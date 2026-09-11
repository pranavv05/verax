const listAuditLogs = async (db, { firmId, page = 1, limit = 50, action, entityType, search }) => {
  const offset = (page - 1) * limit;
  const filters = ["al.firm_id = $1", "al.deleted_at IS NULL"];
  const params = [firmId];
  let paramIndex = params.length + 1;

  if (action) {
    filters.push(`al.action = $${paramIndex}`);
    params.push(action);
    paramIndex += 1;
  }

  if (entityType) {
    filters.push(`al.entity_type = $${paramIndex}`);
    params.push(entityType);
    paramIndex += 1;
  }

  if (search) {
    filters.push(
      `(al.action ILIKE $${paramIndex} OR al.entity_type ILIKE $${paramIndex} OR al.entity_id::text ILIKE $${paramIndex} OR al.metadata::text ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR cl.name ILIKE $${paramIndex})`
    );
    params.push(`%${search}%`);
    paramIndex += 1;
  }

  const whereClause = filters.join(" AND ");

  // metadata.clientId is a free-text JSONB value written by several call sites; only cast it to
  // uuid when it looks like one so a malformed/missing value can never break the audit log query.
  const clientJoin = `
      LEFT JOIN clients cl ON cl.id = (
        CASE
          WHEN al.metadata ->> 'clientId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN (al.metadata ->> 'clientId')::uuid
          WHEN al.entity_type = 'client' THEN al.entity_id
        END
      ) AND cl.deleted_at IS NULL
  `;

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id AND u.deleted_at IS NULL
      ${clientJoin}
      WHERE ${whereClause}
    `,
    params
  );

  const rowsResult = await db.query(
    `
      SELECT al.id,
             al.action,
             al.entity_type,
             al.entity_id,
             al.metadata,
             al.created_at,
             u.name  AS user_name,
             u.email AS user_email,
             cl.name AS client_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id AND u.deleted_at IS NULL
      ${clientJoin}
      WHERE ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `,
    [...params, limit, offset]
  );

  const data = rowsResult.rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
    userName: row.user_name,
    userEmail: row.user_email,
    clientName: row.client_name
  }));

  return {
    data,
    total: countResult.rows[0].total,
    page,
    limit
  };
};

module.exports = {
  listAuditLogs
};
