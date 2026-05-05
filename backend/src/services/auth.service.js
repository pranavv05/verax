const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { randomUUID } = require("crypto");
const ApiError = require("../utils/api-error");
const env = require("../config/env");
const pool = require("../db/pool");
const { withTenantTransaction, setLocalConfig } = require("../db/tenant-context");
const { sendEmail } = require("./email.service");
const {
  PASSWORD_RESET_SUBJECT,
  passwordResetTemplate
} = require("../templates/passwordReset.template");
const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  hashToken
} = require("../utils/token-utils");

const PASSWORD_RESET_TOKEN_TTL_MINUTES = 15;
const PASSWORD_RESET_SUCCESS_MESSAGE =
  "If an account exists for that email, a password reset link will be available shortly.";

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

const revokeRefreshTokenFamily = async (client, { firmId, userId }) => {
  await client.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE firm_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
        AND expires_at > NOW()
    `,
    [firmId, userId]
  );
};

const createPasswordResetToken = () => crypto.randomBytes(32).toString("hex");

const buildPasswordResetUrl = (token) => `${env.FRONTEND_URL}/reset-password/${token}`;

const insertAuditLog = async (client, { firmId, userId, action, entityType, entityId, metadata }) => {
  await client.query(
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
    [firmId, userId ?? null, action, entityType, entityId ?? null, JSON.stringify(metadata || {})]
  );
};

const requestPasswordReset = async ({ email, userAgent, ipAddress }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await withTenantTransaction(
    {
      authContext: "login",
      authEmail: normalizedEmail
    },
    async (client) => {
      const userResult = await client.query(
        `
          SELECT u.id, u.firm_id, u.name, u.email, f.name AS firm_name
          FROM users u
          JOIN firms f ON f.id = u.firm_id
          WHERE lower(u.email) = $1
            AND u.deleted_at IS NULL
            AND f.deleted_at IS NULL
          LIMIT 1
        `,
        [normalizedEmail]
      );

      if (userResult.rowCount === 0) {
        return null;
      }

      const user = userResult.rows[0];
      await setLocalConfig(client, "app.current_firm_id", user.firm_id);
      await setLocalConfig(client, "app.auth_context", "");
      await setLocalConfig(client, "app.auth_email", "");

      await client.query(
        `
          UPDATE password_reset_tokens
          SET deleted_at = NOW()
          WHERE firm_id = $1
            AND user_id = $2
            AND used_at IS NULL
            AND expires_at > NOW()
            AND deleted_at IS NULL
        `,
        [user.firm_id, user.id]
      );

      const token = createPasswordResetToken();
      const tokenHash = hashToken(token);
      await client.query(
        `
          INSERT INTO password_reset_tokens (
            firm_id,
            user_id,
            token_hash,
            expires_at,
            user_agent,
            ip_address
          ) VALUES (
            $1,
            $2,
            $3,
            NOW() + make_interval(mins => $4::integer),
            $5,
            $6
          )
        `,
        [
          user.firm_id,
          user.id,
          tokenHash,
          PASSWORD_RESET_TOKEN_TTL_MINUTES,
          userAgent ?? null,
          ipAddress ?? null
        ]
      );

      await insertAuditLog(client, {
        firmId: user.firm_id,
        userId: user.id,
        action: "password_reset_requested",
        entityType: "user",
        entityId: user.id,
        metadata: {
          email: user.email
        }
      });

      return {
        firmId: user.firm_id,
        userId: user.id,
        email: user.email,
        firmName: user.firm_name,
        resetUrl: buildPasswordResetUrl(token)
      };
    }
  );

  if (result?.resetUrl && env.NODE_ENV !== "production") {
    console.info("[auth/password-reset] development reset link", {
      email: normalizedEmail,
      resetUrl: result.resetUrl
    });
  }

  if (result?.resetUrl) {
    const emailResult = await sendEmail({
      to: result.email,
      subject: PASSWORD_RESET_SUBJECT,
      html: passwordResetTemplate({
        resetLink: result.resetUrl,
        expiryMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES,
        firmName: result.firmName || "Verax"
      })
    });

    await withTenantTransaction({ firmId: result.firmId }, (client) =>
      insertAuditLog(client, {
        firmId: result.firmId,
        userId: result.userId,
        action: "password_reset_emailed",
        entityType: "user",
        entityId: result.userId,
        metadata: {
          email: result.email,
          sent: Boolean(emailResult.sent),
          provider: env.EMAIL_PROVIDER,
          error: emailResult.error ?? null
        }
      })
    );
  }

  return {
    message: PASSWORD_RESET_SUCCESS_MESSAGE,
    devResetLink: env.NODE_ENV !== "production" ? result?.resetUrl ?? null : undefined
  };
};

const getPasswordResetToken = async (client, { tokenHash, forUpdate = false }) => {
  const result = await client.query(
    `
      SELECT
        id,
        firm_id,
        user_id,
        expires_at,
        used_at
      FROM password_reset_tokens prt
      WHERE token_hash = $1
        AND deleted_at IS NULL
      LIMIT 1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
};

const validatePasswordResetToken = async ({ token }) => {
  const tokenHash = hashToken(token);

  return withTenantTransaction(
    {
      authContext: "password_reset",
      passwordResetTokenHash: tokenHash
    },
    async (client) => {
      const row = await getPasswordResetToken(client, { tokenHash });
      const valid =
        Boolean(row) &&
        !row.used_at &&
        new Date(row.expires_at).getTime() > Date.now();

      if (!valid) {
        throw ApiError.notFound("Password reset link is invalid or expired");
      }

      await setLocalConfig(client, "app.current_firm_id", row.firm_id);
      const userResult = await client.query(
        `
          SELECT email
          FROM users
          WHERE id = $1
            AND firm_id = $2
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [row.user_id, row.firm_id]
      );

      if (userResult.rowCount === 0) {
        throw ApiError.notFound("Password reset link is invalid or expired");
      }

      return {
        valid: true,
        email: userResult.rows[0].email,
        expiresAt: row.expires_at
      };
    }
  );
};

const resetPassword = async ({ token, password }) => {
  const tokenHash = hashToken(token);
  const passwordHash = await bcrypt.hash(password, 12);

  return withTenantTransaction(
    {
      authContext: "password_reset",
      passwordResetTokenHash: tokenHash
    },
    async (client) => {
      const row = await getPasswordResetToken(client, { tokenHash, forUpdate: true });
      const valid =
        Boolean(row) &&
        !row.used_at &&
        new Date(row.expires_at).getTime() > Date.now();

      if (!valid) {
        throw ApiError.notFound("Password reset link is invalid or expired");
      }

      await setLocalConfig(client, "app.current_firm_id", row.firm_id);
      await setLocalConfig(client, "app.auth_context", "");
      await setLocalConfig(client, "app.password_reset_token_hash", "");

      await client.query(
        `
          UPDATE users
          SET password_hash = $1,
              updated_at = NOW()
          WHERE id = $2
            AND firm_id = $3
            AND deleted_at IS NULL
        `,
        [passwordHash, row.user_id, row.firm_id]
      );

      await client.query(
        `
          UPDATE password_reset_tokens
          SET used_at = NOW(),
              deleted_at = NOW()
          WHERE id = $1
            AND firm_id = $2
        `,
        [row.id, row.firm_id]
      );

      await revokeRefreshTokenFamily(client, {
        firmId: row.firm_id,
        userId: row.user_id
      });

      await insertAuditLog(client, {
        firmId: row.firm_id,
        userId: row.user_id,
        action: "password_reset_completed",
        entityType: "user",
        entityId: row.user_id,
        metadata: {}
      });

      return { success: true };
    }
  );
};

const registerFirm = async ({ name, firmName, email, password, userAgent, ipAddress }) => {
  if (!email || !email.trim()) {
    throw ApiError.badRequest("Email is required");
  }
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
      await revokeRefreshTokenFamily(client, {
        firmId: sessionRow.firm_id,
        userId: sessionRow.user_id
      });
      throw ApiError.unauthorized("Refresh token mismatch");
    }

    if (sessionRow.revoked_at) {
      await revokeRefreshTokenFamily(client, {
        firmId: sessionRow.firm_id,
        userId: sessionRow.user_id
      });
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

      if (
        !clientRow.upload_token_expires_at ||
        new Date(clientRow.upload_token_expires_at) <= new Date()
      ) {
        throw ApiError.notFound("Magic link is invalid or expired");
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

module.exports = {
  registerFirm,
  loginUser,
  refreshAccessToken,
  logoutSession,
  validateMagicToken,
  requestPasswordReset,
  validatePasswordResetToken,
  resetPassword,
  getRefreshCookieOptions
};
