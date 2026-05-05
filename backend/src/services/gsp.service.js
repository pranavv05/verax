const env = require("../config/env");
const { validateGstin } = require("./compliance.service");

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

const toNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeInvoiceNumber = (value) =>
  String(value || "").trim().replace(/\s+/g, "").toUpperCase();

const normalizeDate = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return raw;
};

const normalizeGstr2bRecord = (record) => {
  const gstAmount =
    toNumber(record.gstAmount ?? record.gst_amount ?? record.iamt) ??
    ((toNumber(record.camt) || 0) + (toNumber(record.samt) || 0) + (toNumber(record.csamt) || 0));

  return {
    invoiceNumber: record.invoiceNumber || record.invoice_number || record.inum || record.invNum || "",
    supplierGSTIN: record.supplierGSTIN || record.supplier_gstin || record.ctin || record.gstin || "",
    taxableAmount: toNumber(record.taxableAmount ?? record.taxable_amount ?? record.txval),
    gstAmount,
    invoiceDate: record.invoiceDate || record.invoice_date || record.idt || record.date || "",
    raw: record
  };
};

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

const valuesDiffer = (left, right, tolerance = 1) => {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (leftNumber === null || rightNumber === null) return false;
  return Math.abs(leftNumber - rightNumber) > tolerance;
};

const matchInvoices = (invoices, gstr2bRecords) => {
  const recordsByInvoice = new Map();
  for (const record of gstr2bRecords.map(normalizeGstr2bRecord)) {
    const key = normalizeInvoiceNumber(record.invoiceNumber);
    if (key && !recordsByInvoice.has(key)) {
      recordsByInvoice.set(key, record);
    }
  }

  return invoices.map((invoice) => {
    const key = normalizeInvoiceNumber(invoice.invoiceNumber);
    const record = recordsByInvoice.get(key);
    if (!record) {
      return {
        invoiceNumber: invoice.invoiceNumber || "",
        matchStatus: "not_found",
        mismatchFields: [],
        gstr2bRecord: null
      };
    }

    const mismatchFields = [];
    if (
      invoice.supplierGSTIN &&
      record.supplierGSTIN &&
      String(invoice.supplierGSTIN).toUpperCase() !== String(record.supplierGSTIN).toUpperCase()
    ) {
      mismatchFields.push("supplierGSTIN");
    }
    if (valuesDiffer(invoice.taxableAmount, record.taxableAmount)) {
      mismatchFields.push("taxableAmount");
    }
    if (valuesDiffer(invoice.gstAmount, record.gstAmount)) {
      mismatchFields.push("gstAmount");
    }
    if (
      invoice.invoiceDate &&
      record.invoiceDate &&
      normalizeDate(invoice.invoiceDate) !== normalizeDate(record.invoiceDate)
    ) {
      mismatchFields.push("invoiceDate");
    }

    const matchStatus =
      mismatchFields.length === 0
        ? "matched"
        : mismatchFields.includes("supplierGSTIN")
        ? "mismatch"
        : "partial";

    return {
      invoiceNumber: invoice.invoiceNumber || "",
      matchStatus,
      mismatchFields,
      gstr2bRecord: record.raw
    };
  });
};

const unavailableResults = (invoices) =>
  invoices.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber || "",
    matchStatus: "unavailable",
    mismatchFields: [],
    gstr2bRecord: null
  }));

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

const matchGSTR2B = async (gstin, period, invoices) => {
  if (!isGspEnabled()) {
    return unavailableResults(invoices);
  }

  try {
    const payload = await requestGsp(
      `/gstr2b?gstin=${encodeURIComponent(gstin)}&period=${encodeURIComponent(period)}`,
      { method: "GET" }
    );
    return matchInvoices(invoices, collectGstr2bRecords(payload));
  } catch (error) {
    console.error("GSP GSTR-2B match unavailable:", error.name || error.message);
    return unavailableResults(invoices);
  }
};

module.exports = {
  GSPAuthError,
  verifyGSTIN,
  matchGSTR2B
};
