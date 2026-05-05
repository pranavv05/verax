const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth } = require("../middlewares/auth.middleware");
const {
  getNotificationsForUser,
  getUnreadCount,
  markRead,
  markAllRead
} = require("../services/notifications.service");

const router = express.Router();

const listQuerySchema = Joi.object({
  unreadOnly: Joi.boolean().truthy("true").falsy("false").default(false)
});

const idParamSchema = Joi.object({
  id: Joi.string().uuid({ version: ["uuidv4", "uuidv5"] }).required()
});

router.use(requireAuth);

router.get(
  "/",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { userId, firmId } = req.user;
    const [notifications, unreadCount] = await Promise.all([
      getNotificationsForUser({
        userId,
        firmId,
        limit: 20,
        onlyUnread: req.query.unreadOnly
      }),
      getUnreadCount({ userId, firmId })
    ]);

    res.status(200).json({ notifications, unreadCount });
  })
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await markAllRead({ userId: req.user.userId, firmId: req.user.firmId });
    res.status(200).json({ success: true });
  })
);

router.patch(
  "/:id/read",
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    await markRead({
      notificationId: req.params.id,
      userId: req.user.userId,
      firmId: req.user.firmId
    });
    res.status(200).json({ success: true });
  })
);

module.exports = router;
