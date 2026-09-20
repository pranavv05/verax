const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const { standardApiLimiter } = require("../middlewares/rate-limit.middleware");
const ApiError = require("../utils/api-error");
const gspService = require("../services/gsp.service");
const {
  buildInvoiceFromExtraction,
  getReconciliationData,
  writeReconciliationWorkbook
} = require("../services/reconciliation.service");

const router = express.Router();
router.use(requireAuth);
router.use(standardApiLimiter);

const gstinVerifySchema = Joi.object({
  gstin: Joi.string().trim().uppercase().length(15).required()
});

const gstr2bMatchSchema = Joi.object({
  gstin: Joi.string().trim().uppercase().length(15).required(),
  period: Joi.string()
    .pattern(/^(0[1-9]|1[0-2])\d{4}$/)
    .required()
    .messages({ "string.pattern.base": "period must be in MMYYYY format" }),
  documentIds: Joi.array().items(Joi.string().guid({ version: "uuidv4" })).min(1).max(50).required()
});

const reconciliationQuerySchema = Joi.object({
  clientId: Joi.string().guid({ version: "uuidv4" }).required(),
  period: Joi.string()
    .pattern(/^(0[1-9]|1[0-2])\d{4}$/)
    .required()
    .messages({ "string.pattern.base": "period must be in MMYYYY format" })
});

const insertAuditLog = async (db, { firmId, userId, action, entityType, entityId, metadata }) => {
  await db.query(
    `
      INSERT INTO audit_logs (
        firm_id,
        user_id,
        action,
        entity_type,
        entity_id,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [firmId, userId ?? null, action, entityType, entityId ?? null, JSON.stringify(metadata || {})]
  );
};

const getDocumentsForMatch = async (db, { firmId, documentIds }) => {
  const result = await db.query(
    `
      SELECT
        d.id,
        e.structured_data
      FROM documents d
      JOIN extractions e
        ON e.document_id = d.id
       AND e.deleted_at IS NULL
      WHERE d.firm_id = $1
        AND d.id = ANY($2::uuid[])
        AND d.status IN ('extracted', 'reviewed')
        AND d.deleted_at IS NULL
      ORDER BY array_position($2::uuid[], d.id)
    `,
    [firmId, documentIds]
  );

  if (result.rowCount !== documentIds.length) {
    throw ApiError.badRequest("One or more documents are not available for GSTR-2B matching");
  }

  return result.rows.map((row) => ({
    documentId: row.id,
    structuredData: row.structured_data || {}
  }));
};

// POST /api/compliance/gstin/verify
router.post(
  "/gstin/verify",
  validate(gstinVerifySchema),
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const { gstin } = req.body;

    const result = await gspService.verifyGSTIN(gstin);

    await req.withTenantTransaction((db) =>
      insertAuditLog(db, {
        firmId,
        userId,
        action: "gstin_verified",
        entityType: "compliance",
        entityId: null,
        metadata: {
          gstin,
          valid: result.valid,
          source: result.source,
          registrationStatus: result.registrationStatus
        }
      })
    );

    res.status(200).json({
      valid: result.valid,
      legalName: result.legalName,
      tradeName: result.tradeName,
      registrationStatus: result.registrationStatus,
      stateCode: result.stateCode,
      source: result.source,
      message: result.message
    });
  })
);

// GET /api/compliance/gstr2b/reconciliation
router.get(
  "/gstr2b/reconciliation",
  validate(reconciliationQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const result = await req.withTenantTransaction((db) =>
      getReconciliationData(db, {
        firmId,
        userId,
        clientId: req.query.clientId,
        period: req.query.period,
        auditAction: "gstr2b_reconciliation_viewed"
      })
    );

    res.status(200).json(result);
  })
);

// GET /api/compliance/gstr2b/reconciliation/export
router.get(
  "/gstr2b/reconciliation/export",
  requireAdmin,
  validate(reconciliationQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const reconciliation = await req.withTenantTransaction((db) =>
      getReconciliationData(db, {
        firmId,
        userId,
        clientId: req.query.clientId,
        period: req.query.period,
        auditAction: "gstr2b_reconciliation_exported"
      })
    );

    await writeReconciliationWorkbook(res, reconciliation);
  })
);

// POST /api/compliance/gstr2b/match
router.post(
  "/gstr2b/match",
  requireAdmin,
  validate(gstr2bMatchSchema),
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const { gstin, period, documentIds } = req.body;

    const response = await req.withTenantTransaction(async (db) => {
      const documents = await getDocumentsForMatch(db, { firmId, documentIds });
      const invoices = documents.map((document) =>
        buildInvoiceFromExtraction(document.documentId, document.structuredData)
      );

      const matches = await gspService.matchGSTR2B(gstin, period, invoices);
      const results = matches.map((match, index) => ({
        documentId: invoices[index].documentId,
        invoiceNumber: match.invoiceNumber,
        matchStatus: match.matchStatus,
        mismatchFields: match.mismatchFields || [],
        gstr2bRecord: match.gstr2bRecord || null
      }));

      for (const result of results) {
        await db.query(
          `
            UPDATE documents
            SET gstr2b_match_status = $3,
                gstr2b_match_details = $4::jsonb,
                updated_at = NOW()
            WHERE id = $1
              AND firm_id = $2
              AND deleted_at IS NULL
          `,
          [
            result.documentId,
            firmId,
            result.matchStatus,
            JSON.stringify({
              period,
              gstin,
              invoiceNumber: result.invoiceNumber,
              mismatchFields: result.mismatchFields,
              gstr2bRecord: result.gstr2bRecord,
              checkedAt: new Date().toISOString()
            })
          ]
        );
      }

      await insertAuditLog(db, {
        firmId,
        userId,
        action: "gstr2b_matched",
        entityType: "compliance",
        entityId: null,
        metadata: {
          gstin,
          period,
          documentCount: documentIds.length,
          statuses: results.map((result) => result.matchStatus)
        }
      });

      return { period, gstin, results };
    });

    res.status(200).json(response);
  })
);

module.exports = router;
