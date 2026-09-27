const express = require("express");
const multer = require("multer");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const { standardApiLimiter } = require("../middlewares/rate-limit.middleware");
const {
  listClients,
  createClient,
  getClientById,
  updateClient,
  deleteClient,
  requestClientDocuments,
  resetClientUploadLink
} = require("../services/clients.service");
const { enableClientPortal } = require("../services/client-auth.service");
const {
  MAX_FILE_SIZE_BYTES,
  buildTemplateCsv,
  previewClientImport,
  confirmClientImport
} = require("../services/client-import.service");
const ApiError = require("../utils/api-error");

const router = express.Router();

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES }
});

const handleImportUpload = (req, res, next) => {
  importUpload.single("file")(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest("File exceeds 5MB limit"));
    }
    if (error) {
      return next(error);
    }
    return next();
  });
};

const uuidSchema = Joi.string().uuid({ version: ["uuidv4", "uuidv5"] });

const listClientsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  status: Joi.string().valid("active", "inactive", "pending").optional(),
  search: Joi.string().trim().max(255).optional()
});

const createClientBodySchema = Joi.object({
  name: Joi.string().trim().max(255).required(),
  gstin: Joi.string().trim().uppercase().max(15).allow(null, ""),
  email: Joi.string().email().max(255).allow(null, ""),
  phone: Joi.string().trim().max(15).allow(null, ""),
  status: Joi.string().valid("active", "inactive", "pending").default("active")
});

const updateClientBodySchema = Joi.object({
  name: Joi.string().trim().max(255).optional(),
  gstin: Joi.string().trim().uppercase().max(15).allow(null, "").optional(),
  email: Joi.string().email().max(255).allow(null, "").optional(),
  phone: Joi.string().trim().max(15).allow(null, "").optional(),
  status: Joi.string().valid("active", "inactive", "pending").optional()
}).min(1);

const clientIdParamSchema = Joi.object({
  id: uuidSchema.required()
});

const enablePortalBodySchema = Joi.object({
  portalEmail: Joi.string().email().max(255).required()
});

const requestDocsBodySchema = Joi.object({
  documentTypes: Joi.array()
    .items(Joi.string().valid("invoice", "bank_statement", "bill", "other"))
    .min(1)
    .optional()
});

const importConfirmRowSchema = Joi.object({
  rowNumber: Joi.number().integer().optional(),
  status: Joi.string().valid("valid", "warning").optional(),
  data: Joi.object({
    clientName: Joi.string().trim().min(2).max(255).required(),
    gstin: Joi.string().trim().uppercase().max(15).allow(null, ""),
    email: Joi.string().email().max(255).allow(null, ""),
    phone: Joi.string().trim().max(15).allow(null, ""),
    status: Joi.string().valid("active", "inactive").allow(null, "")
  }).required(),
  issues: Joi.array().items(Joi.string()).optional()
});

const importConfirmBodySchema = Joi.object({
  rows: Joi.array().items(importConfirmRowSchema).min(1).required()
});

router.use(requireAuth);
router.use(standardApiLimiter);

router.get(
  "/",
  validate(listClientsQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      listClients(db, {
        firmId: req.user.firmId,
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status,
        search: req.query.search
      })
    );
    res.status(200).json(result);
  })
);

router.post(
  "/",
  requireAdmin,
  validate(createClientBodySchema),
  asyncHandler(async (req, res) => {
    const client = await req.withTenantTransaction((db) =>
      createClient(db, {
        firmId: req.user.firmId,
        payload: req.body,
        actorUserId: req.user.userId
      })
    );
    res.status(201).json(client);
  })
);

router.get(
  "/import/template",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const csv = buildTemplateCsv();
    res.status(200);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="verax-client-import-template.csv"'
    );
    res.send(csv);
  })
);

router.post(
  "/import/preview",
  requireAdmin,
  handleImportUpload,
  asyncHandler(async (req, res) => {
    const result = await previewClientImport(req.file);
    res.status(200).json(result);
  })
);

router.post(
  "/import/confirm",
  requireAdmin,
  validate(importConfirmBodySchema),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      confirmClientImport(db, {
        firmId: req.user.firmId,
        actorUserId: req.user.userId,
        rows: req.body.rows
      })
    );
    res.status(200).json(result);
  })
);

router.get(
  "/:id",
  validate(clientIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const client = await req.withTenantTransaction((db) =>
      getClientById(db, {
        firmId: req.user.firmId,
        clientId: req.params.id
      })
    );
    res.status(200).json(client);
  })
);

router.put(
  "/:id",
  requireAdmin,
  validate(clientIdParamSchema, "params"),
  validate(updateClientBodySchema),
  asyncHandler(async (req, res) => {
    const client = await req.withTenantTransaction((db) =>
      updateClient(db, {
        firmId: req.user.firmId,
        clientId: req.params.id,
        payload: req.body,
        actorUserId: req.user.userId
      })
    );
    res.status(200).json(client);
  })
);

router.delete(
  "/:id",
  requireAdmin,
  validate(clientIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    await req.withTenantTransaction((db) =>
      deleteClient(db, {
        firmId: req.user.firmId,
        clientId: req.params.id,
        actorUserId: req.user.userId
      })
    );
    res.status(204).send();
  })
);

router.post(
  "/:id/request-docs",
  requireAdmin,
  validate(clientIdParamSchema, "params"),
  validate(requestDocsBodySchema),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      requestClientDocuments(db, {
        firmId: req.user.firmId,
        clientId: req.params.id,
        actorUserId: req.user.userId,
        documentTypes: req.body.documentTypes
      })
    );
    res.status(200).json(result);
  })
);

// Kills every upload link already sent to this client and issues a new one.
router.post(
  "/:id/reset-upload-link",
  requireAdmin,
  validate(clientIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      resetClientUploadLink(db, {
        firmId: req.user.firmId,
        clientId: req.params.id,
        actorUserId: req.user.userId
      })
    );
    res.status(200).json(result);
  })
);

// Turns on client-portal access and returns the generated temporary password.
// This is the only time the password is ever readable — it is stored hashed.
router.post(
  "/:id/enable-portal",
  requireAdmin,
  validate(clientIdParamSchema, "params"),
  validate(enablePortalBodySchema),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      enableClientPortal(db, {
        firmId: req.user.firmId,
        clientId: req.params.id,
        portalEmail: req.body.portalEmail,
        actorUserId: req.user.userId
      })
    );
    res.status(200).json(result);
  })
);

module.exports = router;
