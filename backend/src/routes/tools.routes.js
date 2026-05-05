const http = require("http");
const https = require("https");
const { Transform } = require("stream");
const { URL } = require("url");
const express = require("express");
const asyncHandler = require("../utils/async-handler");
const { requireAuth } = require("../middlewares/auth.middleware");
const ApiError = require("../utils/api-error");
const env = require("../config/env");

const router = express.Router();
const maxToolUploadBytes = env.MAX_TOOL_UPLOAD_MB * 1024 * 1024;

router.use(requireAuth);

const assertMultipartWithinLimit = (req) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    throw ApiError.badRequest("Request must be multipart/form-data with a 'file' field");
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > maxToolUploadBytes) {
    throw new ApiError(
      413,
      `Tool uploads must be ${env.MAX_TOOL_UPLOAD_MB}MB or smaller`,
      "PAYLOAD_TOO_LARGE"
    );
  }
};

const createByteLimitStream = () => {
  let bytesSeen = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      bytesSeen += chunk.length;
      if (bytesSeen > maxToolUploadBytes) {
        callback(
          new ApiError(
            413,
            `Tool uploads must be ${env.MAX_TOOL_UPLOAD_MB}MB or smaller`,
            "PAYLOAD_TOO_LARGE"
          )
        );
        return;
      }
      callback(null, chunk);
    }
  });
};

const proxyToolRequest = async ({ req, res, pathname, responseContentType }) => {
  assertMultipartWithinLimit(req);

  const aiServiceUrl = new URL(pathname, env.AI_SERVICE_URL);
  if (req.query.company_name) {
    aiServiceUrl.searchParams.set("company_name", req.query.company_name);
  }
  if (req.query.bank_ledger) {
    aiServiceUrl.searchParams.set("bank_ledger", req.query.bank_ledger);
  }

  const isHttps = aiServiceUrl.protocol === "https:";
  const transport = isHttps ? https : http;
  const forwardHeaders = {
    "content-type": req.headers["content-type"]
  };

  if (req.headers["content-length"]) {
    forwardHeaders["content-length"] = req.headers["content-length"];
  }
  if (env.AI_SERVICE_API_KEY) {
    forwardHeaders["x-ai-service-token"] = env.AI_SERVICE_API_KEY;
  }

  await new Promise((resolve, reject) => {
    const proxyReq = transport.request(
      {
        hostname: aiServiceUrl.hostname,
        port: aiServiceUrl.port || (isHttps ? 443 : 80),
        path: aiServiceUrl.pathname + (aiServiceUrl.search || ""),
        method: "POST",
        headers: forwardHeaders,
        timeout: env.AI_SERVICE_TIMEOUT_MS
      },
      (proxyRes) => {
        const status = proxyRes.statusCode || 500;

        if (status !== 200) {
          let body = "";
          proxyRes.setEncoding("utf8");
          proxyRes.on("data", (chunk) => {
            body += chunk;
          });
          proxyRes.on("end", () => {
            let detail = `AI service returned ${status}`;
            try {
              const parsed = JSON.parse(body);
              if (parsed.detail) {
                detail = parsed.detail;
              }
            } catch {
              // Keep generic detail when the upstream body is not JSON.
            }
            if (status === 400 || status === 413 || status === 422) {
              reject(new ApiError(status, detail, status === 413 ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST"));
            } else if (status === 401 || status === 403) {
              reject(new ApiError(502, "AI service rejected backend credentials", "AI_SERVICE_AUTH_FAILED"));
            } else {
              reject(new ApiError(502, detail, "AI_SERVICE_ERROR"));
            }
          });
          return;
        }

        const disposition = proxyRes.headers["content-disposition"];
        res.setHeader("Content-Type", responseContentType);
        if (disposition) {
          res.setHeader("Content-Disposition", disposition);
        }
        if (proxyRes.headers["content-length"]) {
          res.setHeader("Content-Length", proxyRes.headers["content-length"]);
        }

        res.status(200);
        proxyRes.pipe(res, { end: true });
        proxyRes.on("end", resolve);
        proxyRes.on("error", reject);
      }
    );

    const limiter = createByteLimitStream();

    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      reject(new ApiError(504, "AI service timed out while processing the tool request", "GATEWAY_TIMEOUT"));
    });
    proxyReq.on("error", (error) => {
      reject(new ApiError(502, `Could not reach AI service: ${error.message}`, "AI_SERVICE_UNREACHABLE"));
    });
    limiter.on("error", (error) => {
      proxyReq.destroy();
      reject(error);
    });

    req.pipe(limiter).pipe(proxyReq, { end: true });
  });
};

router.post(
  "/register-clean",
  asyncHandler(async (req, res) => {
    await proxyToolRequest({
      req,
      res,
      pathname: "/tools/register-clean",
      responseContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  })
);

router.post(
  "/bank-statement-xml",
  asyncHandler(async (req, res) => {
    await proxyToolRequest({
      req,
      res,
      pathname: "/tools/bank-statement-xml",
      responseContentType: "application/json"
    });
  })
);

module.exports = router;
