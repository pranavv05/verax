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

module.exports = { buildRateLimiter, standardApiLimiter };
