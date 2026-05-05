const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const fixturePath = path.join(__dirname, "fixtures", "bank-statement-sample.txt");
const pythonExe = path.join(rootDir, "ai-service", ".venv", "Scripts", "python.exe");

const rows = fs
  .readFileSync(fixturePath, "utf8")
  .trim()
  .split(/\r?\n/)
  .map((line) => line.split("\t"));

const py = `
import json, sys
import pandas as pd
sys.path.insert(0, "ai-service")
from app.services.bank_statement_xml_service import _standardize, _generate_xml

rows = json.loads(sys.stdin.read())
headers = rows[0]
data = rows[1:]
df = pd.DataFrame(data, columns=headers)
standardized = _standardize(df)
xml = _generate_xml(standardized, company_name="Verax Test Co", bank_ledger="SBI Current Account")
print(json.dumps({
    "xml": xml.decode("utf-8"),
    "standardized": standardized.to_dict(orient="records"),
}))
`;

function test(name, fn, results) {
  try {
    fn();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

const child = spawnSync(pythonExe, ["-c", py], {
  cwd: rootDir,
  input: JSON.stringify(rows),
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
  shell: true
});

const results = [];
if (child.status !== 0) {
  results.push({
    name: "Python bank statement service can be imported and run",
    status: "FAIL",
    error: child.error ? child.error.message : (child.stderr || child.stdout || `status=${child.status} signal=${child.signal}`)
  });
  console.log(JSON.stringify({ results }, null, 2));
  process.exit(1);
}

const payload = JSON.parse(child.stdout);
const xml = payload.xml;
const voucherMatches = xml.match(/<VOUCHER\b/g) || [];
const vouchers = xml.match(/<VOUCHER\b[\s\S]*?<\/VOUCHER>/g) || [];

test("Output contains ENVELOPE root", () => {
  assert(xml.includes("<ENVELOPE>"));
}, results);

test("Voucher count equals non-header rows", () => {
  assert.strictEqual(voucherMatches.length, rows.length - 1);
}, results);

test("Each voucher has date and amount", () => {
  assert(vouchers.every((v) => /<DATE>\d{8}<\/DATE>/.test(v)));
  assert(vouchers.every((v) => /<AMOUNT>-?\d+\.\d{2}<\/AMOUNT>/.test(v)));
}, results);

test("Each voucher has non-empty narration", () => {
  assert(vouchers.every((v) => /<NARRATION>[^<]+<\/NARRATION>/.test(v)));
}, results);

test("Debit rows generate Payment vouchers", () => {
  assert(vouchers.filter((v) => /VCHTYPE="Payment"/.test(v)).length >= 4);
}, results);

test("Credit rows generate Receipt vouchers", () => {
  assert(vouchers.filter((v) => /VCHTYPE="Receipt"/.test(v)).length >= 4);
}, results);

test("Indian number format parses as 123456.78", () => {
  assert(xml.includes("123456.78"));
}, results);

console.log(JSON.stringify({ results, voucherCount: voucherMatches.length }, null, 2));
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
