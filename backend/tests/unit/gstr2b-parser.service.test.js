const ExcelJS = require("exceljs");
const {
  parseGstr2bFile,
  parseGstr2bJson,
  summariseRecords,
  normalizeInvoiceDate
} = require("../../src/services/gstr2b-parser.service");

describe("parseGstr2bJson — hostile input (hardening)", () => {
  test("rejects pathologically nested JSON with a clean 400, not a stack overflow", () => {
    const deep = `{"data":{"docdata":{"b2b":${"[".repeat(2000)}${"]".repeat(2000)}}}}`;
    let error;
    try {
      parseGstr2bJson(deep);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(400);
    expect(error.message).not.toMatch(/call stack/i);
  });

  test("strips control characters / null bytes from parsed strings", () => {
    const json = JSON.stringify({
      data: { docdata: { b2b: [{ ctin: "27AAPFU0939F1ZV", inv: [{ inum: "INV\u0000\u0001-1", txval: 1, iamt: 1 }] }] } }
    });
    const [rec] = parseGstr2bJson(json);
    expect(rec.invoiceNumber).toBe("INV-1");
    expect(rec.invoiceNumber).not.toMatch(/[\u0000-\u001f]/);
  });

  test("zeroes non-finite / absurd amounts instead of storing Infinity/NaN", () => {
    const json = JSON.stringify({
      data: { docdata: { b2b: [{ ctin: "X", inv: [{ inum: "1", txval: 1e308, iamt: 1e308 }] }] } }
    });
    const records = parseGstr2bJson(json);
    const summary = summariseRecords(records);
    expect(Number.isFinite(summary.totalTaxable)).toBe(true);
    expect(Number.isFinite(summary.totalGst)).toBe(true);
    expect(summary.totalTaxable).toBe(0);
  });

  test("tolerates non-numeric / object amounts without throwing", () => {
    const json = JSON.stringify({
      data: { docdata: { b2b: [{ ctin: "X", inv: [{ inum: "1", txval: "not-a-number", iamt: { nested: true } }] }] } }
    });
    const [rec] = parseGstr2bJson(json);
    expect(rec.taxableAmount).toBe(0);
    expect(rec.gstAmount).toBe(0);
  });

  test("a b2b that is not an array is treated as no invoices", () => {
    expect(() => parseGstr2bJson(JSON.stringify({ data: { docdata: { b2b: "evil" } } }))).toThrow(/No B2B/i);
  });

  test("a top-level array is rejected cleanly", () => {
    expect(() => parseGstr2bJson(JSON.stringify([1, 2, 3]))).toThrow(/No B2B/i);
  });

  test("does not pollute Object.prototype via a __proto__ key", () => {
    parseGstr2bJson('{"data":{"docdata":{"b2b":[{"ctin":"X","inv":[{"inum":"1","__proto__":{"polluted":true},"txval":1,"iamt":0}]}]}}}');
    expect({}.polluted).toBeUndefined();
  });
});

describe("normalizeInvoiceDate", () => {
  test("converts DD-MM-YYYY to YYYY-MM-DD", () => {
    expect(normalizeInvoiceDate("01-05-2026")).toBe("2026-05-01");
  });
  test("converts DD/MM/YYYY to YYYY-MM-DD", () => {
    expect(normalizeInvoiceDate("28/02/2026")).toBe("2026-02-28");
  });
  test("returns empty for blank", () => {
    expect(normalizeInvoiceDate("")).toBe("");
    expect(normalizeInvoiceDate(null)).toBe("");
  });
});

describe("parseGstr2bJson", () => {
  const portalJson = JSON.stringify({
    data: {
      docdata: {
        b2b: [
          {
            ctin: "27AAPFU0939F1ZV",
            trdnm: "Acme Supplies",
            inv: [
              {
                inum: "INV-1",
                dt: "01-05-2026",
                itms: [
                  { itm_det: { txval: 1000, iamt: 180 } },
                  { itm_det: { txval: 500, cgst: 45, sgst: 45 } }
                ]
              }
            ]
          }
        ]
      }
    }
  });

  test("extracts B2B invoices and sums multi-rate line items", () => {
    const records = parseGstr2bJson(portalJson);
    expect(records).toHaveLength(1);
    const [rec] = records;
    expect(rec.invoiceNumber).toBe("INV-1");
    expect(rec.supplierGSTIN).toBe("27AAPFU0939F1ZV");
    expect(rec.supplierName).toBe("Acme Supplies");
    expect(rec.taxableAmount).toBe(1500);
    // 180 (igst line) + 45 + 45 (cgst+sgst line) = 270
    expect(rec.gstAmount).toBe(270);
    expect(rec.invoiceDate).toBe("2026-05-01");
  });

  test("includes b2ba amendment records", () => {
    const withAmendment = JSON.stringify({
      data: {
        docdata: {
          b2b: [],
          b2ba: [
            { ctin: "27AAPFU0939F1ZV", inv: [{ inum: "INV-A", txval: 100, iamt: 18 }] }
          ]
        }
      }
    });
    const records = parseGstr2bJson(withAmendment);
    expect(records).toHaveLength(1);
    expect(records[0].invoiceNumber).toBe("INV-A");
  });

  test("throws a clear error on invalid JSON", () => {
    expect(() => parseGstr2bJson("{not json")).toThrow(/not valid GSTR-2B JSON/i);
  });

  test("throws when there are no B2B invoices", () => {
    expect(() => parseGstr2bJson(JSON.stringify({ data: { docdata: {} } }))).toThrow(/No B2B invoices/i);
  });
});

describe("summariseRecords", () => {
  test("totals taxable and gst and counts", () => {
    const summary = summariseRecords([
      { taxableAmount: 100, gstAmount: 18 },
      { taxableAmount: 200, gstAmount: 36 }
    ]);
    expect(summary).toEqual({ recordCount: 2, totalTaxable: 300, totalGst: 54 });
  });
});

describe("parseGstr2bFile (end to end)", () => {
  test("parses a JSON upload by extension", async () => {
    const buffer = Buffer.from(
      JSON.stringify({
        data: { docdata: { b2b: [{ ctin: "27AAPFU0939F1ZV", inv: [{ inum: "INV-1", txval: 1000, iamt: 180, dt: "01-05-2026" }] }] } }
      }),
      "utf8"
    );
    const { records, summary } = await parseGstr2bFile({ buffer, filename: "gstr2b.json" });
    expect(records).toHaveLength(1);
    expect(summary.recordCount).toBe(1);
    expect(summary.totalGst).toBe(180);
  });

  test("parses an Excel upload by extension", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("B2B");
    // A title row above the header, mimicking the portal export layout.
    sheet.addRow(["GSTR-2B B2B"]);
    sheet.addRow([
      "GSTIN of supplier",
      "Trade/Legal name",
      "Invoice number",
      "Invoice Date",
      "Taxable Value",
      "Integrated Tax",
      "Central Tax",
      "State/UT Tax",
      "Cess"
    ]);
    sheet.addRow(["27AAPFU0939F1ZV", "Acme Supplies", "INV-1", "01-05-2026", 1000, 180, 0, 0, 0]);
    sheet.addRow(["27AAPFU0939F1ZV", "Acme Supplies", "INV-2", "02-05-2026", 500, 0, 45, 45, 0]);
    const buffer = await workbook.xlsx.writeBuffer();

    const { records, summary } = await parseGstr2bFile({
      buffer: Buffer.from(buffer),
      filename: "gstr2b.xlsx"
    });
    expect(records).toHaveLength(2);
    expect(records[0].invoiceNumber).toBe("INV-1");
    expect(records[0].gstAmount).toBe(180);
    expect(records[1].gstAmount).toBe(90);
    expect(summary.totalTaxable).toBe(1500);
  });

  test("extracts formula, rich-text and hyperlink cell values (not 0)", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("B2B");
    sheet.addRow(["GSTIN of supplier", "Invoice number", "Invoice Date", "Taxable Value", "Integrated Tax"]);
    const r1 = sheet.addRow(["27AAPFU0939F1ZV", "INV1", "01-05-2026", null, null]);
    r1.getCell(4).value = { formula: "1000", result: 1000 };
    r1.getCell(5).value = { formula: "180", result: 180 };
    const r2 = sheet.addRow([]);
    r2.getCell(1).value = { richText: [{ text: "27AAPFU" }, { text: "0939F1ZV" }] };
    r2.getCell(2).value = { text: "INV2", hyperlink: "http://x" };
    r2.getCell(4).value = 500;
    r2.getCell(5).value = 90;
    const buffer = await workbook.xlsx.writeBuffer();

    const { records } = await parseGstr2bFile({ buffer: Buffer.from(buffer), filename: "gstr2b.xlsx" });
    // Formula results, not 0 — a formula cell parsed as 0 would understate ITC.
    expect(records[0].taxableAmount).toBe(1000);
    expect(records[0].gstAmount).toBe(180);
    // Rich-text GSTIN joined, hyperlink invoice-number text extracted.
    expect(records[1].supplierGSTIN).toBe("27AAPFU0939F1ZV");
    expect(records[1].invoiceNumber).toBe("INV2");
  });

  test("rejects an unsupported extension", async () => {
    await expect(
      parseGstr2bFile({ buffer: Buffer.from("x"), filename: "gstr2b.pdf" })
    ).rejects.toThrow(/JSON or Excel/i);
  });

  test("rejects an empty file", async () => {
    await expect(
      parseGstr2bFile({ buffer: Buffer.alloc(0), filename: "gstr2b.json" })
    ).rejects.toThrow(/empty/i);
  });
});
