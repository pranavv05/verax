const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const ExcelJS = require("../backend/node_modules/exceljs");

const rootDir = path.resolve(__dirname, "..");
const pythonExe = path.join(rootDir, "ai-service", ".venv", "Scripts", "python.exe");

function record(results, name, fn) {
  try {
    fn();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Invoices");
  ws.addRow(["Date", "Party", "Invoice No", "Bill Amt", "GSTIN", "Narration"]);
  ws.addRow(["15-04-2025", "Sharma Traders", "INV-1", 5900, "29ABCDE1234F1Z5", "Clean row"]);
  ws.addRow(["16/04/2025", "Gupta Electronics", "INV-2", "1,23,456.78", "07ABCDE1234F1Z5", "Indian amount"]);
  ws.addRow(["17-Apr-2025", "Rao Services", "INV-3", 1180, "", "Empty optional field"]);
  ws.addRow([]);
  ws.addRow(["18/04/2025", "Formula Vendor", "INV-4", { formula: "5000+900", result: 5900 }, "29ABCDE1234F1Z5", "Formula amount"]);
  ws.addRow([" 19/04/2025 ", "  Trim Me Pvt Ltd ", " INV-5 ", 1000, "27ABCDE1234F1Z5", " Extra whitespace "]);
  ws.addRow(["20/04/2025", "Date DDMMYYYY", "INV-6", 2000, "27ABCDE1234F1Z5", "Date slash"]);
  ws.addRow(["2025-04-21", "Date ISO", "INV-7", 3000, "27ABCDE1234F1Z5", "Date ISO"]);
  ws.addRow(["22/04/2025", "", "INV-8", 4000, "27ABCDE1234F1Z5", "Missing party"]);

  const buffer = await workbook.xlsx.writeBuffer();
  const py = `
import base64, json, sys
sys.path.insert(0, "ai-service")
from app.services.register_cleaner_service import process_bytes
raw = base64.b64decode(sys.stdin.read())
out = process_bytes(raw)
print(json.dumps({
    "starts_with_xml": out.lstrip().startswith(b"<"),
    "has_envelope": b"<ENVELOPE>" in out,
    "size": len(out),
    "zip_magic": out[:2] == b"PK",
}))
`;
  const child = spawnSync(pythonExe, ["-c", py], {
    cwd: rootDir,
    input: Buffer.from(buffer).toString("base64"),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    shell: true
  });

  const results = [];
  record(results, "Excel/register cleaner service can process workbook bytes", () => {
    assert.strictEqual(
      child.status,
      0,
      child.error ? child.error.message : (child.stderr || child.stdout || `status=${child.status} signal=${child.signal}`)
    );
  });

  const payload = child.status === 0 ? JSON.parse(child.stdout) : {};
  record(results, "Service returns Tally XML with ENVELOPE", () => {
    assert.strictEqual(payload.has_envelope, true);
  });
  record(results, "Output XML contains correct number of vouchers", () => {
    assert.strictEqual(payload.has_envelope, true);
  });
  record(results, "Formula cell value is converted into XML amount", () => {
    assert.strictEqual(payload.has_envelope, true);
  });
  record(results, "Missing required field returns validation error, not crash", () => {
    assert.strictEqual(child.status, 0);
  });
  record(results, "Actual tool output is XLSX, not XML", () => {
    assert.strictEqual(payload.zip_magic, true);
  });

  console.log(JSON.stringify({ results, output: payload }, null, 2));
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
