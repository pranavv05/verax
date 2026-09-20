const {
  validateGstin,
  validateTaxMath,
  validateTdsRate
} = require("../../src/services/compliance.service");

describe("validateGstin", () => {
  test("accepts a checksum-valid GSTIN", () => {
    expect(validateGstin("27AAPFU0939F1ZV")).toEqual({ valid: true, message: null });
  });

  test("is tolerant of surrounding whitespace and lowercase", () => {
    expect(validateGstin(" 27aapfu0939f1zv ")).toEqual({ valid: true, message: null });
  });

  test("treats an empty/missing GSTIN as not an error", () => {
    expect(validateGstin(null)).toEqual({ valid: true, message: null });
    expect(validateGstin("")).toEqual({ valid: true, message: null });
  });

  test("rejects a GSTIN that is not 15 characters", () => {
    const result = validateGstin("27AAPFU0939F1Z");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/15 characters/);
  });

  test("rejects an unknown state code", () => {
    const result = validateGstin("99AAPFU0939F1ZV");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/state code/i);
  });

  test("rejects a malformed PAN segment", () => {
    const result = validateGstin("27AAPFU09F0F1ZV");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/PAN pattern/i);
  });

  test("flags a checksum mismatch as a warning, not a hard error message about length", () => {
    // Same GSTIN as the valid case above, but with the checksum digit tampered.
    const result = validateGstin("27AAPFU0939F1Z5");
    expect(result.valid).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.message).toMatch(/checksum mismatch/i);
  });
});

describe("validateTaxMath", () => {
  test("returns no issues when CGST+SGST+IGST matches tax_amount and totals reconcile", () => {
    const issues = validateTaxMath({
      cgst: 450,
      sgst: 450,
      igst: null,
      tax_amount: 900,
      taxable_amount: 5000,
      total_amount: 5900
    });
    expect(issues).toEqual([]);
  });

  test("flags when CGST+SGST+IGST does not sum to tax_amount", () => {
    const issues = validateTaxMath({
      cgst: 450,
      sgst: 450,
      tax_amount: 1000,
      taxable_amount: 5000,
      total_amount: 6000
    });
    expect(issues.some((i) => i.field === "tax_amount")).toBe(true);
  });

  test("flags when taxable_amount + tax_amount does not equal total_amount", () => {
    const issues = validateTaxMath({
      cgst: 450,
      sgst: 450,
      tax_amount: 900,
      taxable_amount: 5000,
      total_amount: 6500
    });
    expect(issues.some((i) => i.field === "total_amount")).toBe(true);
  });

  test("flags CGST/SGST mismatch for an intra-state transaction (no IGST)", () => {
    const issues = validateTaxMath({ cgst: 450, sgst: 300 });
    expect(issues.some((i) => i.field === "cgst")).toBe(true);
  });

  test("does not flag CGST/SGST mismatch when IGST is present (inter-state)", () => {
    const issues = validateTaxMath({ cgst: 450, sgst: 300, igst: 900 });
    expect(issues.some((i) => i.field === "cgst")).toBe(false);
  });

  test("tolerates rounding differences of up to 1 rupee", () => {
    const issues = validateTaxMath({
      cgst: 450.4,
      sgst: 450.4,
      tax_amount: 900.5,
      taxable_amount: 5000,
      total_amount: 5900.5
    });
    expect(issues).toEqual([]);
  });

  test("parses comma-formatted string amounts", () => {
    const issues = validateTaxMath({
      cgst: "1,000",
      sgst: "1,000",
      tax_amount: "2,000",
      taxable_amount: "10,000",
      total_amount: "12,000"
    });
    expect(issues).toEqual([]);
  });
});

describe("validateTdsRate", () => {
  test("accepts a rate matching the individual rate for a known section", () => {
    const result = validateTdsRate({ tds_section: "194J", tds_rate: 10 });
    expect(result.valid).toBe(true);
  });

  test("accepts a rate matching the company rate for a known section", () => {
    const result = validateTdsRate({ tds_section: "194C", tds_rate: 2 });
    expect(result.valid).toBe(true);
  });

  test("flags a rate that matches neither individual nor company rate", () => {
    const result = validateTdsRate({ tds_section: "194J", tds_rate: 5 });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/does not match expected/);
  });

  test("flags an unknown TDS section", () => {
    const result = validateTdsRate({ tds_section: "194ZZ", tds_rate: 10 });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Unknown TDS section/);
  });

  test("treats a missing section as valid (nothing to check)", () => {
    expect(validateTdsRate({})).toEqual({ valid: true, message: null });
  });

  test("is case- and whitespace-insensitive on the section code", () => {
    const result = validateTdsRate({ tds_section: " 194j ", tds_rate: 10 });
    expect(result.valid).toBe(true);
  });
});
