const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const ApiError = require("../utils/api-error");
const {
  listMappings,
  createMapping,
  deleteMapping,
  applyMappings
} = require("../services/narration-mapping.service");

const router = express.Router();
router.use(requireAuth);

const uuidSchema = Joi.string().uuid({ version: ["uuidv4", "uuidv5"] });

const createSchema = Joi.object({
  narrationPattern: Joi.string().trim().min(1).max(500).required(),
  ledgerName: Joi.string().trim().min(1).max(255).required(),
  matchType: Joi.string().valid("exact", "contains", "starts_with").required()
});

const idParamSchema = Joi.object({
  id: uuidSchema.required()
});

const applySchema = Joi.object({
  transactions: Joi.array().items(Joi.string().allow("")).min(1).required()
});

const insertAuditLog = async (db, { firmId, userId, action, entityId, metadata }) => {
  await db.query(
    `
      INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, 'narration_mapping', $4, $5::jsonb)
    `,
    [firmId, userId ?? null, action, entityId ?? null, JSON.stringify(metadata || {})]
  );
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const mappings = await listMappings({ firmId: req.user.firmId });
    res.status(200).json({ mappings });
  })
);

router.post(
  "/",
  requireAdmin,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const mapping = await createMapping({
      firmId: req.user.firmId,
      narrationPattern: req.body.narrationPattern,
      ledgerName: req.body.ledgerName,
      matchType: req.body.matchType,
      createdBy: req.user.userId
    });

    await req.withTenantTransaction((db) =>
      insertAuditLog(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        action: "narration_mapping_created",
        entityId: mapping.id,
        metadata: { narrationPattern: mapping.narrationPattern, ledgerName: mapping.ledgerName }
      })
    );

    res.status(201).json(mapping);
  })
);

router.post(
  "/apply",
  requireAdmin,
  validate(applySchema),
  asyncHandler(async (req, res) => {
    const results = await applyMappings({
      firmId: req.user.firmId,
      narrations: req.body.transactions
    });
    res.status(200).json({ transactions: results });
  })
);

router.delete(
  "/:id",
  requireAdmin,
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const mapping = await deleteMapping({
      firmId: req.user.firmId,
      mappingId: req.params.id
    });

    await req.withTenantTransaction((db) =>
      insertAuditLog(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        action: "narration_mapping_deleted",
        entityId: mapping.id,
        metadata: { narrationPattern: mapping.narrationPattern, ledgerName: mapping.ledgerName }
      })
    );

    res.status(200).json({ success: true });
  })
);

module.exports = router;
