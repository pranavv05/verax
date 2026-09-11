/**
 * Client portal authentication.
 *
 * This is a completely separate auth world from `auth.service.js`:
 *  - different signing key (CLIENT_JWT_SECRET) and JWT issuer/audience
 *  - different subject table (`clients`, not `users`)
 *  - different session table (`client_refresh_tokens`, not `refresh_tokens`)
 *  - different refresh cookie path (/api/client-portal/auth)
 *
 * Nothing here may be reused by, or reuse, the firm-side auth service.
 */

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { randomUUID } = require("crypto");
const ApiError = require("../utils/api-error");
const env = require("../config/env");
const { withTenantTransaction, setLocalConfig } = require("../db/tenant-context");
const { sendEmail } = require("./email.service");
const { hashToken } = require("../utils/token-utils");
const {
  CLIENT_REFRESH_TYPE,
  createClientAccessToken,
  createClientRefreshToken,
  verifyClientToken
} = require("../utils/client-token-utils");
const {
  CLIENT_PORTAL_INVITE_SUBJECT,
  clientPortalInviteTemplate
} = require("../templates/clientPortalInvite.template");

const BCRYPT_COST = 12;
const CLIENT_REFRESH_COOKIE_NAME = "verax_client_refresh_token";
const CLIENT_REFRESH_COOKIE_PATH = "/api/client-portal/auth";
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

// Excludes visually ambiguous characters (0/O, 1/l/I) — this password gets
// read off a screen and typed by hand.
const TEMP_PASSWORD_LETTERS = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const TEMP_PASSWORD_DIGITS = "23456789";
const TEMP_PASSWORD_LENGTH = 12;

const getClientRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: env.CLIENT_REFRESH_TOKEN_TTL_SECONDS * 1000,
  // Deliberately scoped away from the firm cookie at /api/auth so the two
  // sessions can never be sent to, or clobber, each other.
  path: CLIENT_REFRESH_COOKIE_PATH
});

const pickRandom = (alphabet) => alphabet[crypto.randomInt(0, alphabet.length)];

const generateTempPassword = () => {
  const alphabet = TEMP_PASSWORD_LETTERS + TEMP_PASSWORD_DIGITS;
  // Guarantee at least one of each class, then fill and shuffle.
  const characters = [pickRandom(TEMP_PASSWORD_LETTERS), pickRandom(TEMP_PASSWORD_DIGITS)];
  while (characters.length < TEMP_PASSWORD_LENGTH) {
    characters.push(pickRandom(alphabet));
  }
  for (let i = characters.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters.join("");
};

const insertAuditLog = async (db, { firmId, action, entityId, metadata }) => {
  await db.query(
    `
      INSERT INTO audit_logs (
        firm_id,
        user_id,
        action,
        entity_type,
        entity_id,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    // user_id is null for client-portal actions: the actor is a client, not a
    // firm user, and audit_logs.user_id references users(id).
    [firmId, null, action, "client", entityId ?? null, JSON.stringify(metadata || {})]
  );
};

const buildClientPortalLoginUrl = () => `${env.FRONTEND_URL}/client-portal/login`;

const revokeAllClientRefreshTokens = async (db, { clientId }) => {
  await db.query(
    `
      UPDATE client_refresh_tokens
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE client_id = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
    `,
    [clientId]
  );
};

const createClientSession = async (db, { clientId, firmId }) => {
  // The refresh token carries its own row id as the jti, so the id is minted
  // here rather than by the column default.
  const tokenId = randomUUID();
  const refreshToken = createClientRefreshToken({ clientId, firmId, tokenId });

  await db.query(
    `
      INSERT INTO client_refresh_tokens (id, client_id, token_hash, expires_at)
      VALUES ($1, $2, $3, NOW() + make_interval(secs => $4::integer))
    `,
    [tokenId, clientId, hashToken(refreshToken), env.CLIENT_REFRESH_TOKEN_TTL_SECONDS]
  );

  return {
    accessToken: createClientAccessToken({ clientId, firmId }),
    refreshToken
  };
};

/**
 * Admin-side: turn on portal access for one of the firm's own clients.
 * Returns the generated temp password so the admin can relay it once.
 */
const enableClientPortal = async (db, { clientId, firmId, portalEmail, actorUserId }) => {
  const normalizedEmail = String(portalEmail).trim().toLowerCase();

  const clientResult = await db.query(
    `
      SELECT c.id, c.name, c.status, c.portal_enabled, f.name AS firm_name
      FROM clients c
      JOIN firms f ON f.id = c.firm_id
      WHERE c.id = $1
        AND c.firm_id = $2
        AND c.deleted_at IS NULL
        AND f.deleted_at IS NULL
      LIMIT 1
    `,
    [clientId, firmId]
  );

  if (clientResult.rowCount === 0) {
    throw ApiError.notFound("Client not found");
  }

  const client = clientResult.rows[0];
  if (client.status === "inactive") {
    throw ApiError.badRequest("Cannot enable the portal for an inactive client");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);

  let updateResult;
  try {
    updateResult = await db.query(
      `
        UPDATE clients
        SET portal_email = $1,
            portal_password_hash = $2,
            portal_enabled = true
        WHERE id = $3
          AND firm_id = $4
          AND deleted_at IS NULL
        RETURNING id, portal_email, portal_enabled, portal_last_login_at
      `,
      [normalizedEmail, passwordHash, clientId, firmId]
    );
  } catch (error) {
    if (error && error.code === "23505") {
      throw ApiError.conflict("That email is already used by another client portal login");
    }
    throw error;
  }

  if (updateResult.rowCount === 0) {
    throw ApiError.notFound("Client not found");
  }

  // Any session issued against the previous password must not survive a reset.
  await revokeAllClientRefreshTokens(db, { clientId });

  await insertAuditLog(db, {
    firmId,
    action: "client_portal_enabled",
    entityId: clientId,
    metadata: {
      portalEmail: normalizedEmail,
      reEnabled: Boolean(client.portal_enabled),
      actorUserId: actorUserId ?? null
    }
  });

  const emailResult = await sendEmail({
    to: normalizedEmail,
    subject: CLIENT_PORTAL_INVITE_SUBJECT,
    html: clientPortalInviteTemplate({
      loginUrl: buildClientPortalLoginUrl(),
      portalEmail: normalizedEmail,
      tempPassword,
      clientName: client.name,
      firmName: client.firm_name
    })
  });

  await insertAuditLog(db, {
    firmId,
    action: "client_portal_invite_emailed",
    entityId: clientId,
    metadata: {
      portalEmail: normalizedEmail,
      sent: Boolean(emailResult.sent),
      provider: env.EMAIL_PROVIDER,
      error: emailResult.error ?? null
    }
  });

  return {
    success: true,
    tempPassword,
    portalEmail: updateResult.rows[0].portal_email,
    portalEnabled: updateResult.rows[0].portal_enabled,
    emailSent: Boolean(emailResult.sent)
  };
};

const clientLogin = async ({ email, password }) => {
  const normalizedEmail = String(email).trim().toLowerCase();

  const result = await withTenantTransaction(
    {
      authContext: "client_portal_login",
      portalEmail: normalizedEmail
    },
    async (db) => {
      const clientResult = await db.query(
        `
          SELECT id, firm_id, name, portal_email, portal_password_hash, status
          FROM clients
          WHERE lower(portal_email) = $1
            AND portal_enabled = true
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [normalizedEmail]
      );

      if (clientResult.rowCount === 0) {
        // Unknown email: no firm can be resolved, and audit_logs.firm_id is
        // NOT NULL, so this attempt intentionally cannot be audit-logged.
        // Same generic error as a wrong password — never reveal which failed.
        return { authFailed: true };
      }

      const client = clientResult.rows[0];

      // Switch out of the login escape hatch into normal firm-scoped RLS.
      await setLocalConfig(db, "app.current_firm_id", client.firm_id);
      await setLocalConfig(db, "app.current_client_id", client.id);
      await setLocalConfig(db, "app.auth_context", "");
      await setLocalConfig(db, "app.portal_email", "");

      const passwordMatches =
        Boolean(client.portal_password_hash) &&
        (await bcrypt.compare(password, client.portal_password_hash));

      if (!passwordMatches) {
        await insertAuditLog(db, {
          firmId: client.firm_id,
          action: "client_portal_login_failed",
          entityId: client.id,
          metadata: { portalEmail: normalizedEmail, reason: "invalid_password" }
        });
        return { authFailed: true };
      }

      if (client.status === "inactive") {
        await insertAuditLog(db, {
          firmId: client.firm_id,
          action: "client_portal_login_failed",
          entityId: client.id,
          metadata: { portalEmail: normalizedEmail, reason: "client_inactive" }
        });
        return { authFailed: true };
      }

      const firmResult = await db.query(
        `
          SELECT id, name
          FROM firms
          WHERE id = $1
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [client.firm_id]
      );

      if (firmResult.rowCount === 0) {
        return { authFailed: true };
      }

      const session = await createClientSession(db, {
        clientId: client.id,
        firmId: client.firm_id
      });

      await db.query(
        `
          UPDATE clients
          SET portal_last_login_at = NOW()
          WHERE id = $1
            AND firm_id = $2
            AND deleted_at IS NULL
        `,
        [client.id, client.firm_id]
      );

      await insertAuditLog(db, {
        firmId: client.firm_id,
        action: "client_portal_login",
        entityId: client.id,
        metadata: { portalEmail: normalizedEmail }
      });

      return {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        client: {
          id: client.id,
          name: client.name,
          email: client.portal_email,
          firmName: firmResult.rows[0].name
        }
      };
    }
  );

  if (result.authFailed) {
    throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
  }

  return result;
};

const clientRefreshToken = async ({ refreshToken }) => {
  let payload;
  try {
    payload = verifyClientToken(refreshToken);
  } catch (error) {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  if (
    payload.type !== CLIENT_REFRESH_TYPE ||
    payload.role !== "client" ||
    !payload.jti ||
    !payload.sub ||
    !payload.firm_id
  ) {
    throw ApiError.unauthorized("Invalid refresh token payload");
  }

  // Failure paths return a sentinel instead of throwing: several of them revoke
  // the token family first, and throwing inside the handler would ROLLBACK that
  // revocation along with everything else. The caller throws after the commit.
  const outcome = await withTenantTransaction(
    { firmId: payload.firm_id, clientId: payload.sub },
    async (db) => {
      const sessionResult = await db.query(
        `
          SELECT
            crt.id,
            crt.client_id,
            crt.token_hash,
            crt.expires_at,
            crt.revoked_at,
            c.firm_id,
            c.name,
            c.portal_email,
            c.portal_enabled,
            c.status,
            f.name AS firm_name
          FROM client_refresh_tokens crt
          JOIN clients c ON c.id = crt.client_id
          JOIN firms f ON f.id = c.firm_id
          WHERE crt.id = $1
            AND crt.client_id = $2
            AND c.firm_id = $3
            AND c.deleted_at IS NULL
            AND f.deleted_at IS NULL
          LIMIT 1
        `,
        [payload.jti, payload.sub, payload.firm_id]
      );

      if (sessionResult.rowCount === 0) {
        return { authFailed: "Refresh session not found" };
      }

      const session = sessionResult.rows[0];

      // Reuse detection: a token that verified but whose stored hash no longer
      // matches means an old copy was replayed — kill the whole family.
      if (session.token_hash !== hashToken(refreshToken)) {
        await revokeAllClientRefreshTokens(db, { clientId: session.client_id });
        return { authFailed: "Refresh token mismatch" };
      }

      if (session.revoked_at) {
        await revokeAllClientRefreshTokens(db, { clientId: session.client_id });
        return { authFailed: "Refresh token has been revoked" };
      }

      if (new Date(session.expires_at) <= new Date()) {
        return { authFailed: "Refresh token has expired" };
      }

      if (!session.portal_enabled || session.status === "inactive") {
        await revokeAllClientRefreshTokens(db, { clientId: session.client_id });
        return { authFailed: "Client portal access has been disabled" };
      }

      const next = await createClientSession(db, {
        clientId: session.client_id,
        firmId: session.firm_id
      });

      await db.query(
        `
          UPDATE client_refresh_tokens
          SET revoked_at = NOW()
          WHERE id = $1
            AND client_id = $2
        `,
        [session.id, session.client_id]
      );

      return {
        accessToken: next.accessToken,
        refreshToken: next.refreshToken,
        client: {
          id: session.client_id,
          name: session.name,
          email: session.portal_email,
          firmName: session.firm_name
        }
      };
    }
  );

  if (outcome.authFailed) {
    throw ApiError.unauthorized(outcome.authFailed);
  }

  return outcome;
};

const clientLogout = async ({ refreshToken }) => {
  if (!refreshToken) {
    return;
  }

  let payload;
  try {
    payload = verifyClientToken(refreshToken, { ignoreExpiration: true });
  } catch (error) {
    return;
  }

  if (
    payload.type !== CLIENT_REFRESH_TYPE ||
    payload.role !== "client" ||
    !payload.jti ||
    !payload.sub ||
    !payload.firm_id
  ) {
    return;
  }

  await withTenantTransaction(
    { firmId: payload.firm_id, clientId: payload.sub },
    async (db) => {
      const revokeResult = await db.query(
        `
          UPDATE client_refresh_tokens
          SET revoked_at = COALESCE(revoked_at, NOW())
          WHERE id = $1
            AND client_id = $2
          RETURNING id
        `,
        [payload.jti, payload.sub]
      );

      if (revokeResult.rowCount > 0) {
        await insertAuditLog(db, {
          firmId: payload.firm_id,
          action: "client_portal_logout",
          entityId: payload.sub,
          metadata: {}
        });
      }
    }
  );
};

const clientChangePassword = async (db, { clientId, firmId, currentPassword, newPassword }) => {
  const clientResult = await db.query(
    `
      SELECT id, portal_password_hash
      FROM clients
      WHERE id = $1
        AND firm_id = $2
        AND portal_enabled = true
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [clientId, firmId]
  );

  if (clientResult.rowCount === 0) {
    throw ApiError.notFound("Client portal account not found");
  }

  const client = clientResult.rows[0];
  const currentMatches =
    Boolean(client.portal_password_hash) &&
    (await bcrypt.compare(currentPassword, client.portal_password_hash));

  if (!currentMatches) {
    throw ApiError.unauthorized("Current password is incorrect");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await db.query(
    `
      UPDATE clients
      SET portal_password_hash = $1
      WHERE id = $2
        AND firm_id = $3
        AND deleted_at IS NULL
    `,
    [passwordHash, clientId, firmId]
  );

  // Every existing session, including the caller's, is invalidated on purpose:
  // the client signs back in with the new password.
  await revokeAllClientRefreshTokens(db, { clientId });

  await insertAuditLog(db, {
    firmId,
    action: "client_portal_password_changed",
    entityId: clientId,
    metadata: {}
  });

  return { success: true };
};

module.exports = {
  CLIENT_REFRESH_COOKIE_NAME,
  CLIENT_REFRESH_COOKIE_PATH,
  getClientRefreshCookieOptions,
  enableClientPortal,
  clientLogin,
  clientRefreshToken,
  clientLogout,
  clientChangePassword
};
