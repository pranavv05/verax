const ApiError = require("../utils/api-error");
const { withTenantTransaction } = require("../db/tenant-context");

const DOC_TYPES = new Set(["invoice", "bank_statement", "bill", "other"]);

const mapSchedule = (row) => ({
  id: row.id,
  firmId: row.firm_id,
  clientId: row.client_id,
  clientName: row.client_name,
  clientEmail: row.client_email,
  documentTypes: row.document_types || [],
  frequency: row.frequency,
  dayOfMonth: row.day_of_month,
  dayOfWeek: row.day_of_week,
  active: row.active,
  lastSentAt: row.last_sent_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const assertDocumentTypes = (documentTypes) => {
  if (!Array.isArray(documentTypes) || documentTypes.length === 0) {
    throw ApiError.badRequest("At least one document type is required");
  }
  for (const type of documentTypes) {
    if (!DOC_TYPES.has(type)) {
      throw ApiError.badRequest("Invalid document type");
    }
  }
};

const normalizeSchedulePayload = ({ documentTypes, frequency, dayOfMonth, dayOfWeek }) => {
  if (documentTypes) assertDocumentTypes(documentTypes);

  if (frequency === "monthly") {
    if (!dayOfMonth) throw ApiError.badRequest("dayOfMonth is required for monthly schedules");
    return { documentTypes, frequency, dayOfMonth, dayOfWeek: null };
  }

  if (frequency === "weekly") {
    if (dayOfWeek === undefined || dayOfWeek === null) {
      throw ApiError.badRequest("dayOfWeek is required for weekly schedules");
    }
    return { documentTypes, frequency, dayOfMonth: null, dayOfWeek };
  }

  if (frequency) throw ApiError.badRequest("Invalid frequency");
  return { documentTypes, frequency, dayOfMonth, dayOfWeek };
};

const assertClientBelongsToFirm = async (db, { firmId, clientId }) => {
  const result = await db.query(
    `
      SELECT id
      FROM clients
      WHERE id = $1
        AND firm_id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [clientId, firmId]
  );
  if (result.rowCount === 0) throw ApiError.notFound("Client not found");
};

const createSchedule = async ({
  firmId,
  clientId,
  documentTypes,
  frequency,
  dayOfMonth,
  dayOfWeek,
  createdBy
}) =>
  withTenantTransaction({ firmId }, async (db) => {
    await assertClientBelongsToFirm(db, { firmId, clientId });
    const normalized = normalizeSchedulePayload({ documentTypes, frequency, dayOfMonth, dayOfWeek });

    await db.query(
      `
        UPDATE scheduled_requests
        SET active = false,
            updated_at = NOW()
        WHERE firm_id = $1
          AND client_id = $2
          AND active = true
      `,
      [firmId, clientId]
    );

    const result = await db.query(
      `
        INSERT INTO scheduled_requests (
          firm_id,
          client_id,
          document_types,
          frequency,
          day_of_month,
          day_of_week,
          created_by
        ) VALUES ($1, $2, $3::text[], $4, $5, $6, $7)
        RETURNING *
      `,
      [
        firmId,
        clientId,
        normalized.documentTypes,
        normalized.frequency,
        normalized.dayOfMonth,
        normalized.dayOfWeek,
        createdBy
      ]
    );

    return mapSchedule(result.rows[0]);
  });

const getScheduleForClient = async ({ clientId, firmId }) =>
  withTenantTransaction({ firmId }, async (db) => {
    const result = await db.query(
      `
        SELECT sr.*, c.name AS client_name, c.email AS client_email
        FROM scheduled_requests sr
        JOIN clients c ON c.id = sr.client_id
        WHERE sr.client_id = $1
          AND sr.firm_id = $2
          AND sr.active = true
          AND c.deleted_at IS NULL
        LIMIT 1
      `,
      [clientId, firmId]
    );
    return result.rowCount === 0 ? null : mapSchedule(result.rows[0]);
  });

const listSchedulesForFirm = async ({ firmId }) =>
  withTenantTransaction({ firmId }, async (db) => {
    const result = await db.query(
      `
        SELECT sr.*, c.name AS client_name, c.email AS client_email
        FROM scheduled_requests sr
        JOIN clients c ON c.id = sr.client_id
        WHERE sr.firm_id = $1
          AND sr.active = true
          AND c.deleted_at IS NULL
        ORDER BY sr.created_at DESC
      `,
      [firmId]
    );
    return result.rows.map(mapSchedule);
  });

const updateSchedule = async ({ scheduleId, firmId, updates }) =>
  withTenantTransaction({ firmId }, async (db) => {
    const existingResult = await db.query(
      `SELECT * FROM scheduled_requests WHERE id = $1 AND firm_id = $2 LIMIT 1`,
      [scheduleId, firmId]
    );
    if (existingResult.rowCount === 0) throw ApiError.notFound("Schedule not found");
    const existing = existingResult.rows[0];

    const merged = {
      documentTypes: updates.documentTypes ?? existing.document_types,
      frequency: updates.frequency ?? existing.frequency,
      dayOfMonth: Object.prototype.hasOwnProperty.call(updates, "dayOfMonth")
        ? updates.dayOfMonth
        : existing.day_of_month,
      dayOfWeek: Object.prototype.hasOwnProperty.call(updates, "dayOfWeek")
        ? updates.dayOfWeek
        : existing.day_of_week
    };
    const normalized = normalizeSchedulePayload(merged);

    const result = await db.query(
      `
        UPDATE scheduled_requests
        SET document_types = $3::text[],
            frequency = $4,
            day_of_month = $5,
            day_of_week = $6,
            active = $7,
            updated_at = NOW()
        WHERE id = $1
          AND firm_id = $2
        RETURNING *
      `,
      [
        scheduleId,
        firmId,
        normalized.documentTypes,
        normalized.frequency,
        normalized.dayOfMonth,
        normalized.dayOfWeek,
        updates.active ?? existing.active
      ]
    );

    return mapSchedule(result.rows[0]);
  });

const deleteSchedule = async ({ scheduleId, firmId }) =>
  withTenantTransaction({ firmId }, async (db) => {
    const result = await db.query(
      `
        DELETE FROM scheduled_requests
        WHERE id = $1
          AND firm_id = $2
        RETURNING *
      `,
      [scheduleId, firmId]
    );
    if (result.rowCount === 0) throw ApiError.notFound("Schedule not found");
    return mapSchedule(result.rows[0]);
  });

const getDueSchedules = async () =>
  withTenantTransaction({ authContext: "scheduler" }, async (db) => {
    const now = new Date();
    const dayOfMonth = now.getUTCDate();
    const dayOfWeek = now.getUTCDay();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result = await db.query(
      `
        SELECT
          sr.*
        FROM scheduled_requests sr
        WHERE sr.active = true
          AND (
            (
              sr.frequency = 'monthly'
              AND sr.day_of_month = $1
              AND (sr.last_sent_at IS NULL OR sr.last_sent_at < $3::timestamptz)
            )
            OR
            (
              sr.frequency = 'weekly'
              AND sr.day_of_week = $2
              AND (sr.last_sent_at IS NULL OR sr.last_sent_at < $4::timestamptz)
            )
          )
      `,
      [dayOfMonth, dayOfWeek, startOfMonth.toISOString(), sevenDaysAgo.toISOString()]
    );

    const schedules = [];
    for (const row of result.rows) {
      const clientResult = await withTenantTransaction({ firmId: row.firm_id }, async (tenantDb) =>
        tenantDb.query(
          `
            SELECT name AS client_name, email AS client_email
            FROM clients
            WHERE id = $1
              AND firm_id = $2
              AND deleted_at IS NULL
            LIMIT 1
          `,
          [row.client_id, row.firm_id]
        )
      );
      if (clientResult.rowCount > 0) {
        schedules.push(mapSchedule({ ...row, ...clientResult.rows[0] }));
      }
    }

    return schedules;
  });

const markSent = async ({ scheduleId }) =>
  withTenantTransaction({ authContext: "scheduler" }, async (db) => {
    await db.query(
      `UPDATE scheduled_requests SET last_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [scheduleId]
    );
  });

module.exports = {
  createSchedule,
  getScheduleForClient,
  listSchedulesForFirm,
  updateSchedule,
  deleteSchedule,
  getDueSchedules,
  markSent
};
