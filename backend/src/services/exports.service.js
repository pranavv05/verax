const crypto = require("crypto");
const ApiError = require("../utils/api-error");
const { buildTallyXml } = require("./tally-xml.service");
const { uploadTextObject, createDownloadUrl } = require("./s3.service");
const { createNotification } = require("./notifications.service");
const env = require("../config/env");

const EXPORT_STATUSES = new Set(["generated", "downloaded", "failed"]);

const buildExportS3Key = ({ firmId, clientId, exportId }) => {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `firms/${firmId}/clients/${clientId}/exports/tally/${year}/${month}/${exportId}.xml`;
};

const buildBulkExportS3Key = ({ firmId, clientId }) => {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `exports/${firmId}/${clientId}/bulk_${timestamp}.xml`;
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
      SELECT id, name
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
  return result.rows[0];
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

const getDocumentDate = (document) => {
  const extraction = document.structured_data || {};
  const candidates = [
    extraction.document_date,
    extraction.invoice_date,
    extraction.date,
    document.created_at,
    document.uploaded_at
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date(document.created_at || document.uploaded_at);
};

const fetchBulkReviewedDocuments = async (db, { firmId, clientId, fromDate, toDate }) => {
  const result = await db.query(
    `
      SELECT
        d.id,
        d.client_id,
        d.firm_id,
        d.file_name,
        d.doc_type,
        d.uploaded_at,
        d.created_at,
        d.status,
        e.structured_data
      FROM documents d
      LEFT JOIN extractions e ON e.document_id = d.id AND e.deleted_at IS NULL
      WHERE d.firm_id = $1
        AND d.client_id = $2
        AND d.status = 'reviewed'
        AND d.deleted_at IS NULL
      ORDER BY d.uploaded_at ASC
    `,
    [firmId, clientId]
  );

  const fromTime = fromDate ? new Date(`${fromDate}T00:00:00.000Z`).getTime() : null;
  const toTime = toDate ? new Date(`${toDate}T23:59:59.999Z`).getTime() : null;

  return result.rows.filter((document) => {
    const documentTime = getDocumentDate(document).getTime();
    if (fromTime !== null && documentTime < fromTime) return false;
    if (toTime !== null && documentTime > toTime) return false;
    return true;
  });
};

const fetchPreviewDocumentsByIds = async (db, { firmId, clientId, documentIds }) => {
  const result = await db.query(
    `
      SELECT
        d.id,
        d.client_id,
        d.firm_id,
        d.file_name,
        d.doc_type,
        d.uploaded_at,
        d.created_at,
        d.status,
        e.structured_data
      FROM documents d
      LEFT JOIN extractions e ON e.document_id = d.id AND e.deleted_at IS NULL
      WHERE d.firm_id = $1
        AND d.client_id = $2
        AND d.id = ANY($3::uuid[])
        AND d.status = 'reviewed'
        AND d.deleted_at IS NULL
      ORDER BY d.uploaded_at ASC
    `,
    [firmId, clientId, documentIds]
  );

  const returnedIds = new Set(result.rows.map((row) => row.id));
  const missing = documentIds.filter((id) => !returnedIds.has(id));
  if (missing.length > 0) {
    throw ApiError.badRequest(
      `Some documents are missing or not reviewed for preview: ${missing.join(", ")}`
    );
  }

  return result.rows;
};

const decodeXml = (value) =>
  String(value || "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");

const parseXmlAmount = (value) => {
  const parsed = Number(String(value || "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const extractFirstTag = (source, tagName) => {
  const match = source.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
};

const parseTallyXmlPreview = (xmlPayload) => {
  const vouchers = [];
  const voucherRegex = /<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER>/gi;
  let voucherMatch;

  while ((voucherMatch = voucherRegex.exec(xmlPayload)) !== null) {
    const attrs = voucherMatch[1] || "";
    const body = voucherMatch[2] || "";
    const typeMatch = attrs.match(/VCHTYPE="([^"]*)"/i);
    const ledgerBlocks = Array.from(
      body.matchAll(/<ALLLEDGERENTRIES\.LIST>([\s\S]*?)<\/ALLLEDGERENTRIES\.LIST>/gi)
    ).map((match) => match[1] || "");
    const inventoryBlocks = Array.from(
      body.matchAll(/<ALLINVENTORYENTRIES\.LIST>([\s\S]*?)<\/ALLINVENTORYENTRIES\.LIST>/gi)
    );
    const allAmounts = Array.from(body.matchAll(/<AMOUNT>([\s\S]*?)<\/AMOUNT>/gi)).map(
      (match) => Math.abs(parseXmlAmount(match[1]))
    );
    const gstAmount = ledgerBlocks.reduce((sum, block) => {
      const ledgerName = extractFirstTag(block, "LEDGERNAME").toUpperCase();
      if (!["CGST", "SGST", "IGST"].includes(ledgerName)) return sum;
      return sum + Math.abs(parseXmlAmount(extractFirstTag(block, "AMOUNT")));
    }, 0);

    vouchers.push({
      voucherType: decodeXml(typeMatch?.[1] || "Journal"),
      voucherDate: extractFirstTag(body, "DATE"),
      partyName: extractFirstTag(body, "PARTYLEDGERNAME") || "Unknown Party",
      narration: extractFirstTag(body, "NARRATION"),
      totalAmount: allAmounts.length > 0 ? Math.max(...allAmounts) : 0,
      gstAmount,
      lineItemCount: inventoryBlocks.length || ledgerBlocks.length
    });
  }

  return vouchers;
};

const normaliseItemName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getInvoiceNumber = (document) => {
  const extraction = document.structured_data || {};
  return (
    extraction.invoice_number ||
    extraction.invoiceNumber ||
    extraction.reference_number ||
    document.file_name ||
    document.id
  );
};

const getLineItemRawName = (item) =>
  item.description || item.item_name || item.name || item.product_name || item.service_name || "";

const getUnresolvedMappingWarnings = async (db, { firmId, documents }) => {
  const result = await db.query(
    `
      SELECT vendor_raw, tally_name
      FROM item_name_mappings
      WHERE firm_id = $1
    `,
    [firmId]
  );
  const mappings = new Map(
    result.rows.map((row) => [normaliseItemName(row.vendor_raw), String(row.tally_name || "").trim()])
  );
  const warnings = [];

  for (const document of documents) {
    const extraction = document.structured_data || {};
    const lineItems = Array.isArray(extraction.line_items) ? extraction.line_items : [];
    for (const item of lineItems) {
      const rawName = getLineItemRawName(item);
      const rawKey = normaliseItemName(rawName);
      const explicitTallyName = String(item.tally_item_name || "").trim();
      const mappedTallyName = rawKey ? mappings.get(rawKey) : "";
      if (explicitTallyName || mappedTallyName) continue;

      warnings.push({
        documentId: document.id,
        invoiceNumber: getInvoiceNumber(document),
        itemName: rawName || "Unnamed item",
        issue: "unresolved_mapping"
      });
    }
  }

  return warnings;
};

const generateTallyExportPreview = async (
  db,
  { firmId, clientId, documentIds = null, fromDate = null, toDate = null }
) => {
  await assertClientExists(db, { firmId, clientId });

  const previewDocuments =
    Array.isArray(documentIds) && documentIds.length > 0
      ? await fetchPreviewDocumentsByIds(db, { firmId, clientId, documentIds })
      : await fetchBulkReviewedDocuments(db, { firmId, clientId, fromDate, toDate });

  if (previewDocuments.length === 0) {
    throw ApiError.badRequest("No reviewed documents to preview");
  }

  if (previewDocuments.length > 200) {
    throw ApiError.badRequest("Too many documents. Please use a narrower date range.");
  }

  const xmlPayload = buildTallyXml({ documents: previewDocuments });
  const vouchers = parseTallyXmlPreview(xmlPayload);
  const warnings = await getUnresolvedMappingWarnings(db, {
    firmId,
    documents: previewDocuments
  });

  return {
    documentCount: previewDocuments.length,
    vouchers,
    warnings,
    hasWarnings: warnings.length > 0
  };
};

const persistGeneratedExport = async (
  db,
  { exportId, firmId, clientId, documentIds, xmlS3Key, userId, exportType = "single", fromDate = null, toDate = null }
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
        created_by,
        exported_at,
        status,
        export_type,
        document_count,
        from_date,
        to_date
      ) VALUES ($1, $2, $3, $4::uuid[], $5, $6, $6, NOW(), 'generated', $7, $8, $9, $10)
    `,
    [
      exportId,
      firmId,
      clientId,
      documentIds,
      xmlS3Key,
      userId,
      exportType,
      documentIds.length,
      fromDate,
      toDate
    ]
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
  const client = await assertClientExists(db, { firmId, clientId });

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

    try {
      await createNotification({
        firmId,
        userId,
        type: "export_ready",
        title: "Export ready for download",
        message: `Your Tally export for ${client.name} (${normalizedDocumentIds.length} document${normalizedDocumentIds.length > 1 ? "s" : ""}) is ready.`,
        entityType: "export",
        entityId: exportId
      });
    } catch (notificationError) {
      console.error("Export notification failed:", notificationError.message || notificationError);
    }
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

const generateBulkTallyExport = async (
  db,
  { firmId, userId, clientId, fromDate = null, toDate = null }
) => {
  const client = await assertClientExists(db, { firmId, clientId });

  const reviewedDocuments = await fetchBulkReviewedDocuments(db, {
    firmId,
    clientId,
    fromDate,
    toDate
  });

  if (reviewedDocuments.length === 0) {
    throw ApiError.badRequest("No reviewed documents found for this client in the selected range");
  }

  if (reviewedDocuments.length > 200) {
    throw ApiError.badRequest("Too many documents. Please use a narrower date range.");
  }

  const exportId = crypto.randomUUID();
  const documentIds = reviewedDocuments.map((document) => document.id);
  const xmlS3Key = buildBulkExportS3Key({ firmId, clientId });
  const xmlPayload = buildTallyXml({ documents: reviewedDocuments });

  await uploadTextObject({
    key: xmlS3Key,
    body: xmlPayload,
    contentType: "application/xml"
  });

  await persistGeneratedExport(db, {
    exportId,
    firmId,
    clientId,
    documentIds,
    xmlS3Key,
    userId,
    exportType: "bulk",
    fromDate,
    toDate
  });

  await insertAuditLog(db, {
    firmId,
    userId,
    action: "bulk_export_generated",
    entityType: "export",
    entityId: exportId,
    metadata: {
      documentCount: documentIds.length,
      clientId
    }
  });

  try {
    await createNotification({
      firmId,
      userId,
      type: "export_ready",
      title: "Export ready for download",
      message: `Your Tally export for ${client.name} (${documentIds.length} document${documentIds.length > 1 ? "s" : ""}) is ready.`,
      entityType: "export",
      entityId: exportId
    });
  } catch (notificationError) {
    console.error("Bulk export notification failed:", notificationError.message || notificationError);
  }

  const download = await createDownloadUrl({
    key: xmlS3Key,
    expiresIn: env.TALLY_EXPORT_URL_EXPIRY_SECONDS
  });

  return {
    exportId,
    documentCount: documentIds.length,
    downloadUrl: download.url,
    expiresAt: new Date(Date.now() + download.expiresIn * 1000).toISOString()
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
        export_type,
        document_count,
        from_date,
        to_date,
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
      exportType: row.export_type || "single",
      documentCount:
        row.document_count ?? (Array.isArray(row.document_ids) ? row.document_ids.length : 0),
      fromDate: row.from_date,
      toDate: row.to_date,
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
  generateBulkTallyExport,
  generateTallyExportPreview,
  listExportHistory,
  getExportDownload
};
