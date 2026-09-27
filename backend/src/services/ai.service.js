const env = require("../config/env");

/**
 * The AI service is down, restarting or shedding load — not a problem with
 * this document. The worker waits and tries again without spending one of
 * the document's own retries (see document-job.processor.js), so a deploy or
 * a PaddleOCR model reload can't permanently fail every upload in flight.
 */
class AiServiceUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "AiServiceUnavailableError";
    this.transient = true;
  }
}

// 502/503/504: the platform's proxy answering for a service that's down or
// restarting. 429: the service (or Groq behind it) asking us to back off.
const UNAVAILABLE_STATUSES = new Set([429, 502, 503, 504]);

const isNetworkFailure = (error) =>
  error && error.name !== "AbortError" && (error instanceof TypeError || Boolean(error.cause && error.cause.code));

const processDocumentWithAiService = async ({ documentId, s3Key, docType, firmId }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_SERVICE_TIMEOUT_MS);
  const headers = {
    "Content-Type": "application/json"
  };

  if (env.AI_SERVICE_API_KEY) {
    headers["X-AI-Service-Token"] = env.AI_SERVICE_API_KEY;
  }

  try {
    let response;
    try {
      response = await fetch(`${env.AI_SERVICE_URL}/process`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          document_id: documentId,
          s3_key: s3Key,
          doc_type: docType,
          firm_id: firmId
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (isNetworkFailure(error)) {
        const code = (error.cause && error.cause.code) || error.message;
        throw new AiServiceUnavailableError(`AI service unreachable (${code})`);
      }
      throw error;
    }

    const bodyText = await response.text();
    let parsedBody = null;
    if (bodyText) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch (error) {
        parsedBody = null;
      }
    }

    if (!response.ok) {
      const message =
        (parsedBody && parsedBody.message) ||
        (parsedBody && parsedBody.detail) ||
        bodyText ||
        `AI service failed with status ${response.status}`;
      if (UNAVAILABLE_STATUSES.has(response.status)) {
        throw new AiServiceUnavailableError(
          `AI service unavailable (${response.status}): ${String(message).slice(0, 500)}`
        );
      }
      throw new Error(String(message).slice(0, 1000));
    }

    if (!parsedBody || typeof parsedBody !== "object") {
      throw new Error("AI service returned an invalid JSON response");
    }

    return parsedBody;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("AI service request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const generateBankStatementXmlExport = async ({ transactions, companyName, bankLedger }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_SERVICE_TIMEOUT_MS);
  const headers = {
    "Content-Type": "application/json"
  };

  if (env.AI_SERVICE_API_KEY) {
    headers["X-AI-Service-Token"] = env.AI_SERVICE_API_KEY;
  }

  try {
    const response = await fetch(`${env.AI_SERVICE_URL}/tools/bank-statement-xml/export`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        transactions,
        company_name: companyName || "My Company",
        bank_ledger: bankLedger || "Bank Account"
      }),
      signal: controller.signal
    });

    const bodyText = await response.text();
    let parsedBody = null;
    if (bodyText) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch (error) {
        parsedBody = null;
      }
    }

    if (!response.ok) {
      const message =
        (parsedBody && parsedBody.message) ||
        (parsedBody && parsedBody.detail) ||
        bodyText ||
        `AI service failed with status ${response.status}`;
      throw new Error(String(message).slice(0, 1000));
    }

    if (!parsedBody || typeof parsedBody !== "object") {
      throw new Error("AI service returned an invalid JSON response");
    }

    return parsedBody;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("AI service request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  AiServiceUnavailableError,
  processDocumentWithAiService,
  generateBankStatementXmlExport
};
