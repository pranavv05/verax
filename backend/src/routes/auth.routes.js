const express = require("express");
const Joi = require("joi");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const {
  registerFirm,
  loginUser,
  refreshAccessToken,
  logoutSession,
  validateMagicToken,
  getRefreshCookieOptions
} = require("../services/auth.service");
const { getCurrentUser } = require("../services/firms.service");
const { requireAuth } = require("../middlewares/auth.middleware");
const env = require("../config/env");

const router = express.Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please try again later.",
    statusCode: 429
  }
});

const signupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required(),
  firmName: Joi.string().trim().min(2).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required()
});

const magicTokenSchema = Joi.object({
  token: Joi.string().pattern(/^[a-zA-Z0-9]{32,128}$/).required()
});

router.post(
  "/signup",
  authRateLimiter,
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const { password, ...safeBody } = req.body || {};
    console.info("[auth/signup] req.body", {
      ...safeBody,
      password: password ? "[redacted]" : undefined
    });

    const result = await registerFirm({
      name: req.body.name,
      firmName: req.body.firmName,
      email: req.body.email,
      password: req.body.password,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip
    });

    res.cookie(env.REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());
    res.status(201).json({
      accessToken: result.accessToken,
      user: result.user,
      firm: result.firm
    });
  })
);

router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await loginUser({
      email: req.body.email,
      password: req.body.password,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip
    });

    res.cookie(env.REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());
    res.status(200).json({
      accessToken: result.accessToken,
      user: result.user,
      firm: result.firm
    });
  })
);

router.post(
  "/refresh",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies[env.REFRESH_COOKIE_NAME];
    const result = await refreshAccessToken({
      refreshToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip
    });

    res.cookie(env.REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());
    res.status(200).json({
      accessToken: result.accessToken,
      user: result.user
    });
  })
);

router.post(
  "/logout",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies[env.REFRESH_COOKIE_NAME];
    await logoutSession({ refreshToken });
    res.clearCookie(env.REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    res.status(200).json({ success: true });
  })
);

router.get(
  "/magic/:token",
  authRateLimiter,
  validate(magicTokenSchema, "params"),
  asyncHandler(async (req, res) => {
    const result = await validateMagicToken({ token: req.params.token });
    res.status(200).json(result);
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await req.withTenantTransaction((db) =>
      getCurrentUser(db, { firmId: req.user.firmId, userId: req.user.userId })
    );
    res.status(200).json(user);
  })
);

module.exports = router;
