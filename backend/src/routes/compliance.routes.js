const express = require("express");
const multer = require("multer");
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
const { parseGstr2bFile, MAX_FILE_SIZE_BYTES } = require("../services/gstr2b-parser.service");
const {
  storeSnapshot,
  getLatestSnapshot
} = require("../services/gstr2b-source.service");
const { verifyGstinCached } = require("../services/gstin-verification.service");

const router = express.Router();
router.use(requireAuth);
router.use(standardApiLimiter);

// GSTR-2B files (portal JSON can be several MB) use memory storage so the
// parser works on the buffer directly, exactly like the client-import upload.
const gstr2bUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES }
});

const handleGstr2bUpload = (req, res, next) => {
  gstr2bUpload.single("file")(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(
        ApiError.badRequest(
          `File exceeds ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB limit`
        )
      );
    }
    if (error) {
      return next(error);
    }
    return next();
  });
};

const gstr2bUploadSchema = Joi.object({
  clientId: Joi.string().guid({ version: "uuidv4" }).required(),
  period: Joi.string()
    .pattern(/^(0[1-9]|1[0-2])\d{4}$/)
    .required()
    .messages({ "string.pattern.base": "period must be in MMYYYY format" })
});

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
    const forceRefresh = req.query.refresh === "true";

    const result = await req.withTenantTransaction(async (db) => {
      const verification = await verifyGstinCached(db, gstin, { forceRefresh });

      await insertAuditLog(db, {
        firmId,
        userId,
        action: "gstin_verified",
        entityType: "compliance",
        entityId: null,
        metadata: {
          gstin,
          valid: verification.valid,
          source: verification.source,
          cached: verification.cached,
          registrationStatus: verification.registrationStatus
        }
      });

      return verification;
    });

    res.status(200).json({
      valid: result.valid,
      legalName: result.legalName,
      tradeName: result.tradeName,
      registrationStatus: result.registrationStatus,
      stateCode: result.stateCode,
      source: result.source,
      cached: Boolean(result.cached),
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

// POST /api/compliance/gstr2b/upload
// Upload a client's GSTR-2B (portal JSON or Excel) for a period. Parses the
// file and stores a snapshot that reconciliation then matches against — the
// zero-GSP path that makes reconciliation work today.
router.post(
  "/gstr2b/upload",
  requireAdmin,
  handleGstr2bUpload,
  validate(gstr2bUploadSchema),
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const { clientId, period } = req.body;

    if (!req.file || !req.file.buffer) {
      throw ApiError.badRequest("No file uploaded. Attach a GSTR-2B JSON or Excel file.");
    }

    const { records, summary } = await parseGstr2bFile({
      buffer: req.file.buffer,
      filename: req.file.originalname
    });

    const response = await req.withTenantTransaction(async (db) => {
      // Confirm the client belongs to this firm before storing anything.
      // RLS already scopes writes, but this returns a clean 404 rather than a
      // policy error, and matches how clients.service guards client access.
      const clientResult = await db.query(
        `SELECT id, name FROM clients WHERE id = $1 AND firm_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [clientId, firmId]
      );
      if (clientResult.rowCount === 0) {
        throw ApiError.notFound("Client not found");
      }

      const stored = await storeSnapshot(db, {
        firmId,
        clientId,
        period,
        source: "offline_upload",
        sourceFilename: req.file.originalname,
        records,
        summary,
        uploadedBy: userId
      });

      await insertAuditLog(db, {
        firmId,
        userId,
        action: "gstr2b_snapshot_uploaded",
        entityType: "client",
        entityId: clientId,
        metadata: {
          period,
          source: "offline_upload",
          filename: req.file.originalname,
          recordCount: summary.recordCount
        }
      });

      return {
        snapshotId: stored.id,
        clientId,
        clientName: clientResult.rows[0].name,
        period,
        recordCount: summary.recordCount,
        totalTaxable: summary.totalTaxable,
        totalGst: summary.totalGst,
        uploadedAt: stored.created_at
      };
    });

    res.status(201).json(response);
  })
);

// GET /api/compliance/gstr2b/snapshot
// Report whether a GSTR-2B snapshot exists for a client+period (so the UI can
// prompt an upload before showing an empty reconciliation).
router.get(
  "/gstr2b/snapshot",
  validate(reconciliationQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { firmId } = req.user;
    const snapshot = await req.withTenantTransaction((db) =>
      getLatestSnapshot(db, {
        firmId,
        clientId: req.query.clientId,
        period: req.query.period
      })
    );

    if (!snapshot) {
      return res.status(200).json({ exists: false });
    }

    return res.status(200).json({
      exists: true,
      source: snapshot.source,
      sourceFilename: snapshot.sourceFilename,
      recordCount: snapshot.recordCount,
      totalTaxable: snapshot.totalTaxable,
      totalGst: snapshot.totalGst,
      uploadedAt: snapshot.createdAt
    });
  })
);

module.exports = router;
