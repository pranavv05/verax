const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const { standardApiLimiter } = require("../middlewares/rate-limit.middleware");
const {
  createSchedule,
  getScheduleForClient,
  listSchedulesForFirm,
  updateSchedule,
  deleteSchedule
} = require("../services/scheduled-requests.service");

const router = express.Router();
router.use(requireAuth);
router.use(standardApiLimiter);

const uuidSchema = Joi.string().uuid({ version: ["uuidv4", "uuidv5"] });
const docTypeSchema = Joi.string().valid("invoice", "bank_statement", "bill", "other");

const createSchema = Joi.object({
  clientId: uuidSchema.required(),
  documentTypes: Joi.array().items(docTypeSchema).min(1).required(),
  frequency: Joi.string().valid("monthly", "weekly").required(),
  dayOfMonth: Joi.when("frequency", {
    is: "monthly",
    then: Joi.number().integer().min(1).max(28).required(),
    otherwise: Joi.any().allow(null).optional()
  }),
  dayOfWeek: Joi.when("frequency", {
    is: "weekly",
    then: Joi.number().integer().min(0).max(6).required(),
    otherwise: Joi.any().allow(null).optional()
  })
});

const updateSchema = Joi.object({
  documentTypes: Joi.array().items(docTypeSchema).min(1).optional(),
  frequency: Joi.string().valid("monthly", "weekly").optional(),
  dayOfMonth: Joi.number().integer().min(1).max(28).allow(null).optional(),
  dayOfWeek: Joi.number().integer().min(0).max(6).allow(null).optional(),
  active: Joi.boolean().optional()
}).min(1);

const querySchema = Joi.object({
  clientId: uuidSchema.optional()
});

const idParamSchema = Joi.object({
  id: uuidSchema.required()
});

const insertAuditLog = async (db, { firmId, userId, action, entityType, entityId, metadata }) => {
  await db.query(
    `
      INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [firmId, userId ?? null, action, entityType, entityId ?? null, JSON.stringify(metadata || {})]
  );
};

router.post(
  "/",
  requireAdmin,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const schedule = await createSchedule({
      firmId: req.user.firmId,
      clientId: req.body.clientId,
      documentTypes: req.body.documentTypes,
      frequency: req.body.frequency,
      dayOfMonth: req.body.dayOfMonth,
      dayOfWeek: req.body.dayOfWeek,
      createdBy: req.user.userId
    });

    await req.withTenantTransaction((db) =>
      insertAuditLog(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        action: "schedule_created",
        entityType: "client",
        entityId: schedule.clientId,
        metadata: { scheduleId: schedule.id }
      })
    );

    res.status(201).json(schedule);
  })
);

router.get(
  "/",
  validate(querySchema, "query"),
  asyncHandler(async (req, res) => {
    if (req.query.clientId) {
      const schedule = await getScheduleForClient({
        firmId: req.user.firmId,
        clientId: req.query.clientId
      });
      return res.status(200).json({ schedule });
    }

    const schedules = await listSchedulesForFirm({ firmId: req.user.firmId });
    return res.status(200).json({ schedules });
  })
);

router.patch(
  "/:id",
  requireAdmin,
  validate(idParamSchema, "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const schedule = await updateSchedule({
      firmId: req.user.firmId,
      scheduleId: req.params.id,
      updates: req.body
    });

    await req.withTenantTransaction((db) =>
      insertAuditLog(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        action: "schedule_updated",
        entityType: "client",
        entityId: schedule.clientId,
        metadata: { scheduleId: schedule.id }
      })
    );

    res.status(200).json(schedule);
  })
);

router.delete(
  "/:id",
  requireAdmin,
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const schedule = await deleteSchedule({
      firmId: req.user.firmId,
      scheduleId: req.params.id
    });

    await req.withTenantTransaction((db) =>
      insertAuditLog(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        action: "schedule_deleted",
        entityType: "client",
        entityId: schedule.clientId,
        metadata: { scheduleId: schedule.id }
      })
    );

    res.status(200).json({ success: true });
  })
);

module.exports = router;
