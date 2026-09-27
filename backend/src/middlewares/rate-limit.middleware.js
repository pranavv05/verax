const rateLimit = require("express-rate-limit");

const buildRateLimiter = ({ windowMs, max }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later.",
      statusCode: 429
    },
    keyGenerator: (req) => req.user?.firmId || req.ip
  });

// Default throttle for authenticated, non-upload API routes: generous enough
// for normal staff usage, tight enough to stop a compromised token from
// hammering export/compliance/client endpoints with no limit at all.
const standardApiLimiter = buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 300 });

// Limiters for the unauthenticated auth endpoints (firm and client portal).
// Each router builds its own instances so the two portals keep separate
// budgets. req.ip is only a real per-client address when TRUST_PROXY matches
// the deployment's proxy hop count (see config/env.js).
const buildAuthLimiter = ({ max, keyGenerator, message = "Too many requests. Please try again later." }) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "RATE_LIMIT_EXCEEDED",
      message,
      statusCode: 429
    },
    ...(keyGenerator && { keyGenerator })
  });

// Keys a login attempt on IP + target account, so colleagues behind one
// office NAT don't share a single 10-attempt budget, while password
// guessing against any one account is still capped per source IP.
const loginAccountKey = (req) =>
  `${req.ip}|${String(req.body?.email || "").trim().toLowerCase()}`;

// Login: per-account budget, plus a wider per-IP ceiling so one IP can't
// spray guesses across many accounts. Refresh/logout get a separate, much
// larger per-IP budget: they carry a 256-bit refresh token (nothing to
// guess), run on every page load and every 15-minute access-token expiry,
// and previously shared the 10-per-15-minutes login budget — which logged
// out everyone behind a shared IP once a handful of sessions refreshed.
const buildAuthLimiters = ({ message } = {}) => ({
  attempt: buildAuthLimiter({ max: 10, message }),
  loginPerAccount: buildAuthLimiter({ max: 10, keyGenerator: loginAccountKey, message }),
  loginPerIp: buildAuthLimiter({ max: 100, message }),
  session: buildAuthLimiter({ max: 300, message })
});

module.exports = { buildRateLimiter, standardApiLimiter, buildAuthLimiters };
