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
  const narration = narrationParts.join(" | ") || "Imported from CA SaaS";

  const ledgerEntries = buildLedgerEntries(extraction, partyLedgerName);
  const ledgerXml = ledgerEntries
    .map(
      (entry) => `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${escapeXml(entry.ledgerName)}</LEDGERNAME>
                <AMOUNT>${escapeXml(entry.amount.toFixed(2))}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`
    )
    .join("");

  return `
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="${escapeXml(safeVoucherType)}" ACTION="Create">
            <DATE>${escapeXml(voucherDate)}</DATE>
            <NARRATION>${escapeXml(narration)}</NARRATION>
            <PARTYLEDGERNAME>${escapeXml(partyLedgerName)}</PARTYLEDGERNAME>${ledgerXml}
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
