const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const {
  listClients,
  createClient,
  getClientById,
  updateClient,
  deleteClient,
  requestClientDocuments
} = require("../services/clients.service");

const router = express.Router();

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

router.use(requireAuth);

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
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      requestClientDocuments(db, {
        firmId: req.user.firmId,
        clientId: req.params.id,
        actorUserId: req.user.userId
      })
    );
    res.status(200).json(result);
  })
);

module.exports = router;
