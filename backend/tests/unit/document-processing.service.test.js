const { detectDocTypeMismatch } = require("../../src/services/document-processing.service");

describe("detectDocTypeMismatch", () => {
  test("flags a bank_statement upload that extracted like an invoice", () => {
    const structuredData = {
      invoice_number: "INV-001",
      vendor_gstin: "27AAAAA0000A1Z5",
      line_items: [{ description: "Widget", amount: 100 }]
    };
    expect(detectDocTypeMismatch("bank_statement", structuredData)).toMatch(/bank statement.*invoice/i);
  });

  test("flags an invoice upload that extracted like a bank statement", () => {
    const structuredData = {
      transactions: [{ date: "2024-01-01", narration: "UPI transfer", debit: 500, credit: null, balance: 1000 }]
    };
    expect(detectDocTypeMismatch("invoice", structuredData)).toMatch(/invoice\/bill.*bank statement/i);
  });

  test("flags a bill upload that extracted like a bank statement", () => {
    const structuredData = {
      transactions: [{ date: "2024-01-01", narration: "NEFT", debit: null, credit: 200, balance: 800 }]
    };
    expect(detectDocTypeMismatch("bill", structuredData)).toMatch(/invoice\/bill.*bank statement/i);
  });

  test("does not flag a correctly-typed invoice", () => {
    const structuredData = {
      invoice_number: "INV-002",
      vendor_gstin: "27AAAAA0000A1Z5",
      total_amount: 5000
    };
    expect(detectDocTypeMismatch("invoice", structuredData)).toBeNull();
  });

  test("does not flag a correctly-typed bank statement", () => {
    const structuredData = {
      transactions: [{ date: "2024-01-01", narration: "Salary credit", debit: null, credit: 50000, balance: 50000 }]
    };
    expect(detectDocTypeMismatch("bank_statement", structuredData)).toBeNull();
  });

  test("does not flag a low-quality extraction with neither shape present (already handled by confidence gating)", () => {
    const structuredData = { document_type_detected: "unknown" };
    expect(detectDocTypeMismatch("invoice", structuredData)).toBeNull();
    expect(detectDocTypeMismatch("bank_statement", structuredData)).toBeNull();
  });

  test("does not flag doc_type 'other'", () => {
    const structuredData = {
      transactions: [{ date: "2024-01-01", narration: "x", debit: 1, credit: null, balance: 1 }]
    };
    expect(detectDocTypeMismatch("other", structuredData)).toBeNull();
  });

  test("handles missing/malformed structuredData without throwing", () => {
    expect(detectDocTypeMismatch("invoice", null)).toBeNull();
    expect(detectDocTypeMismatch("invoice", undefined)).toBeNull();
    expect(detectDocTypeMismatch("invoice", "not an object")).toBeNull();
  });
});
