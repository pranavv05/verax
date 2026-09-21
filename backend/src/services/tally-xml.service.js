const ALLOWED_VOUCHER_TYPES = new Set([
  "Purchase",
  "Sales",
  "Payment",
  "Receipt",
  "Journal"
]);

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseDateValue = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const yyyymmdd = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (yyyymmdd) {
      return new Date(Date.UTC(Number(yyyymmdd[1]), Number(yyyymmdd[2]) - 1, Number(yyyymmdd[3])));
    }
    return new Date(trimmed);
  }
  return null;
};

const formatTallyDate = (inputDate, fallbackDate = new Date()) => {
  const parsedInput = parseDateValue(inputDate);
  const fallbackCandidate = parseDateValue(fallbackDate);
  const parsedFallback =
    fallbackCandidate && !Number.isNaN(fallbackCandidate.getTime()) ? fallbackCandidate : new Date();
  const d = parsedInput && !Number.isNaN(parsedInput.getTime()) ? parsedInput : parsedFallback;
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
};

/* ── Invoice / Bill helpers ─────────────────────────────────────────────────── */

const inferVoucherType = ({ docType, extraction }) => {
  const explicitType =
    extraction.voucher_type || extraction.transaction_type || extraction.entry_type;
  if (typeof explicitType === "string") {
    const normalized = explicitType.trim().toLowerCase();
    const match = ["purchase", "sales", "payment", "receipt", "journal"].find(
      (n) => n === normalized
    );
    if (match) return `${match.charAt(0).toUpperCase()}${match.slice(1)}`;
  }

  if (docType === "invoice" || docType === "bill") return "Purchase";
  return "Journal";
};

const getPartyLedgerName = (extraction) =>
  extraction.vendor_name ||
  extraction.supplierName ||
  extraction.supplier_name ||
  extraction.party_ledger ||
  extraction.customer_name ||
  extraction.client_name ||
  "Unknown Party";

const getPurchaseLedgerName = (extraction) =>
  extraction.purchase_ledger ||
  extraction.expense_ledger ||
  extraction.ledger_name ||
  extraction.tally_ledger_name ||
  "Purchase";

const buildTaxLedgerEntries = (extraction) => {
  const entries = [];
  const cgst = toNumber(extraction.cgst);
  const sgst = toNumber(extraction.sgst);
  const igst = toNumber(extraction.igst);

  if (cgst && cgst > 0) {
    entries.push(`
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>CGST</LEDGERNAME>
                <AMOUNT>-${cgst.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`);
  }
  if (sgst && sgst > 0) {
    entries.push(`
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>SGST</LEDGERNAME>
                <AMOUNT>-${sgst.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`);
  }
  if (igst && igst > 0) {
    entries.push(`
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>IGST</LEDGERNAME>
                <AMOUNT>-${igst.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`);
  }
  return entries.join("");
};

const buildInventoryEntries = (extraction, voucherType) => {
  const items = Array.isArray(extraction.line_items) ? extraction.line_items : [];
  const inventoryItems = items.filter((item) => item.tally_item_name?.trim());
  if (inventoryItems.length === 0) return "";

  const isDeemedPositive = voucherType === "Purchase" ? "Yes" : "No";
  return inventoryItems
    .map((item) => {
      const qty = toNumber(item.quantity) ?? 0;
      const rate = toNumber(item.unit_price) ?? 0;
      const amount = toNumber(item.total) ?? qty * rate;
      const uom = item.uom || "PCS";
      return `
              <ALLINVENTORYENTRIES.LIST>
                <STOCKITEMNAME>${escapeXml(item.tally_item_name.trim())}</STOCKITEMNAME>
                <ISDEEMEDPOSITIVE>${isDeemedPositive}</ISDEEMEDPOSITIVE>
                <RATE>${escapeXml(rate.toFixed(2))}/${escapeXml(uom)}</RATE>
                <AMOUNT>${isDeemedPositive === "Yes" ? "-" : ""}${escapeXml(amount.toFixed(2))}</AMOUNT>
                <ACTUALQTY>${escapeXml(String(qty))} ${escapeXml(uom)}</ACTUALQTY>
                <BILLEDQTY>${escapeXml(String(qty))} ${escapeXml(uom)}</BILLEDQTY>
              </ALLINVENTORYENTRIES.LIST>`;
    })
    .join("");
};

const buildInvoiceVoucherXml = (document) => {
  const extraction = document.structured_data || {};
  const voucherType = inferVoucherType({ docType: document.doc_type, extraction });
  const safeVoucherType = ALLOWED_VOUCHER_TYPES.has(voucherType) ? voucherType : "Journal";
  const partyLedgerName = getPartyLedgerName(extraction);
  const voucherDate = formatTallyDate(
    extraction.invoice_date || extraction.invoiceDate || extraction.date || extraction.document_date,
    document.uploaded_at
  );

  const narrationParts = [];
  const invoiceNumber = extraction.invoice_number || extraction.invoiceNumber;
  if (invoiceNumber) narrationParts.push(`Invoice ${invoiceNumber}`);
  if (document.file_name) narrationParts.push(`File ${document.file_name}`);
  const narration = narrationParts.join(" | ") || "Imported from Verax";

  const totalAmount = toNumber(extraction.total_amount ?? extraction.totalAmount) ?? 0;
  const cgst = toNumber(extraction.cgst) ?? 0;
  const sgst = toNumber(extraction.sgst) ?? 0;
  const igst = toNumber(extraction.igst) ?? 0;
  const taxAmount = cgst + sgst + igst;
  // Always derived from total - tax, never taken from the extracted
  // taxable_amount/subtotal field directly: a voucher's party-ledger leg
  // (totalAmount) must equal its purchase-ledger + tax legs by construction,
  // or Tally's double-entry import is unbalanced. Taking the LLM/OCR's
  // taxable_amount verbatim let an internally-inconsistent extraction (the
  // exact case the Review page's own tax-math warning flags) still export
  // into books that don't balance. Genuinely bad extractions (e.g. a
  // missing total_amount) are caught before this point by
  // assertDocumentsPassTaxMath in exports.service.js, not papered over here.
  const taxableAmount = totalAmount - taxAmount;
  const purchaseLedgerName = getPurchaseLedgerName(extraction);

  const gstin = extraction.vendor_gstin || extraction.supplierGSTIN || extraction.supplier_gstin;
  const gstinRef = gstin
    ? `\n            <PARTYGSTIN>${escapeXml(gstin)}</PARTYGSTIN>`
    : "";
  const invoiceRef = invoiceNumber
    ? `\n            <REFERENCE>${escapeXml(invoiceNumber)}</REFERENCE>`
    : "";

  const inventoryXml = buildInventoryEntries(extraction, safeVoucherType);
  // Numeric negation (-x), not string-concatenating a literal "-": totalAmount
  // and taxableAmount can legitimately be negative (a credit note misfiled as
  // an invoice, or a missing total_amount driving taxableAmount below zero —
  // see the taxableAmount comment above). Prepending a literal "-" to an
  // already-negative formatted string produces a garbage double-negative
  // like "--900.00", which is not a valid Tally AMOUNT.
  const partyAmount = safeVoucherType === "Purchase" ? totalAmount : -totalAmount;
  const purchaseAmount = -taxableAmount;
  const partyEntry = `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${escapeXml(partyLedgerName)}</LEDGERNAME>
                <AMOUNT>${escapeXml(partyAmount.toFixed(2))}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
  const purchaseEntry = `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${escapeXml(purchaseLedgerName)}</LEDGERNAME>
                <AMOUNT>${escapeXml(purchaseAmount.toFixed(2))}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
  const ledgerXml = partyEntry + purchaseEntry + buildTaxLedgerEntries(extraction);

  return `
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="${escapeXml(safeVoucherType)}" ACTION="Create">
            <DATE>${escapeXml(voucherDate)}</DATE>
            <NARRATION>${escapeXml(narration)}</NARRATION>
            <PARTYLEDGERNAME>${escapeXml(partyLedgerName)}</PARTYLEDGERNAME>${gstinRef}${invoiceRef}${ledgerXml}${inventoryXml}
          </VOUCHER>
        </TALLYMESSAGE>`;
};

/* ── Bank Statement helpers ─────────────────────────────────────────────────── */

const buildBankTransactionVoucherXml = (txn, document) => {
  const extraction = document.structured_data || {};
  const bankLedger = extraction.bank_name
    ? `${extraction.bank_name} - ${extraction.account_number || "Bank"}`.trim()
    : "Bank Account";

  const debit = toNumber(txn.debit);
  const credit = toNumber(txn.credit);

  // Credit entry → money coming in → Receipt voucher
  // Debit entry  → money going out → Payment voucher
  const isCredit = credit !== null && credit > 0;
  const voucherType = isCredit ? "Receipt" : "Payment";
  const amount = isCredit ? credit : (debit ?? 0);

  const narration = [txn.narration, txn.reference].filter(Boolean).join(" | ") || "Bank transaction";
  const voucherDate = formatTallyDate(txn.date, document.uploaded_at);

  return `
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="${voucherType}" ACTION="Create">
            <DATE>${escapeXml(voucherDate)}</DATE>
            <NARRATION>${escapeXml(narration)}</NARRATION>
            <PARTYLEDGERNAME>${escapeXml(bankLedger)}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(bankLedger)}</LEDGERNAME>
              <AMOUNT>${isCredit ? "" : "-"}${escapeXml(amount.toFixed(2))}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${isCredit ? "Sales Account" : "Purchase Account"}</LEDGERNAME>
              <AMOUNT>${isCredit ? "-" : ""}${escapeXml(amount.toFixed(2))}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`;
};

const buildBankStatementVouchersXml = (document) => {
  const extraction = document.structured_data || {};
  const transactions = Array.isArray(extraction.transactions) ? extraction.transactions : [];

  if (transactions.length === 0) {
    // Fall back to single voucher from closing/opening balance difference
    const closingBalance = toNumber(extraction.closing_balance);
    const openingBalance = toNumber(extraction.opening_balance);
    const amount =
      closingBalance !== null && openingBalance !== null
        ? closingBalance - openingBalance
        : toNumber(extraction.total_amount) ?? 0;
    const isCredit = amount >= 0;
    const absAmount = Math.abs(amount);

    const bankLedger = extraction.bank_name
      ? `${extraction.bank_name} - ${extraction.account_number || "Bank"}`.trim()
      : "Bank Account";
    const voucherDate = formatTallyDate(
      extraction.statement_period_to || extraction.statement_period_from,
      document.uploaded_at
    );
    // Same two-legged shape as buildBankTransactionVoucherXml below — the
    // previous version of this fallback emitted only the bank-ledger leg
    // with no offsetting entry at all, a structurally single-sided voucher
    // that TallyPrime's double-entry import would very likely reject.
    const counterLedger = isCredit ? "Sales Account" : "Purchase Account";
    return `
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="${isCredit ? "Receipt" : "Payment"}" ACTION="Create">
            <DATE>${escapeXml(voucherDate)}</DATE>
            <NARRATION>${escapeXml(`Bank Statement - ${extraction.bank_name || ""} ${extraction.account_number || ""}`.trim() || "Bank Statement")}</NARRATION>
            <PARTYLEDGERNAME>${escapeXml(bankLedger)}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(bankLedger)}</LEDGERNAME>
              <AMOUNT>${isCredit ? "" : "-"}${escapeXml(absAmount.toFixed(2))}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(counterLedger)}</LEDGERNAME>
              <AMOUNT>${isCredit ? "-" : ""}${escapeXml(absAmount.toFixed(2))}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`;
  }

  return transactions
    .filter((txn) => toNumber(txn.debit) || toNumber(txn.credit))
    .map((txn) => buildBankTransactionVoucherXml(txn, document))
    .join("");
};

/* ── Entry point ────────────────────────────────────────────────────────────── */

const buildVoucherXml = (document) => {
  if (document.doc_type === "bank_statement") {
    return buildBankStatementVouchersXml(document);
  }
  return buildInvoiceVoucherXml(document);
};

const buildTallyXml = ({ documents }) => {
  const vouchersXml = documents.map((document) => buildVoucherXml(document)).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>${vouchersXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
};

module.exports = {
  buildTallyXml
};

if (require.main === module) {
  const testInvoice = {
    doc_type: "invoice",
    file_name: "test-invoice.pdf",
    uploaded_at: "2025-04-16",
    structured_data: {
      invoiceNumber: "INV-TEST-001",
      invoiceDate: "2025-04-15",
      supplierName: "Test Supplier",
      supplierGSTIN: "29ABCDE1234F1Z5",
      line_items: [
        {
          description: "Office Supplies",
          quantity: 10,
          unit_price: 500,
          total: 5000
        }
      ],
      cgst: 450,
      sgst: 450,
      totalAmount: 5900
    }
  };
  const xml = buildTallyXml({ documents: [testInvoice] });
  const ledgerAmounts = Array.from(
    xml.matchAll(/<ALLLEDGERENTRIES\.LIST>[\s\S]*?<AMOUNT>(-?\d+(?:\.\d+)?)<\/AMOUNT>[\s\S]*?<\/ALLLEDGERENTRIES\.LIST>/g)
  ).map((match) => Number(match[1]));
  const debitTotal = ledgerAmounts.filter((amount) => amount > 0).reduce((sum, amount) => sum + amount, 0);
  const creditTotal = Math.abs(
    ledgerAmounts.filter((amount) => amount < 0).reduce((sum, amount) => sum + amount, 0)
  );

  console.log(xml);
  console.log({
    hasCgstLedger: xml.includes("<LEDGERNAME>CGST</LEDGERNAME>"),
    hasSgstLedger: xml.includes("<LEDGERNAME>SGST</LEDGERNAME>"),
    debitTotal,
    creditTotal,
    isBalanced: debitTotal === creditTotal
  });
}
