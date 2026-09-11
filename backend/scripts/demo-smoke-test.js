#!/usr/bin/env node
/**
 * End-to-end smoke test for the demo path:
 *   login -> list clients -> create client -> request docs (magic link)
 *   -> magic-link status -> upload -> confirm -> wait for processing
 *   -> extraction -> approve -> tally export -> download
 *
 * Idempotent: re-running reuses the existing demo client instead of failing on
 * the duplicate-GSTIN conflict, so it is safe to run repeatedly before a demo.
 *
 * Usage:
 *   node scripts/demo-smoke-test.js              # full flow
 *   node scripts/demo-smoke-test.js --no-export  # stop after extraction
 */

const fs = require("fs");
const path = require("path");

const API = process.env.DEMO_API_BASE || "http://localhost:3000";
const EMAIL = process.env.DEMO_EMAIL || "admin@demo.com";
const PASSWORD = process.env.DEMO_PASSWORD || "Demo@123456";
const CLIENT_GSTIN = "29ABCDE1234F1Z5";
const CLIENT_NAME = "Test SME Client";
const PDF_PATH = path.resolve(__dirname, "..", "..", "tests", "fixtures", "test-invoice.pdf");
const PROCESSING_TIMEOUT_MS = Number(process.env.DEMO_PROCESSING_TIMEOUT_MS || 180000);

const skipExport = process.argv.includes("--no-export");
const seedFallback = process.argv.includes("--seed");

let pass = 0;
let fail = 0;

const log = (ok, label, detail) => {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}${detail ? ` -- ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
  }
};

const call = async (method, urlPath, { token, body, raw, contentType } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (raw) {
    headers["Content-Type"] = contentType || "application/octet-stream";
    payload = raw;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const url = urlPath.startsWith("http") ? urlPath : `${API}${urlPath}`;
  const response = await fetch(url, { method, headers, body: payload });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
};

const main = async () => {
  console.log(`\n=== Verax demo smoke test -> ${API} ===\n`);

  if (!fs.existsSync(PDF_PATH)) {
    console.log(`  FAIL  test invoice missing at ${PDF_PATH}`);
    console.log("        run: node scripts/make-test-invoice.js");
    process.exit(1);
  }

  // --- health ---
  const health = await call("GET", "/health");
  log(health.status === 200, "GET /health", `status=${health.status}`);

  // --- 3a login ---
  const login = await call("POST", "/api/auth/login", {
    body: { email: EMAIL, password: PASSWORD }
  });
  const token = login.body && login.body.accessToken;
  log(
    login.status === 200 && Boolean(token),
    "POST /api/auth/login",
    `status=${login.status} role=${login.body?.user?.role} firm=${login.body?.firm?.name} plan=${login.body?.firm?.plan}`
  );
  if (!token) {
    console.log("\nCannot continue without an access token.");
    console.log(JSON.stringify(login.body, null, 2));
    process.exit(1);
  }

  // --- 3b list clients ---
  const list = await call("GET", "/api/clients", { token });
  const rows = list.body?.data ?? list.body?.clients ?? list.body;
  log(
    list.status === 200,
    "GET /api/clients",
    `status=${list.status} count=${Array.isArray(rows) ? rows.length : "n/a"}`
  );

  // --- 3c create client ---
  // Reuse the demo client if it already exists. The API does not reject a
  // duplicate GSTIN, so creating unconditionally would pile up a new client on
  // every run and leave the demo firm's client list full of near-duplicates.
  let clientId = null;
  const existing = (Array.isArray(rows) ? rows : []).find(
    (row) => row.gstin === CLIENT_GSTIN || row.name === CLIENT_NAME
  );

  if (existing) {
    clientId = existing.id;
    log(true, "POST /api/clients", `skipped -- reusing existing client id=${clientId}`);
  } else {
    const create = await call("POST", "/api/clients", {
      token,
      body: { name: CLIENT_NAME, gstin: CLIENT_GSTIN, email: "client@test.com" }
    });
    clientId = create.body?.id ?? create.body?.client?.id;
    log(
      create.status === 201 && Boolean(clientId),
      "POST /api/clients",
      `status=${create.status} id=${clientId}`
    );
  }
  if (!clientId) {
    console.log("\nNo client id available.");
    console.log(JSON.stringify(create.body, null, 2));
    process.exit(1);
  }

  // --- 3d request docs / magic link ---
  const reqDocs = await call("POST", `/api/clients/${clientId}/request-docs`, {
    token,
    body: { documentTypes: ["invoice"] }
  });
  const uploadToken = reqDocs.body?.uploadToken;
  log(
    reqDocs.status === 200 && Boolean(uploadToken),
    "POST /api/clients/:id/request-docs",
    `status=${reqDocs.status} tokenLen=${uploadToken ? uploadToken.length : 0}`
  );
  if (!uploadToken) {
    console.log(JSON.stringify(reqDocs.body, null, 2));
    process.exit(1);
  }
  console.log(`        magic link: ${process.env.FRONTEND_URL || "http://localhost:5173"}/upload/${uploadToken}`);

  // --- 3e magic link status ---
  const status = await call("GET", `/api/upload/${uploadToken}/status`);
  log(status.status === 200, "GET /api/upload/:token/status", `status=${status.status}`);

  // --- 4 upload ---
  const pdf = fs.readFileSync(PDF_PATH);
  const initiate = await call("POST", `/api/upload/${uploadToken}/documents/upload`, {
    body: {
      file_name: "test-invoice.pdf",
      file_type: "application/pdf",
      file_size: pdf.length,
      doc_type: "invoice"
    }
  });
  const documentId = initiate.body?.document_id;
  const uploadUrl = initiate.body?.upload_url;
  log(
    initiate.status === 200 && Boolean(documentId) && Boolean(uploadUrl),
    "POST /api/upload/:token/documents/upload",
    `status=${initiate.status} documentId=${documentId}`
  );
  if (!documentId || !uploadUrl) {
    console.log(JSON.stringify(initiate.body, null, 2));
    process.exit(1);
  }

  const put = await call("PUT", uploadUrl, { raw: pdf, contentType: "application/pdf" });
  log(put.status === 200, "PUT upload_url (file bytes)", `status=${put.status}`);

  const confirm = await call("POST", `/api/upload/${uploadToken}/documents/confirm`, {
    body: { document_id: documentId }
  });
  log(
    confirm.status === 200,
    "POST /api/upload/:token/documents/confirm",
    `status=${confirm.status} queued=${confirm.body?.queue?.queued} queueError=${confirm.body?.queue?.error ?? "none"}`
  );

  // --- 5 wait for processing ---
  const terminal = new Set(["extracted", "review_required", "reviewed", "failed", "exported"]);
  const started = Date.now();
  let docStatus = null;
  let doc = null;
  while (Date.now() - started < PROCESSING_TIMEOUT_MS) {
    const res = await call("GET", `/api/documents/${documentId}`, { token });
    doc = res.body;
    docStatus = doc?.status ?? doc?.document?.status;
    if (terminal.has(docStatus)) break;
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  let processedOk = docStatus === "extracted" || docStatus === "review_required";
  log(
    processedOk,
    "document reached a reviewable status",
    `status=${docStatus} after ${Math.round((Date.now() - started) / 1000)}s`
  );
  if (!processedOk) {
    console.log(
      `        processing_error: ${doc?.processing_error ?? doc?.processing?.error ?? "none recorded"}`
    );
  }

  // With --seed, fall back to a seeded extraction so the remaining review /
  // approve / export assertions still get exercised when the AI service is not
  // available. Keeps the rest of the flow verifiable independently of OCR.
  if (!processedOk && seedFallback) {
    console.log("        --seed given: seeding an extraction so approve/export can be tested");
    const { execFileSync } = require("child_process");
    try {
      execFileSync(
        process.execPath,
        [path.join(__dirname, "seed-demo-extraction.js"), documentId],
        { stdio: "inherit" }
      );
      processedOk = true;
    } catch (seedError) {
      console.log(`        seeding failed: ${seedError.message}`);
    }
  }

  // --- 6 extraction ---
  const extraction = await call("GET", `/api/extractions/${documentId}`, { token });
  const confidence =
    extraction.body?.confidence_score ??
    extraction.body?.extraction?.confidence_score ??
    extraction.body?.confidenceScore;
  log(
    extraction.status === 200,
    "GET /api/extractions/:documentId",
    `status=${extraction.status} confidence=${confidence}`
  );
  const structured =
    extraction.body?.structured_data ?? extraction.body?.extraction?.structured_data ?? null;
  if (structured) {
    console.log(
      `        extracted: vendor=${structured.vendor_name ?? "?"} invoice=${structured.invoice_number ?? "?"} total=${structured.total_amount ?? "?"}`
    );
  }

  if (skipExport) {
    console.log(`\n=== ${pass} passed, ${fail} failed (export skipped) ===\n`);
    process.exit(fail === 0 ? 0 : 1);
  }

  // --- 7 approve ---
  const approve = await call("POST", `/api/extractions/${documentId}/approve`, { token, body: {} });
  log(
    approve.status === 200,
    "POST /api/extractions/:documentId/approve",
    `status=${approve.status}${approve.status !== 200 ? ` msg=${approve.body?.message}` : ""}`
  );

  // --- 8 export ---
  // NOTE: /api/export/tally validates snake_case (client_id / document_ids),
  // unlike /api/export/bulk and /preview which take camelCase. This matches
  // generateExportSchema in exports.routes.js and what ExportPage.jsx sends.
  const exportRes = await call("POST", "/api/export/tally", {
    token,
    body: { client_id: clientId, document_ids: [documentId] }
  });
  const exportId = exportRes.body?.export_id;
  log(
    exportRes.status === 200 && Boolean(exportId) && exportRes.body?.status === "generated",
    "POST /api/export/tally",
    `status=${exportRes.status} export_id=${exportId} exportStatus=${exportRes.body?.status} docCount=${exportRes.body?.document_count}`
  );

  if (exportId) {
    const download = await call("GET", `/api/export/${exportId}/download`, { token });
    const downloadUrl = download.body?.download_url ?? download.body?.downloadUrl ?? download.body?.url;
    log(
      download.status === 200 && Boolean(downloadUrl),
      "GET /api/export/:id/download",
      `status=${download.status}`
    );

    if (downloadUrl) {
      const xmlRes = await fetch(downloadUrl);
      const xml = await xmlRes.text();
      const isXml = xml.trimStart().startsWith("<?xml") || xml.trimStart().startsWith("<ENVELOPE");
      log(isXml, "downloaded file is Tally XML", `first 40 chars: ${xml.trimStart().slice(0, 40)}`);
      if (isXml) {
        const vouchers = (xml.match(/<VOUCHER/g) || []).length;
        console.log(`        vouchers=${vouchers} bytes=${xml.length}`);
      }
    }
  }

  console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error("\nSmoke test crashed:", error);
  process.exit(1);
});
