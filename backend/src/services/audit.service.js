const listAuditLogs = async (db, { firmId, page = 1, limit = 50, action, entityType }) => {
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

  const whereClause = filters.join(" AND ");

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM audit_logs al
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
             u.email AS user_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id AND u.deleted_at IS NULL
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
    userEmail: row.user_email
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
