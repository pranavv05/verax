/**
 * Client-facing portal API.
 *
 * Every route here is guarded by `requireClientAuth` (CLIENT_JWT_SECRET) and
 * scoped to BOTH `req.firmId` and `req.clientId`. RLS narrows to the firm; the
 * explicit `client_id = $` predicate on every query narrows to this one client.
 *
 * Hard rule: extraction contents (`extractions.structured_data`, `raw_text`)
 * and Tally XML are never returned to a client. Only upload metadata, plain-
 * English status, and their own original file.
 */

const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const ApiError = require("../utils/api-error");
const { requireClientAuth } = require("../middlewares/client-auth.middleware");
const { createDownloadUrl } = require("../services/s3.service");
const {
  getReconciliationData,
  writeReconciliationWorkbook
} = require("../services/reconciliation.service");

const router = express.Router();

router.use(requireClientAuth);

// Client-facing labels. Internal statuses (extracted, review_required, ...) are
// firm workflow vocabulary and are never shown to a client.
const CLIENT_STATUS_LABELS = {
  uploaded: "Processing",
  processing: "Processing",
  extracted: "Processing",
  review_required: "Under Review",
  reviewed: "Under Review",
  exported: "Complete"
};

const CLIENT_STATUS_MESSAGES = {
  uploaded: "We've received your document. It's queued to be read.",
  processing: "We're reading the details off your document right now.",
  extracted: "The details have been read and are waiting for your accountant.",
  review_required:
    "Your accountant is checking this document over before it's finalised.",
  reviewed: "Your accountant has checked this document. It's ready to be filed.",
  exported: "All done — this document has been filed into your accounts."
};

// Client-facing filter value -> the internal statuses it covers.
const STATUS_FILTER_GROUPS = {
  processing: ["uploaded", "processing", "extracted"],
  under_review: ["review_required", "reviewed"],
  complete: ["exported"]
};

const SOURCE_LABELS = {
  magic: "Uploaded by you",
  auth: "Uploaded by your accountant"
};

const toClientStatus = (status) => CLIENT_STATUS_LABELS[status] || "Processing";
const toClientStatusMessage = (status) =>
  CLIENT_STATUS_MESSAGES[status] || "We're working on this document.";

const listDocumentsQuerySchema = Joi.object({
  status: Joi.string().valid("processing", "under_review", "complete").optional(),
  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

const documentIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: ["uuidv4", "uuidv5"] }).required()
});

const periodQuerySchema = Joi.object({
  period: Joi.string()
    .pattern(/^(0[1-9]|1[0-2])\d{4}$/)
    .required()
    .messages({ "string.pattern.base": "period must be in MMYYYY format" })
});

const monthLabel = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
};

// GET /api/client-portal/me
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const result = await req.withClientTransaction(async (db) => {
      const clientResult = await db.query(
        `
          SELECT c.id, c.name, c.gstin, c.portal_email, c.portal_last_login_at, f.name AS firm_name
          FROM clients c
          JOIN firms f ON f.id = c.firm_id
          WHERE c.id = $1
            AND c.firm_id = $2
            AND c.deleted_at IS NULL
            AND f.deleted_at IS NULL
          LIMIT 1
        `,
        [req.clientId, req.firmId]
      );

      if (clientResult.rowCount === 0) {
        throw ApiError.notFound("Account not found");
      }

      return clientResult.rows[0];
    });

    res.status(200).json({
      id: result.id,
      name: result.name,
      email: result.portal_email,
      gstin: result.gstin,
      firmName: result.firm_name,
      portalLastLoginAt: result.portal_last_login_at
    });
  })
);

// GET /api/client-portal/stats
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const row = await req.withClientTransaction(async (db) => {
      const result = await db.query(
        `
          SELECT
            COUNT(*)::int AS total_documents,
            COUNT(*) FILTER (WHERE status IN ('uploaded', 'processing', 'extracted'))::int
              AS processing_count,
            COUNT(*) FILTER (WHERE status IN ('review_required', 'reviewed'))::int
              AS review_count,
            COUNT(*) FILTER (WHERE status = 'exported')::int AS completed_count,
            COUNT(*) FILTER (WHERE uploaded_at >= date_trunc('month', NOW()))::int
              AS this_month_documents
          FROM documents
          WHERE firm_id = $1
            AND client_id = $2
            AND deleted_at IS NULL
        `,
        [req.firmId, req.clientId]
      );
      return result.rows[0];
    });

    res.status(200).json({
      totalDocuments: row.total_documents,
      processingCount: row.processing_count,
      reviewCount: row.review_count,
      completedCount: row.completed_count,
      thisMonthDocuments: row.this_month_documents
    });
  })
);

// GET /api/client-portal/documents
router.get(
  "/documents",
  validate(listDocumentsQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { status, fromDate, toDate, page, limit } = req.query;

    const filters = ["d.firm_id = $1", "d.client_id = $2", "d.deleted_at IS NULL"];
    const values = [req.firmId, req.clientId];
    let idx = values.length + 1;

    if (status) {
      filters.push(`d.status = ANY($${idx}::document_status_enum[])`);
      values.push(STATUS_FILTER_GROUPS[status]);
      idx += 1;
    }
    if (fromDate) {
      filters.push(`d.uploaded_at >= $${idx}`);
      values.push(fromDate);
      idx += 1;
    }
    if (toDate) {
      filters.push(`d.uploaded_at <= $${idx}`);
      values.push(toDate);
      idx += 1;
    }

    const whereClause = filters.join(" AND ");
    const offset = (page - 1) * limit;

    const result = await req.withClientTransaction(async (db) => {
      const countResult = await db.query(
        `SELECT COUNT(*)::int AS total FROM documents d WHERE ${whereClause}`,
        values
      );

      const rowsResult = await db.query(
        `
          SELECT
            d.id,
            d.file_name,
            d.doc_type,
            d.status,
            d.uploaded_at,
            d.updated_at,
            e.confidence_score,
            s.source
          FROM documents d
          LEFT JOIN extractions e ON e.document_id = d.id AND e.deleted_at IS NULL
          LEFT JOIN document_upload_sessions s
            ON s.s3_key = d.s3_key AND s.deleted_at IS NULL
          WHERE ${whereClause}
          ORDER BY d.uploaded_at DESC
          LIMIT $${idx} OFFSET $${idx + 1}
        `,
        [...values, limit, offset]
      );

      return { total: countResult.rows[0].total, rows: rowsResult.rows };
    });

    res.status(200).json({
      data: result.rows.map((row) => ({
        id: row.id,
        originalFilename: row.file_name,
        documentType: row.doc_type,
        status: toClientStatus(row.status),
        source: SOURCE_LABELS[row.source] || "Uploaded by your accountant",
        confidenceScore: row.confidence_score,
        createdAt: row.uploaded_at,
        updatedAt: row.updated_at
      })),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / limit)
      }
    });
  })
);

// GET /api/client-portal/documents/:id
router.get(
  "/documents/:id",
  validate(documentIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const row = await req.withClientTransaction(async (db) => {
      const result = await db.query(
        `
          SELECT
            d.id,
            d.file_name,
            d.doc_type,
            d.status,
            d.uploaded_at,
            d.updated_at,
            e.confidence_score,
            s.source
          FROM documents d
          LEFT JOIN extractions e ON e.document_id = d.id AND e.deleted_at IS NULL
          LEFT JOIN document_upload_sessions s
            ON s.s3_key = d.s3_key AND s.deleted_at IS NULL
          WHERE d.id = $1
            AND d.firm_id = $2
            AND d.client_id = $3
            AND d.deleted_at IS NULL
          LIMIT 1
        `,
        [req.params.id, req.firmId, req.clientId]
      );

      if (result.rowCount === 0) {
        throw ApiError.notFound("Document not found");
      }

      return result.rows[0];
    });

    res.status(200).json({
      id: row.id,
      originalFilename: row.file_name,
      documentType: row.doc_type,
      status: toClientStatus(row.status),
      statusMessage: toClientStatusMessage(row.status),
      source: SOURCE_LABELS[row.source] || "Uploaded by your accountant",
      confidenceScore: row.confidence_score,
      createdAt: row.uploaded_at,
      updatedAt: row.updated_at
    });
  })
);

// GET /api/client-portal/documents/:id/download
router.get(
  "/documents/:id/download",
  validate(documentIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const row = await req.withClientTransaction(async (db) => {
      const result = await db.query(
        `
          SELECT id, file_name, s3_key
          FROM documents
          WHERE id = $1
            AND firm_id = $2
            AND client_id = $3
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [req.params.id, req.firmId, req.clientId]
      );

      if (result.rowCount === 0) {
        throw ApiError.notFound("Document not found");
      }

      return result.rows[0];
    });

    const { url, expiresIn } = await createDownloadUrl({ key: row.s3_key });
    res.status(200).json({
      id: row.id,
      originalFilename: row.file_name,
      downloadUrl: url,
      expiresIn
    });
  })
);

// GET /api/client-portal/reconciliation
router.get(
  "/reconciliation",
  validate(periodQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { period } = req.query;

    const response = await req.withClientTransaction(async (db) => {
      const gstinResult = await db.query(
        `
          SELECT gstin
          FROM clients
          WHERE id = $1 AND firm_id = $2 AND deleted_at IS NULL
          LIMIT 1
        `,
        [req.clientId, req.firmId]
      );

      if (gstinResult.rowCount === 0) {
        throw ApiError.notFound("Account not found");
      }

      if (!gstinResult.rows[0].gstin) {
        return {
          period,
          available: false,
          message:
            "Your GST number isn't on file yet, so we can't compare your invoices against the GST portal. Please contact your CA firm.",
          summary: {
            totalDocuments: 0,
            matched: 0,
            notFound: 0,
            mismatched: 0,
            totalITC: 0
          }
        };
      }

      const reconciliation = await getReconciliationData(db, {
        firmId: req.firmId,
        userId: null,
        clientId: req.clientId,
        period,
        auditAction: "client_portal_reconciliation_viewed"
      });

      return {
        period,
        available: true,
        summary: {
          totalDocuments: reconciliation.summary.total,
          matched: reconciliation.summary.matched,
          notFound: reconciliation.summary.notFound,
          // "partial" is a near-match; from the client's point of view it is
          // still something that does not line up.
          mismatched: reconciliation.summary.mismatched + reconciliation.summary.partial,
          totalITC: reconciliation.summary.totalGstAmount
        }
      };
    });

    res.status(200).json(response);
  })
);

// GET /api/client-portal/reconciliation/export
router.get(
  "/reconciliation/export",
  validate(periodQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const reconciliation = await req.withClientTransaction((db) =>
      getReconciliationData(db, {
        firmId: req.firmId,
        userId: null,
        clientId: req.clientId,
        period: req.query.period,
        auditAction: "client_portal_reconciliation_exported"
      })
    );

    await writeReconciliationWorkbook(res, reconciliation);
  })
);

// GET /api/client-portal/exports
router.get(
  "/exports",
  asyncHandler(async (req, res) => {
    const rows = await req.withClientTransaction(async (db) => {
      const result = await db.query(
        `
          SELECT
            id,
            document_count,
            document_ids,
            from_date,
            to_date,
            exported_at,
            created_at
          FROM tally_exports
          WHERE firm_id = $1
            AND client_id = $2
            AND deleted_at IS NULL
          ORDER BY exported_at DESC NULLS LAST, created_at DESC
          LIMIT 50
        `,
        [req.firmId, req.clientId]
      );
      return result.rows;
    });

    res.status(200).json({
      data: rows.map((row) => {
        const from = monthLabel(row.from_date);
        const to = monthLabel(row.to_date);
        let period = monthLabel(row.exported_at || row.created_at);
        if (from && to) {
          period = from === to ? from : `${from} - ${to}`;
        }

        return {
          id: row.id,
          exportedAt: row.exported_at || row.created_at,
          documentCount:
            row.document_count ?? (Array.isArray(row.document_ids) ? row.document_ids.length : 0),
          period
        };
      })
    });
  })
);

module.exports = router;
