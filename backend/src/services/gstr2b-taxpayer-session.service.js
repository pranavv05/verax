/**
 * GST taxpayer session management.
 *
 * Owns the lifecycle of the per-client OTP consent + token used to pull live
 * GSTR-2B from a GSP (Sandbox):
 *   requestOtp  -> GSTN sends an OTP to the client's registered mobile/email
 *   verifyOtp   -> opens a session, stores the ENCRYPTED taxpayer token
 *   getUsableToken -> returns a live token, refreshing transparently if near
 *                     expiry, or signals that a fresh OTP is needed
 *   getStatus   -> connected / expired / needs-reauth, for the UI
 *
 * The token is encrypted at rest (utils/secret-box); plaintext never touches
 * the database and is never logged. All DB access is tenant-scoped, so RLS on
 * gstr2b_taxpayer_sessions enforces firm isolation.
 */

const ApiError = require("../utils/api-error");
const secretBox = require("../utils/secret-box");
const sandbox = require("./sandbox-gsp.service");

// Refresh the taxpayer token when it is within this window of expiring, so a
// reconciliation started near the edge doesn't fail mid-call.
const REFRESH_SKEW_MS = 10 * 60 * 1000;

const toMsOrNull = (value) => {
  if (value === null || value === undefined) return null;
  // Sandbox returns epoch ms or ISO; accept both.
  if (typeof value === "number") return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const loadClientForGstin = async (db, { firmId, clientId }) => {
  const result = await db.query(
    `SELECT id, name, gstin, gst_username FROM clients
     WHERE id = $1 AND firm_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [clientId, firmId]
  );
  if (result.rowCount === 0) throw ApiError.notFound("Client not found");
  return result.rows[0];
};

const loadSession = async (db, { firmId, clientId }) => {
  const result = await db.query(
    `SELECT id, gstin, token_encrypted, provider, status, token_expiry, session_expiry
     FROM gstr2b_taxpayer_sessions
     WHERE firm_id = $1 AND client_id = $2
     ORDER BY updated_at DESC LIMIT 1`,
    [firmId, clientId]
  );
  return result.rowCount > 0 ? result.rows[0] : null;
};

/**
 * Persist a client's GST-portal username so it is available for OTP + refresh.
 */
const setGstUsername = async (db, { firmId, clientId, gstUsername }) => {
  await db.query(
    `UPDATE clients SET gst_username = $3, updated_at = NOW()
     WHERE id = $1 AND firm_id = $2 AND deleted_at IS NULL`,
    [clientId, firmId, gstUsername || null]
  );
};

/**
 * Step 1: send an OTP to the client's registered mobile/email. The CA triggers
 * this; the client reads the OTP. Requires the client to have a GSTIN and a GST
 * username (the latter can be supplied in this call and is saved).
 */
const requestOtp = async (db, { firmId, clientId, gstUsername }) => {
  const client = await loadClientForGstin(db, { firmId, clientId });
  if (!client.gstin) {
    throw ApiError.badRequest("Set the client's GSTIN before connecting GST.");
  }
  const username = gstUsername || client.gst_username;
  if (!username) {
    throw ApiError.badRequest("The client's GST portal username is required to send an OTP.");
  }
  if (gstUsername && gstUsername !== client.gst_username) {
    await setGstUsername(db, { firmId, clientId, gstUsername });
  }

  await sandbox.requestTaxpayerOtp({ username, gstin: client.gstin });

  // Upsert a pending session row so the UI reflects "OTP sent".
  await db.query(
    `INSERT INTO gstr2b_taxpayer_sessions (firm_id, client_id, gstin, provider, status)
     VALUES ($1, $2, $3, 'sandbox', 'pending')
     ON CONFLICT (firm_id, client_id, gstin)
     DO UPDATE SET status = 'pending', updated_at = NOW()`,
    [firmId, clientId, client.gstin]
  );

  return { status: "otp_sent", gstin: client.gstin };
};

/**
 * Step 2: verify the OTP, open the session, store the encrypted token.
 */
const verifyOtp = async (db, { firmId, clientId, userId, otp }) => {
  const client = await loadClientForGstin(db, { firmId, clientId });
  if (!client.gstin) throw ApiError.badRequest("Set the client's GSTIN first.");
  if (!client.gst_username) {
    throw ApiError.badRequest("The client's GST portal username is missing; request an OTP first.");
  }

  const verified = await sandbox.verifyTaxpayerOtp({
    username: client.gst_username,
    gstin: client.gstin,
    otp
  });

  const tokenExpiryMs = toMsOrNull(verified.tokenExpiry);
  const sessionExpiryMs = toMsOrNull(verified.sessionExpiry);

  await db.query(
    `INSERT INTO gstr2b_taxpayer_sessions
       (firm_id, client_id, gstin, token_encrypted, provider, status,
        token_expiry, session_expiry, last_refreshed_at, created_by)
     VALUES ($1,$2,$3,$4,'sandbox','active',$5,$6,NOW(),$7)
     ON CONFLICT (firm_id, client_id, gstin) DO UPDATE SET
       token_encrypted = EXCLUDED.token_encrypted,
       status = 'active',
       token_expiry = EXCLUDED.token_expiry,
       session_expiry = EXCLUDED.session_expiry,
       last_refreshed_at = NOW(),
       updated_at = NOW()`,
    [
      firmId,
      clientId,
      client.gstin,
      secretBox.encrypt(verified.taxpayerToken),
      tokenExpiryMs ? new Date(tokenExpiryMs) : null,
      sessionExpiryMs ? new Date(sessionExpiryMs) : null,
      userId ?? null
    ]
  );

  return { status: "connected", gstin: client.gstin };
};

/**
 * Return a usable (live, non-expired) taxpayer token for a client, refreshing
 * transparently when near expiry. Returns { token } on success, or throws a
 * clear 409 when a fresh OTP is required (no session, revoked, or past the
 * portal session cap). The reconciliation source resolver calls this.
 */
const getUsableToken = async (db, { firmId, clientId }) => {
  const session = await loadSession(db, { firmId, clientId });
  if (!session || session.status === "revoked" || !session.token_encrypted) {
    throw ApiError.conflict("This client's GST session needs to be connected (OTP).");
  }

  const now = Date.now();
  const sessionExpiryMs = session.session_expiry ? new Date(session.session_expiry).getTime() : null;
  if (sessionExpiryMs && sessionExpiryMs <= now) {
    await db.query(
      `UPDATE gstr2b_taxpayer_sessions SET status='expired', updated_at=NOW() WHERE id=$1`,
      [session.id]
    );
    throw ApiError.conflict("This client's GST session has expired; reconnect with a new OTP.");
  }

  let token;
  try {
    token = secretBox.decrypt(session.token_encrypted);
  } catch {
    throw ApiError.conflict("Stored GST session is unreadable; reconnect with a new OTP.");
  }

  const tokenExpiryMs = session.token_expiry ? new Date(session.token_expiry).getTime() : null;
  const needsRefresh = tokenExpiryMs !== null && tokenExpiryMs - now < REFRESH_SKEW_MS;
  if (needsRefresh) {
    try {
      const refreshed = await sandbox.refreshTaxpayerSession({ taxpayerToken: token });
      token = refreshed.taxpayerToken;
      await db.query(
        `UPDATE gstr2b_taxpayer_sessions
         SET token_encrypted=$2, token_expiry=$3, session_expiry=COALESCE($4, session_expiry),
             last_refreshed_at=NOW(), status='active', updated_at=NOW()
         WHERE id=$1`,
        [
          session.id,
          secretBox.encrypt(token),
          refreshed.tokenExpiry ? new Date(toMsOrNull(refreshed.tokenExpiry)) : null,
          refreshed.sessionExpiry ? new Date(toMsOrNull(refreshed.sessionExpiry)) : null
        ]
      );
    } catch {
      // Refresh failed (past the portal session cap, or token already dead):
      // mark expired and ask for a new OTP rather than failing opaquely.
      await db.query(
        `UPDATE gstr2b_taxpayer_sessions SET status='expired', updated_at=NOW() WHERE id=$1`,
        [session.id]
      );
      throw ApiError.conflict("This client's GST session could not be refreshed; reconnect with a new OTP.");
    }
  }

  return { token, gstin: session.gstin };
};

const getStatus = async (db, { firmId, clientId }) => {
  const client = await loadClientForGstin(db, { firmId, clientId });
  const session = await loadSession(db, { firmId, clientId });
  if (!session) {
    return { connected: false, status: "not_connected", gstin: client.gstin, gstUsername: client.gst_username };
  }
  const now = Date.now();
  const sessionExpiryMs = session.session_expiry ? new Date(session.session_expiry).getTime() : null;
  const effectiveStatus =
    session.status === "active" && sessionExpiryMs && sessionExpiryMs <= now ? "expired" : session.status;
  return {
    connected: effectiveStatus === "active",
    status: effectiveStatus,
    gstin: session.gstin,
    gstUsername: client.gst_username,
    tokenExpiry: session.token_expiry,
    sessionExpiry: session.session_expiry
  };
};

const revoke = async (db, { firmId, clientId }) => {
  await db.query(
    `UPDATE gstr2b_taxpayer_sessions SET status='revoked', token_encrypted=NULL, updated_at=NOW()
     WHERE firm_id=$1 AND client_id=$2`,
    [firmId, clientId]
  );
  return { status: "revoked" };
};

module.exports = {
  requestOtp,
  verifyOtp,
  getUsableToken,
  getStatus,
  revoke,
  // exported for tests
  loadSession
};
