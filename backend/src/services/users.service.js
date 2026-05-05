const bcrypt = require("bcryptjs");
const ApiError = require("../utils/api-error");
const env = require("../config/env");
const { sendEmail } = require("./email.service");
const { userInviteSubject, userInviteTemplate } = require("../templates/userInvite.template");

const SALT_ROUNDS = 12;

const toUserResponse = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const listUsers = async (db, { firmId }) => {
  const result = await db.query(
    `
      SELECT id, name, email, role, created_at, updated_at
      FROM users
      WHERE firm_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `,
    [firmId]
  );

  return result.rows.map(toUserResponse);
};

const inviteUser = async (db, { firmId, actorUserId, name, email, password, role = "staff" }) => {
  const existingResult = await db.query(
    `
      SELECT id FROM users
      WHERE email = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [email]
  );

  if (existingResult.rowCount > 0) {
    throw ApiError.conflict("A user with this email address already exists");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const firmResult = await db.query(
    `
      SELECT f.name AS firm_name,
             inviter.name AS inviter_name
      FROM firms f
      LEFT JOIN users inviter
        ON inviter.id = $2
       AND inviter.firm_id = f.id
       AND inviter.deleted_at IS NULL
      WHERE f.id = $1
        AND f.deleted_at IS NULL
      LIMIT 1
    `,
    [firmId, actorUserId ?? null]
  );

  const firmContext = firmResult.rows[0] || {};
  const firmName = firmContext.firm_name || "your firm";
  const inviterName = firmContext.inviter_name || "An admin";

  const insertResult = await db.query(
    `
      INSERT INTO users (firm_id, name, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, role, created_at, updated_at
    `,
    [firmId, name, email, passwordHash, role]
  );

  const newUser = insertResult.rows[0];
  const emailResult = await sendEmail({
    to: newUser.email,
    subject: userInviteSubject({ firmName }),
    html: userInviteTemplate({
      inviterName,
      firmName,
      loginUrl: `${env.FRONTEND_URL}/login`,
      tempPassword: password
    })
  });

  await db.query(
    `
      INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      firmId,
      actorUserId ?? null,
      "user_invited",
      "user",
      newUser.id,
      JSON.stringify({ email: newUser.email, role: newUser.role })
    ]
  );

  await db.query(
    `
      INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      firmId,
      actorUserId ?? null,
      "user_invite_emailed",
      "user",
      newUser.id,
      JSON.stringify({
        email: newUser.email,
        sent: Boolean(emailResult.sent),
        provider: env.EMAIL_PROVIDER,
        error: emailResult.error ?? null
      })
    ]
  );

  return toUserResponse(newUser);
};

const removeUser = async (db, { firmId, actorUserId, targetUserId }) => {
  if (actorUserId === targetUserId) {
    throw ApiError.badRequest("You cannot remove your own account");
  }

  const userResult = await db.query(
    `
      SELECT id, role FROM users
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [targetUserId, firmId]
  );

  if (userResult.rowCount === 0) {
    throw ApiError.notFound("User not found");
  }

  await db.query(
    `
      UPDATE users
      SET deleted_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
        AND firm_id = $2
    `,
    [targetUserId, firmId]
  );

  await db.query(
    `
      INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [firmId, actorUserId ?? null, "user_removed", "user", targetUserId, JSON.stringify({})]
  );

  return { success: true };
};

module.exports = {
  listUsers,
  inviteUser,
  removeUser
};
