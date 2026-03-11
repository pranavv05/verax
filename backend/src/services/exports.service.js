const crypto = require("crypto");
const ApiError = require("../utils/api-error");
const { buildTallyXml } = require("./tally-xml.service");
const { uploadTextObject, createDownloadUrl } = require("./s3.service");
const env = require("../config/env");

const EXPORT_STATUSES = new Set(["generated", "downloaded", "failed"]);

const buildExportS3Key = ({ firmId, clientId, exportId }) => {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `firms/${firmId}/clients/${clientId}/exports/tally/${year}/${month}/${exportId}.xml`;
};

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

const assertClientExists = async (db, { firmId, clientId }) => {
  const result = await db.query(
    `
      SELECT id
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
};

const fetchApprovedDocuments = async (
  db,
  { firmId, clientId, documentIds, dateFrom, dateTo }
) => {
  const filters = [
    "d.firm_id = $1",
    "d.client_id = $2",
    "d.deleted_at IS NULL",
    "(d.status = 'reviewed' OR e.reviewed_at IS NOT NULL)"
  ];
  const values = [firmId, clientId];
  let idx = values.length + 1;

  if (documentIds && documentIds.length > 0) {
    filters.push(`d.id = ANY($${idx}::uuid[])`);
    values.push(documentIds);
    idx += 1;
  }
  if (dateFrom) {
    filters.push(`d.uploaded_at >= $${idx}::timestamptz`);
    values.push(dateFrom);
    idx += 1;
  }
  if (dateTo) {
    filters.push(`d.uploaded_at <= $${idx}::timestamptz`);
    values.push(dateTo);
    idx += 1;
  }

  const result = await db.query(
    `
      SELECT
        d.id,
        d.client_id,
        d.firm_id,
        d.file_name,
        d.doc_type,
        d.uploaded_at,
        d.status,
        e.structured_data
      FROM documents d
      LEFT JOIN extractions e ON e.document_id = d.id AND e.deleted_at IS NULL
      WHERE ${filters.join(" AND ")}
      ORDER BY d.uploaded_at ASC
    `,
    values
  );

  if (result.rowCount === 0) {
    throw ApiError.badRequest("No approved documents found for export");
  }

  if (documentIds && documentIds.length > 0) {
    const returnedIds = new Set(result.rows.map((row) => row.id));
    const missing = documentIds.filter((id) => !returnedIds.has(id));
    if (missing.length > 0) {
      throw ApiError.badRequest(
        `Some documents are missing or not approved for export: ${missing.join(", ")}`
      );
    }
  }

  return result.rows;
};

const persistGeneratedExport = async (
  db,
  { exportId, firmId, clientId, documentIds, xmlS3Key, userId }
) => {
  await db.query(
    `
      INSERT INTO tally_exports (
        id,
        firm_id,
        client_id,
        document_ids,
        xml_s3_key,
        exported_by,
        exported_at,
        status
      ) VALUES ($1, $2, $3, $4::uuid[], $5, $6, NOW(), 'generated')
    `,
    [exportId, firmId, clientId, documentIds, xmlS3Key, userId]
  );

  await db.query(
    `
      UPDATE documents
      SET status = 'exported'
      WHERE id = ANY($1::uuid[])
        AND firm_id = $2
        AND deleted_at IS NULL
    `,
    [documentIds, firmId]
  );

  await insertAuditLog(db, {
    firmId,
    userId,
    action: "tally_export_generated",
    entityType: "tally_export",
    entityId: exportId,
    metadata: {
      clientId,
      documentCount: documentIds.length
    }
  });
};

const persistFailedExport = async (
  db,
  { exportId, firmId, clientId, documentIds, userId, errorMessage }
) => {
  await db.query(
    `
      INSERT INTO tally_exports (
        id,
        firm_id,
        client_id,
        document_ids,
        xml_s3_key,
        exported_by,
        exported_at,
        status
      ) VALUES ($1, $2, $3, $4::uuid[], NULL, $5, NOW(), 'failed')
      ON CONFLICT (id) DO NOTHING
    `,
    [exportId, firmId, clientId, documentIds, userId]
  );

  await insertAuditLog(db, {
    firmId,
    userId,
    action: "tally_export_failed",
    entityType: "tally_export",
    entityId: exportId,
    metadata: {
      clientId,
      documentCount: documentIds.length,
      error: String(errorMessage || "Unknown export failure").slice(0, 1000)
    }
  });
};

const generateTallyExport = async (
  db,
  { firmId, userId, clientId, documentIds, dateFrom, dateTo }
) => {
  await assertClientExists(db, { firmId, clientId });

  const approvedDocuments = await fetchApprovedDocuments(db, {
    firmId,
    clientId,
    documentIds,
    dateFrom,
    dateTo
  });

  const exportId = crypto.randomUUID();
  const normalizedDocumentIds = approvedDocuments.map((row) => row.id);
  const xmlS3Key = buildExportS3Key({
    firmId,
    clientId,
    exportId
  });
  const xmlPayload = buildTallyXml({
    documents: approvedDocuments
  });

  try {
    await uploadTextObject({
      key: xmlS3Key,
      body: xmlPayload,
      contentType: "application/xml"
    });

    await persistGeneratedExport(db, {
      exportId,
      firmId,
      clientId,
      documentIds: normalizedDocumentIds,
      xmlS3Key,
      userId
    });
  } catch (error) {
    await persistFailedExport(db, {
      exportId,
      firmId,
      clientId,
      documentIds: normalizedDocumentIds,
      userId,
      errorMessage: error.message
    });
    return {
      export_id: exportId,
      client_id: clientId,
      document_count: normalizedDocumentIds.length,
      xml_s3_key: null,
      download_url: null,
      expires_in: null,
      status: "failed",
      error: String(error.message || "Failed to generate export").slice(0, 1000)
    };
  }

  const download = await createDownloadUrl({
    key: xmlS3Key,
    expiresIn: env.TALLY_EXPORT_URL_EXPIRY_SECONDS
  });

  return {
    export_id: exportId,
    client_id: clientId,
    document_count: normalizedDocumentIds.length,
    xml_s3_key: xmlS3Key,
    download_url: download.url,
    expires_in: download.expiresIn,
    status: "generated"
  };
};

const listExportHistory = async (db, { firmId, page, limit, clientId, status }) => {
  if (status && !EXPORT_STATUSES.has(status)) {
    throw ApiError.badRequest("Invalid export status filter");
  }

  const filters = ["firm_id = $1", "deleted_at IS NULL"];
  const values = [firmId];
  let idx = values.length + 1;

  if (clientId) {
    filters.push(`client_id = $${idx}`);
    values.push(clientId);
    idx += 1;
  }

  if (status) {
    filters.push(`status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  const whereClause = filters.join(" AND ");
  const offset = (page - 1) * limit;

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM tally_exports
      WHERE ${whereClause}
    `,
    values
  );

  const rowsResult = await db.query(
    `
      SELECT
        id,
        firm_id,
        client_id,
        document_ids,
        xml_s3_key,
        exported_by,
        exported_at,
        status,
        created_at,
        updated_at
      FROM tally_exports
      WHERE ${whereClause}
      ORDER BY exported_at DESC NULLS LAST, created_at DESC
      LIMIT $${idx}
      OFFSET $${idx + 1}
    `,
    [...values, limit, offset]
  );

  return {
    data: rowsResult.rows.map((row) => ({
      id: row.id,
      firmId: row.firm_id,
      clientId: row.client_id,
      documentIds: row.document_ids || [],
      xmlS3Key: row.xml_s3_key,
      exportedBy: row.exported_by,
      exportedAt: row.exported_at,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
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

const getExportDownload = async (db, { firmId, userId, exportId }) => {
  const exportResult = await db.query(
    `
      SELECT
        id,
        firm_id,
        client_id,
        document_ids,
        xml_s3_key,
        status
      FROM tally_exports
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [exportId, firmId]
  );

  if (exportResult.rowCount === 0) {
    throw ApiError.notFound("Export not found");
  }

  const row = exportResult.rows[0];
  if (!row.xml_s3_key || row.status === "failed") {
    throw ApiError.badRequest("Export file is not available for download");
  }

  const download = await createDownloadUrl({
    key: row.xml_s3_key,
    expiresIn: env.TALLY_EXPORT_URL_EXPIRY_SECONDS
  });

  await db.query(
    `
      UPDATE tally_exports
      SET status = 'downloaded'
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
        AND status <> 'failed'
    `,
    [exportId, firmId]
  );

  await insertAuditLog(db, {
    firmId,
    userId,
    action: "tally_export_downloaded",
    entityType: "tally_export",
    entityId: exportId,
    metadata: {
      clientId: row.client_id,
      documentCount: Array.isArray(row.document_ids) ? row.document_ids.length : 0
    }
  });

  return {
    export_id: row.id,
    status: "downloaded",
    download_url: download.url,
    expires_in: download.expiresIn
  };
};

module.exports = {
  generateTallyExport,
  listExportHistory,
  getExportDownload
};
