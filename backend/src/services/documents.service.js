const crypto = require("crypto");
const path = require("path");
const ApiError = require("../utils/api-error");
const env = require("../config/env");
const { createUploadUrl, assertObjectExists, createDownloadUrl } = require("./s3.service");
const { assertAllowedFile } = require("../utils/upload-validation");
const { withTenantTransaction, setLocalConfig } = require("../db/tenant-context");

const DOC_TYPES = new Set(["invoice", "bank_statement", "bill", "other"]);

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

const normalizeFileNameForKey = (fileName) =>
  fileName
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

const buildS3Key = ({ firmId, clientId, documentId, fileName }) => {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeName = normalizeFileNameForKey(path.basename(fileName));
  return `firms/${firmId}/clients/${clientId}/documents/${year}/${month}/${documentId}/${safeName}`;
};

const buildStorageKey = ({ firmId, clientId, documentId, fileName }) => {
  const safeName = normalizeFileNameForKey(path.basename(fileName));
  if (env.LOCAL_STORAGE) {
    return `${documentId}-${safeName}`;
  }
  return buildS3Key({ firmId, clientId, documentId, fileName: safeName });
};

const getClientForFirm = async (db, { firmId, clientId }) => {
  const result = await db.query(
    `
      SELECT id, firm_id, name, status
      FROM clients
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [clientId, firmId]
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound("Client not found");
  }

  const client = result.rows[0];
  if (client.status === "inactive") {
    throw ApiError.badRequest("Cannot upload documents for an inactive client");
  }

  return client;
};

const getClientByMagicToken = async (db, token) => {
  const result = await db.query(
    `
      SELECT id, firm_id, name, status, upload_token_expires_at
      FROM clients
      WHERE upload_token = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [token]
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound("Magic link is invalid or expired");
  }

  const client = result.rows[0];
  if (client.status === "inactive") {
    throw ApiError.badRequest("Cannot upload documents for an inactive client");
  }

  if (
    !client.upload_token_expires_at ||
    new Date(client.upload_token_expires_at) <= new Date()
  ) {
    throw ApiError.notFound("Magic link is invalid or expired");
  }

  return client;
};

const createUploadSession = async (
  db,
  { firmId, clientId, userId, source, fileName, fileType, fileSize, docType }
) => {
  if (!DOC_TYPES.has(docType)) {
    throw ApiError.badRequest("Invalid document type");
  }

  const safeFileName = assertAllowedFile({ fileName, fileType, fileSize });
  const documentId = crypto.randomUUID();
  const s3Key = buildStorageKey({
    firmId,
    clientId,
    documentId,
    fileName: safeFileName
  });

  await db.query(
    `
      INSERT INTO document_upload_sessions (
        id,
        firm_id,
        client_id,
        created_by,
        source,
        file_name,
        file_type,
        file_size,
        doc_type,
        s3_key,
        upload_expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        NOW() + make_interval(secs => $11::integer)
      )
    `,
    [
      documentId,
      firmId,
      clientId,
      userId ?? null,
      source,
      safeFileName,
      fileType,
      fileSize,
      docType,
      s3Key,
      env.UPLOAD_URL_EXPIRY_SECONDS
    ]
  );

  const upload = await createUploadUrl({
    key: s3Key,
    contentType: fileType
  });

  await insertAuditLog(db, {
    firmId,
    userId,
    action: "document_upload_initiated",
    entityType: "document_upload_session",
    entityId: documentId,
    metadata: {
      clientId,
      fileName: safeFileName,
      docType,
      source
    }
  });

  return {
    upload_url: upload.url,
    document_id: documentId,
    expires_in: upload.expiresIn
  };
};

const initiateUploadForFirm = async (
  db,
  { firmId, userId, clientId, fileName, fileType, fileSize, docType }
) => {
  await getClientForFirm(db, { firmId, clientId });

  return createUploadSession(db, {
    firmId,
    clientId,
    userId,
    source: "auth",
    fileName,
    fileType,
    fileSize,
    docType
  });
};

const initiateUploadWithMagicToken = async ({
  token,
  fileName,
  fileType,
  fileSize,
  docType
}) =>
  withTenantTransaction(
    {
      authContext: "magic_link",
      uploadToken: token
    },
    async (db) => {
      const client = await getClientByMagicToken(db, token);
      await setLocalConfig(db, "app.current_firm_id", client.firm_id);

      return createUploadSession(db, {
        firmId: client.firm_id,
        clientId: client.id,
        userId: null,
        source: "magic",
        fileName,
        fileType,
        fileSize,
        docType
      });
    }
  );

const getUploadSessionForConfirmation = async (
  db,
  { documentId, firmId, expectedClientId = null }
) => {
  const values = [documentId, firmId];
  let clientFilterSql = "";
  if (expectedClientId) {
    values.push(expectedClientId);
    clientFilterSql = ` AND client_id = $3`;
  }

  const result = await db.query(
    `
      SELECT
        id,
        firm_id,
        client_id,
        created_by,
        source,
        file_name,
        file_type,
        file_size,
        doc_type,
        s3_key,
        upload_expires_at,
        confirmed_at
      FROM document_upload_sessions
      WHERE id = $1
        AND firm_id = $2
        ${clientFilterSql}
        AND deleted_at IS NULL
      LIMIT 1
    `,
    values
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound("Upload session not found");
  }

  return result.rows[0];
};

const mapDocumentResponse = (row) => ({
  id: row.id,
  clientId: row.client_id,
  firmId: row.firm_id,
  fileName: row.file_name,
  s3Key: row.s3_key,
  docType: row.doc_type,
  status: row.status,
  uploadedAt: row.uploaded_at
});

const confirmUploadForFirm = async (
  db,
  { firmId, userId, documentId, expectedClientId = null, source = "auth" }
) => {
  const session = await getUploadSessionForConfirmation(db, {
    documentId,
    firmId,
    expectedClientId
  });

  if (session.confirmed_at) {
    const existingDocument = await db.query(
      `
        SELECT id, client_id, firm_id, file_name, s3_key, doc_type, status, uploaded_at
        FROM documents
        WHERE id = $1
          AND firm_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [session.id, firmId]
    );

    if (existingDocument.rowCount > 0) {
      return {
        document: mapDocumentResponse(existingDocument.rows[0]),
        queuePayload: {
          documentId: existingDocument.rows[0].id,
          s3Key: existingDocument.rows[0].s3_key,
          docType: existingDocument.rows[0].doc_type,
          firmId,
          clientId: existingDocument.rows[0].client_id
        },
        alreadyConfirmed: true
      };
    }
  }

  if (new Date(session.upload_expires_at).getTime() < Date.now()) {
    throw ApiError.badRequest("Upload session has expired");
  }

  await assertObjectExists({ key: session.s3_key });

  const insertResult = await db.query(
    `
      INSERT INTO documents (
        id,
        client_id,
        firm_id,
        file_name,
        s3_key,
        doc_type,
        status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'uploaded'
      )
      ON CONFLICT (id) DO UPDATE
      SET
        client_id = EXCLUDED.client_id,
        firm_id = EXCLUDED.firm_id,
        file_name = EXCLUDED.file_name,
        s3_key = EXCLUDED.s3_key,
        doc_type = EXCLUDED.doc_type
      RETURNING id, client_id, firm_id, file_name, s3_key, doc_type, status, uploaded_at
    `,
    [
      session.id,
      session.client_id,
      session.firm_id,
      session.file_name,
      session.s3_key,
      session.doc_type
    ]
  );

  await db.query(
    `
      UPDATE document_upload_sessions
      SET confirmed_at = COALESCE(confirmed_at, NOW())
      WHERE id = $1
        AND firm_id = $2
    `,
    [session.id, firmId]
  );

  await insertAuditLog(db, {
    firmId,
    userId,
    action: "document_upload_confirmed",
    entityType: "document",
    entityId: session.id,
    metadata: {
      clientId: session.client_id,
      source
    }
  });

  const document = insertResult.rows[0];
  return {
    document: mapDocumentResponse(document),
    queuePayload: {
      documentId: document.id,
      s3Key: document.s3_key,
      docType: document.doc_type,
      firmId: document.firm_id,
      clientId: document.client_id
    },
    alreadyConfirmed: false
  };
};

const rotateMagicTokenIfNeeded = async (db, { firmId, clientId }) => {
  if (!env.MAGIC_LINK_SINGLE_USE) {
    return null;
  }

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const newToken = crypto.randomBytes(32).toString("hex");
    try {
      const updateResult = await db.query(
        `
          UPDATE clients
          SET upload_token = $1,
              upload_token_expires_at = NOW() + make_interval(hours => $2::integer)
          WHERE id = $3
            AND firm_id = $4
            AND deleted_at IS NULL
          RETURNING upload_token, upload_token_expires_at
        `,
        [newToken, env.MAGIC_LINK_EXPIRY_HOURS, clientId, firmId]
      );

      if (updateResult.rowCount === 0) {
        throw ApiError.notFound("Client not found");
      }

      return {
        uploadToken: updateResult.rows[0].upload_token,
        uploadTokenExpiresAt: updateResult.rows[0].upload_token_expires_at
      };
    } catch (error) {
      if (error.code === "23505" && attempt < maxAttempts) {
        continue;
      }
      throw error;
    }
  }

  throw ApiError.conflict("Unable to rotate upload token");
};

const confirmUploadWithMagicToken = async ({ token, documentId }) =>
  withTenantTransaction(
    {
      authContext: "magic_link",
      uploadToken: token
    },
    async (db) => {
      const client = await getClientByMagicToken(db, token);
      await setLocalConfig(db, "app.current_firm_id", client.firm_id);

      const confirmation = await confirmUploadForFirm(db, {
        firmId: client.firm_id,
        userId: null,
        documentId,
        expectedClientId: client.id,
        source: "magic"
      });

      const rotation = await rotateMagicTokenIfNeeded(db, {
        firmId: client.firm_id,
        clientId: client.id
      });

      return {
        ...confirmation,
        tokenRotation: rotation
      };
    }
  );

const markDocumentQueued = async (db, { firmId, documentId }) => {
  await db.query(
    `
      UPDATE documents
      SET status = 'processing',
          processing_error = NULL
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
    `,
    [documentId, firmId]
  );
};

const markDocumentQueueFailure = async (db, { firmId, documentId, errorMessage }) => {
  const normalizedError = String(errorMessage || "Queue enqueue failed");
  await db.query(
    `
      UPDATE documents
      SET status = 'uploaded',
          processing_attempts = processing_attempts + 1,
          processing_error = $3
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
    `,
    [documentId, firmId, normalizedError.slice(0, 1000)]
  );
};

const VALID_STATUSES = new Set([
  "uploaded",
  "processing",
  "extracted",
  "review_required",
  "reviewed",
  "exported"
]);
const VALID_DOC_TYPES = new Set(["invoice", "bank_statement", "bill", "other"]);

const listDocuments = async (db, { firmId, clientId, status, docType, page = 1, limit = 50 }) => {
  if (status && !VALID_STATUSES.has(status)) {
    throw ApiError.badRequest("Invalid status filter");
  }
  if (docType && !VALID_DOC_TYPES.has(docType)) {
    throw ApiError.badRequest("Invalid doc_type filter");
  }

  const filters = ["d.firm_id = $1", "d.deleted_at IS NULL"];
  const values = [firmId];
  let idx = 2;

  if (clientId) {
    filters.push(`d.client_id = $${idx}`);
    values.push(clientId);
    idx += 1;
  }
  if (status) {
    filters.push(`d.status = $${idx}`);
    values.push(status);
    idx += 1;
  }
  if (docType) {
    filters.push(`d.doc_type = $${idx}`);
    values.push(docType);
    idx += 1;
  }

  const whereClause = filters.join(" AND ");
  const safeLimit = Math.min(Number(limit) || 50, 200);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * safeLimit;

  const [countResult, rowsResult] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total FROM documents d WHERE ${whereClause}`, values),
    db.query(
      `SELECT d.id, d.client_id, d.firm_id, d.file_name, d.s3_key,
              d.doc_type, d.status, d.processing_error, d.uploaded_at, d.updated_at
       FROM documents d
       WHERE ${whereClause}
       ORDER BY d.uploaded_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, safeLimit, offset]
    )
  ]);

  const total = countResult.rows[0].total;
  return {
    data: rowsResult.rows.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      firmId: row.firm_id,
      fileName: row.file_name,
      docType: row.doc_type,
      status: row.status,
      processingError: row.processing_error,
      uploadedAt: row.uploaded_at,
      updatedAt: row.updated_at
    })),
    pagination: {
      page: Math.max(Number(page) || 1, 1),
      limit: safeLimit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / safeLimit)
    }
  };
};

const getDocumentById = async (db, { firmId, documentId }) => {
  const result = await db.query(
    `SELECT id, client_id, firm_id, file_name, s3_key, doc_type, status,
            processing_error, processing_attempts, gstr2b_match_status,
            gstr2b_match_details, uploaded_at, updated_at
     FROM documents
     WHERE id = $1 AND firm_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [documentId, firmId]
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound("Document not found");
  }

  const row = result.rows[0];
  const { url: downloadUrl } = await createDownloadUrl({ key: row.s3_key });

  return {
    id: row.id,
    clientId: row.client_id,
    firmId: row.firm_id,
    fileName: row.file_name,
    docType: row.doc_type,
    status: row.status,
    processingError: row.processing_error,
    processingAttempts: row.processing_attempts,
    gstr2bMatchStatus: row.gstr2b_match_status,
    gstr2bMatchDetails: row.gstr2b_match_details,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at,
    download_url: downloadUrl
  };
};

const deleteDocument = async (db, { firmId, userId, documentId }) => {
  const documentResult = await db.query(
    `
      SELECT id, status, s3_key
      FROM documents
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [documentId, firmId]
  );

  if (documentResult.rowCount === 0) {
    throw ApiError.notFound("Document not found");
  }

  const document = documentResult.rows[0];
  if (document.status === "exported") {
    throw ApiError.badRequest("Cannot delete a document that has already been exported");
  }

  await db.query(
    `
      UPDATE documents
      SET deleted_at = NOW()
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
    `,
    [documentId, firmId]
  );

  await db.query(
    `
      UPDATE extractions
      SET deleted_at = NOW()
      WHERE document_id = $1
        AND deleted_at IS NULL
    `,
    [documentId]
  );

  await insertAuditLog(db, {
    firmId,
    userId,
    action: "document_deleted",
    entityType: "document",
    entityId: documentId,
    metadata: {
      status: document.status
    }
  });

  return { success: true };
};

module.exports = {
  initiateUploadForFirm,
  initiateUploadWithMagicToken,
  confirmUploadForFirm,
  confirmUploadWithMagicToken,
  markDocumentQueued,
  markDocumentQueueFailure,
  listDocuments,
  getDocumentById,
  deleteDocument
};
