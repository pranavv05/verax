const { withTenantTransaction } = require("../db/tenant-context");

const mapNotification = (row) => ({
  id: row.id,
  firmId: row.firm_id,
  userId: row.user_id,
  type: row.type,
  title: row.title,
  message: row.message,
  entityType: row.entity_type,
  entityId: row.entity_id,
  read: row.read,
  createdAt: row.created_at
});

const createNotification = async ({
  firmId,
  userId,
  type,
  title,
  message,
  entityType = null,
  entityId = null
}) => {
  try {
    return await withTenantTransaction({ firmId }, async (db) => {
      const result = await db.query(
        `
          INSERT INTO notifications (
            firm_id,
            user_id,
            type,
            title,
            message,
            entity_type,
            entity_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, firm_id, user_id, type, title, message, entity_type, entity_id, read, created_at
        `,
        [firmId, userId, type, title, message, entityType, entityId]
      );

      return mapNotification(result.rows[0]);
    });
  } catch (error) {
    console.error("Failed to create notification:", error.message || error);
    return null;
  }
};

const getNotificationsForUser = async ({ userId, firmId, limit = 20, onlyUnread = false }) =>
  withTenantTransaction({ firmId }, async (db) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const values = [firmId, userId, safeLimit];
    const unreadSql = onlyUnread ? "AND read = false" : "";

    const result = await db.query(
      `
        SELECT id, firm_id, user_id, type, title, message, entity_type, entity_id, read, created_at
        FROM notifications
        WHERE firm_id = $1
          AND user_id = $2
          ${unreadSql}
        ORDER BY created_at DESC
        LIMIT $3
      `,
      values
    );

    return result.rows.map(mapNotification);
  });

const getUnreadCount = async ({ userId, firmId }) =>
  withTenantTransaction({ firmId }, async (db) => {
    const result = await db.query(
      `
        SELECT COUNT(*)::int AS count
        FROM notifications
        WHERE firm_id = $1
          AND user_id = $2
          AND read = false
      `,
      [firmId, userId]
    );

    return Number(result.rows[0]?.count || 0);
  });

const markRead = async ({ notificationId, userId, firmId }) =>
  withTenantTransaction({ firmId }, async (db) => {
    await db.query(
      `
        UPDATE notifications
        SET read = true
        WHERE id = $1
          AND firm_id = $2
          AND user_id = $3
      `,
      [notificationId, firmId, userId]
    );
  });

const markAllRead = async ({ userId, firmId }) =>
  withTenantTransaction({ firmId }, async (db) => {
    await db.query(
      `
        UPDATE notifications
        SET read = true
        WHERE firm_id = $1
          AND user_id = $2
          AND read = false
      `,
      [firmId, userId]
    );
  });

module.exports = {
  createNotification,
  getNotificationsForUser,
  getUnreadCount,
  markRead,
  markAllRead
};
