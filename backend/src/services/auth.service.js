const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const ApiError = require("../utils/api-error");
const env = require("../config/env");
const pool = require("../db/pool");
const { withTenantTransaction, setLocalConfig } = require("../db/tenant-context");
const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  hashToken
} = require("../utils/token-utils");

const mapUserResponse = (row) => ({
  id: row.id,
  firmId: row.firm_id,
  name: row.name,
  email: row.email,
  role: row.role
});

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  path: "/api/auth"
});

const createSession = async (client, { user, userAgent, ipAddress }) => {
  const tokenId = randomUUID();
  const accessToken = createAccessToken({
    userId: user.id,
    firmId: user.firm_id,
    role: user.role
  });
  const refreshToken = createRefreshToken({
    userId: user.id,
    firmId: user.firm_id,
    role: user.role,
    tokenId
  });

  await client.query(
    `
      INSERT INTO refresh_tokens (
        firm_id,
        user_id,
        token_id,
        token_hash,
        expires_at,
        user_agent,
        ip_address
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        NOW() + make_interval(secs => $5::integer),
        $6,
        $7
      )
    `,
    [
      user.firm_id,
      user.id,
      tokenId,
      hashToken(refreshToken),
      env.REFRESH_TOKEN_TTL_SECONDS,
      userAgent ?? null,
      ipAddress ?? null
    ]
  );

  return { accessToken, refreshToken, tokenId };
};

const loginUser = async ({ email, password, userAgent, ipAddress }) => {
  const normalizedEmail = email.trim().toLowerCase();

  return withTenantTransaction(
    {
      authContext: "login",
      authEmail: normalizedEmail
    },
    async (client) => {
      const userResult = await client.query(
        `
          SELECT id, firm_id, name, email, password_hash, role
          FROM users
          WHERE lower(email) = $1
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [normalizedEmail]
      );

      if (userResult.rowCount === 0) {
        throw ApiError.unauthorized("Invalid email or password");
      }

      const user = userResult.rows[0];
      const passwordMatches = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatches) {
        throw ApiError.unauthorized("Invalid email or password");
      }

      await setLocalConfig(client, "app.current_firm_id", user.firm_id);
      await setLocalConfig(client, "app.auth_context", "");
      await setLocalConfig(client, "app.auth_email", "");

      const firmResult = await client.query(
        `
          SELECT id, name, plan
          FROM firms
          WHERE id = $1
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [user.firm_id]
      );

      if (firmResult.rowCount === 0) {
        throw ApiError.unauthorized("Firm account is unavailable");
      }

      const session = await createSession(client, {
        user,
        userAgent,
        ipAddress
      });

      return {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        user: mapUserResponse(user),
        firm: firmResult.rows[0]
      };
    }
  );
};

const refreshAccessToken = async ({ refreshToken, userAgent, ipAddress }) => {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  if (
    payload.type !== "refresh" ||
    !payload.jti ||
    !payload.sub ||
    !payload.firm_id
  ) {
    throw ApiError.unauthorized("Invalid refresh token payload");
  }

  return withTenantTransaction({ firmId: payload.firm_id }, async (client) => {
    const sessionResult = await client.query(
      `
        SELECT
          rt.id,
          rt.user_id,
          rt.firm_id,
          rt.token_hash,
          rt.expires_at,
          rt.revoked_at,
          u.name,
          u.email,
          u.role
        FROM refresh_tokens rt
        JOIN users u ON u.id = rt.user_id
        WHERE rt.token_id = $1
          AND rt.user_id = $2
          AND rt.firm_id = $3
          AND rt.deleted_at IS NULL
          AND u.deleted_at IS NULL
        LIMIT 1
      `,
      [payload.jti, payload.sub, payload.firm_id]
    );

    if (sessionResult.rowCount === 0) {
      throw ApiError.unauthorized("Refresh session not found");
    }

    const sessionRow = sessionResult.rows[0];
    if (sessionRow.token_hash !== hashToken(refreshToken)) {
      throw ApiError.unauthorized("Refresh token mismatch");
    }

    if (sessionRow.revoked_at) {
      throw ApiError.unauthorized("Refresh token has been revoked");
    }

    if (new Date(sessionRow.expires_at) <= new Date()) {
      throw ApiError.unauthorized("Refresh token has expired");
    }

    const user = {
      id: sessionRow.user_id,
      firm_id: sessionRow.firm_id,
      name: sessionRow.name,
      email: sessionRow.email,
      role: sessionRow.role
    };

    const nextTokenId = randomUUID();
    const nextAccessToken = createAccessToken({
      userId: user.id,
      firmId: user.firm_id,
      role: user.role
    });
    const nextRefreshToken = createRefreshToken({
      userId: user.id,
      firmId: user.firm_id,
      role: user.role,
      tokenId: nextTokenId
    });

    await client.query(
      `
        UPDATE refresh_tokens
        SET revoked_at = NOW(),
            replaced_by_token_id = $1
        WHERE id = $2
      `,
      [nextTokenId, sessionRow.id]
    );

    await client.query(
      `
        INSERT INTO refresh_tokens (
          firm_id,
          user_id,
          token_id,
          token_hash,
          expires_at,
          user_agent,
          ip_address
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          NOW() + make_interval(secs => $5::integer),
          $6,
          $7
        )
      `,
      [
        user.firm_id,
        user.id,
        nextTokenId,
        hashToken(nextRefreshToken),
        env.REFRESH_TOKEN_TTL_SECONDS,
        userAgent ?? null,
        ipAddress ?? null
      ]
    );

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      user: mapUserResponse(user)
    };
  });
};

const logoutSession = async ({ refreshToken }) => {
  if (!refreshToken) {
    return;
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken, { ignoreExpiration: true });
  } catch (error) {
    return;
  }

  if (
    payload.type !== "refresh" ||
    !payload.jti ||
    !payload.sub ||
    !payload.firm_id
  ) {
    return;
  }

  await withTenantTransaction({ firmId: payload.firm_id }, async (client) => {
    await client.query(
      `
        UPDATE refresh_tokens
        SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE token_id = $1
          AND user_id = $2
          AND firm_id = $3
          AND deleted_at IS NULL
      `,
      [payload.jti, payload.sub, payload.firm_id]
    );
  });
};

const validateMagicToken = async ({ token }) =>
  withTenantTransaction(
    {
      authContext: "magic_link",
      uploadToken: token
    },
    async (client) => {
      const clientResult = await client.query(
        `
          SELECT id, firm_id, name, status, upload_token_expires_at
          FROM clients
          WHERE upload_token = $1
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [token]
      );

      if (clientResult.rowCount === 0) {
        throw ApiError.notFound("Magic link is invalid or expired");
      }

      const clientRow = clientResult.rows[0];
      if (clientRow.status === "inactive") {
        throw ApiError.forbidden("Client is inactive");
      }

      return {
        valid: true,
        client: {
          id: clientRow.id,
          firmId: clientRow.firm_id,
          name: clientRow.name,
          status: clientRow.status,
          uploadTokenExpiresAt: clientRow.upload_token_expires_at
        }
      };
    }
  );

const registerFirm = async ({ name, firmName, email, password, userAgent, ipAddress }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Use open context for email uniqueness check
    await setLocalConfig(client, "app.current_firm_id", "");
    await setLocalConfig(client, "app.auth_context", "signup");
    await setLocalConfig(client, "app.auth_email", normalizedEmail);
    await setLocalConfig(client, "app.upload_token", "");

    const existingUser = await client.query(
      `SELECT id FROM users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`,
      [normalizedEmail]
    );
    if (existingUser.rowCount > 0) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const firmResult = await client.query(
      `INSERT INTO firms (name, owner_email, plan) VALUES ($1, $2, 'starter') RETURNING id, name, plan`,
      [firmName.trim(), normalizedEmail]
    );
    const firm = firmResult.rows[0];

    await setLocalConfig(client, "app.current_firm_id", firm.id);
    await setLocalConfig(client, "app.auth_context", "");
    await setLocalConfig(client, "app.auth_email", "");

    const userResult = await client.query(
      `INSERT INTO users (firm_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')
       RETURNING id, firm_id, name, email, role`,
      [firm.id, name.trim(), normalizedEmail, passwordHash]
    );
    const user = userResult.rows[0];

    const session = await createSession(client, { user, userAgent, ipAddress });

    await client.query("COMMIT");
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: mapUserResponse(user),
      firm: { id: firm.id, name: firm.name, plan: firm.plan }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  loginUser,
  registerFirm,
  refreshAccessToken,
  logoutSession,
  validateMagicToken,
  getRefreshCookieOptions
};
