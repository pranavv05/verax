const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const { listUsers, inviteUser, removeUser } = require("../services/users.service");

const router = express.Router();

const uuidSchema = Joi.string().uuid({ version: ["uuidv4", "uuidv5"] });

const inviteUserSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid("admin", "staff").default("staff")
});

const userIdParamSchema = Joi.object({
  id: uuidSchema.required()
});

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const data = await req.withTenantTransaction((db) =>
      listUsers(db, { firmId: req.user.firmId })
    );
    res.status(200).json({ data });
  })
);

router.post(
  "/",
  requireAdmin,
  validate(inviteUserSchema),
  asyncHandler(async (req, res) => {
    const user = await req.withTenantTransaction((db) =>
      inviteUser(db, {
        firmId: req.user.firmId,
        actorUserId: req.user.userId,
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        role: req.body.role
      })
    );
    res.status(201).json({ user });
  })
);

router.delete(
  "/:id",
  requireAdmin,
  validate(userIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      removeUser(db, {
        firmId: req.user.firmId,
        actorUserId: req.user.userId,
        targetUserId: req.params.id
      })
    );
    res.status(200).json(result);
  })
);

module.exports = router;
