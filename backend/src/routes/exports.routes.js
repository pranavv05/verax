const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth } = require("../middlewares/auth.middleware");
const ApiError = require("../utils/api-error");
const {
  generateTallyExport,
  listExportHistory,
  getExportDownload
} = require("../services/exports.service");

const router = express.Router();

const uuidSchema = Joi.string().uuid({ version: ["uuidv4", "uuidv5"] });

const generateExportSchema = Joi.object({
  client_id: uuidSchema.required(),
  document_ids: Joi.array().items(uuidSchema).min(1).required(),
  date_from: Joi.date().iso().optional(),
  date_to: Joi.date().iso().optional()
}).custom((value, helpers) => {
  if (value.date_from && value.date_to && new Date(value.date_from) > new Date(value.date_to)) {
    return helpers.error("any.invalid");
  }
  return value;
}, "date range validation").messages({
  "any.invalid": "date_from must be earlier than or equal to date_to"
});

const historyQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  client_id: uuidSchema.optional(),
  status: Joi.string().valid("generated", "downloaded", "failed").optional()
});

const downloadParamSchema = Joi.object({
  id: uuidSchema.required()
});

router.use(requireAuth);

router.post(
  "/tally",
  validate(generateExportSchema),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      generateTallyExport(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        clientId: req.body.client_id,
        documentIds: req.body.document_ids,
        dateFrom: req.body.date_from ?? null,
        dateTo: req.body.date_to ?? null
      })
    );

    if (result.status === "failed") {
      throw new ApiError(502, result.error || "Failed to generate tally export", "EXPORT_FAILED");
    }

    res.status(200).json(result);
  })
);

router.get(
  "/history",
  validate(historyQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      listExportHistory(db, {
        firmId: req.user.firmId,
        page: req.query.page,
        limit: req.query.limit,
        clientId: req.query.client_id ?? null,
        status: req.query.status ?? null
      })
    );

    res.status(200).json(result);
  })
);

router.get(
  "/:id/download",
  validate(downloadParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      getExportDownload(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        exportId: req.params.id
      })
    );

    res.status(200).json(result);
  })
);

module.exports = router;
