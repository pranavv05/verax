const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const { getFirmSettings, updateFirmSettings, getCurrentUser } = require("../services/firms.service");

const router = express.Router();

const updateFirmSettingsSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required()
});

router.get(
  "/settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const firm = await req.withTenantTransaction((db) =>
      getFirmSettings(db, { firmId: req.user.firmId })
    );
    res.status(200).json({ firm });
  })
);

router.put(
  "/settings",
  requireAuth,
  requireAdmin,
  validate(updateFirmSettingsSchema),
  asyncHandler(async (req, res) => {
    const firm = await req.withTenantTransaction((db) =>
      updateFirmSettings(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        name: req.body.name
      })
    );
    res.status(200).json({ firm });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await req.withTenantTransaction((db) =>
      getCurrentUser(db, {
        firmId: req.user.firmId,
        userId: req.user.userId
      })
    );
    res.status(200).json({ user });
  })
);

module.exports = router;
