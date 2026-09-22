const ExcelJS = require("exceljs");
const {
  MAX_ROWS,
  buildTemplateCsv,
  previewClientImport
} = require("../../src/services/client-import.service");

const csvFile = (text, name = "clients.csv") => ({
  originalname: name,
  buffer: Buffer.from(text, "utf8"),
  size: Buffer.byteLength(text, "utf8")
});

const xlsxFile = async (rows, name = "clients.xlsx") => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Clients");
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return { originalname: name, buffer: Buffer.from(buffer), size: buffer.byteLength };
};

describe("buildTemplateCsv", () => {
  test("includes the header row and one example row", () => {
    const csv = buildTemplateCsv();
    expect(csv).toContain("client_name,gstin,email,phone,status");
    expect(csv).toContain("Example Client");
  });
});

describe("previewClientImport — CSV", () => {
  test("parses a valid CSV and reports all rows as valid", async () => {
    const csv =
      "client_name,gstin,email,phone,status\n" +
      "Acme Traders,27AAAAA0000A1Z5,acme@test.com,9876543210,active\n";
    const result = await previewClientImport(csvFile(csv));
    expect(result.total).toBe(1);
    expect(result.valid).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.rows[0].data.clientName).toBe("Acme Traders");
  });

  test("accepts header aliases (Name instead of client_name)", async () => {
    const csv = "Name,Email\nJohn Traders,john@test.com\n";
    const result = await previewClientImport(csvFile(csv));
    expect(result.errors).toBe(0);
    expect(result.rows[0].data.clientName).toBe("John Traders");
  });

  test("rejects a file with no client_name column at all", async () => {
    const csv = "gstin,email\n27AAAAA0000A1Z5,x@test.com\n";
    await expect(previewClientImport(csvFile(csv))).rejects.toThrow(/client_name.*missing/i);
  });

  test("flags a missing client name as an error row", async () => {
    const csv = "client_name,email\n,x@test.com\n";
    const result = await previewClientImport(csvFile(csv));
    expect(result.errors).toBe(1);
    expect(result.rows[0].issues).toContain("Client name is required");
  });

  test("flags a structurally invalid GSTIN as an error", async () => {
    const csv = "client_name,gstin\nAcme,NOTAGSTIN\n";
    const result = await previewClientImport(csvFile(csv));
    expect(result.errors).toBe(1);
    expect(result.rows[0].issues).toContain("Invalid GSTIN format");
  });

  test("flags a duplicate GSTIN within the same file as an error on the second occurrence", async () => {
    const csv =
      "client_name,gstin,email,phone\n" +
      "Acme One,27AAAAA0000A1Z5,one@test.com,9876543210\n" +
      "Acme Two,27AAAAA0000A1Z5,two@test.com,9876543211\n";
    const result = await previewClientImport(csvFile(csv));
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[1].status).toBe("error");
    expect(result.rows[1].issues).toContain("Duplicate GSTIN in this file");
  });

  test("flags an invalid email format as an error", async () => {
    const csv = "client_name,email\nAcme,not-an-email\n";
    const result = await previewClientImport(csvFile(csv));
    expect(result.rows[0].issues).toContain("Invalid email format");
  });

  test("flags a phone number that isn't exactly 10 digits as an error", async () => {
    const csv = "client_name,phone\nAcme,12345\n";
    const result = await previewClientImport(csvFile(csv));
    expect(result.rows[0].issues).toContain("Phone must be exactly 10 digits");
  });

  test("treats a row with a valid name but no email/phone as a warning, not an error", async () => {
    const csv = "client_name\nAcme Traders\n";
    const result = await previewClientImport(csvFile(csv));
    expect(result.rows[0].status).toBe("warning");
    expect(result.errors).toBe(0);
  });

  test("rejects a completely empty file", async () => {
    await expect(previewClientImport(csvFile(""))).rejects.toThrow(/empty/i);
  });

  test("rejects a file with more than MAX_ROWS data rows", async () => {
    const header = "client_name\n";
    const rows = Array.from({ length: MAX_ROWS + 1 }, (_, i) => `Client ${i}`).join("\n");
    await expect(previewClientImport(csvFile(header + rows))).rejects.toThrow(/maximum/i);
  });

  test("rejects an unsupported file extension", async () => {
    await expect(previewClientImport(csvFile("client_name\nAcme\n", "clients.pdf"))).rejects.toThrow(
      /CSV and XLSX/i
    );
  });

  test("rejects when no file is provided", async () => {
    await expect(previewClientImport(null)).rejects.toThrow(/no file/i);
  });
});

describe("previewClientImport — XLSX (exceljs-based reader)", () => {
  test("parses a valid XLSX workbook the same way as the equivalent CSV", async () => {
    const file = await xlsxFile([
      ["client_name", "gstin", "email", "phone", "status"],
      ["Acme Traders", "27AAAAA0000A1Z5", "acme@test.com", "9876543210", "active"]
    ]);
    const result = await previewClientImport(file);
    expect(result.total).toBe(1);
    expect(result.valid).toBe(1);
    expect(result.rows[0].data.gstin).toBe("27AAAAA0000A1Z5");
  });

  test("drops fully blank rows from the middle of the sheet", async () => {
    const file = await xlsxFile([
      ["client_name"],
      ["Acme"],
      [],
      ["Beta"]
    ]);
    const result = await previewClientImport(file);
    expect(result.total).toBe(2);
  });

  test("stringifies a numeric GSTIN-like cell rather than passing through a raw number", async () => {
    // A spreadsheet can auto-format an all-digit cell as a number; the
    // reader must stringify it the same way the old raw:false XLSX option
    // did, or downstream length/regex checks on strings silently misbehave.
    const file = await xlsxFile([["client_name", "phone"], ["Acme", 9876543210]]);
    const result = await previewClientImport(file);
    expect(result.rows[0].data.phone).toBe("9876543210");
  });

  test("rejects a corrupted/non-XLSX buffer with a friendly error instead of throwing raw", async () => {
    const bogus = { originalname: "clients.xlsx", buffer: Buffer.from("not a real xlsx file"), size: 21 };
    await expect(previewClientImport(bogus)).rejects.toThrow(/could not read this file/i);
  });
});
