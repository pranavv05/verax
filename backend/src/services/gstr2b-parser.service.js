/**
 * GSTR-2B file parser.
 *
 * Firms can download a client's GSTR-2B from the GST portal as either the
 * portal's JSON export or an Excel workbook. Both describe the same thing: the
 * B2B supplier invoices that make up the client's available ITC for a period.
 * This module turns either file into the normalised record shape the matching
 * layer already consumes (see gsp.service.matchInvoices):
 *
 *   { invoiceNumber, supplierGSTIN, supplierName,
 *     taxableAmount, gstAmount, invoiceDate, raw }
 *
 * It parses ONLY — it performs no I/O and touches no database, so it is pure
 * and unit-testable. Storage and reconciliation wiring live elsewhere.
 *
 * Scope: B2B and B2BA (amendments) invoices, which carry the bulk of ITC.
 * Credit/debit notes (CDNR) and import records are intentionally out of scope
 * for this first version and are ignored rather than mis-parsed; a later pass
 * can add them behind the same normalised shape.
 */

const ExcelJS = require("exceljs");
const ApiError = require("../utils/api-error");
const { toAmount } = require("../utils/amount");

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // GSTR-2B JSON for a large client can be several MB.
const MAX_RECORDS = 50000; // A hard ceiling so a malformed or hostile file cannot exhaust memory.
const ALLOWED_EXTENSIONS = new Set(["json", "xlsx"]);

const toNumberOrZero = (value) => {
  const parsed = toAmount(value);
  return parsed === null ? 0 : parsed;
};

const cleanString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const cleanGstin = (value) => cleanString(value).replace(/\s/g, "").toUpperCase();

/**
 * The portal prints invoice dates as DD-MM-YYYY. Normalise to YYYY-MM-DD so it
 * matches the extraction side (gsp.service.normalizeDate parses both, but
 * storing one canonical form keeps the stored snapshot clean and comparable).
 * Unrecognised forms are returned trimmed, never guessed.
 */
const normalizeInvoiceDate = (value) => {
  const raw = cleanString(value);
  if (!raw) return "";
  const ddmmyyyy = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return raw;
};

/**
 * One portal invoice object (`inv[]` entry) -> normalised record.
 * The portal nests tax figures under an `itms[].itm_det` array; a single
 * invoice can carry several rate lines, so taxable and GST are summed across
 * all of them. Field names follow the GSTN GSTR-2B JSON schema, with a few
 * tolerant fallbacks for exports that use the longer key names.
 */
const normalizePortalInvoice = (supplierGstin, supplierName, inv) => {
  const items = Array.isArray(inv.itms) ? inv.itms : [];
  let taxable = 0;
  let gst = 0;

  if (items.length > 0) {
    for (const item of items) {
      const det = item.itm_det || item.itmDet || item || {};
      taxable += toNumberOrZero(det.txval ?? det.taxable_value ?? det.taxableValue);
      gst +=
        toNumberOrZero(det.iamt ?? det.igst) +
        toNumberOrZero(det.camt ?? det.cgst) +
        toNumberOrZero(det.samt ?? det.sgst) +
        toNumberOrZero(det.csamt ?? det.cess);
    }
  } else {
    // Some exports flatten a single rate line onto the invoice itself.
    taxable = toNumberOrZero(inv.txval ?? inv.taxable_value);
    gst =
      toNumberOrZero(inv.iamt) +
      toNumberOrZero(inv.camt) +
      toNumberOrZero(inv.samt) +
      toNumberOrZero(inv.csamt);
  }

  return {
    invoiceNumber: cleanString(inv.inum ?? inv.invoice_number ?? inv.invoiceNumber),
    supplierGSTIN: supplierGstin,
    supplierName: cleanString(supplierName),
    taxableAmount: Number(taxable.toFixed(2)),
    gstAmount: Number(gst.toFixed(2)),
    invoiceDate: normalizeInvoiceDate(inv.dt ?? inv.idt ?? inv.invoice_date),
    raw: inv
  };
};

/**
 * Parse the GST portal's GSTR-2B JSON export.
 *
 * Shape (abbreviated, per the GSTN schema):
 *   { data: { docdata: { b2b: [ { ctin, cfs, trdnm, inv: [ { inum, dt, itms } ] } ],
 *                         b2ba: [ ... ] } } }
 * Older/thinner exports put `b2b` directly under `data` or at the top level, so
 * all three nestings are checked.
 */
const parseGstr2bJson = (text) => {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw ApiError.badRequest("The uploaded file is not valid GSTR-2B JSON.");
  }

  const docdata =
    payload?.data?.docdata || payload?.docdata || payload?.data || payload || {};

  const b2bGroups = []
    .concat(Array.isArray(docdata.b2b) ? docdata.b2b : [])
    .concat(Array.isArray(docdata.b2ba) ? docdata.b2ba : []);

  if (b2bGroups.length === 0) {
    throw ApiError.badRequest(
      "No B2B invoices found in this GSTR-2B file. Make sure you exported the full GSTR-2B JSON from the GST portal."
    );
  }

  const records = [];
  for (const group of b2bGroups) {
    const supplierGstin = cleanGstin(group.ctin ?? group.supplier_gstin);
    const supplierName = group.trdnm ?? group.trade_name ?? group.lgnm ?? "";
    const invoices = Array.isArray(group.inv) ? group.inv : [];
    for (const inv of invoices) {
      records.push(normalizePortalInvoice(supplierGstin, supplierName, inv));
      if (records.length > MAX_RECORDS) {
        throw ApiError.badRequest(`GSTR-2B file exceeds ${MAX_RECORDS} records.`);
      }
    }
  }

  return records;
};

// Excel header aliases -> canonical field. The portal's Excel uses long human
// headers; firms sometimes re-save with their own. Match case/space-insensitively.
const EXCEL_HEADER_ALIASES = {
  "gstin of supplier": "supplierGSTIN",
  "supplier gstin": "supplierGSTIN",
  gstin: "supplierGSTIN",
  ctin: "supplierGSTIN",
  "trade/legal name": "supplierName",
  "trade name": "supplierName",
  "supplier name": "supplierName",
  "invoice number": "invoiceNumber",
  "invoice no": "invoiceNumber",
  "invoice no.": "invoiceNumber",
  inum: "invoiceNumber",
  "invoice date": "invoiceDate",
  "invoice date (dd-mm-yyyy)": "invoiceDate",
  "taxable value": "taxableAmount",
  "taxable value (₹)": "taxableAmount",
  "taxable amount": "taxableAmount",
  "integrated tax": "igst",
  "integrated tax (₹)": "igst",
  "integrated tax(₹)": "igst",
  igst: "igst",
  "central tax": "cgst",
  "central tax (₹)": "cgst",
  cgst: "cgst",
  "state/ut tax": "sgst",
  "state/ut tax (₹)": "sgst",
  "state tax": "sgst",
  sgst: "sgst",
  cess: "cess",
  "cess (₹)": "cess"
};

const canonicalHeader = (header) => {
  const key = cleanString(header).toLowerCase().replace(/\s+/g, " ");
  return EXCEL_HEADER_ALIASES[key] || null;
};

/**
 * Parse the GST portal's GSTR-2B Excel export (the "B2B" sheet). Reads the
 * first sheet that contains a recognisable supplier-GSTIN + invoice-number
 * header row, then maps each data row into the normalised shape.
 */
const parseGstr2bExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw ApiError.badRequest("The uploaded file is not a readable Excel workbook.");
  }

  const records = [];

  for (const worksheet of workbook.worksheets) {
    // Find the header row: the first row that maps to both a supplier GSTIN and
    // an invoice number. GSTR-2B Excel has title/summary rows above the table.
    let headerRowNumber = null;
    let columnMap = null;

    for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 25); rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const candidate = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const canonical = canonicalHeader(cell.value);
        if (canonical) candidate[canonical] = colNumber;
      });
      if (candidate.supplierGSTIN && candidate.invoiceNumber) {
        headerRowNumber = rowNumber;
        columnMap = candidate;
        break;
      }
    }

    if (!headerRowNumber || !columnMap) continue;

    const cellText = (row, col) => (col ? cleanString(row.getCell(col).value) : "");
    const cellNum = (row, col) => (col ? toNumberOrZero(row.getCell(col).value) : 0);

    for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const supplierGSTIN = cleanGstin(cellText(row, columnMap.supplierGSTIN));
      const invoiceNumber = cellText(row, columnMap.invoiceNumber);
      if (!supplierGSTIN && !invoiceNumber) continue; // blank/spacer row

      const gst =
        cellNum(row, columnMap.igst) +
        cellNum(row, columnMap.cgst) +
        cellNum(row, columnMap.sgst) +
        cellNum(row, columnMap.cess);

      records.push({
        invoiceNumber,
        supplierGSTIN,
        supplierName: cellText(row, columnMap.supplierName),
        taxableAmount: Number(cellNum(row, columnMap.taxableAmount).toFixed(2)),
        gstAmount: Number(gst.toFixed(2)),
        invoiceDate: normalizeInvoiceDate(cellText(row, columnMap.invoiceDate)),
        raw: null
      });

      if (records.length > MAX_RECORDS) {
        throw ApiError.badRequest(`GSTR-2B file exceeds ${MAX_RECORDS} records.`);
      }
    }

    // Stop at the first sheet that yielded a usable table.
    if (records.length > 0) break;
  }

  if (records.length === 0) {
    throw ApiError.badRequest(
      "No B2B invoice rows found in this Excel file. Upload the GSTR-2B Excel downloaded from the GST portal."
    );
  }

  return records;
};

/**
 * Summarise a parsed record set for storage/display without re-summing a large
 * JSONB array on every read.
 */
const summariseRecords = (records) => {
  let totalTaxable = 0;
  let totalGst = 0;
  for (const record of records) {
    totalTaxable += record.taxableAmount || 0;
    totalGst += record.gstAmount || 0;
  }
  return {
    recordCount: records.length,
    totalTaxable: Number(totalTaxable.toFixed(2)),
    totalGst: Number(totalGst.toFixed(2))
  };
};

/**
 * Entry point: parse an uploaded GSTR-2B file (JSON or Excel) into normalised
 * records plus a summary. `filename` decides the format by extension.
 */
const parseGstr2bFile = async ({ buffer, filename }) => {
  if (!buffer || buffer.length === 0) {
    throw ApiError.badRequest("The uploaded file is empty.");
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw ApiError.badRequest(
      `File exceeds ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB limit.`
    );
  }

  const extension = cleanString(filename).split(".").pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw ApiError.badRequest("Only GSTR-2B JSON or Excel (.xlsx) files are supported.");
  }

  const records =
    extension === "json"
      ? parseGstr2bJson(buffer.toString("utf8"))
      : await parseGstr2bExcel(buffer);

  return { records, summary: summariseRecords(records) };
};

module.exports = {
  MAX_FILE_SIZE_BYTES,
  MAX_RECORDS,
  ALLOWED_EXTENSIONS,
  parseGstr2bFile,
  parseGstr2bJson,
  parseGstr2bExcel,
  summariseRecords,
  normalizeInvoiceDate
};
