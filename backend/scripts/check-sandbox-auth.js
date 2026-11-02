#!/usr/bin/env node
/**
 * Verify Sandbox (sandbox.co.in) API credentials by calling ONLY /authenticate.
 *
 * This hits the single cheapest, consent-free endpoint to confirm your
 * SANDBOX_API_KEY / SANDBOX_API_SECRET work end-to-end. It makes no taxpayer,
 * OTP, or GSTR-2B calls, so it does not touch GSTIN consent or burn return-data
 * quota. It prints ONLY success/failure and never prints the token or secret.
 *
 * Usage (from backend/, with your .env holding SANDBOX_API_KEY/SECRET):
 *   node -r dotenv/config scripts/check-sandbox-auth.js
 * or export the vars yourself and run:
 *   node scripts/check-sandbox-auth.js
 */

const KEY = process.env.SANDBOX_API_KEY;
const SECRET = process.env.SANDBOX_API_SECRET;
const BASE = (process.env.SANDBOX_API_BASE_URL || "https://api.sandbox.co.in").replace(/\/+$/, "");
const VERSION = process.env.SANDBOX_API_VERSION || "1.0.0";

(async () => {
  if (!KEY || !SECRET) {
    console.error("FAIL: SANDBOX_API_KEY / SANDBOX_API_SECRET are not set in the environment.");
    process.exit(1);
  }

  try {
    const response = await fetch(`${BASE}/authenticate`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "x-api-key": KEY,
        "x-api-secret": SECRET,
        "x-api-version": VERSION
      }
    });
    const body = await response.json().catch(() => null);
    const gotToken = Boolean(body && body.data && body.data.access_token);

    if (response.ok && gotToken) {
      console.log(`OK: authenticated with Sandbox at ${BASE}. Access token received (not printed).`);
      console.log(`    token length: ${body.data.access_token.length} chars; code: ${body.code}`);
      process.exit(0);
    }

    console.error(`FAIL: authenticate returned HTTP ${response.status}, code ${body && body.code}.`);
    if (body && body.message) console.error(`    message: ${body.message}`);
    process.exit(1);
  } catch (error) {
    console.error(`FAIL: request error: ${error.message}`);
    process.exit(1);
  }
})();
