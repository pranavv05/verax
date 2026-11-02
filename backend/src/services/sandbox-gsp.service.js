/**
 * Sandbox (sandbox.co.in) GSP client.
 *
 * Implements the real Sandbox API contract (verified against their live docs,
 * Nov 2026), which is a TWO-token flow:
 *
 *  1. Sandbox JWT — POST /authenticate with x-api-key + x-api-secret. Valid 24h.
 *     Passed in the `authorization` header WITHOUT a "Bearer" prefix. Cached in
 *     memory and refreshed on expiry. Identifies OUR application.
 *
 *  2. Taxpayer token — per client GSTIN, a one-time OTP consent:
 *       POST /gst/compliance/tax-payer/otp          {username, gstin}  -> sends OTP
 *       POST /gst/compliance/tax-payer/otp/verify?otp=XXXX {username,gstin} -> 6h token
 *       POST /gst/compliance/tax-payer/session/refresh      -> extend 6h
 *     The taxpayer token authorizes reads of THAT taxpayer's data. It is NOT
 *     stored here (this module is stateless); the caller persists it per
 *     firm+client (see the taxpayer-session store) and passes it back in.
 *
 *  3. GSTR-2B — GET /gst/compliance/tax-payer/gstrs/gstr-2b/{year}/{month} with
 *     the taxpayer token in `authorization`.
 *
 * Secrets come only from env (SANDBOX_API_KEY / SANDBOX_API_SECRET) and are
 * never logged. All calls time out so a slow upstream cannot hang a request.
 */

const env = require("../config/env");
const ApiError = require("../utils/api-error");
const { normalizeGstr2bRecord } = require("./gstr2b-matching");

const REQUEST_TIMEOUT_MS = 20000;
// Refresh the app JWT a minute before its stated 24h expiry.
const JWT_TTL_MS = 24 * 60 * 60 * 1000;
const JWT_REFRESH_SKEW_MS = 60 * 1000;

const isSandboxConfigured = () =>
  Boolean(env.SANDBOX_API_KEY && env.SANDBOX_API_SECRET);

const baseUrl = () => String(env.SANDBOX_API_BASE_URL || "").replace(/\/+$/, "");

class SandboxError extends Error {
  constructor(message, { statusCode, code } = {}) {
    super(message);
    this.name = "SandboxError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const fetchWithTimeout = async (url, options) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

// ── App JWT (cached) ──────────────────────────────────────────────────────────

let cachedJwt = null;
let cachedJwtExpiresAt = 0;

/**
 * Obtain (and cache) the Sandbox application JWT. `forceRefresh` bypasses the
 * cache. Throws SandboxError on failure; never logs the key/secret.
 */
const getAppToken = async ({ forceRefresh = false } = {}) => {
  if (!isSandboxConfigured()) {
    throw new SandboxError("Sandbox API key/secret are not configured", { code: "not_configured" });
  }
  if (!forceRefresh && cachedJwt && cachedJwtExpiresAt > Date.now() + JWT_REFRESH_SKEW_MS) {
    return cachedJwt;
  }

  const response = await fetchWithTimeout(`${baseUrl()}/authenticate`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "x-api-key": env.SANDBOX_API_KEY,
      "x-api-secret": env.SANDBOX_API_SECRET,
      "x-api-version": env.SANDBOX_API_VERSION
    }
  });

  const payload = await parseJson(response);
  const token = payload?.data?.access_token;
  if (!response.ok || !token) {
    throw new SandboxError("Sandbox authentication failed", {
      statusCode: response.status,
      code: payload?.code
    });
  }

  cachedJwt = token;
  cachedJwtExpiresAt = Date.now() + JWT_TTL_MS;
  return token;
};

// For tests / explicit reset.
const _clearTokenCache = () => {
  cachedJwt = null;
  cachedJwtExpiresAt = 0;
};

// ── Taxpayer OTP session ───────────────────────────────────────────────────────

/**
 * Request an OTP for a taxpayer GSTIN. The OTP is delivered by GSTN to the
 * taxpayer's registered mobile/email. Requires the taxpayer to have enabled API
 * access in their GST portal profile first.
 */
const requestTaxpayerOtp = async ({ username, gstin }) => {
  const appToken = await getAppToken();
  const response = await fetchWithTimeout(`${baseUrl()}/gst/compliance/tax-payer/otp`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: appToken,
      "content-type": "application/json",
      "x-api-key": env.SANDBOX_API_KEY,
      "x-api-version": env.SANDBOX_API_VERSION,
      "x-source": "primary"
    },
    body: JSON.stringify({ username, gstin })
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new SandboxError(sandboxMessage(payload, "Could not send OTP to the taxpayer"), {
      statusCode: response.status,
      code: payload?.code
    });
  }
  return { ok: true, raw: payload };
};

/**
 * Verify the OTP and open a taxpayer session. Returns the taxpayer access token
 * plus expiry timestamps. The caller persists these per firm+client.
 */
const verifyTaxpayerOtp = async ({ username, gstin, otp }) => {
  const appToken = await getAppToken();
  const url = `${baseUrl()}/gst/compliance/tax-payer/otp/verify?otp=${encodeURIComponent(otp)}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: appToken,
      "content-type": "application/json",
      "x-api-key": env.SANDBOX_API_KEY,
      "x-api-version": env.SANDBOX_API_VERSION,
      "x-source": "primary"
    },
    body: JSON.stringify({ username, gstin })
  });
  const payload = await parseJson(response);
  const data = payload?.data || {};
  const taxpayerToken = data.access_token || data.token;
  if (!response.ok || !taxpayerToken) {
    throw new SandboxError(sandboxMessage(payload, "OTP verification failed"), {
      statusCode: response.status,
      code: payload?.code
    });
  }
  return {
    taxpayerToken,
    sessionExpiry: data.session_expiry ?? null,
    tokenExpiry: data.token_expiry ?? null,
    raw: payload
  };
};

/**
 * Refresh a taxpayer session for another ~6h. Returns the (possibly new) token
 * and expiry. Throws if the session can no longer be refreshed (OTP needed again).
 */
const refreshTaxpayerSession = async ({ taxpayerToken }) => {
  const response = await fetchWithTimeout(
    `${baseUrl()}/gst/compliance/tax-payer/session/refresh`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: taxpayerToken,
        "x-api-key": env.SANDBOX_API_KEY,
        "x-api-version": env.SANDBOX_API_VERSION
      }
    }
  );
  const payload = await parseJson(response);
  const data = payload?.data || {};
  const newToken = data.access_token || data.token || taxpayerToken;
  if (!response.ok) {
    throw new SandboxError(sandboxMessage(payload, "Could not refresh taxpayer session"), {
      statusCode: response.status,
      code: payload?.code
    });
  }
  return {
    taxpayerToken: newToken,
    sessionExpiry: data.session_expiry ?? null,
    tokenExpiry: data.token_expiry ?? null
  };
};

// ── GSTR-2B ────────────────────────────────────────────────────────────────────

/**
 * Pull a taxpayer's GSTR-2B for a period (MMYYYY) using their taxpayer token,
 * and normalise the B2B + B2BA invoices into the record shape the matching layer
 * consumes, carrying through IMS status and ITC-availability for the ITC Desk.
 * Returns { records, raw } or throws SandboxError.
 */
const fetchGstr2b = async ({ taxpayerToken, period }) => {
  const month = period.slice(0, 2);
  const year = period.slice(2);
  const url = `${baseUrl()}/gst/compliance/tax-payer/gstrs/gstr-2b/${year}/${month}`;
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: taxpayerToken,
      "x-api-key": env.SANDBOX_API_KEY,
      "x-api-version": env.SANDBOX_API_VERSION
    }
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new SandboxError(sandboxMessage(payload, "Could not fetch GSTR-2B"), {
      statusCode: response.status,
      code: payload?.code
    });
  }
  return { records: extractRecords(payload), raw: payload };
};

/**
 * Pull the B2B supplier invoices out of the Sandbox GSTR-2B envelope and
 * normalise them. The invoice-level detail lives at
 * data.data.data.docdata.b2b[].inv[]; each inv carries inum/dt/txval/cgst/sgst/
 * igst/cess plus imsStatus and itcavl.
 */
const extractRecords = (payload) => {
  const docdata = payload?.data?.data?.data?.docdata || payload?.data?.data?.docdata || {};
  const groups = []
    .concat(Array.isArray(docdata.b2b) ? docdata.b2b : [])
    .concat(Array.isArray(docdata.b2ba) ? docdata.b2ba : []);

  const records = [];
  for (const group of groups) {
    const ctin = group.ctin;
    const trdnm = group.trdnm;
    const invoices = Array.isArray(group.inv) ? group.inv : [];
    for (const inv of invoices) {
      const normalized = normalizeGstr2bRecord({
        inum: inv.inum,
        ctin,
        trdnm,
        txval: inv.txval,
        iamt: inv.igst,
        camt: inv.cgst,
        samt: inv.sgst,
        csamt: inv.cess,
        dt: inv.dt,
        raw: inv
      });
      // Carry IMS + ITC-availability through for the ITC Desk; harmless to the
      // matcher, which ignores unknown fields.
      normalized.imsStatus = inv.imsStatus ?? null;
      normalized.itcAvailable = inv.itcavl === "Y";
      records.push(normalized);
    }
  }
  return records;
};

// Pull a human-readable GSTN/Sandbox error message out of a failure payload.
const sandboxMessage = (payload, fallback) => {
  const gstn = payload?.data?.error?.message || payload?.data?.message || payload?.message;
  return gstn || fallback;
};

module.exports = {
  SandboxError,
  isSandboxConfigured,
  getAppToken,
  requestTaxpayerOtp,
  verifyTaxpayerOtp,
  refreshTaxpayerSession,
  fetchGstr2b,
  // exported for tests
  extractRecords,
  _clearTokenCache
};
