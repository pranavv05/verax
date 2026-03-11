const ApiError = require("../utils/api-error");

const insertAuditLog = async (db, { firmId, userId, action, entityType, entityId, metadata }) => {
  await db.query(
    `
      INSERT INTO audit_logs (
        firm_id,
        user_id,
        action,
        entity_type,
        entity_id,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [firmId, userId ?? null, action, entityType, entityId ?? null, JSON.stringify(metadata || {})]
  );
};

const normalizeConfidenceScore = (input) => {
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.max(0, Math.min(1, numeric));
};

const markDocumentProcessingStarted = async (db, { firmId, documentId }) => {
  const result = await db.query(
    `
      UPDATE documents
      SET status = 'processing',
          processing_error = NULL
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
      RETURNING id, client_id
    `,
    [documentId, firmId]
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound("Document not found for processing");
  }

  return result.rows[0];
};

const markDocumentProcessingSucceeded = async (
  db,
  { firmId, documentId, structuredData, rawText, confidenceScore }
) => {
  await db.query(
    `
      INSERT INTO extractions (
        document_id,
        raw_text,
        structured_data,
        confidence_score,
        reviewed_by,
        reviewed_at,
        deleted_at
      ) VALUES ($1, $2, $3::jsonb, $4, NULL, NULL, NULL)
      ON CONFLICT (document_id)
      DO UPDATE SET
        raw_text = EXCLUDED.raw_text,
        structured_data = EXCLUDED.structured_data,
        confidence_score = EXCLUDED.confidence_score,
        reviewed_by = NULL,
        reviewed_at = NULL,
        deleted_at = NULL
    `,
    [documentId, rawText ?? null, JSON.stringify(structuredData || {}), confidenceScore]
  );

  const updateResult = await db.query(
    `
      UPDATE documents
      SET status = 'extracted',
          processing_error = NULL
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
      RETURNING id, client_id
    `,
    [documentId, firmId]
  );

  if (updateResult.rowCount === 0) {
    throw ApiError.notFound("Document not found while finalizing extraction");
  }

  await insertAuditLog(db, {
    firmId,
    userId: null,
    action: "document_processed",
    entityType: "document",
    entityId: documentId,
    metadata: {
      confidenceScore
    }
  });
};

const markDocumentProcessingFailed = async (
  db,
  { firmId, documentId, errorMessage, jobId }
) => {
  const normalizedError = String(errorMessage || "Document processing failed").slice(0, 1000);

  const updateResult = await db.query(
    `
      UPDATE documents
      SET status = 'uploaded',
          processing_attempts = processing_attempts + 1,
          processing_error = $3
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
      RETURNING processing_attempts, client_id
    `,
    [documentId, firmId, normalizedError]
  );

  if (updateResult.rowCount === 0) {
    throw ApiError.notFound("Document not found while marking failure");
  }

  const row = updateResult.rows[0];
  const attempt = Number(row.processing_attempts);

  await insertAuditLog(db, {
    firmId,
    userId: null,
    action: "document_processing_failed",
    entityType: "document",
    entityId: documentId,
    metadata: {
      attempt,
      jobId,
      error: normalizedError
    }
  });

  let alertTriggered = false;
  if (attempt >= 3) {
    alertTriggered = true;
    await insertAuditLog(db, {
      firmId,
      userId: null,
      action: "document_processing_alert",
      entityType: "document",
      entityId: documentId,
      metadata: {
        attempt,
        jobId,
        error: normalizedError
      }
    });
  }

  return {
    attempt,
    alertTriggered
  };
};

const parseAiResponse = (payload) => ({
  structuredData:
    payload && typeof payload.structured_data === "object" && payload.structured_data !== null
      ? payload.structured_data
      : {},
  rawText: payload && typeof payload.raw_text === "string" ? payload.raw_text : null,
  confidenceScore: normalizeConfidenceScore(payload ? payload.confidence_score : null)
});

module.exports = {
  parseAiResponse,
  markDocumentProcessingStarted,
  markDocumentProcessingSucceeded,
  markDocumentProcessingFailed
};
