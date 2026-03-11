const crypto = require("crypto");
const path = require("path");
const ApiError = require("../utils/api-error");
const env = require("../config/env");
const { createUploadUrl, assertObjectExists } = require("./s3.service");
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
  const s3Key = buildS3Key({
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

module.exports = {
  initiateUploadForFirm,
  initiateUploadWithMagicToken,
  confirmUploadForFirm,
  confirmUploadWithMagicToken,
  markDocumentQueued,
  markDocumentQueueFailure
};
