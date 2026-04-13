/**
 * Compliance Service
 *
 * Validates Indian financial documents: GSTIN, TDS rates, tax math, duplicates.
 * Returns validation results keyed by field for inline display on the Review page.
 */

/* ──────────────────────────────── GSTIN ──────────────────────────────────────── */

const VALID_STATE_CODES = new Set([
  "01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16",
  "17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32",
  "33","34","35","36","37","38","97"
]);

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const gstinChecksum = (gstin14) => {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const idx = GSTIN_CHARS.indexOf(gstin14[i].toUpperCase());
    if (idx < 0) return null;
    const factor = (i % 2 === 0) ? 1 : 2;
    const product = idx * factor;
    total += Math.floor(product / 36) + (product % 36);
  }
  const remainder = total % 36;
  return GSTIN_CHARS[(36 - (remainder % 36)) % 36];
};

const validateGstin = (gstin) => {
  if (!gstin || typeof gstin !== "string") {
    return { valid: true, message: null }; // empty is not an error
  }

  const cleaned = gstin.replace(/\s/g, "").toUpperCase();

  if (cleaned.length !== 15) {
    return { valid: false, message: `GSTIN must be 15 characters (got ${cleaned.length})`, severity: "error" };
  }

  const stateCode = cleaned.substring(0, 2);
  if (!VALID_STATE_CODES.has(stateCode)) {
    return { valid: false, message: `Invalid state code '${stateCode}' in GSTIN`, severity: "error" };
  }

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleaned.substring(2, 12))) {
    return { valid: false, message: "Invalid PAN pattern in GSTIN (chars 3-12)", severity: "error" };
  }

  if (cleaned[13] !== "Z") {
    return { valid: false, message: "14th character of GSTIN must be 'Z'", severity: "warning" };
  }

  const expectedCheck = gstinChecksum(cleaned.substring(0, 14));
  if (expectedCheck && cleaned[14] !== expectedCheck) {
    return { valid: false, message: `GSTIN checksum mismatch (expected '${expectedCheck}')`, severity: "warning" };
  }

  return { valid: true, message: null };
};

/* ──────────────────────────────── Tax Math ───────────────────────────────────── */

const toNum = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number(v.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const validateTaxMath = (extraction) => {
  const issues = [];
  const cgst = toNum(extraction.cgst);
  const sgst = toNum(extraction.sgst);
  const igst = toNum(extraction.igst);
  const taxAmount = toNum(extraction.tax_amount);
  const taxableAmount = toNum(extraction.taxable_amount ?? extraction.subtotal);
  const totalAmount = toNum(extraction.total_amount);

  // Check: CGST + SGST + IGST ≈ tax_amount
  if (taxAmount !== null && (cgst !== null || sgst !== null || igst !== null)) {
    const sumTaxes = (cgst || 0) + (sgst || 0) + (igst || 0);
    if (Math.abs(sumTaxes - taxAmount) > 1) {
      issues.push({
        field: "tax_amount",
        message: `CGST(${cgst || 0}) + SGST(${sgst || 0}) + IGST(${igst || 0}) = ${sumTaxes}, but tax_amount = ${taxAmount}`,
        severity: "warning"
      });
    }
  }

  // Check: taxable_amount + tax_amount ≈ total_amount
  if (taxableAmount !== null && taxAmount !== null && totalAmount !== null) {
    const expected = taxableAmount + taxAmount;
    if (Math.abs(expected - totalAmount) > 1) {
      issues.push({
        field: "total_amount",
        message: `Taxable(${taxableAmount}) + Tax(${taxAmount}) = ${expected}, but total = ${totalAmount}`,
        severity: "warning"
      });
    }
  }

  // Check: CGST should equal SGST for intra-state
  if (cgst !== null && sgst !== null && igst === null) {
    if (Math.abs(cgst - sgst) > 0.5) {
      issues.push({
        field: "cgst",
        message: `CGST(${cgst}) and SGST(${sgst}) should be equal for intra-state transactions`,
        severity: "warning"
      });
    }
  }

  return issues;
};

/* ──────────────────────────────── TDS Rate ───────────────────────────────────── */

const TDS_RATE_TABLE = {
  "194C": { individual: 1, company: 2, description: "Payment to contractors" },
  "194J": { individual: 10, company: 10, description: "Professional/technical fees" },
  "194I": { individual: 10, company: 10, description: "Rent" },
  "194H": { individual: 5, company: 5, description: "Commission/brokerage" },
  "194A": { individual: 10, company: 10, description: "Interest (other than bank)" },
  "194B": { individual: 30, company: 30, description: "Lottery/crossword puzzle" },
  "194D": { individual: 5, company: 5, description: "Insurance commission" },
  "194DA": { individual: 5, company: 5, description: "Life insurance policy payout" },
  "194E": { individual: 20, company: 20, description: "Non-resident sportsperson" },
  "194G": { individual: 5, company: 5, description: "Commission on lottery tickets" },
  "194IA": { individual: 1, company: 1, description: "Transfer of immovable property" },
  "194IB": { individual: 5, company: 5, description: "Rent by individual/HUF" },
  "194M": { individual: 5, company: 5, description: "Payment to commission agents" },
  "194N": { individual: 2, company: 2, description: "Cash withdrawal" },
  "194O": { individual: 1, company: 1, description: "E-commerce participant" },
  "194Q": { individual: 0.1, company: 0.1, description: "Purchase of goods" }
};

const validateTdsRate = (extraction) => {
  const section = extraction.tds_section;
  if (!section || typeof section !== "string") {
    return { valid: true, message: null };
  }

  const cleanedSection = section.replace(/\s+/g, "").toUpperCase();
  const rateInfo = TDS_RATE_TABLE[cleanedSection];
  if (!rateInfo) {
    return { valid: false, message: `Unknown TDS section '${section}'`, severity: "warning" };
  }

  const tdsRate = toNum(extraction.tds_rate);
  if (tdsRate === null) {
    return { valid: true, message: `Expected TDS rate for ${cleanedSection}: ${rateInfo.individual}% (${rateInfo.description})` };
  }

  const expectedRates = [rateInfo.individual, rateInfo.company];
  if (!expectedRates.includes(tdsRate)) {
    return {
      valid: false,
      message: `TDS rate ${tdsRate}% does not match expected ${rateInfo.individual}%/${rateInfo.company}% for ${cleanedSection} (${rateInfo.description})`,
      severity: "warning"
    };
  }

  return { valid: true, message: null };
};

/* ────────────────────────── Duplicate Invoice ───────────────────────────────── */

const checkDuplicateInvoice = async (db, { firmId, extraction }) => {
  const vendorGstin = extraction.vendor_gstin;
  const invoiceNumber = extraction.invoice_number;

  if (!vendorGstin || !invoiceNumber) {
    return { isDuplicate: false, message: null };
  }

  const result = await db.query(
    `SELECT d.id, d.file_name
     FROM extractions e
     JOIN documents d ON d.id = e.document_id AND d.deleted_at IS NULL
     WHERE d.firm_id = $1
       AND e.structured_data->>'vendor_gstin' = $2
       AND e.structured_data->>'invoice_number' = $3
       AND e.reviewed_at IS NOT NULL
       AND e.deleted_at IS NULL
     LIMIT 1`,
    [firmId, vendorGstin.trim(), invoiceNumber.trim()]
  );

  if (result.rowCount > 0) {
    const existing = result.rows[0];
    return {
      isDuplicate: true,
      existingDocumentId: existing.id,
      message: `Possible duplicate: Invoice '${invoiceNumber}' from GSTIN '${vendorGstin}' was already processed in '${existing.file_name}'`
    };
  }

  return { isDuplicate: false, message: null };
};

/* ──────────────────────────────── Run All ────────────────────────────────────── */

const runAll = async (db, { firmId, extraction }) => {
  if (!extraction || typeof extraction !== "object") {
    return {};
  }

  const [duplicate] = await Promise.all([
    checkDuplicateInvoice(db, { firmId, extraction })
  ]);

  return {
    gstin: validateGstin(extraction.vendor_gstin),
    tax_math: validateTaxMath(extraction),
    tds: validateTdsRate(extraction),
    duplicate
  };
};

module.exports = {
  validateGstin,
  validateTaxMath,
  validateTdsRate,
  checkDuplicateInvoice,
  runAll
};
