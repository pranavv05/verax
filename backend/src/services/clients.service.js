const crypto = require("crypto");
const ApiError = require("../utils/api-error");
const env = require("../config/env");
const { sendEmail } = require("./email.service");
const {
  clientMagicLinkSubject,
  clientMagicLinkTemplate
} = require("../templates/clientMagicLink.template");

const ALLOWED_STATUSES = new Set(["active", "inactive", "pending"]);

const toClientResponse = (row) => ({
  id: row.id,
  firmId: row.firm_id,
  name: row.name,
  gstin: row.gstin,
  email: row.email,
  phone: row.phone,
  uploadToken: row.upload_token,
  uploadTokenExpiresAt: row.upload_token_expires_at,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const createUploadToken = () => crypto.randomBytes(32).toString("hex");

const DEFAULT_REQUESTED_DOCUMENT_TYPES = [
  "Invoices",
  "Bills",
  "Bank statements",
  "Supporting documents"
];

const DOCUMENT_TYPE_LABELS = {
  invoice: "Invoices",
  bill: "Bills",
  bank_statement: "Bank statements",
  other: "Supporting documents"
};

const toRequestedDocumentLabels = (documentTypes) =>
  Array.isArray(documentTypes) && documentTypes.length > 0
    ? documentTypes.map((type) => DOCUMENT_TYPE_LABELS[type] || type)
    : DEFAULT_REQUESTED_DOCUMENT_TYPES;

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

const listClients = async (db, { firmId, page, limit, status, search }) => {
  const offset = (page - 1) * limit;
  const filters = ["c.firm_id = $1", "c.deleted_at IS NULL"];
  const params = [firmId];
  let paramIndex = params.length + 1;

  if (status) {
    if (!ALLOWED_STATUSES.has(status)) {
      throw ApiError.badRequest("Invalid client status filter");
    }
    filters.push(`c.status = $${paramIndex}`);
    params.push(status);
    paramIndex += 1;
  }

  if (search) {
    filters.push(
      `(c.name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.gstin ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex})`
    );
    params.push(`%${search}%`);
    paramIndex += 1;
  }

  const whereClause = filters.join(" AND ");

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM clients c
      WHERE ${whereClause}
    `,
    params
  );

  // Single indexed aggregate (idx_documents_firm_id), grouped by client — one extra
  // round trip for the whole page, not one query per row, so this stays cheap even
  // at 100+ clients.
  const rowsResult = await db.query(
    `
      SELECT c.id, c.firm_id, c.name, c.gstin, c.email, c.phone, c.upload_token,
             c.upload_token_expires_at, c.status, c.created_at, c.updated_at,
             COALESCE(doc_stats.total_documents, 0) AS total_documents,
             COALESCE(doc_stats.pending_documents, 0) AS pending_documents,
             doc_stats.last_activity_at
      FROM clients c
      LEFT JOIN (
        SELECT client_id,
               COUNT(*)::int AS total_documents,
               COUNT(*) FILTER (WHERE status IN ('extracted', 'review_required'))::int AS pending_documents,
               MAX(uploaded_at) AS last_activity_at
        FROM documents
        WHERE firm_id = $1 AND deleted_at IS NULL
        GROUP BY client_id
      ) doc_stats ON doc_stats.client_id = c.id
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `,
    [...params, limit, offset]
  );

  return {
    data: rowsResult.rows.map((row) => ({
      ...toClientResponse(row),
      documentSummary: {
        totalDocuments: row.total_documents,
        pendingDocuments: row.pending_documents,
        lastActivityAt: row.last_activity_at
      }
    })),
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      totalPages:
        countResult.rows[0].total === 0
          ? 0
          : Math.ceil(countResult.rows[0].total / limit)
    }
  };
};

const createClient = async (db, { firmId, payload, actorUserId }) => {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const uploadToken = createUploadToken();
    try {
      const createResult = await db.query(
        `
          INSERT INTO clients (
            firm_id,
            name,
            gstin,
            email,
            phone,
            upload_token,
            upload_token_expires_at,
            status
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            NOW() + make_interval(hours => $7::integer),
            $8
          )
          RETURNING id, firm_id, name, gstin, email, phone, upload_token, upload_token_expires_at, status, created_at, updated_at
        `,
        [
          firmId,
          payload.name,
          payload.gstin ?? null,
          payload.email ?? null,
          payload.phone ?? null,
          uploadToken,
          env.MAGIC_LINK_EXPIRY_HOURS,
          payload.status || "active"
        ]
      );

      const clientRow = createResult.rows[0];
      await insertAuditLog(db, {
        firmId,
        userId: actorUserId,
        action: "client_created",
        entityType: "client",
        entityId: clientRow.id,
        metadata: { name: clientRow.name, status: clientRow.status }
      });

      return toClientResponse(clientRow);
    } catch (error) {
      if (error.code === "23505" && attempt < maxAttempts) {
        continue;
      }
      throw error;
    }
  }

  throw ApiError.conflict("Could not generate a unique upload token");
};

const getClientById = async (db, { firmId, clientId }) => {
  const clientResult = await db.query(
    `
      SELECT id, firm_id, name, gstin, email, phone, upload_token, upload_token_expires_at, status,
             portal_email, portal_enabled, portal_last_login_at, created_at, updated_at
      FROM clients
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [clientId, firmId]
  );

  if (clientResult.rowCount === 0) {
    throw ApiError.notFound("Client not found");
  }

  const summaryResult = await db.query(
    `
      SELECT
        COUNT(*)::int AS total_documents,
        COUNT(*) FILTER (WHERE status = 'uploaded')::int AS uploaded_documents,
        COUNT(*) FILTER (WHERE status = 'processing')::int AS processing_documents,
        COUNT(*) FILTER (WHERE status = 'extracted')::int AS extracted_documents,
        COUNT(*) FILTER (WHERE status = 'reviewed')::int AS reviewed_documents,
        COUNT(*) FILTER (WHERE status = 'exported')::int AS exported_documents,
        MAX(uploaded_at) AS last_uploaded_at
      FROM documents
      WHERE firm_id = $1
        AND client_id = $2
        AND deleted_at IS NULL
    `,
    [firmId, clientId]
  );

  const clientRow = clientResult.rows[0];
  const client = toClientResponse(clientRow);
  const summary = summaryResult.rows[0];

  return {
    ...client,
    // Portal credentials themselves (portal_password_hash) are never selected
    // or returned — only whether the portal is on, and for whom.
    portal: {
      enabled: Boolean(clientRow.portal_enabled),
      email: clientRow.portal_email,
      lastLoginAt: clientRow.portal_last_login_at
    },
    documentSummary: {
      totalDocuments: summary.total_documents,
      uploadedDocuments: summary.uploaded_documents,
      processingDocuments: summary.processing_documents,
      extractedDocuments: summary.extracted_documents,
      reviewedDocuments: summary.reviewed_documents,
      exportedDocuments: summary.exported_documents,
      lastUploadedAt: summary.last_uploaded_at
    }
  };
};

const updateClient = async (db, { firmId, clientId, payload, actorUserId }) => {
  const fields = [];
  const values = [];
  let index = 1;

  const pushField = (columnName, value) => {
    fields.push(`${columnName} = $${index}`);
    values.push(value);
    index += 1;
  };

  if (Object.prototype.hasOwnProperty.call(payload, "name")) {
    pushField("name", payload.name);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "gstin")) {
    pushField("gstin", payload.gstin || null);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "email")) {
    pushField("email", payload.email || null);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "phone")) {
    pushField("phone", payload.phone || null);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    pushField("status", payload.status);
  }

  if (fields.length === 0) {
    throw ApiError.badRequest("No valid fields provided for update");
  }

  values.push(clientId, firmId);
  const updateResult = await db.query(
    `
      UPDATE clients
      SET ${fields.join(", ")}
      WHERE id = $${index}
        AND firm_id = $${index + 1}
        AND deleted_at IS NULL
      RETURNING id, firm_id, name, gstin, email, phone, upload_token, upload_token_expires_at, status, created_at, updated_at
    `,
    values
  );

  if (updateResult.rowCount === 0) {
    throw ApiError.notFound("Client not found");
  }

  const updatedClient = updateResult.rows[0];
  await insertAuditLog(db, {
    firmId,
    userId: actorUserId,
    action: "client_updated",
    entityType: "client",
    entityId: clientId,
    metadata: { updatedFields: Object.keys(payload) }
  });

  return toClientResponse(updatedClient);
};

const deleteClient = async (db, { firmId, clientId, actorUserId }) => {
  const deleteResult = await db.query(
    `
      UPDATE clients
      SET deleted_at = NOW()
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
      RETURNING id
    `,
    [clientId, firmId]
  );

  if (deleteResult.rowCount === 0) {
    throw ApiError.notFound("Client not found");
  }

  await insertAuditLog(db, {
    firmId,
    userId: actorUserId,
    action: "client_deleted",
    entityType: "client",
    entityId: clientId,
    metadata: {}
  });
};

const requestClientDocuments = async (db, { firmId, clientId, actorUserId, documentTypes }) => {
  const clientResult = await db.query(
    `
      SELECT c.id, c.name, c.email, c.status, f.name AS firm_name
      FROM clients c
      JOIN firms f ON f.id = c.firm_id
      WHERE c.id = $1
        AND c.firm_id = $2
        AND c.deleted_at IS NULL
        AND f.deleted_at IS NULL
      LIMIT 1
    `,
    [clientId, firmId]
  );

  if (clientResult.rowCount === 0) {
    throw ApiError.notFound("Client not found");
  }

  const client = clientResult.rows[0];
  if (client.status === "inactive") {
    throw ApiError.badRequest("Cannot request documents for an inactive client");
  }

  const shouldRotateToken = env.MAGIC_LINK_SINGLE_USE;
  let requestResult = null;

  if (shouldRotateToken) {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        requestResult = await db.query(
          `
            UPDATE clients
            SET upload_token = $1,
                upload_token_expires_at = NOW() + make_interval(hours => $2::integer)
            WHERE id = $3
              AND firm_id = $4
              AND deleted_at IS NULL
            RETURNING upload_token, upload_token_expires_at
          `,
          [createUploadToken(), env.MAGIC_LINK_EXPIRY_HOURS, clientId, firmId]
        );
        break;
      } catch (error) {
        if (error.code === "23505" && attempt < maxAttempts) {
          continue;
        }
        throw error;
      }
    }
  } else {
    requestResult = await db.query(
      `
        UPDATE clients
        SET upload_token_expires_at = NOW() + make_interval(hours => $1::integer)
        WHERE id = $2
          AND firm_id = $3
          AND deleted_at IS NULL
        RETURNING upload_token, upload_token_expires_at
      `,
      [env.MAGIC_LINK_EXPIRY_HOURS, clientId, firmId]
    );
  }

  if (!requestResult || requestResult.rowCount === 0) {
    throw ApiError.notFound("Client not found");
  }

  await insertAuditLog(db, {
    firmId,
    userId: actorUserId,
    action: "client_request_docs",
    entityType: "client",
    entityId: clientId,
    metadata: {
      singleUse: env.MAGIC_LINK_SINGLE_USE,
      email: client.email
    }
  });

  if (client.email) {
    const uploadToken = requestResult.rows[0].upload_token;
    const uploadTokenExpiresAt = requestResult.rows[0].upload_token_expires_at;
    const uploadLink = `${env.FRONTEND_URL}/upload/${uploadToken}`;
    const emailResult = await sendEmail({
      to: client.email,
      subject: clientMagicLinkSubject({ firmName: client.firm_name }),
      html: clientMagicLinkTemplate({
        uploadLink,
        firmName: client.firm_name,
        clientName: client.name,
        documentTypes: toRequestedDocumentLabels(documentTypes),
        expiryDate: uploadTokenExpiresAt
      })
    });

    await insertAuditLog(db, {
      firmId,
      userId: actorUserId,
      action: "client_magic_link_emailed",
      entityType: "client",
      entityId: clientId,
      metadata: {
        email: client.email,
        sent: Boolean(emailResult.sent),
        provider: env.EMAIL_PROVIDER,
        error: emailResult.error ?? null
      }
    });
  }

  return {
    message: "Document request queued",
    clientId,
    uploadToken: requestResult.rows[0].upload_token,
    uploadTokenExpiresAt: requestResult.rows[0].upload_token_expires_at
  };
};

module.exports = {
  listClients,
  createClient,
  getClientById,
  updateClient,
  deleteClient,
  requestClientDocuments
};
