const ApiError = require("../utils/api-error");
const { verifyAccessToken } = require("../utils/token-utils");
const { withTenantTransaction } = require("../db/tenant-context");

const extractBearerToken = (authorizationHeader = "") => {
  if (!authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice(7).trim();
};

const requireAuth = (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return next(ApiError.unauthorized("Missing bearer access token"));
  }

  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== "access" || !payload.firm_id || !payload.sub) {
      return next(ApiError.unauthorized("Invalid access token payload"));
    }

    req.user = {
      userId: payload.sub,
      firmId: payload.firm_id,
      role: payload.role
    };
    req.withTenantTransaction = (handler) =>
      withTenantTransaction({ firmId: req.user.firmId }, handler);

    return next();
  } catch (error) {
    return next(ApiError.unauthorized("Invalid or expired access token"));
  }
};

module.exports = {
  requireAuth
};
