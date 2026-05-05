const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const { listAuditLogs } = require("../services/audit.service");

const router = express.Router();

const listAuditLogsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  action: Joi.string().trim().max(255).optional(),
  entityType: Joi.string().trim().max(255).optional()
});

router.use(requireAuth);

router.get(
  "/",
  requireAdmin,
  validate(listAuditLogsQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      listAuditLogs(db, {
        firmId: req.user.firmId,
        page: req.query.page,
        limit: req.query.limit,
        action: req.query.action,
        entityType: req.query.entityType
      })
    );
    res.status(200).json(result);
  })
);

module.exports = router;
