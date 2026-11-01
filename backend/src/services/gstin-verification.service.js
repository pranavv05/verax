/**
 * GSTIN verification with caching.
 *
 * Wraps gsp.service.verifyGSTIN (live GSP, or local checksum fallback) with a
 * global cache (gstin_verification_cache) so the same supplier GSTIN — which can
 * appear on hundreds of invoices — is not re-verified on every call. A GSTIN's
 * registration status is identical for every firm, so the cache is global, not
 * per tenant.
 *
 * Freshness rules:
 *  - A "gsp" (authoritative) row is trusted for GSP_TTL_MS.
 *  - A "local_checksum" row is only a format check; it is always re-attempted
 *    against the GSP when one is configured (so enabling a GSP later upgrades
 *    cached results), but still serves instantly when no GSP is configured.
 *
 * The returned shape is a superset of gsp.service.verifyGSTIN's, adding:
 *  - cached:  true when served from cache without a fresh upstream call
 *  - source:  "gsp" | "local_fallback" (upstream) or "gsp"/"local_checksum" (cache)
 */

const gspService = require("./gsp.service");

const GSP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // A registration status rarely changes within a week.

const cleanGstin = (value) => String(value || "").replace(/\s/g, "").toUpperCase();

const readCache = async (db, gstin) => {
  const result = await db.query(
    `
      SELECT gstin, valid, legal_name, trade_name, registration_status,
             state_code, source, message, fetched_at
      FROM gstin_verification_cache
      WHERE gstin = $1
      LIMIT 1
    `,
    [gstin]
  );
  return result.rowCount > 0 ? result.rows[0] : null;
};

const writeCache = async (db, gstin, result) => {
  // Map the upstream source ("gsp" | "local_fallback") to the stored source.
  const storedSource = result.source === "gsp" ? "gsp" : "local_checksum";
  await db.query(
    `
      INSERT INTO gstin_verification_cache (
        gstin, valid, legal_name, trade_name, registration_status,
        state_code, source, message, fetched_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (gstin) DO UPDATE SET
        valid = EXCLUDED.valid,
        legal_name = EXCLUDED.legal_name,
        trade_name = EXCLUDED.trade_name,
        registration_status = EXCLUDED.registration_status,
        state_code = EXCLUDED.state_code,
        source = EXCLUDED.source,
        message = EXCLUDED.message,
        fetched_at = NOW(),
        updated_at = NOW()
    `,
    [
      gstin,
      Boolean(result.valid),
      result.legalName || null,
      result.tradeName || null,
      result.registrationStatus || null,
      result.stateCode || null,
      storedSource,
      result.message || null
    ]
  );
};

const cacheRowToResult = (row) => ({
  valid: row.valid,
  legalName: row.legal_name,
  tradeName: row.trade_name,
  registrationStatus: row.registration_status,
  stateCode: row.state_code,
  source: row.source,
  message: row.message,
  cached: true,
  fetchedAt: row.fetched_at
});

const isFresh = (row) => {
  if (row.source !== "gsp") {
    // A checksum-only row is never "fresh enough" to skip a GSP that is now
    // available; it is only served directly when no GSP is configured.
    return !gspService.isGspEnabled();
  }
  const age = Date.now() - new Date(row.fetched_at).getTime();
  return age < GSP_TTL_MS;
};

/**
 * Verify a GSTIN, using and updating the global cache.
 * `db` is a tenant transaction client; the cache table has no RLS so it is
 * accessible from any tenant context.
 * `options.forceRefresh` bypasses the cache read and always re-verifies.
 */
const verifyGstinCached = async (db, gstin, options = {}) => {
  const cleaned = cleanGstin(gstin);

  if (!options.forceRefresh) {
    const cached = await readCache(db, cleaned);
    if (cached && isFresh(cached)) {
      return cacheRowToResult(cached);
    }
  }

  const result = await gspService.verifyGSTIN(cleaned);

  // Persist best-effort: a cache write failure must never fail verification.
  try {
    await writeCache(db, cleaned, result);
  } catch (error) {
    console.error("GSTIN cache write failed (non-fatal):", error.message);
  }

  return { ...result, cached: false };
};

module.exports = {
  GSP_TTL_MS,
  verifyGstinCached,
  // exported for tests
  isFresh,
  cacheRowToResult
};
