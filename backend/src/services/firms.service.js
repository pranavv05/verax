const ApiError = require("../utils/api-error");

const getFirmSettings = async (db, { firmId }) => {
  const result = await db.query(
    `
      SELECT id, name, owner_email, plan, created_at
      FROM firms
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [firmId]
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound("Firm not found");
  }

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    ownerEmail: row.owner_email,
    plan: row.plan,
    createdAt: row.created_at
  };
};

const updateFirmSettings = async (db, { firmId, userId, name }) => {
  const result = await db.query(
    `
      UPDATE firms
      SET name = $2,
          updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, name, owner_email, plan, created_at
    `,
    [firmId, name]
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound("Firm not found");
  }

  await db.query(
    `
      INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [firmId, userId ?? null, "firm_settings_updated", "firm", firmId, JSON.stringify({ name })]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    ownerEmail: row.owner_email,
    plan: row.plan,
    createdAt: row.created_at
  };
};

const getCurrentUser = async (db, { firmId, userId }) => {
  const result = await db.query(
    `
      SELECT u.id, u.name, u.email, u.role, u.created_at,
             f.name AS firm_name, f.plan
      FROM users u
      JOIN firms f ON f.id = u.firm_id
      WHERE u.id = $1
        AND u.firm_id = $2
        AND u.deleted_at IS NULL
        AND f.deleted_at IS NULL
      LIMIT 1
    `,
    [userId, firmId]
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound("User not found");
  }

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    firmName: row.firm_name,
    plan: row.plan
  };
};

module.exports = {
  getFirmSettings,
  updateFirmSettings,
  getCurrentUser
};
