/**
 * Pure GSTR-2B matching logic, shared by every data source.
 *
 * Extracted from gsp.service.js so the offline-snapshot path and the live-GSP
 * path match invoices against portal records the exact same way. This module is
 * pure (no I/O, no env), so it is cheap to unit-test and behaves identically
 * whoever calls it. Behaviour is unchanged from the original gsp.service
 * implementation — only its home has moved.
 */

const { toAmount } = require("../utils/amount");

const toNumber = toAmount;

const normalizeInvoiceNumber = (value) =>
  String(value || "").trim().replace(/\s+/g, "").toUpperCase();

const normalizeDate = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return raw;
};

/**
 * Normalise one GSTR-2B supplier record into the canonical shape, tolerating
 * both the GSTN API key names (ctin/inum/txval/iamt...) and the longer
 * snake_case/camelCase forms an offline parser or a GSP wrapper may emit.
 */
const normalizeGstr2bRecord = (record) => {
  const gstAmount =
    toNumber(record.gstAmount ?? record.gst_amount ?? record.iamt) ??
    ((toNumber(record.camt) || 0) + (toNumber(record.samt) || 0) + (toNumber(record.csamt) || 0));

  return {
    invoiceNumber:
      record.invoiceNumber || record.invoice_number || record.inum || record.invNum || "",
    supplierGSTIN:
      record.supplierGSTIN || record.supplier_gstin || record.ctin || record.gstin || "",
    supplierName: record.supplierName || record.supplier_name || record.trdnm || record.lgnm || "",
    taxableAmount: toNumber(record.taxableAmount ?? record.taxable_amount ?? record.txval),
    gstAmount,
    invoiceDate: record.invoiceDate || record.invoice_date || record.idt || record.dt || record.date || "",
    raw: record.raw ?? record
  };
};

const valuesDiffer = (left, right, tolerance = 1) => {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (leftNumber === null || rightNumber === null) return false;
  return Math.abs(leftNumber - rightNumber) > tolerance;
};

/**
 * Match the firm's extracted invoices against a set of GSTR-2B records.
 * Returns one result per invoice, in input order:
 *   { invoiceNumber, matchStatus, mismatchFields, gstr2bRecord }
 * matchStatus is "matched" | "partial" | "mismatch" | "not_found".
 */
const matchInvoices = (invoices, gstr2bRecords) => {
  const recordsByInvoice = new Map();
  for (const record of (gstr2bRecords || []).map(normalizeGstr2bRecord)) {
    const key = normalizeInvoiceNumber(record.invoiceNumber);
    if (key && !recordsByInvoice.has(key)) {
      recordsByInvoice.set(key, record);
    }
  }

  return invoices.map((invoice) => {
    const key = normalizeInvoiceNumber(invoice.invoiceNumber);
    const record = recordsByInvoice.get(key);
    if (!record) {
      return {
        invoiceNumber: invoice.invoiceNumber || "",
        matchStatus: "not_found",
        mismatchFields: [],
        gstr2bRecord: null
      };
    }

    const mismatchFields = [];
    if (
      invoice.supplierGSTIN &&
      record.supplierGSTIN &&
      String(invoice.supplierGSTIN).toUpperCase() !== String(record.supplierGSTIN).toUpperCase()
    ) {
      mismatchFields.push("supplierGSTIN");
    }
    if (valuesDiffer(invoice.taxableAmount, record.taxableAmount)) {
      mismatchFields.push("taxableAmount");
    }
    if (valuesDiffer(invoice.gstAmount, record.gstAmount)) {
      mismatchFields.push("gstAmount");
    }
    if (
      invoice.invoiceDate &&
      record.invoiceDate &&
      normalizeDate(invoice.invoiceDate) !== normalizeDate(record.invoiceDate)
    ) {
      mismatchFields.push("invoiceDate");
    }

    const matchStatus =
      mismatchFields.length === 0
        ? "matched"
        : mismatchFields.includes("supplierGSTIN")
        ? "mismatch"
        : "partial";

    return {
      invoiceNumber: invoice.invoiceNumber || "",
      matchStatus,
      mismatchFields,
      gstr2bRecord: record.raw
    };
  });
};

const unavailableResults = (invoices) =>
  (invoices || []).map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber || "",
    matchStatus: "unavailable",
    mismatchFields: [],
    gstr2bRecord: null
  }));

module.exports = {
  toNumber,
  normalizeInvoiceNumber,
  normalizeDate,
  normalizeGstr2bRecord,
  valuesDiffer,
  matchInvoices,
  unavailableResults
};
