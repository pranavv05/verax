const ApiError = require("../utils/api-error");
const { enqueueDocumentProcessingJob } = require("./document-queue.service");
const { snapshotDocument } = require("./document-versions.service");

const insertAuditLog = async (db, { firmId, userId, action, entityType, entityId, metadata }) => {
  await db.query(
    `INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [firmId, userId ?? null, action, entityType, entityId ?? null, JSON.stringify(metadata || {})]
  );
};

const assertDocumentBelongsToFirm = async (db, { firmId, documentId }) => {
  const result = await db.query(
    `SELECT id, client_id, status, s3_key, doc_type
     FROM documents
     WHERE id = $1 AND firm_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [documentId, firmId]
  );
  if (result.rowCount === 0) {
    throw ApiError.notFound("Document not found");
  }
  return result.rows[0];
};

const getExtraction = async (db, { firmId, documentId }) => {
  await assertDocumentBelongsToFirm(db, { firmId, documentId });

  const result = await db.query(
    `SELECT e.id, e.document_id, e.raw_text, e.structured_data, e.confidence_score,
            e.reviewed_by, e.reviewed_at, e.created_at, e.updated_at,
            d.status AS document_status, d.doc_type, d.file_name, d.processing_error
     FROM extractions e
     JOIN documents d ON d.id = e.document_id
     WHERE e.document_id = $1 AND e.deleted_at IS NULL
     LIMIT 1`,
    [documentId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    documentId: row.document_id,
    structuredData: row.structured_data || {},
    rawText: row.raw_text,
    confidenceScore: row.confidence_score,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documentStatus: row.document_status,
    docType: row.doc_type,
    fileName: row.file_name,
    processingError: row.processing_error
  };
};

const snapshotCurrentExtraction = async (db, { documentId, snapshotReason, createdBy }) => {
  try {
    const result = await db.query(
      `
        SELECT structured_data
        FROM extractions
        WHERE document_id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [documentId]
    );

    if (result.rowCount > 0) {
      await snapshotDocument({
        documentId,
        extractedData: result.rows[0].structured_data || {},
        snapshotReason,
        createdBy,
        trx: db
      });
    }
  } catch (error) {
    console.error(
      `Failed to snapshot document ${documentId} (${snapshotReason}):`,
      error.message || error
    );
  }
};

const updateExtraction = async (db, { firmId, documentId, structuredData, userId = null }) => {
  const doc = await assertDocumentBelongsToFirm(db, { firmId, documentId });

  if (doc.status === "exported" || doc.status === "reviewed") {
    throw ApiError.badRequest(
      "Cannot edit an extraction that has already been approved or exported. Reprocess it first."
    );
  }

  await snapshotCurrentExtraction(db, {
    documentId,
    snapshotReason: "pre_edit",
    createdBy: userId
  });

  const result = await db.query(
    `UPDATE extractions
     SET structured_data = $1::jsonb,
         updated_at = NOW()
     WHERE document_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [JSON.stringify(structuredData), documentId]
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound("Extraction not found — document may not have been processed yet");
  }

  await insertAuditLog(db, {
    firmId,
    userId,
    action: "extraction_updated",
    entityType: "document",
    entityId: documentId,
    metadata: {}
  });

  return { success: true };
};

const approveExtraction = async (db, { firmId, documentId, userId, nameMappingService }) => {
  const doc = await assertDocumentBelongsToFirm(db, { firmId, documentId });

  if (!["extracted", "review_required", "reviewed"].includes(doc.status)) {
    throw ApiError.badRequest(
      `Cannot approve a document with status '${doc.status}'. Document must be in 'extracted' or 'review_required' state.`
    );
  }

  await snapshotCurrentExtraction(db, {
    documentId,
    snapshotReason: "pre_approval",
    createdBy: userId
  });

  const extractionResult = await db.query(
    `UPDATE extractions
     SET reviewed_by = $1,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE document_id = $2 AND deleted_at IS NULL
     RETURNING id, structured_data`,
    [userId, documentId]
  );

  if (extractionResult.rowCount === 0) {
    throw ApiError.notFound("Extraction not found");
  }

  await db.query(
    `UPDATE documents SET status = 'reviewed', updated_at = NOW()
     WHERE id = $1 AND firm_id = $2 AND deleted_at IS NULL`,
    [documentId, firmId]
  );

  // Save name mappings for any corrected line items
  if (nameMappingService) {
    const structuredData = extractionResult.rows[0].structured_data || {};
    const lineItems = Array.isArray(structuredData.line_items) ? structuredData.line_items : [];
    for (const item of lineItems) {
      const rawName = item.description;
      const tallyName = item.tally_item_name;
      if (rawName && tallyName && rawName.trim() !== tallyName.trim()) {
        await nameMappingService.upsertMapping(db, { firmId, vendorRaw: rawName.trim(), tallyName: tallyName.trim() });
      }
    }
  }

  await insertAuditLog(db, {
    firmId,
    userId,
    action: "extraction_approved",
    entityType: "document",
    entityId: documentId,
    metadata: {}
  });

  return { success: true, documentId, status: "reviewed" };
};

const reprocessDocument = async (db, { firmId, documentId, userId }) => {
  const doc = await assertDocumentBelongsToFirm(db, { firmId, documentId });

  if (doc.status === "exported") {
    throw ApiError.badRequest("Cannot reprocess a document that has already been exported");
  }

  await snapshotCurrentExtraction(db, {
    documentId,
    snapshotReason: "reprocess",
    createdBy: userId
  });

  // processing_attempts restarts with the new job: the permanent-failure
  // alert fires at attempt >= 3, so carrying the old count over would email
  // admins on every retry of the fresh job instead of once after the last.
  await db.query(
    `UPDATE documents
     SET status = 'uploaded', processing_error = NULL, processing_attempts = 0, updated_at = NOW()
     WHERE id = $1 AND firm_id = $2 AND deleted_at IS NULL`,
    [documentId, firmId]
  );

  const jobId = await enqueueDocumentProcessingJob({
    documentId,
    s3Key: doc.s3_key,
    docType: doc.doc_type,
    firmId,
    clientId: doc.client_id
  });

  await insertAuditLog(db, {
    firmId,
    userId,
    action: "document_reprocess_requested",
    entityType: "document",
    entityId: documentId,
    metadata: { jobId }
  });

  return { success: true, jobId };
};

module.exports = {
  getExtraction,
  updateExtraction,
  approveExtraction,
  reprocessDocument
};
