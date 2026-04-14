/**
 * tools.routes.js
 *
 * Authenticated proxy routes for standalone processing tools.
 * All routes require a valid bearer token (requireAuth).
 *
 * POST /api/tools/register-clean
 *   Accepts multipart/form-data with field "file" (.xlsx or .xls).
 *   Proxies the raw multipart body directly to the AI service
 *   /tools/register-clean endpoint and streams the cleaned Excel
 *   file response back to the client.
 *
 *   Because the AI service already speaks multipart/form-data natively
 *   via FastAPI's UploadFile, the simplest and zero-extra-dependency
 *   approach is to forward the raw request body verbatim, preserving the
 *   Content-Type header (which carries the multipart boundary).
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");
const express = require("express");
const asyncHandler = require("../utils/async-handler");
const { requireAuth } = require("../middlewares/auth.middleware");
const ApiError = require("../utils/api-error");
const env = require("../config/env");

const router = express.Router();

// All tools require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// POST /api/tools/register-clean
// ---------------------------------------------------------------------------
router.post(
  "/register-clean",
  asyncHandler(async (req, res) => {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      throw ApiError.badRequest("Request must be multipart/form-data with a 'file' field");
    }

    const aiServiceUrl = new URL("/tools/register-clean", env.AI_SERVICE_URL);
    const isHttps = aiServiceUrl.protocol === "https:";
    const transport = isHttps ? https : http;

    const timeoutMs = env.AI_SERVICE_TIMEOUT_MS || 120000;

    // Forward Content-Length if the client sent it so the AI service can
    // size its buffer correctly.  Content-Type *must* be forwarded verbatim
    // because it contains the multipart boundary string.
    const forwardHeaders = {
      "content-type": contentType,
    };
    if (req.headers["content-length"]) {
      forwardHeaders["content-length"] = req.headers["content-length"];
    }

    await new Promise((resolve, reject) => {
      const proxyReq = transport.request(
        {
          hostname: aiServiceUrl.hostname,
          port: aiServiceUrl.port || (isHttps ? 443 : 80),
          path: aiServiceUrl.pathname + (aiServiceUrl.search || ""),
          method: "POST",
          headers: forwardHeaders,
          timeout: timeoutMs,
        },
        (proxyRes) => {
          const status = proxyRes.statusCode || 500;

          if (status !== 200) {
            // Collect the error body so we can surface a useful message.
            let body = "";
            proxyRes.setEncoding("utf8");
            proxyRes.on("data", (chunk) => { body += chunk; });
            proxyRes.on("end", () => {
              let detail = `AI service returned ${status}`;
              try {
                const parsed = JSON.parse(body);
                if (parsed.detail) detail = parsed.detail;
              } catch {
                // body is not JSON; keep the generic message
              }
              if (status === 400) {
                reject(ApiError.badRequest(detail));
              } else {
                reject(new ApiError(502, detail, "AI_SERVICE_ERROR"));
              }
            });
            return;
          }

          // Success — stream the Excel bytes back to the client, forwarding
          // the relevant headers set by the AI service.
          const disposition = proxyRes.headers["content-disposition"];
          res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
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

      proxyReq.on("timeout", () => {
        proxyReq.destroy();
        reject(new ApiError(504, "AI service timed out while cleaning the register", "GATEWAY_TIMEOUT"));
      });

      proxyReq.on("error", (err) => {
        reject(new ApiError(502, `Could not reach AI service: ${err.message}`, "AI_SERVICE_UNREACHABLE"));
      });

      // Pipe the raw multipart body from the client request into the proxy request.
      req.pipe(proxyReq, { end: true });
    });
  })
);

module.exports = router;
