const { buildTallyXml } = require("../../src/services/tally-xml.service");

const extractAmounts = (xml) =>
  Array.from(
    xml.matchAll(
      /<ALLLEDGERENTRIES\.LIST>[\s\S]*?<AMOUNT>(-?\d+(?:\.\d+)?)<\/AMOUNT>[\s\S]*?<\/ALLLEDGERENTRIES\.LIST>/g
    )
  ).map((match) => Number(match[1]));

// Every voucher Tally imports must be a balanced double-entry: total debits
// (positive ledger amounts) must equal total credits (negative ledger
// amounts). An unbalanced voucher is silently rejected by TallyPrime on
// import, so this is the single most important invariant of the exporter.
const assertBalanced = (xml) => {
  const amounts = extractAmounts(xml);
  const debitTotal = amounts.filter((a) => a > 0).reduce((sum, a) => sum + a, 0);
  const creditTotal = Math.abs(amounts.filter((a) => a < 0).reduce((sum, a) => sum + a, 0));
  expect(debitTotal).toBeCloseTo(creditTotal, 2);
};

describe("buildTallyXml — invoice vouchers", () => {
  const baseInvoice = {
    doc_type: "invoice",
    file_name: "invoice-1.pdf",
    uploaded_at: "2025-04-16",
    structured_data: {
      invoiceNumber: "INV-001",
      invoiceDate: "2025-04-15",
      supplierName: "Test Supplier",
      supplierGSTIN: "29ABCDE1234F1Z5",
      line_items: [{ description: "Office Supplies", quantity: 10, unit_price: 500, total: 5000 }],
      cgst: 450,
      sgst: 450,
      totalAmount: 5900
    }
  };

  test("produces a balanced voucher for a standard intra-state invoice", () => {
    const xml = buildTallyXml({ documents: [baseInvoice] });
    assertBalanced(xml);
  });

  test("uses VCHTYPE Purchase for an invoice document", () => {
    const xml = buildTallyXml({ documents: [baseInvoice] });
    expect(xml).toMatch(/<VOUCHER VCHTYPE="Purchase"/);
  });

  test("includes CGST and SGST ledger entries when present", () => {
    const xml = buildTallyXml({ documents: [baseInvoice] });
    expect(xml).toContain("<LEDGERNAME>CGST</LEDGERNAME>");
    expect(xml).toContain("<LEDGERNAME>SGST</LEDGERNAME>");
  });

  test("omits a tax ledger entry when that tax is zero or absent", () => {
    const doc = {
      ...baseInvoice,
      structured_data: { ...baseInvoice.structured_data, sgst: 0, igst: undefined }
    };
    const xml = buildTallyXml({ documents: [doc] });
    expect(xml).toContain("<LEDGERNAME>CGST</LEDGERNAME>");
    expect(xml).not.toContain("<LEDGERNAME>SGST</LEDGERNAME>");
    expect(xml).not.toContain("<LEDGERNAME>IGST</LEDGERNAME>");
  });

  test("includes an inventory entry per line item with a tally_item_name", () => {
    const doc = {
      ...baseInvoice,
      structured_data: {
        ...baseInvoice.structured_data,
        line_items: [
          { tally_item_name: "Stationery", quantity: 10, unit_price: 500, total: 5000, uom: "PCS" }
        ]
      }
    };
    const xml = buildTallyXml({ documents: [doc] });
    expect(xml).toContain("<STOCKITEMNAME>Stationery</STOCKITEMNAME>");
    expect(xml).toContain("<ACTUALQTY>10 PCS</ACTUALQTY>");
  });

  test("skips line items with no tally_item_name (unmapped items don't hit inventory)", () => {
    const doc = {
      ...baseInvoice,
      structured_data: {
        ...baseInvoice.structured_data,
        line_items: [{ description: "Unmapped item", quantity: 1, unit_price: 100, total: 100 }]
      }
    };
    const xml = buildTallyXml({ documents: [doc] });
    expect(xml).not.toContain("ALLINVENTORYENTRIES");
  });

  test("escapes XML special characters in vendor/party names", () => {
    const doc = {
      ...baseInvoice,
      structured_data: { ...baseInvoice.structured_data, supplierName: 'A & B "Traders" <Pvt>' }
    };
    const xml = buildTallyXml({ documents: [doc] });
    expect(xml).toContain("A &amp; B &quot;Traders&quot; &lt;Pvt&gt;");
    expect(xml).not.toContain('A & B "Traders" <Pvt>');
  });

  test("falls back to Journal for a doc_type that isn't invoice/bill", () => {
    const doc = { ...baseInvoice, doc_type: "other" };
    const xml = buildTallyXml({ documents: [doc] });
    expect(xml).toMatch(/<VOUCHER VCHTYPE="Journal"/);
  });

  test("honors an explicit, recognized voucher_type override", () => {
    const doc = {
      ...baseInvoice,
      structured_data: { ...baseInvoice.structured_data, voucher_type: "sales" }
    };
    const xml = buildTallyXml({ documents: [doc] });
    expect(xml).toMatch(/<VOUCHER VCHTYPE="Sales"/);
  });

  test("normalizes a YYYYMMDD date and a natural date string the same way", () => {
    const withCompact = buildTallyXml({
      documents: [
        { ...baseInvoice, structured_data: { ...baseInvoice.structured_data, invoiceDate: "20250415" } }
      ]
    });
    expect(withCompact).toContain("<DATE>20250415</DATE>");
  });
});

describe("buildTallyXml — bank statement vouchers", () => {
  const bankDoc = {
    doc_type: "bank_statement",
    file_name: "statement.pdf",
    uploaded_at: "2025-04-16",
    structured_data: {
      bank_name: "HDFC Bank",
      account_number: "1234",
      transactions: [
        { date: "20250401", narration: "Payment received", credit: 10000, debit: null },
        { date: "20250402", narration: "Rent paid", debit: 5000, credit: null }
      ]
    }
  };

  test("produces a Receipt voucher for a credit transaction", () => {
    const xml = buildTallyXml({ documents: [bankDoc] });
    expect(xml).toMatch(/<VOUCHER VCHTYPE="Receipt"/);
  });

  test("produces a Payment voucher for a debit transaction", () => {
    const xml = buildTallyXml({ documents: [bankDoc] });
    expect(xml).toMatch(/<VOUCHER VCHTYPE="Payment"/);
  });

  test("each transaction voucher is individually balanced", () => {
    const xml = buildTallyXml({ documents: [bankDoc] });
    assertBalanced(xml);
  });

  test("skips zero-amount transactions", () => {
    const doc = {
      ...bankDoc,
      structured_data: {
        ...bankDoc.structured_data,
        transactions: [{ date: "20250401", narration: "No-op", debit: 0, credit: 0 }]
      }
    };
    const xml = buildTallyXml({ documents: [doc] });
    expect(xml).not.toContain("TALLYMESSAGE");
  });

  test("falls back to opening/closing balance delta when there are no transactions", () => {
    const doc = {
      ...bankDoc,
      structured_data: {
        bank_name: "HDFC Bank",
        account_number: "1234",
        transactions: [],
        opening_balance: 1000,
        closing_balance: 4000,
        statement_period_to: "20250430"
      }
    };
    const xml = buildTallyXml({ documents: [doc] });
    expect(xml).toMatch(/<VOUCHER VCHTYPE="Receipt"/);
    expect(xml).toContain("<AMOUNT>3000.00</AMOUNT>");
  });
});

describe("buildTallyXml — multi-document envelope", () => {
  test("wraps all vouchers in a single ENVELOPE with one voucher count matching input", () => {
    const invoice = {
      doc_type: "invoice",
      file_name: "a.pdf",
      structured_data: { invoiceNumber: "1", supplierName: "A", totalAmount: 100 }
    };
    const xml = buildTallyXml({ documents: [invoice, invoice] });
    expect(xml.startsWith("<ENVELOPE>")).toBe(true);
    expect((xml.match(/<TALLYMESSAGE>/g) || []).length).toBe(2);
  });
});
