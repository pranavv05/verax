import { describe, test, expect } from "vitest";
import { isTaxFieldExpected } from "../../src/lib/tax-fields";

describe("isTaxFieldExpected", () => {
  test("an IGST invoice doesn't need CGST, SGST or a total-tax figure", () => {
    const igstInvoice = { cgst: null, sgst: null, igst: 21366, tax_amount: null };
    expect(isTaxFieldExpected(igstInvoice, "cgst")).toBe(false);
    expect(isTaxFieldExpected(igstInvoice, "sgst")).toBe(false);
    expect(isTaxFieldExpected(igstInvoice, "tax_amount")).toBe(false);
    expect(isTaxFieldExpected(igstInvoice, "igst")).toBe(true);
  });

  test("a CGST + SGST invoice doesn't need IGST", () => {
    const intraState = { cgst_amount: 3558.6, sgst_amount: 3558.6, igst: null, tax_amount: null };
    expect(isTaxFieldExpected(intraState, "igst")).toBe(false);
    expect(isTaxFieldExpected(intraState, "cgst")).toBe(true);
  });

  test("with no tax read at all, every tax field still asks to be checked", () => {
    const nothing = { cgst: null, sgst: null, igst: "", tax_amount: null };
    for (const key of ["cgst", "sgst", "igst", "tax_amount"]) expect(isTaxFieldExpected(nothing, key)).toBe(true);
  });

  test("TDS fields are only expected once some TDS was read", () => {
    const noTds = { tds_section: null, tds_rate: "", tds_amount: null };
    for (const key of ["tds_section", "tds_rate", "tds_amount"]) expect(isTaxFieldExpected(noTds, key)).toBe(false);
    expect(isTaxFieldExpected({ tds_section: "194C", tds_rate: null }, "tds_rate")).toBe(true);
  });

  test("other fields are unaffected", () => {
    expect(isTaxFieldExpected({ igst: 100 }, "invoice_number")).toBe(true);
  });
});
