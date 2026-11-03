/**
 * Firm data export and permanent deletion, through the real app, a live
 * Postgres (as the least-privilege ca_app role) and real stored files
 * (LOCAL_STORAGE). Two firms are seeded so every assertion also proves the
 * other firm is untouched — the property that matters most here.
 */
process.env.TRUST_PROXY = "1";
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;
const describeIfDb = ADMIN_URL && APP_URL && process.env.LOCAL_STORAGE === "true" ? describe : describe.skip;

const app = require("../../src/app");
const sharedAppPool = require("../../src/db/pool");
const { LOCAL_STORAGE_ROOT } = require("../../src/services/s3.service");
const { createAccessToken } = require("../../src/utils/token-utils");

const uid = () => crypto.randomUUID();

const seedFirm = async (pool, label) => {
  const f = {
    firmId: uid(), adminId: uid(), staffId: uid(), clientId: uid(), docId: uid(), exportId: uid(),
    password: `Admin!${label}Pass2026`, name: `Data Test ${label} & Co`
  };
  f.docKey = `test-firm-data/${f.firmId}/${f.docId}-invoice.pdf`;
  f.xmlKey = `test-firm-data/${f.firmId}/${f.exportId}.xml`;
  f.docBytes = crypto.randomBytes(2048);
  for (const [key, body] of [[f.docKey, f.docBytes], [f.xmlKey, Buffer.from(`<ENVELOPE>${label}</ENVELOPE>`)]]) {
    const p = path.join(LOCAL_STORAGE_ROOT, key);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  const hash = await bcrypt.hash(f.password, 4);
  await pool.query(`INSERT INTO firms (id, name, owner_email) VALUES ($1,$2,$3)`, [f.firmId, f.name, `${label}@firmdata.test.local`]);
  await pool.query(
    `INSERT INTO users (id, firm_id, name, email, password_hash, role) VALUES ($1,$2,'Admin',$3,$4,'admin'),($5,$2,'Staff',$6,$4,'staff')`,
    [f.adminId, f.firmId, `admin-${label}@firmdata.test.local`, hash, f.staffId, `staff-${label}@firmdata.test.local`]
  );
  await pool.query(
    `INSERT INTO clients (id, firm_id, name, upload_token, portal_password_hash) VALUES ($1,$2,$3,$4,'portal-secret-hash')`,
    [f.clientId, f.firmId, `Client ${label}`, crypto.randomBytes(32).toString("hex")]
  );
  await pool.query(
    `INSERT INTO documents (id, client_id, firm_id, file_name, s3_key, status) VALUES ($1,$2,$3,'invoice.pdf',$4,'reviewed')`,
    [f.docId, f.clientId, f.firmId, f.docKey]
  );
  await pool.query(`INSERT INTO extractions (document_id, structured_data) VALUES ($1,$2::jsonb)`, [f.docId, JSON.stringify({ invoice_number: `INV-${label}` })]);
  await pool.query(
    `INSERT INTO tally_exports (id, firm_id, client_id, document_ids, xml_s3_key) VALUES ($1,$2,$3,ARRAY[$4]::uuid[],$5)`,
    [f.exportId, f.firmId, f.clientId, f.docId, f.xmlKey]
  );
  await pool.query(`INSERT INTO tally_agents (firm_id, name, token_hash) VALUES ($1,'PC',$2)`, [f.firmId, `agent-secret-hash-${label}`]);
  await pool.query(
    `INSERT INTO refresh_tokens (firm_id, user_id, token_id, token_hash, expires_at) VALUES ($1,$2,$3,$4,NOW()+INTERVAL '1 day')`,
    [f.firmId, f.adminId, uid(), `refresh-secret-hash-${label}`]
  );
  await pool.query(`INSERT INTO audit_logs (firm_id, user_id, action, entity_type) VALUES ($1,$2,'seeded','firm')`, [f.firmId, f.adminId]);
  f.adminJwt = createAccessToken({ userId: f.adminId, firmId: f.firmId, role: "admin" });
  f.staffJwt = createAccessToken({ userId: f.staffId, firmId: f.firmId, role: "staff" });
  return f;
};

const FIRM_TABLES = [
  "users", "clients", "documents", "tally_exports", "tally_agents", "refresh_tokens", "audit_logs",
  "tally_sync_jobs", "ims_actions", "gstr2b_snapshots", "gstr2b_taxpayer_sessions", "scheduled_requests",
  "notifications", "narration_mappings", "item_name_mappings", "password_reset_tokens", "document_upload_sessions"
];

const rowsFor = async (pool, firmId) => {
  const counts = {};
  for (const t of FIRM_TABLES) counts[t] = Number((await pool.query(`SELECT count(*) FROM ${t} WHERE firm_id = $1`, [firmId])).rows[0].count);
  counts.firms = Number((await pool.query(`SELECT count(*) FROM firms WHERE id = $1`, [firmId])).rows[0].count);
  counts.extractions = Number((await pool.query(`SELECT count(*) FROM extractions e JOIN documents d ON d.id=e.document_id WHERE d.firm_id=$1`, [firmId])).rows[0].count);
  return counts;
};

describeIfDb("Firm data export and deletion", () => {
  let pool;
  let A;
  let B;

  beforeAll(async () => {
    pool = new Pool({ connectionString: ADMIN_URL });
    A = await seedFirm(pool, "A");
    B = await seedFirm(pool, "B");
  });

  afterAll(async () => {
    for (const f of [A, B].filter(Boolean)) {
      await pool.query(`DELETE FROM extractions WHERE document_id = $1`, [f.docId]);
      for (const t of ["tally_exports", "tally_agents", "refresh_tokens", "audit_logs", "documents", "clients", "users"]) {
        await pool.query(`DELETE FROM ${t} WHERE firm_id = $1`, [f.firmId]);
      }
      await pool.query(`DELETE FROM firms WHERE id = $1`, [f.firmId]);
    }
    fs.rmSync(path.join(LOCAL_STORAGE_ROOT, "test-firm-data"), { recursive: true, force: true });
    await pool.end();
    await sharedAppPool.end();
  });

  describe("export", () => {
    it("is admin-only", async () => {
      const res = await request(app).post("/api/firms/export-link").set("Authorization", `Bearer ${A.staffJwt}`);
      expect(res.status).toBe(403);
    });

    it("rejects a missing or forged link, and a login token used as a link", async () => {
      expect((await request(app).get("/api/firms/export")).status).toBe(401);
      expect((await request(app).get("/api/firms/export?token=forged")).status).toBe(401);
      expect((await request(app).get(`/api/firms/export?token=${A.adminJwt}`)).status).toBe(401);
    });

    it("produces a complete ZIP of this firm's data and files, with no secrets and nothing from other firms", async () => {
      const link = await request(app).post("/api/firms/export-link").set("Authorization", `Bearer ${A.adminJwt}`);
      expect(link.status).toBe(200);

      const res = await request(app).get(link.body.path).buffer(true).parse((r, cb) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/zip");
      expect(res.headers["content-disposition"]).toMatch(/attachment; filename="verax-export-Data-Test-A-&-Co-\d{4}-\d{2}-\d{2}\.zip"/);

      const zipPath = path.join(os.tmpdir(), `verax-export-${A.firmId}.zip`);
      fs.writeFileSync(zipPath, res.body);
      const dump = JSON.parse(execFileSync("python3", ["-I", "-c", `
import json, sys, zipfile, base64
z = zipfile.ZipFile(sys.argv[1])
print(json.dumps({n: base64.b64encode(z.read(n)).decode() for n in z.namelist()}))`, zipPath], { maxBuffer: 64 << 20 }).toString());
      fs.rmSync(zipPath);
      const file = (n) => Buffer.from(dump[n], "base64");
      const json = (n) => JSON.parse(file(`verax-export/data/${n}.json`).toString());

      expect(Object.keys(dump)).toEqual(expect.arrayContaining([
        "verax-export/README.txt", "verax-export/data/firm.json", "verax-export/data/clients.json",
        "verax-export/data/documents.json", "verax-export/data/extractions.json", "verax-export/data/audit_logs.json",
        `verax-export/documents/Client A/${A.docId}-invoice.pdf`, `verax-export/tally/${A.exportId}.xml`
      ]));
      expect(file(`verax-export/documents/Client A/${A.docId}-invoice.pdf`).equals(A.docBytes)).toBe(true);
      expect(json("firm")).toHaveLength(1);
      expect(json("users").map((u) => u.id).sort()).toEqual([A.adminId, A.staffId].sort());
      expect(json("extractions")[0].structured_data.invoice_number).toBe("INV-A");

      // No exported row may carry a credential column…
      const secretKeys = ["password_hash", "portal_password_hash", "upload_token", "token_hash", "token_encrypted"];
      for (const name of Object.keys(dump).filter((n) => n.startsWith("verax-export/data/"))) {
        const rows = [].concat(JSON.parse(file(name).toString()));
        for (const row of rows) expect(Object.keys(row).filter((k) => secretKeys.includes(k))).toEqual([]);
      }
      // …and none of the actual secret values may appear anywhere in the archive.
      const everything = Object.values(dump).map((b) => Buffer.from(b, "base64").toString("latin1")).join("\n");
      const { rows: [secrets] } = await pool.query(
        `SELECT c.upload_token, u.password_hash FROM clients c JOIN users u ON u.firm_id = c.firm_id WHERE c.id = $1 LIMIT 1`,
        [A.clientId]
      );
      for (const secret of [secrets.upload_token, secrets.password_hash, "portal-secret-hash", "agent-secret-hash-A", "refresh-secret-hash-A"]) {
        expect(everything).not.toContain(secret);
      }
      for (const otherFirm of [B.firmId, B.clientId, B.docId, "INV-B", "Client B"]) {
        expect(everything).not.toContain(otherFirm);
      }
    });
  });

  describe("deletion", () => {
    const del = (f, body, jwt = f.adminJwt) =>
      request(app).post("/api/firms/delete").set("Authorization", `Bearer ${jwt}`).send(body);

    it("refuses staff, a wrong password, or a wrong firm name — and deletes nothing", async () => {
      expect((await del(A, { confirmFirmName: A.name, password: A.password }, A.staffJwt)).status).toBe(403);
      const wrongPw = await del(A, { confirmFirmName: A.name, password: "nope-nope-nope" });
      expect(wrongPw.status).toBe(403);
      expect(wrongPw.body.message).toMatch(/password is incorrect/i);
      const wrongName = await del(A, { confirmFirmName: "Data Test A", password: A.password });
      expect(wrongName.status).toBe(400);
      expect((await rowsFor(pool, A.firmId)).firms).toBe(1);
    });

    it("erases every row and stored file of the firm, and nothing of any other firm", async () => {
      const bBefore = await rowsFor(pool, B.firmId);
      const res = await del(A, { confirmFirmName: `  ${A.name} `, password: A.password });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ deleted: true, filesDeleted: 2, filesFailed: 0 });
      expect(res.headers["set-cookie"].join(";")).toMatch(/refresh/i);

      const aAfter = await rowsFor(pool, A.firmId);
      expect(Object.entries(aAfter).filter(([, n]) => n !== 0)).toEqual([]);
      expect(fs.existsSync(path.join(LOCAL_STORAGE_ROOT, A.docKey))).toBe(false);
      expect(fs.existsSync(path.join(LOCAL_STORAGE_ROOT, A.xmlKey))).toBe(false);

      expect(await rowsFor(pool, B.firmId)).toEqual(bBefore);
      expect(fs.existsSync(path.join(LOCAL_STORAGE_ROOT, B.docKey))).toBe(true);
      expect(fs.existsSync(path.join(LOCAL_STORAGE_ROOT, B.xmlKey))).toBe(true);
    });

    it("the deleted firm's remaining access token can't read anything", async () => {
      const res = await request(app).get("/api/firms/me").set("Authorization", `Bearer ${A.adminJwt}`);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
