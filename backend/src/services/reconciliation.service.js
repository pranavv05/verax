/**
 * GSTR-2B reconciliation.
 *
 * Extracted from `compliance.routes.js` so the client portal can serve the same
 * reconciliation data and the same Excel workbook without duplicating the
 * matching logic. Behaviour is unchanged from the route-local version.
 */

const ExcelJS = require("exceljs");
const ApiError = require("../utils/api-error");
const gspService = require("./gsp.service");

const toNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const buildInvoiceFromExtraction = (documentId, structuredData) => ({
  documentId,
  invoiceNumber: structuredData.invoice_number || structuredData.invoiceNumber || "",
  supplierGSTIN:
    structuredData.vendor_gstin ||
    structuredData.supplier_gstin ||
    structuredData.supplierGSTIN ||
    "",
  taxableAmount: toNumber(structuredData.taxable_amount ?? structuredData.subtotal),
  gstAmount:
    toNumber(structuredData.tax_amount) ??
    ((toNumber(structuredData.cgst) || 0) +
      (toNumber(structuredData.sgst) || 0) +
      (toNumber(structuredData.igst) || 0)),
  invoiceDate:
    structuredData.invoice_date ||
    structuredData.invoiceDate ||
    structuredData.date ||
    structuredData.document_date ||
    ""
});

const getGstr2bNumber = (record, field) => {
  if (!record) return null;
  if (field === "taxableAmount") {
    return toNumber(record.taxableAmount ?? record.taxable_amount ?? record.txval);
  }
  if (field === "gstAmount") {
    return (
      toNumber(record.gstAmount ?? record.gst_amount ?? record.iamt) ??
      ((toNumber(record.camt) || 0) + (toNumber(record.samt) || 0) + (toNumber(record.csamt) || 0))
    );
  }
  return null;
};

const getPeriodRange = (period) => {
  const month = Number(period.slice(0, 2));
  const year = Number(period.slice(2));
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
};

const parseInvoiceDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

const getReconciliationData = async (db, { firmId, userId, clientId, period, auditAction }) => {
  const clientResult = await db.query(
    `
      SELECT id, name, gstin
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

  const client = clientResult.rows[0];
  if (!client.gstin) {
    throw ApiError.badRequest("Client does not have a GSTIN configured");
  }

  const documentsResult = await db.query(
    `
      SELECT
        d.id,
        d.doc_type,
        e.structured_data
      FROM documents d
      JOIN extractions e ON e.document_id = d.id AND e.deleted_at IS NULL
      WHERE d.firm_id = $1
        AND d.client_id = $2
        AND d.doc_type = 'invoice'
        AND d.status IN ('extracted', 'reviewed', 'exported')
        AND d.deleted_at IS NULL
      ORDER BY d.uploaded_at ASC
    `,
    [firmId, clientId]
  );

  const { start, end } = getPeriodRange(period);
  const documents = documentsResult.rows
    .map((row) => {
      const structuredData = row.structured_data || {};
      const invoice = buildInvoiceFromExtraction(row.id, structuredData);
      const invoiceDate = parseInvoiceDate(invoice.invoiceDate);
      return {
        documentId: row.id,
        structuredData,
        invoice: {
          ...invoice,
          supplierName: structuredData.vendor_name || structuredData.supplier_name || null,
          invoiceDate
        }
      };
    })
    .filter(({ invoice }) => {
      if (
        !invoice.invoiceNumber ||
        !invoice.supplierGSTIN ||
        invoice.taxableAmount === null ||
        invoice.gstAmount === null ||
        !invoice.invoiceDate
      ) {
        return false;
      }
      return invoice.invoiceDate >= start && invoice.invoiceDate <= end;
    });

  const invoices = documents.map(({ invoice }) => ({
    documentId: invoice.documentId,
    invoiceNumber: invoice.invoiceNumber,
    supplierGSTIN: invoice.supplierGSTIN,
    taxableAmount: invoice.taxableAmount,
    gstAmount: invoice.gstAmount,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10)
  }));

  const matches = await gspService.matchGSTR2B(client.gstin, period, invoices);
  const rows = documents.map(({ invoice }, index) => {
    const match = matches[index] || {};
    return {
      documentId: invoice.documentId,
      invoiceNumber: invoice.invoiceNumber,
      supplierGSTIN: invoice.supplierGSTIN,
      supplierName: invoice.supplierName,
      invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
      taxableAmount: invoice.taxableAmount,
      gstAmount: invoice.gstAmount,
      matchStatus: match.matchStatus || "unavailable",
      mismatchFields: match.mismatchFields || [],
      gstr2bTaxableAmount: getGstr2bNumber(match.gstr2bRecord, "taxableAmount"),
      gstr2bGstAmount: getGstr2bNumber(match.gstr2bRecord, "gstAmount")
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc.totalTaxableAmount += row.taxableAmount || 0;
      acc.totalGstAmount += row.gstAmount || 0;
      if (row.matchStatus === "matched") acc.matched += 1;
      if (row.matchStatus === "partial") acc.partial += 1;
      if (row.matchStatus === "mismatch") acc.mismatched += 1;
      if (row.matchStatus === "not_found") acc.notFound += 1;
      if (row.matchStatus === "unavailable") acc.unavailable += 1;
      return acc;
    },
    {
      total: 0,
      matched: 0,
      partial: 0,
      mismatched: 0,
      notFound: 0,
      unavailable: 0,
      totalTaxableAmount: 0,
      totalGstAmount: 0
    }
  );

  await insertAuditLog(db, {
    firmId,
    userId,
    action: auditAction,
    entityType: "client",
    entityId: clientId,
    metadata: { period, documentCount: rows.length }
  });

  return {
    client: { id: client.id, name: client.name, gstin: client.gstin },
    period,
    summary,
    rows
  };
};

const safeFilename = (value) =>
  String(value || "client")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const addExcelFill = (cell, color) => {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color }
  };
};

const writeReconciliationWorkbook = async (res, reconciliation) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("GST Reconciliation");
  sheet.columns = [
    { header: "Invoice No.", key: "invoiceNumber", width: 18 },
    { header: "Supplier GSTIN", key: "supplierGSTIN", width: 20 },
    { header: "Supplier Name", key: "supplierName", width: 24 },
    { header: "Invoice Date", key: "invoiceDate", width: 16 },
    { header: "Taxable Amt (₹)", key: "taxableAmount", width: 18 },
    { header: "GST Amt (₹)", key: "gstAmount", width: 16 },
    { header: "GSTR-2B Taxable (₹)", key: "gstr2bTaxableAmount", width: 22 },
    { header: "GSTR-2B GST (₹)", key: "gstr2bGstAmount", width: 18 },
    { header: "Match Status", key: "matchStatus", width: 16 },
    { header: "Mismatch Fields", key: "mismatchFields", width: 25 }
  ];

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    addExcelFill(cell, "FF1F4E79");
  });

  const rowColors = {
    matched: "FFE2EFDA",
    partial: "FFFFFF99",
    mismatch: "FFFCE4D6",
    not_found: "FFFDE9C9"
  };

  reconciliation.rows.forEach((row) => {
    const excelRow = sheet.addRow({
      ...row,
      mismatchFields: row.mismatchFields.join(", ")
    });
    if (rowColors[row.matchStatus]) {
      excelRow.eachCell((cell) => addExcelFill(cell, rowColors[row.matchStatus]));
    }
  });

  sheet.addRow([]);
  const summaryRow = sheet.addRow([
    `Total: ${reconciliation.summary.total} invoices | Matched: ${reconciliation.summary.matched} | Mismatched: ${reconciliation.summary.mismatched + reconciliation.summary.partial} | Not Found: ${reconciliation.summary.notFound}`
  ]);
  summaryRow.font = { bold: true };

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="gst-reconciliation-${safeFilename(reconciliation.client.name)}-${reconciliation.period}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
};

module.exports = {
  toNumber,
  buildInvoiceFromExtraction,
  getReconciliationData,
  writeReconciliationWorkbook,
  safeFilename
};
