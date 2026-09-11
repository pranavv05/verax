const jwt = require("jsonwebtoken");
const env = require("../config/env");

// Deliberately distinct from the firm portal's ISSUER/AUDIENCE in token-utils.js.
// Combined with a distinct signing key (CLIENT_JWT_SECRET, which env.js refuses
// to let equal JWT_SECRET), this makes a firm token structurally unusable on
// client-portal routes and vice versa — even before the `role`/`type` checks.
const CLIENT_ISSUER = "verax-client-portal";
const CLIENT_AUDIENCE = "verax-clients";

const CLIENT_ACCESS_TYPE = "client_access";
const CLIENT_REFRESH_TYPE = "client_refresh";

const createClientAccessToken = ({ clientId, firmId }) =>
  jwt.sign(
    { firm_id: firmId, role: "client", type: CLIENT_ACCESS_TYPE },
    env.CLIENT_JWT_SECRET,
    {
      subject: clientId,
      issuer: CLIENT_ISSUER,
      audience: CLIENT_AUDIENCE,
      expiresIn: env.CLIENT_JWT_EXPIRY
    }
  );

const createClientRefreshToken = ({ clientId, firmId, tokenId }) =>
  jwt.sign(
    { firm_id: firmId, role: "client", type: CLIENT_REFRESH_TYPE },
    env.CLIENT_JWT_SECRET,
    {
      subject: clientId,
      jwtid: tokenId,
      issuer: CLIENT_ISSUER,
      audience: CLIENT_AUDIENCE,
      expiresIn: `${env.CLIENT_REFRESH_TOKEN_TTL_SECONDS}s`
    }
  );

const verifyClientToken = (token, options = {}) =>
  jwt.verify(token, env.CLIENT_JWT_SECRET, {
    issuer: CLIENT_ISSUER,
    audience: CLIENT_AUDIENCE,
    ignoreExpiration: Boolean(options.ignoreExpiration)
  });

module.exports = {
  CLIENT_ISSUER,
  CLIENT_AUDIENCE,
  CLIENT_ACCESS_TYPE,
  CLIENT_REFRESH_TYPE,
  createClientAccessToken,
  createClientRefreshToken,
  verifyClientToken
};
