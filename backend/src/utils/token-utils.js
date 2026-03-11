const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

const ISSUER = "ca-saas-platform";
const AUDIENCE = "ca-saas-users";

const createAccessToken = ({ userId, firmId, role }) =>
  jwt.sign({ firm_id: firmId, role, type: "access" }, env.JWT_SECRET, {
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`
  });

const createRefreshToken = ({ userId, firmId, role, tokenId }) =>
  jwt.sign({ firm_id: firmId, role, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    subject: userId,
    jwtid: tokenId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: `${env.REFRESH_TOKEN_TTL_SECONDS}s`
  });

const verifyAccessToken = (token) =>
  jwt.verify(token, env.JWT_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE
  });

const verifyRefreshToken = (token, options = {}) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
    ignoreExpiration: Boolean(options.ignoreExpiration)
  });

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

module.exports = {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken
};
