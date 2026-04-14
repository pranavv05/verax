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

const formatTallyDate = (inputDate, fallbackDate = new Date()) => {
  const source =
    typeof inputDate === "string" && inputDate.trim() ? new Date(inputDate) : fallbackDate;
  const d = Number.isNaN(source.getTime()) ? new Date(fallbackDate) : source;
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
  extraction.party_ledger ||
  extraction.customer_name ||
  extraction.client_name ||
  "Unknown Party";

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
    extraction.invoice_date || extraction.date || extraction.document_date,
    document.uploaded_at
  );

  const narrationParts = [];
  if (extraction.invoice_number) narrationParts.push(`Invoice ${extraction.invoice_number}`);
  if (document.file_name) narrationParts.push(`File ${document.file_name}`);
  const narration = narrationParts.join(" | ") || "Imported from Verax";

  const totalAmount = toNumber(extraction.total_amount) ?? 0;
  const taxableAmount = toNumber(extraction.taxable_amount ?? extraction.subtotal) ?? totalAmount;

  const gstinRef = extraction.vendor_gstin
    ? `\n            <PARTYGSTIN>${escapeXml(extraction.vendor_gstin)}</PARTYGSTIN>`
    : "";
  const invoiceRef = extraction.invoice_number
    ? `\n            <REFERENCE>${escapeXml(extraction.invoice_number)}</REFERENCE>`
    : "";

  const inventoryXml = buildInventoryEntries(extraction, safeVoucherType);
  const hasInventory = inventoryXml.length > 0;

  let ledgerXml;
  if (hasInventory && (safeVoucherType === "Purchase" || safeVoucherType === "Sales")) {
    const partyEntry = `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${escapeXml(partyLedgerName)}</LEDGERNAME>
                <AMOUNT>${safeVoucherType === "Purchase" ? "" : "-"}${escapeXml(totalAmount.toFixed(2))}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
    const purchaseEntry = `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>Purchase Account</LEDGERNAME>
                <AMOUNT>-${escapeXml(taxableAmount.toFixed(2))}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
    ledgerXml = partyEntry + purchaseEntry + buildTaxLedgerEntries(extraction);
  } else {
    ledgerXml = `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${escapeXml(partyLedgerName)}</LEDGERNAME>
                <AMOUNT>${escapeXml(totalAmount.toFixed(2))}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
  }

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

    const bankLedger = extraction.bank_name
      ? `${extraction.bank_name} - ${extraction.account_number || "Bank"}`.trim()
      : "Bank Account";
    const voucherDate = formatTallyDate(
      extraction.statement_period_to || extraction.statement_period_from,
      document.uploaded_at
    );
    return `
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="${amount >= 0 ? "Receipt" : "Payment"}" ACTION="Create">
            <DATE>${escapeXml(voucherDate)}</DATE>
            <NARRATION>${escapeXml(`Bank Statement - ${extraction.bank_name || ""} ${extraction.account_number || ""}`.trim() || "Bank Statement")}</NARRATION>
            <PARTYLEDGERNAME>${escapeXml(bankLedger)}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(bankLedger)}</LEDGERNAME>
              <AMOUNT>${escapeXml(Math.abs(amount).toFixed(2))}</AMOUNT>
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

  return `<ENVELOPE>
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
