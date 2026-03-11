const env = require("../config/env");

const processDocumentWithAiService = async ({ documentId, s3Key, docType, firmId }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.AI_SERVICE_URL}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        document_id: documentId,
        s3_key: s3Key,
        doc_type: docType,
        firm_id: firmId
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
  processDocumentWithAiService
};
