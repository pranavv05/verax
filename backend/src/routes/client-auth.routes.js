const express = require("express");
const Joi = require("joi");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireClientAuth } = require("../middlewares/client-auth.middleware");
const {
  CLIENT_REFRESH_COOKIE_NAME,
  getClientRefreshCookieOptions,
  clientLogin,
  clientRefreshToken,
  clientLogout,
  clientChangePassword
} = require("../services/client-auth.service");

const router = express.Router();

// Separate from the firm portal's authRateLimiter — client-portal brute force
// attempts must not consume, or be masked by, the firm portal's budget.
const clientAuthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many attempts. Please try again in a few minutes.",
    statusCode: 429
  }
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(8).max(128).required(),
  newPassword: Joi.string().min(8).max(128).required()
});

router.post(
  "/login",
  clientAuthRateLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await clientLogin({
      email: req.body.email,
      password: req.body.password
    });

    res.cookie(CLIENT_REFRESH_COOKIE_NAME, result.refreshToken, getClientRefreshCookieOptions());
    res.status(200).json({
      accessToken: result.accessToken,
      client: result.client
    });
  })
);

router.post(
  "/refresh",
  clientAuthRateLimiter,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies[CLIENT_REFRESH_COOKIE_NAME];
    const result = await clientRefreshToken({ refreshToken });

    res.cookie(CLIENT_REFRESH_COOKIE_NAME, result.refreshToken, getClientRefreshCookieOptions());
    res.status(200).json({
      accessToken: result.accessToken,
      client: result.client
    });
  })
);

router.post(
  "/logout",
  clientAuthRateLimiter,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies[CLIENT_REFRESH_COOKIE_NAME];
    await clientLogout({ refreshToken });
    res.clearCookie(CLIENT_REFRESH_COOKIE_NAME, getClientRefreshCookieOptions());
    res.status(200).json({ success: true });
  })
);

router.post(
  "/change-password",
  clientAuthRateLimiter,
  requireClientAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await req.withClientTransaction((db) =>
      clientChangePassword(db, {
        clientId: req.clientId,
        firmId: req.firmId,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword
      })
    );

    // Every session was revoked, including this one — clear the cookie so the
    // browser cannot try to refresh with a now-dead token.
    res.clearCookie(CLIENT_REFRESH_COOKIE_NAME, getClientRefreshCookieOptions());
    res.status(200).json(result);
  })
);

module.exports = router;
