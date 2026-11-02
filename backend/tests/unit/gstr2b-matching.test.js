const {
  normalizeGstr2bRecord,
  matchInvoices,
  unavailableResults
} = require("../../src/services/gstr2b-matching");

describe("normalizeGstr2bRecord", () => {
  test("maps GSTN API short keys to the canonical shape", () => {
    const record = normalizeGstr2bRecord({
      inum: "INV-1",
      ctin: "27AAPFU0939F1ZV",
      txval: 1000,
      iamt: 180,
      dt: "2026-05-01"
    });
    expect(record.invoiceNumber).toBe("INV-1");
    expect(record.supplierGSTIN).toBe("27AAPFU0939F1ZV");
    expect(record.taxableAmount).toBe(1000);
    expect(record.gstAmount).toBe(180);
  });

  test("sums cgst+sgst+cess when there is no igst", () => {
    const record = normalizeGstr2bRecord({ inum: "INV-2", camt: 90, samt: 90, csamt: 10 });
    expect(record.gstAmount).toBe(190);
  });

  test("sums the GSTN tax components even when igst is explicitly 0 (real intra-state 2B shape)", () => {
    // Regression: GSTN sets iamt:0 on intra-state invoices. The old `?? iamt`
    // treated that present 0 as the total and returned gstAmount 0, zeroing GST
    // for every intra-state invoice. It must sum iamt+camt+samt+csamt. (The
    // Sandbox adapter maps igst->iamt, cgst->camt, sgst->samt, cess->csamt
    // before calling this, so the short keys are what flow through.)
    const record = normalizeGstr2bRecord({
      inum: "INV-INTRA",
      txval: 1694.92,
      iamt: 0,
      camt: 152.54,
      samt: 152.54,
      csamt: 0
    });
    expect(record.gstAmount).toBeCloseTo(305.08, 2);
  });

  test("accepts already-normalised camelCase records (GSP wrapper output)", () => {
    const record = normalizeGstr2bRecord({
      invoiceNumber: "INV-3",
      supplierGSTIN: "27AAPFU0939F1ZV",
      taxableAmount: 500,
      gstAmount: 90
    });
    expect(record.invoiceNumber).toBe("INV-3");
    expect(record.gstAmount).toBe(90);
  });
});

describe("matchInvoices", () => {
  const records = [
    {
      inum: "INV-1",
      ctin: "27AAPFU0939F1ZV",
      txval: 1000,
      iamt: 180,
      dt: "2026-05-01"
    }
  ];

  test("marks an exact match as matched", () => {
    const invoices = [
      {
        invoiceNumber: "INV-1",
        supplierGSTIN: "27AAPFU0939F1ZV",
        taxableAmount: 1000,
        gstAmount: 180,
        invoiceDate: "2026-05-01"
      }
    ];
    const [result] = matchInvoices(invoices, records);
    expect(result.matchStatus).toBe("matched");
    expect(result.mismatchFields).toEqual([]);
  });

  test("ignores surrounding whitespace and case in the invoice number", () => {
    const invoices = [
      {
        invoiceNumber: " inv-1 ",
        supplierGSTIN: "27AAPFU0939F1ZV",
        taxableAmount: 1000,
        gstAmount: 180,
        invoiceDate: "2026-05-01"
      }
    ];
    const [result] = matchInvoices(invoices, records);
    expect(result.matchStatus).toBe("matched");
  });

  test("flags an amount difference beyond tolerance as partial", () => {
    const invoices = [
      {
        invoiceNumber: "INV-1",
        supplierGSTIN: "27AAPFU0939F1ZV",
        taxableAmount: 1000,
        gstAmount: 200,
        invoiceDate: "2026-05-01"
      }
    ];
    const [result] = matchInvoices(invoices, records);
    expect(result.matchStatus).toBe("partial");
    expect(result.mismatchFields).toContain("gstAmount");
  });

  test("a supplier-GSTIN difference is a hard mismatch", () => {
    const invoices = [
      {
        invoiceNumber: "INV-1",
        supplierGSTIN: "29AAPFU0939F1ZV",
        taxableAmount: 1000,
        gstAmount: 180,
        invoiceDate: "2026-05-01"
      }
    ];
    const [result] = matchInvoices(invoices, records);
    expect(result.matchStatus).toBe("mismatch");
    expect(result.mismatchFields).toContain("supplierGSTIN");
  });

  test("an invoice absent from 2B is not_found", () => {
    const invoices = [
      {
        invoiceNumber: "INV-999",
        supplierGSTIN: "27AAPFU0939F1ZV",
        taxableAmount: 1000,
        gstAmount: 180,
        invoiceDate: "2026-05-01"
      }
    ];
    const [result] = matchInvoices(invoices, records);
    expect(result.matchStatus).toBe("not_found");
  });

  test("tolerates rupee rounding within 1", () => {
    const invoices = [
      {
        invoiceNumber: "INV-1",
        supplierGSTIN: "27AAPFU0939F1ZV",
        taxableAmount: 1000.4,
        gstAmount: 179.6,
        invoiceDate: "2026-05-01"
      }
    ];
    const [result] = matchInvoices(invoices, records);
    expect(result.matchStatus).toBe("matched");
  });

  test("preserves input order", () => {
    const invoices = [
      { invoiceNumber: "INV-999", supplierGSTIN: "27AAPFU0939F1ZV", taxableAmount: 1, gstAmount: 1, invoiceDate: "2026-05-01" },
      { invoiceNumber: "INV-1", supplierGSTIN: "27AAPFU0939F1ZV", taxableAmount: 1000, gstAmount: 180, invoiceDate: "2026-05-01" }
    ];
    const results = matchInvoices(invoices, records);
    expect(results[0].matchStatus).toBe("not_found");
    expect(results[1].matchStatus).toBe("matched");
  });
});

describe("unavailableResults", () => {
  test("returns one unavailable result per invoice, in order", () => {
    const invoices = [{ invoiceNumber: "A" }, { invoiceNumber: "B" }];
    const results = unavailableResults(invoices);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.matchStatus === "unavailable")).toBe(true);
    expect(results[1].invoiceNumber).toBe("B");
  });
});
