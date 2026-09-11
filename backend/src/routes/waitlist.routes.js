const express = require("express");
const Joi = require("joi");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { addToWaitlist } = require("../services/waitlist.service");

const router = express.Router();

const waitlistRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many waitlist attempts. Please try again later.",
    statusCode: 429
  }
});

const waitlistSchema = Joi.object({
  email: Joi.string().email().required(),
  // Optional so the plain "join waitlist" entry points (email-only) keep working —
  // the "Request a Demo" form collects and sends these, everything else can omit them.
  firmName: Joi.string().trim().max(255).allow("").optional(),
  contactName: Joi.string().trim().max(255).allow("").optional(),
  phone: Joi.string().trim().max(20).allow("").optional()
});

router.post(
  "/join",
  waitlistRateLimiter,
  validate(waitlistSchema),
  asyncHandler(async (req, res) => {
    const { email, firmName, contactName, phone } = req.body;
    const entry = await addToWaitlist({ email, firmName, contactName, phone });

    res.status(201).json({
      success: true,
      message: "You've been added to the waitlist!",
      email: entry.email
    });
  })
);

module.exports = router;
