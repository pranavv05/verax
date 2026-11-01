const {
  getPeriodRange,
  buildInvoiceFromExtraction
} = require("../../src/services/reconciliation.service");

describe("getPeriodRange — period validation (defence in depth)", () => {
  test("accepts a valid MMYYYY period and returns that month's range", () => {
    const { start, end } = getPeriodRange("052026");
    expect(start.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-31T23:59:59.999Z");
  });

  test("rejects a 4-digit year-only value (would have yielded a 1927 window)", () => {
    expect(() => getPeriodRange("2026")).toThrow(/MMYYYY/);
  });

  test("rejects a month of 00 or 13", () => {
    expect(() => getPeriodRange("002026")).toThrow(/MMYYYY/);
    expect(() => getPeriodRange("132026")).toThrow(/MMYYYY/);
  });

  test("rejects non-string / garbage input instead of returning null dates", () => {
    expect(() => getPeriodRange("XXYYYY")).toThrow(/MMYYYY/);
    expect(() => getPeriodRange(null)).toThrow(/MMYYYY/);
    expect(() => getPeriodRange("")).toThrow(/MMYYYY/);
  });

  test("the valid-period error carries a 400 status", () => {
    let status;
    try {
      getPeriodRange("bad");
    } catch (e) {
      status = e.statusCode;
    }
    expect(status).toBe(400);
  });
});

describe("buildInvoiceFromExtraction", () => {
  test("derives GST from cgst+sgst+igst when tax_amount is absent", () => {
    const inv = buildInvoiceFromExtraction("doc1", {
      invoice_number: "INV1",
      vendor_gstin: "27AAPFU0939F1ZV",
      taxable_amount: 1000,
      cgst: 90,
      sgst: 90,
      invoice_date: "2026-05-10"
    });
    expect(inv.invoiceNumber).toBe("INV1");
    expect(inv.supplierGSTIN).toBe("27AAPFU0939F1ZV");
    expect(inv.taxableAmount).toBe(1000);
    expect(inv.gstAmount).toBe(180);
  });
});
