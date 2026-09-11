#!/usr/bin/env node
/**
 * Seeds a realistic extraction row for a document, so the review -> approve ->
 * Tally-export path can be exercised without a live OCR/LLM round trip.
 *
 * Why this exists: the AI service needs a heavy PaddleOCR container build, which
 * can be slow or unavailable behind a restricted network. This lets the review
 * page, confidence bar, approve action and XML export all be verified (and
 * demoed) independently of that. When the AI service IS running, the worker
 * writes this same row itself and this script is unnecessary.
 *
 * Field names mirror ai-service EXTRACTION_PROMPT exactly, plus the short tax
 * aliases (cgst/sgst/igst, total) that tally-xml.service.js also accepts.
 *
 * Usage:
 *   node scripts/seed-demo-extraction.js                 # newest invoice document
 *   node scripts/seed-demo-extraction.js <documentId>
 */

const pool = require("../src/db/pool");
const { withTenantTransaction } = require("../src/db/tenant-context");

const CONFIDENCE = 0.87;

const structuredData = {
  document_type_detected: "invoice",
  invoice_number: "INV-2026-0417",
  invoice_date: "2026-07-12",
  due_date: "2026-08-11",

  supplier_name: "Sharma Steel Traders",
  supplier_gstin: "27AAECS1234C1ZP",
  supplier_address: "Plot 14, MIDC Industrial Area, Pune, Maharashtra 411019",
  // Aliases also understood by tally-xml.service.js.
  vendor_name: "Sharma Steel Traders",
  vendor_gstin: "27AAECS1234C1ZP",

  buyer_name: "Test SME Client",
  buyer_gstin: "29ABCDE1234F1Z5",
  place_of_supply: "Maharashtra",

  line_items: [
    {
      description: "MS Angle 50x50x6mm",
      hsn_code: "7216",
      quantity: 120,
      unit: "Nos",
      rate: 850,
      amount: 102000,
      discount: null
    },
    {
      description: "MS Flat Bar 40x6mm",
      hsn_code: "7214",
      quantity: 60,
      unit: "Nos",
      rate: 720,
      amount: 43200,
      discount: null
    }
  ],

  taxable_amount: 145200,
  subtotal: 145200,

  cgst_rate: 9,
  cgst_amount: 13068,
  sgst_rate: 9,
  sgst_amount: 13068,
  igst_rate: null,
  igst_amount: null,
  cess_amount: null,
  // Short aliases used by the tax-ledger builder.
  cgst: 13068,
  sgst: 13068,
  igst: 0,

  tds_section: null,
  tds_rate: null,
  tds_amount: null,

  total_amount: 171336,
  total: 171336,

  amount_in_words: "One Lakh Seventy One Thousand Three Hundred Thirty Six Rupees Only",
  payment_terms: "30 days from invoice date",
  bank_details: "HDFC Bank, A/c 50200012345678, IFSC HDFC0001234",
  notes: null,

  voucher_type: "Purchase",
  confidence: CONFIDENCE
};

const rawText = [
  "TAX INVOICE",
  "Sharma Steel Traders",
  "GSTIN: 27AAECS1234C1ZP",
  "Plot 14, MIDC Industrial Area, Pune, Maharashtra 411019",
  "Invoice No: INV-2026-0417",
  "Invoice Date: 12/07/2026",
  "Bill To: Test SME Client  GSTIN: 29ABCDE1234F1Z5",
  "MS Angle 50x50x6mm  7216  120  850.00  102000.00",
  "MS Flat Bar 40x6mm  7214   60  720.00   43200.00",
  "Taxable Value 145200.00",
  "CGST @ 9% 13068.00",
  "SGST @ 9% 13068.00",
  "Total Invoice Value 171336.00"
].join("\n");

const main = async () => {
  const explicitId = process.argv[2];

  const lookup = await pool.query(
    explicitId
      ? "SELECT id, firm_id, file_name, status FROM documents WHERE id = $1"
      : `SELECT id, firm_id, file_name, status
           FROM documents
          WHERE doc_type = 'invoice' AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1`,
    explicitId ? [explicitId] : []
  );

  if (lookup.rowCount === 0) {
    console.error(
      explicitId
        ? `No document found with id ${explicitId}`
        : "No invoice documents found -- upload one first."
    );
    process.exit(1);
  }

  const document = lookup.rows[0];
  console.log(`Seeding extraction for ${document.file_name} (${document.id})`);
  console.log(`  current status: ${document.status}`);

  await withTenantTransaction({ firmId: document.firm_id }, async (db) => {
    await db.query(
      `
        INSERT INTO extractions (document_id, raw_text, structured_data, confidence_score)
        VALUES ($1, $2, $3::jsonb, $4)
        ON CONFLICT (document_id) DO UPDATE
          SET raw_text = EXCLUDED.raw_text,
              structured_data = EXCLUDED.structured_data,
              confidence_score = EXCLUDED.confidence_score,
              updated_at = NOW()
      `,
      [document.id, rawText, JSON.stringify(structuredData), CONFIDENCE]
    );

    // review_required is the status the worker itself would land on; it keeps the
    // amber review banner visible on the review page, which is worth showing.
    await db.query(
      `UPDATE documents
          SET status = 'review_required', processing_error = NULL
        WHERE id = $1 AND firm_id = $2`,
      [document.id, document.firm_id]
    );
  });

  console.log(`  seeded: confidence=${CONFIDENCE}, status -> review_required`);
  console.log(`  review page: http://localhost:5173/review/${document.id}`);

  await pool.end();
};

main().catch(async (error) => {
  console.error("Seed failed:", error);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
