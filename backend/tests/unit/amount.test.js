const { toAmount } = require("../../src/utils/amount");
const { buildInvoiceFromExtraction } = require("../../src/services/reconciliation.service");

describe("toAmount", () => {
  test("reads numbers and Indian-formatted strings", () => {
    expect(toAmount(21366)).toBe(21366);
    expect(toAmount("1,40,066.00")).toBe(140066);
    expect(toAmount(" 0 ")).toBe(0);
  });

  test("treats blank, non-numeric and non-finite values as missing", () => {
    for (const value of ["", "   ", "abc", null, undefined, NaN, Infinity, {}]) {
      expect(toAmount(value)).toBeNull();
    }
  });
});

describe("GSTR-2B reconciliation invoice", () => {
  // A blank "Total tax" read as 0 GST, so the invoice could never match GSTR-2B.
  test("falls back to CGST + SGST + IGST when tax_amount is blank", () => {
    const invoice = buildInvoiceFromExtraction("doc-1", {
      invoice_number: "NST-2026-1187",
      vendor_gstin: "24AAGFN5678Q1ZG",
      subtotal: 118700,
      cgst: "",
      sgst: "",
      igst: 21366,
      tax_amount: ""
    });
    expect(invoice.gstAmount).toBe(21366);
    expect(invoice.taxableAmount).toBe(118700);
  });
});
