const assert = require("assert");
const { buildTallyXml } = require("../backend/src/services/tally-xml.service");

function record(results, name, fn) {
  try {
    fn();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

const syntheticOcrInputs = {
  A: `TAX INVOICE
Invoice No: INV-2025-001  Date: 15/04/2025
Vendor: Sharma Traders  GSTIN: 29ABCDE1234F1Z5
Item: Office Supplies  Qty: 10  Rate: 500  Amount: 5000
CGST 9%: 450  SGST 9%: 450  Total: 5900`,
  B: `TAX INV0ICE
lnvoice N0: lNV-2O25-OO1  D@te: 15/O4/2O25
Vend0r: Sharma Tr@ders  GSTIN: 29ABCDE1234F1Z5
lt em: 0ffice Suppl1es  Qty: 1O  R@te: 5OO  Am0unt: 5OOO
CGST 9%: 45O  SGST 9%: 45O  T0tal: 59OO`,
  C: `TAX INVOICE
Invoice No: INV-2025-002
Vendor: Gupta Electronics`,
  D: `STATE BANK OF INDIA
Account Statement  Period: Apr 2025
Date        Narration           Debit    Credit   Balance
01/04/2025  Opening Balance                       50000.00`,
  E: `कर चालान / TAX INVOICE
Invoice No: INV-001
विक्रेता / Vendor: राम Trading Co
Total: 11800`
};

const fullInvoiceDocument = {
  id: "doc-1",
  doc_type: "invoice",
  file_name: "invoice.pdf",
  uploaded_at: "2025-04-16T00:00:00Z",
  structured_data: {
    invoiceNumber: "INV-2025-001",
    invoiceDate: "2025-04-15",
    supplierName: "Sharma & Sons <Traders>",
    supplierGSTIN: "29ABCDE1234F1Z5",
    lineItems: [{ description: "Office Supplies", quantity: 10, rate: 500, amount: 5000 }],
    cgst: 450,
    sgst: 450,
    igst: 0,
    totalAmount: 5900
  }
};

const snakeCaseInvoiceDocument = {
  ...fullInvoiceDocument,
  structured_data: {
    invoice_number: "INV-2025-001",
    invoice_date: "2025-04-15",
    vendor_name: "Sharma & Sons <Traders>",
    vendor_gstin: "29ABCDE1234F1Z5",
    line_items: [{ description: "Office Supplies", quantity: 10, unit_price: 500, total: 5000 }],
    cgst: 450,
    sgst: 450,
    igst: 0,
    subtotal: 5000,
    total_amount: 5900
  }
};

const results = [];
let camelXml = "";
let camelError = null;
let snakeXml = "";
let snakeError = null;

try {
  camelXml = buildTallyXml({ documents: [fullInvoiceDocument] });
} catch (error) {
  camelError = error;
}

try {
  snakeXml = buildTallyXml({ documents: [snakeCaseInvoiceDocument] });
} catch (error) {
  snakeError = error;
}

record(results, "Synthetic OCR inputs are available for prompt QA", () => {
  assert.strictEqual(Object.keys(syntheticOcrInputs).length, 5);
});

record(results, "CamelCase extracted invoice contains ENVELOPE", () => {
  assert.ifError(camelError);
  assert(camelXml.includes("<ENVELOPE>"));
});

record(results, "CamelCase invoice date becomes 20250415", () => {
  assert.ifError(camelError);
  assert(camelXml.includes("<DATE>20250415</DATE>"));
});

record(results, "CamelCase supplier GSTIN appears in XML", () => {
  assert.ifError(camelError);
  assert(camelXml.includes("29ABCDE1234F1Z5"));
});

record(results, "CamelCase supplier name is XML-escaped", () => {
  assert.ifError(camelError);
  assert(camelXml.includes("Sharma &amp; Sons &lt;Traders&gt;"));
});

record(results, "Snake-case invoice date becomes 20250415", () => {
  assert.ifError(snakeError);
  assert(snakeXml.includes("<DATE>20250415</DATE>"));
});

record(results, "Snake-case CGST and SGST ledger entries are present", () => {
  assert.ifError(snakeError);
  assert(snakeXml.includes("<LEDGERNAME>CGST</LEDGERNAME>"));
  assert(snakeXml.includes("<LEDGERNAME>SGST</LEDGERNAME>"));
});

record(results, "Snake-case supplier GSTIN appears in PARTYGSTIN", () => {
  assert.ifError(snakeError);
  assert(snakeXml.includes("<PARTYGSTIN>29ABCDE1234F1Z5</PARTYGSTIN>"));
});

record(results, "Snake-case voucher ledger amounts balance to zero", () => {
  assert.ifError(snakeError);
  const amounts = [...snakeXml.matchAll(/<AMOUNT>(-?\d+\.\d{2})<\/AMOUNT>/g)].map((m) => Number(m[1]));
  const sum = amounts.reduce((acc, amount) => acc + amount, 0);
  assert.strictEqual(sum, 0);
});

console.log(JSON.stringify({ results }, null, 2));
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
