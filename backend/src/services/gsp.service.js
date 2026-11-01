/**
 * GSP (GST Suvidha Provider) client — the LIVE data source for GSTIN
 * verification and GSTR-2B retrieval.
 *
 * This talks to a GSP over HTTP when GSP credentials are configured. When they
 * are not (the common case until a firm signs a GSP contract), verifyGSTIN
 * falls back to a local checksum check and matchGSTR2B reports every invoice as
 * "unavailable". The offline-upload path (gstr2b-source.service.js) is what
 * makes reconciliation work without a GSP; this module is the live alternative
 * behind the same matching logic (gstr2b-matching.js).
 */

const env = require("../config/env");
const { validateGstin } = require("./compliance.service");
const {
  normalizeGstr2bRecord,
  matchInvoices,
  unavailableResults
} = require("./gstr2b-matching");

class GSPAuthError extends Error {
  constructor(message = "GSP authentication failed") {
    super(message);
    this.name = "GSPAuthError";
  }
}

let cachedToken = null;
let cachedTokenExpiresAt = 0;

const isGspEnabled = () =>
  !env.GSP_DISABLED &&
  Boolean(env.GSP_API_URL && env.GSP_USERNAME && env.GSP_PASSWORD);

const cleanBaseUrl = () => String(env.GSP_API_URL || "").replace(/\/+$/, "");

const jsonRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(`GSP request failed with status ${response.status}`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload || {};
};

const authenticate = async () => {
  if (cachedToken && cachedTokenExpiresAt > Date.now() + 60000) {
    return cachedToken;
  }

  const payload = await jsonRequest(`${cleanBaseUrl()}/auth/login`, {
    method: "POST",
    body: JSON.stringify({
      username: env.GSP_USERNAME,
      password: env.GSP_PASSWORD
    })
  });

  const token = payload.token || payload.accessToken || payload.access_token || payload.authToken;
  if (!token) {
    throw new GSPAuthError("GSP authentication response did not include a token");
  }

  const expiresInSeconds = Number(payload.expiresIn || payload.expires_in || 21600);
  cachedToken = token;
  cachedTokenExpiresAt = Date.now() + Math.max(expiresInSeconds - 60, 60) * 1000;
  return cachedToken;
};

const requestGsp = async (path, options = {}, hasRetried = false) => {
  const token = await authenticate();

  try {
    return await jsonRequest(`${cleanBaseUrl()}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
  } catch (error) {
    if (error.statusCode === 401 && !hasRetried) {
      cachedToken = null;
      cachedTokenExpiresAt = 0;
      return requestGsp(path, options, true);
    }
    if (error.statusCode === 401) {
      throw new GSPAuthError();
    }
    throw error;
  }
};

const localFallbackGSTIN = (gstin) => {
  const cleaned = String(gstin || "").replace(/\s/g, "").toUpperCase();
  const result = validateGstin(cleaned);
  return {
    valid: Boolean(result.valid),
    legalName: null,
    tradeName: null,
    registrationStatus: result.valid ? "Active" : "Invalid",
    stateCode: cleaned.slice(0, 2) || null,
    source: "local_fallback",
    message: result.message || null
  };
};

const normalizeGstinResponse = (gstin, payload) => {
  const data = payload.data || payload.result || payload.taxpayerInfo || payload;
  const status =
    data.registrationStatus ||
    data.status ||
    data.sts ||
    data.gstinStatus ||
    (data.cancelDate ? "Cancelled" : "Active");

  return {
    valid: String(status).toLowerCase() === "active",
    legalName: data.legalName || data.lgnm || data.legal_name || "",
    tradeName: data.tradeName || data.tradeNam || data.trade_name || "",
    registrationStatus: status,
    stateCode: data.stateCode || data.stjCd || String(gstin).slice(0, 2),
    source: "gsp"
  };
};

/**
 * Collect the supplier records out of a GSP's GSTR-2B response, tolerating the
 * several envelope shapes different GSPs use. Returns an array of raw records
 * (B2B invoices), flattened so each carries its supplier ctin.
 */
const collectGstr2bRecords = (payload) => {
  const candidates = [
    payload.records,
    payload.invoices,
    payload.data,
    payload.data?.records,
    payload.data?.invoices,
    payload.data?.b2b,
    payload.result?.records,
    payload.result?.invoices
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.flatMap((item) => {
        if (Array.isArray(item.inv)) return item.inv.map((invoice) => ({ ...invoice, ctin: item.ctin }));
        return item;
      });
    }
  }

  return [];
};

const verifyGSTIN = async (gstin) => {
  const cleaned = String(gstin || "").replace(/\s/g, "").toUpperCase();
  if (!isGspEnabled()) {
    return localFallbackGSTIN(cleaned);
  }

  try {
    const payload = await requestGsp(`/gstin/verify?gstin=${encodeURIComponent(cleaned)}`, {
      method: "GET"
    });
    return normalizeGstinResponse(cleaned, payload);
  } catch (error) {
    console.error("GSP GSTIN verification unavailable:", error.name || error.message);
    return localFallbackGSTIN(cleaned);
  }
};

/**
 * Fetch and normalise a client's GSTR-2B B2B records from the live GSP for a
 * period. Returns normalised records (see gstr2b-matching.normalizeGstr2bRecord)
 * or null when no GSP is configured or the call fails — the caller decides the
 * fallback (offline snapshot, or "unavailable").
 */
const fetchGstr2bRecords = async (gstin, period) => {
  if (!isGspEnabled()) {
    return null;
  }
  try {
    const payload = await requestGsp(
      `/gstr2b?gstin=${encodeURIComponent(gstin)}&period=${encodeURIComponent(period)}`,
      { method: "GET" }
    );
    return collectGstr2bRecords(payload).map(normalizeGstr2bRecord);
  } catch (error) {
    console.error("GSP GSTR-2B fetch unavailable:", error.name || error.message);
    return null;
  }
};

/**
 * Match invoices against the live GSP's GSTR-2B for a period. Preserved for
 * backward compatibility; returns "unavailable" results when no GSP is
 * configured. New callers should prefer gstr2b-source.service, which also
 * consults offline snapshots.
 */
const matchGSTR2B = async (gstin, period, invoices) => {
  const records = await fetchGstr2bRecords(gstin, period);
  if (records === null) {
    return unavailableResults(invoices);
  }
  return matchInvoices(invoices, records);
};

module.exports = {
  GSPAuthError,
  isGspEnabled,
  verifyGSTIN,
  fetchGstr2bRecords,
  matchGSTR2B
};
