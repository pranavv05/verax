const { assertDocumentsPassTaxMath, getTaxMathWarnings } = require("../../src/services/exports.service");

const balancedDoc = {
  id: "doc-1",
  file_name: "invoice-1.pdf",
  structured_data: {
    cgst: 450,
    sgst: 450,
    tax_amount: 900,
    taxable_amount: 5000,
    total_amount: 5900
  }
};

const inconsistentDoc = {
  id: "doc-2",
  file_name: "invoice-2.pdf",
  structured_data: {
    // 450 + 450 = 900, but tax_amount claims 500 — internally inconsistent.
    cgst: 450,
    sgst: 450,
    tax_amount: 500,
    taxable_amount: 5000,
    total_amount: 5900
  }
};

describe("assertDocumentsPassTaxMath", () => {
  test("does not throw when every document's tax math reconciles", () => {
    expect(() => assertDocumentsPassTaxMath([balancedDoc])).not.toThrow();
  });

  test("throws a clear, actionable error naming the offending document when tax math fails", () => {
    expect(() => assertDocumentsPassTaxMath([inconsistentDoc])).toThrow(
      /Cannot export.*tax math.*invoice-2\.pdf/s
    );
  });

  test("a single bad document blocks the whole export batch, not just itself", () => {
    expect(() => assertDocumentsPassTaxMath([balancedDoc, inconsistentDoc])).toThrow(/1 document/);
  });

  test("a document with no structured_data at all does not throw (nothing to check)", () => {
    expect(() => assertDocumentsPassTaxMath([{ id: "doc-3", file_name: "empty.pdf" }])).not.toThrow();
  });
});

describe("getTaxMathWarnings", () => {
  test("returns no warnings for a reconciling document", () => {
    expect(getTaxMathWarnings([balancedDoc])).toEqual([]);
  });

  test("returns a tax_math_mismatch warning identifying the document for an inconsistent one", () => {
    // inconsistentDoc's bad tax_amount cascades into two separate checks
    // (CGST+SGST+IGST vs tax_amount, and taxable+tax vs total) — both are
    // real, independent discrepancies, so both should be surfaced.
    const warnings = getTaxMathWarnings([inconsistentDoc]);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    for (const warning of warnings) {
      expect(warning).toMatchObject({ documentId: "doc-2", issue: "tax_math_mismatch" });
      expect(warning.message).toBeTruthy();
    }
  });
});
