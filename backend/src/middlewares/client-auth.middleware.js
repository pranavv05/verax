/**
 * Client portal auth guard.
 *
 * Completely independent of `auth.middleware.js`'s requireAuth: it verifies
 * against CLIENT_JWT_SECRET with the client-portal issuer/audience, so a firm
 * access token can never satisfy it (and a client token can never satisfy
 * requireAuth, which verifies against JWT_SECRET with the firm issuer).
 *
 * On success it establishes the client's RLS context for the request:
 *   app.current_firm_id  = the client's firm
 *   app.current_client_id = the client itself
 * exposed as `req.withClientTransaction`, which every client-portal route must
 * use for database access.
 */

const ApiError = require("../utils/api-error");
const { withTenantTransaction } = require("../db/tenant-context");
const { CLIENT_ACCESS_TYPE, verifyClientToken } = require("../utils/client-token-utils");

const extractBearerToken = (authorizationHeader = "") => {
  if (!authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice(7).trim();
};

const requireClientAuth = (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return next(ApiError.unauthorized("Missing bearer access token"));
  }

  try {
    const payload = verifyClientToken(token);

    if (
      payload.type !== CLIENT_ACCESS_TYPE ||
      payload.role !== "client" ||
      !payload.firm_id ||
      !payload.sub
    ) {
      return next(ApiError.unauthorized("Invalid client access token payload"));
    }

    req.clientId = payload.sub;
    req.firmId = payload.firm_id;
    req.withClientTransaction = (handler) =>
      withTenantTransaction({ firmId: req.firmId, clientId: req.clientId }, handler);

    return next();
  } catch (error) {
    return next(ApiError.unauthorized("Invalid or expired access token"));
  }
};

module.exports = {
  requireClientAuth
};
