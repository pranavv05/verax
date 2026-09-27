const rateLimit = require("express-rate-limit");

// Keyed per signed-in user, not per firm: a firm-wide key made every staff
// member share one budget, so a few people reviewing at month-end locked the
// whole office out. Falls back to the IP for unauthenticated requests.
// (requireAuth sets req.user.userId from the token's `sub`.)
const perUserKey = (req) => (req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`);

const buildRateLimiter = ({
  windowMs,
  max,
  keyGenerator = perUserKey,
  message = "Too many requests. Please try again later."
}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "RATE_LIMIT_EXCEEDED",
      message,
      statusCode: 429
    },
    keyGenerator
  });

// Default throttle for authenticated, non-upload API routes. 900 per 15
// minutes per user (one a second, sustained) is well above a fast reviewer's
// pace, but still stops a stolen token from hammering the API unbounded.
const STANDARD_API_MAX = 900;
const standardApiLimiter = buildRateLimiter({ windowMs: 15 * 60 * 1000, max: STANDARD_API_MAX });

// Magic-link (client upload) limits, per client IP. Uploading one file is two
// requests (initiate, then confirm), and they used to share one 50-per-hour
// bucket, so a client sending 30 bills was cut off halfway. Each step now has
// its own budget sized for a month's paperwork in one sitting. The link
// carries a 256-bit token, so these guard against floods, not guessing.
const PUBLIC_UPLOAD_MAX_PER_HOUR = 300;
const MAGIC_LINK_OPEN_MAX = 120;

const buildPublicUploadLimiters = () => {
  const message = "Upload limit reached. Please try again later.";
  const byIp = (req) => `ip:${req.ip}`;
  const hour = 60 * 60 * 1000;
  return {
    initiate: buildRateLimiter({ windowMs: hour, max: PUBLIC_UPLOAD_MAX_PER_HOUR, keyGenerator: byIp, message }),
    confirm: buildRateLimiter({ windowMs: hour, max: PUBLIC_UPLOAD_MAX_PER_HOUR, keyGenerator: byIp, message }),
    // Opening or refreshing the upload link. Previously shared the 10-per-15-
    // minutes signup/password budget, so a client reopening the link a few
    // times locked themselves out.
    open: buildRateLimiter({ windowMs: 15 * 60 * 1000, max: MAGIC_LINK_OPEN_MAX, keyGenerator: byIp })
  };
};

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

module.exports = {
  buildRateLimiter,
  standardApiLimiter,
  buildAuthLimiters,
  buildPublicUploadLimiters,
  perUserKey,
  STANDARD_API_MAX,
  PUBLIC_UPLOAD_MAX_PER_HOUR,
  MAGIC_LINK_OPEN_MAX
};
