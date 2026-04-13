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
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatTallyDate = (inputDate, fallbackDate = new Date()) => {
  const source =
    typeof inputDate === "string" && inputDate.trim() ? new Date(inputDate) : fallbackDate;
  if (Number.isNaN(source.getTime())) {
    const fallback = new Date(fallbackDate);
    return `${fallback.getUTCFullYear()}${String(fallback.getUTCMonth() + 1).padStart(2, "0")}${String(
      fallback.getUTCDate()
    ).padStart(2, "0")}`;
  }

  return `${source.getUTCFullYear()}${String(source.getUTCMonth() + 1).padStart(2, "0")}${String(
    source.getUTCDate()
  ).padStart(2, "0")}`;
};

const inferVoucherType = ({ docType, extraction }) => {
  const explicitType =
    extraction.voucher_type || extraction.transaction_type || extraction.entry_type;
  if (typeof explicitType === "string") {
    const normalized = explicitType.trim().toLowerCase();
    const match = ["purchase", "sales", "payment", "receipt", "journal"].find(
      (name) => name === normalized
    );
    if (match) {
      return `${match.charAt(0).toUpperCase()}${match.slice(1)}`;
    }
  }

  if (docType === "bank_statement") {
    const amount = toNumber(extraction.total_amount);
    if (amount !== null && amount >= 0) {
      return "Receipt";
    }
    return "Payment";
  }

  if (docType === "invoice" || docType === "bill") {
    return "Purchase";
  }

  return "Journal";
};

const getPartyLedgerName = (extraction) =>
  extraction.vendor_name ||
  extraction.party_ledger ||
  extraction.customer_name ||
  extraction.client_name ||
  "Unknown Party";

const buildLedgerEntries = (extraction, partyLedgerName) => {
  const items = Array.isArray(extraction.line_items) ? extraction.line_items : [];
  if (items.length > 0) {
    const derived = items
      .map((item) => {
        const amount = toNumber(item.total) ?? toNumber(item.amount) ?? 0;
        const ledgerName = item.description || partyLedgerName;
        return {
          ledgerName,
          amount
        };
      })
      .filter((entry) => entry.amount !== 0);

    if (derived.length > 0) {
      return derived;
    }
  }

  const totalAmount = toNumber(extraction.total_amount) ?? 0;
  return [
    {
      ledgerName: partyLedgerName,
      amount: totalAmount
    }
  ];
};

const buildInventoryEntries = (extraction, voucherType) => {
  const items = Array.isArray(extraction.line_items) ? extraction.line_items : [];
  const inventoryItems = items.filter(
    (item) => item.tally_item_name && item.tally_item_name.trim()
  );

  if (inventoryItems.length === 0) return "";

  const isDeemedPositive = voucherType === "Purchase" ? "Yes" : "No";

  return inventoryItems
    .map((item) => {
      const qty = toNumber(item.quantity) ?? 0;
      const rate = toNumber(item.unit_price) ?? 0;
      const amount = toNumber(item.total) ?? qty * rate;
      const uom = item.uom || "PCS";
      const stockName = item.tally_item_name.trim();

      return `
              <ALLINVENTORYENTRIES.LIST>
                <STOCKITEMNAME>${escapeXml(stockName)}</STOCKITEMNAME>
                <ISDEEMEDPOSITIVE>${isDeemedPositive}</ISDEEMEDPOSITIVE>
                <RATE>${escapeXml(rate.toFixed(2))}/${escapeXml(uom)}</RATE>
                <AMOUNT>${isDeemedPositive === "Yes" ? "-" : ""}${escapeXml(amount.toFixed(2))}</AMOUNT>
                <ACTUALQTY>${escapeXml(String(qty))} ${escapeXml(uom)}</ACTUALQTY>
                <BILLEDQTY>${escapeXml(String(qty))} ${escapeXml(uom)}</BILLEDQTY>
              </ALLINVENTORYENTRIES.LIST>`;
    })
    .join("");
};

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

const buildVoucherXml = (document) => {
  const extraction = document.structured_data || {};
  const voucherType = inferVoucherType({ docType: document.doc_type, extraction });
  const safeVoucherType = ALLOWED_VOUCHER_TYPES.has(voucherType) ? voucherType : "Journal";
  const partyLedgerName = getPartyLedgerName(extraction);
  const voucherDate = formatTallyDate(
    extraction.invoice_date || extraction.date || extraction.document_date,
    document.uploaded_at
  );

  const narrationParts = [];
  if (extraction.invoice_number) {
    narrationParts.push(`Invoice ${extraction.invoice_number}`);
  }
  if (document.file_name) {
    narrationParts.push(`File ${document.file_name}`);
  }
  const narration = narrationParts.join(" | ") || "Imported from Verax";

  const totalAmount = toNumber(extraction.total_amount) ?? 0;

  // Party ledger entry (debit for purchase, credit for sales)
  const partyLedgerXml = `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${escapeXml(partyLedgerName)}</LEDGERNAME>
                <AMOUNT>${safeVoucherType === "Purchase" ? "" : "-"}${escapeXml(totalAmount.toFixed(2))}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;

  // Purchase/expense account entry
  const taxableAmount = toNumber(extraction.taxable_amount ?? extraction.subtotal) ?? totalAmount;
  const purchaseAccountXml = `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>Purchase Account</LEDGERNAME>
                <AMOUNT>-${escapeXml(taxableAmount.toFixed(2))}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;

  // Tax ledger entries
  const taxLedgerXml = buildTaxLedgerEntries(extraction);

  // Inventory entries (only for Purchase/Sales with line items that have tally_item_name)
  const inventoryXml = buildInventoryEntries(extraction, safeVoucherType);
  const hasInventory = inventoryXml.length > 0;

  // Build ledger section: if we have inventory, use proper accounting entries.
  // Otherwise fall back to the simpler format.
  let ledgerXml;
  if (hasInventory && (safeVoucherType === "Purchase" || safeVoucherType === "Sales")) {
    ledgerXml = partyLedgerXml + purchaseAccountXml + taxLedgerXml;
  } else {
    const ledgerEntries = buildLedgerEntries(extraction, partyLedgerName);
    ledgerXml = ledgerEntries
      .map(
        (entry) => `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${escapeXml(entry.ledgerName)}</LEDGERNAME>
                <AMOUNT>${escapeXml(entry.amount.toFixed(2))}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`
      )
      .join("");
  }

  // GSTIN reference number
  const gstinRef = extraction.vendor_gstin
    ? `
            <PARTYGSTIN>${escapeXml(extraction.vendor_gstin)}</PARTYGSTIN>`
    : "";

  // Invoice reference
  const invoiceRef = extraction.invoice_number
    ? `
            <REFERENCE>${escapeXml(extraction.invoice_number)}</REFERENCE>`
    : "";

  return `
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="${escapeXml(safeVoucherType)}" ACTION="Create">
            <DATE>${escapeXml(voucherDate)}</DATE>
            <NARRATION>${escapeXml(narration)}</NARRATION>
            <PARTYLEDGERNAME>${escapeXml(partyLedgerName)}</PARTYLEDGERNAME>${gstinRef}${invoiceRef}${ledgerXml}${inventoryXml}
          </VOUCHER>
        </TALLYMESSAGE>`;
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
