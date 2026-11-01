/**
 * Tally-agent authentication.
 *
 * The installed Tally agent authenticates with its own bearer token (not a firm
 * JWT). This middleware resolves that token to an agent and its firm, then
 * exposes req.agent = { id, firmId } and a req.withTenantTransaction scoped to
 * that firm, so every downstream query runs under the agent's firm's RLS exactly
 * like a firm user's requests do.
 *
 * Resolution happens in two phases because the agent's firm is unknown until the
 * token is resolved:
 *   1. open a transaction with authContext 'tally_agent' + agentTokenHash so the
 *      tally_agents RLS policy exposes the one matching active agent row;
 *   2. re-scope req.withTenantTransaction to that firm for the handlers.
 */

const ApiError = require("../utils/api-error");
const { withTenantTransaction } = require("../db/tenant-context");
const { authenticateAgent, hashAgentToken } = require("../services/tally-connector.service");

const extractBearerToken = (authorizationHeader = "") => {
  if (!authorizationHeader.startsWith("Bearer ")) return null;
  return authorizationHeader.slice(7).trim();
};

const requireAgentAuth = async (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return next(ApiError.unauthorized("Missing agent token"));
  }

  try {
    const agent = await withTenantTransaction(
      { authContext: "tally_agent", agentTokenHash: hashAgentToken(token) },
      (db) => authenticateAgent(db, token)
    );

    if (!agent) {
      return next(ApiError.unauthorized("Invalid or revoked agent token"));
    }

    req.agent = { id: agent.id, firmId: agent.firmId };
    req.withTenantTransaction = (handler) =>
      withTenantTransaction({ firmId: agent.firmId }, handler);

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { requireAgentAuth };
