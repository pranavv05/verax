/**
 * Live Tally connector routes.
 *
 * Two audiences, two auth schemes on one router:
 *
 *  App-facing (firm JWT, admin):
 *    POST   /api/tally/agents              register an agent (token shown once)
 *    GET    /api/tally/agents              list agents + online status
 *    DELETE /api/tally/agents/:agentId     revoke an agent
 *    POST   /api/tally/sync                queue a reviewed document for push
 *    GET    /api/tally/sync/:documentId    latest sync status for a document
 *
 *  Agent-facing (agent bearer token):
 *    POST   /api/tally/agent/heartbeat     liveness + version
 *    POST   /api/tally/agent/claim         claim the next queued job
 *    POST   /api/tally/agent/jobs/:jobId/result   report a job result
 */

const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const { requireAgentAuth } = require("../middlewares/tally-agent-auth.middleware");
const { standardApiLimiter } = require("../middlewares/rate-limit.middleware");
const ApiError = require("../utils/api-error");
const connector = require("../services/tally-connector.service");

const router = express.Router();

/* ───────────────────────── App-facing (firm users) ─────────────────────────── */

const appRouter = express.Router();
appRouter.use(requireAuth);
appRouter.use(standardApiLimiter);

const registerAgentSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  tallyCompany: Joi.string().trim().max(255).allow("").optional()
});

const syncSchema = Joi.object({
  documentId: Joi.string().guid({ version: "uuidv4" }).required()
});

const loadReviewedDocument = async (db, { firmId, documentId }) => {
  const result = await db.query(
    `
      SELECT d.id, d.client_id, d.firm_id, d.file_name, d.doc_type, d.uploaded_at, d.status,
             e.structured_data
      FROM documents d
      LEFT JOIN extractions e ON e.document_id = d.id AND e.deleted_at IS NULL
      WHERE d.id = $1 AND d.firm_id = $2 AND d.deleted_at IS NULL
      LIMIT 1
    `,
    [documentId, firmId]
  );
  if (result.rowCount === 0) {
    throw ApiError.notFound("Document not found");
  }
  const document = result.rows[0];
  if (document.status !== "reviewed") {
    throw ApiError.badRequest("Only reviewed documents can be pushed to Tally");
  }
  return document;
};

const insertAuditLog = async (db, { firmId, userId, action, entityType, entityId, metadata }) => {
  await db.query(
    `INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [firmId, userId ?? null, action, entityType, entityId ?? null, JSON.stringify(metadata || {})]
  );
};

// POST /api/tally/agents
appRouter.post(
  "/agents",
  requireAdmin,
  validate(registerAgentSchema),
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const { name, tallyCompany } = req.body;

    const result = await req.withTenantTransaction(async (db) => {
      const registered = await connector.registerAgent(db, { firmId, userId, name, tallyCompany });
      await insertAuditLog(db, {
        firmId,
        userId,
        action: "tally_agent_registered",
        entityType: "tally_agent",
        entityId: registered.agent.id,
        metadata: { name }
      });
      return registered;
    });

    // The plaintext token is returned exactly once — the UI must tell the firm
    // to copy it now; it is stored only as a hash and cannot be shown again.
    res.status(201).json({
      agent: result.agent,
      token: result.token,
      tokenNotice: "Copy this token now. It is shown only once and cannot be retrieved later."
    });
  })
);

// GET /api/tally/agents
appRouter.get(
  "/agents",
  asyncHandler(async (req, res) => {
    const { firmId } = req.user;
    const agents = await req.withTenantTransaction((db) => connector.listAgents(db, { firmId }));
    res.status(200).json({ agents });
  })
);

// DELETE /api/tally/agents/:agentId
appRouter.delete(
  "/agents/:agentId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const { agentId } = req.params;
    if (!/^[0-9a-f-]{36}$/i.test(agentId)) {
      throw ApiError.badRequest("Invalid agent id");
    }
    await req.withTenantTransaction(async (db) => {
      const revoked = await connector.revokeAgent(db, { firmId, agentId });
      await insertAuditLog(db, {
        firmId,
        userId,
        action: "tally_agent_revoked",
        entityType: "tally_agent",
        entityId: revoked.id,
        metadata: {}
      });
    });
    res.status(204).send();
  })
);

// POST /api/tally/sync
appRouter.post(
  "/sync",
  requireAdmin,
  validate(syncSchema),
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const { documentId } = req.body;

    const job = await req.withTenantTransaction(async (db) => {
      const document = await loadReviewedDocument(db, { firmId, documentId });
      const enqueued = await connector.enqueueDocumentSync(db, { firmId, userId, document });
      await insertAuditLog(db, {
        firmId,
        userId,
        action: "tally_sync_queued",
        entityType: "document",
        entityId: documentId,
        metadata: { jobId: enqueued.id, remoteId: enqueued.remote_id }
      });
      return enqueued;
    });

    res.status(202).json({ job });
  })
);

// GET /api/tally/sync/:documentId
appRouter.get(
  "/sync/:documentId",
  asyncHandler(async (req, res) => {
    const { firmId } = req.user;
    const { documentId } = req.params;
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
      throw ApiError.badRequest("Invalid document id");
    }
    const job = await req.withTenantTransaction((db) =>
      connector.getJobStatus(db, { firmId, documentId })
    );
    res.status(200).json({ job: job || null });
  })
);

/* ───────────────────────── Agent-facing (agent token) ──────────────────────── */

const agentRouter = express.Router();
agentRouter.use(requireAgentAuth);

const heartbeatSchema = Joi.object({
  agentVersion: Joi.string().trim().max(50).allow("").optional()
});

const resultSchema = Joi.object({
  ok: Joi.boolean().required(),
  created: Joi.number().integer().min(0).default(0),
  altered: Joi.number().integer().min(0).default(0),
  errors: Joi.number().integer().min(0).default(0),
  lineErrors: Joi.array().items(Joi.string()).default([]),
  retryable: Joi.boolean().default(false),
  error: Joi.string().allow("", null).optional(),
  raw: Joi.string().allow("", null).optional()
});

// POST /api/tally/agent/heartbeat
agentRouter.post(
  "/heartbeat",
  validate(heartbeatSchema),
  asyncHandler(async (req, res) => {
    const { id: agentId, firmId } = req.agent;
    await req.withTenantTransaction((db) =>
      connector.recordHeartbeat(db, { agentId, firmId, agentVersion: req.body.agentVersion })
    );
    res.status(200).json({ ok: true });
  })
);

// POST /api/tally/agent/claim
agentRouter.post(
  "/claim",
  asyncHandler(async (req, res) => {
    const { id: agentId, firmId } = req.agent;
    const job = await req.withTenantTransaction(async (db) => {
      await connector.recordHeartbeat(db, { agentId, firmId });
      return connector.claimNextJob(db, { firmId, agentId });
    });
    // No job: 204 so the agent can long-poll without parsing a body.
    if (!job) {
      return res.status(204).send();
    }
    return res.status(200).json({
      job: {
        id: job.id,
        documentId: job.document_id,
        remoteId: job.remote_id,
        voucherXml: job.voucher_xml,
        attempts: job.attempts
      }
    });
  })
);

// POST /api/tally/agent/jobs/:jobId/result
agentRouter.post(
  "/jobs/:jobId/result",
  validate(resultSchema),
  asyncHandler(async (req, res) => {
    const { id: agentId, firmId } = req.agent;
    const { jobId } = req.params;
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
      throw ApiError.badRequest("Invalid job id");
    }
    const outcome = await req.withTenantTransaction((db) =>
      connector.reportJobResult(db, { firmId, agentId, jobId, report: req.body })
    );
    res.status(200).json(outcome);
  })
);

router.use("/", appRouter);
router.use("/agent", agentRouter);

module.exports = router;
