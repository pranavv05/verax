const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const { buildRateLimiter, PUBLIC_UPLOAD_MAX_PER_HOUR } = require("../middlewares/rate-limit.middleware");
const {
  initiateUploadForFirm,
  confirmUploadForFirm,
  markDocumentQueued,
  markDocumentQueueFailure,
  listDocuments,
  getDocumentById,
  deleteDocument
} = require("../services/documents.service");
const { enqueueDocumentProcessingJob } = require("../services/document-queue.service");
const {
  getVersionsForDocument,
  getVersionDetail
} = require("../services/document-versions.service");

const router = express.Router();

// Staff uploads: per user (not per office IP), with separate budgets for
// initiate and confirm, which used to share one 50-per-hour bucket.
const staffUploadLimiter = () =>
  buildRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: PUBLIC_UPLOAD_MAX_PER_HOUR,
    message: "Upload limit reached. Please try again later."
  });
const initiateUploadLimiter = staffUploadLimiter();
const confirmUploadLimiter = staffUploadLimiter();

const uploadRequestSchema = Joi.object({
  client_id: Joi.string().uuid({ version: ["uuidv4", "uuidv5"] }).required(),
  file_name: Joi.string().trim().max(255).required(),
  file_type: Joi.string().trim().max(150).required(),
  file_size: Joi.number().integer().positive().required(),
  doc_type: Joi.string().valid("invoice", "bank_statement", "bill", "other").default("other")
});

const confirmSchema = Joi.object({
  document_id: Joi.string().uuid({ version: ["uuidv4", "uuidv5"] }).required()
});

const documentIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: ["uuidv4", "uuidv5"] }).required()
});

const versionParamSchema = Joi.object({
  id: Joi.string().uuid({ version: ["uuidv4", "uuidv5"] }).required(),
  versionId: Joi.string().uuid({ version: ["uuidv4", "uuidv5"] }).required()
});

const listQuerySchema = Joi.object({
  client_id: Joi.string().uuid({ version: ["uuidv4", "uuidv5"] }).optional(),
  status: Joi.string()
    .valid("uploaded", "processing", "extracted", "review_required", "reviewed", "exported")
    .optional(),
  doc_type: Joi.string().valid("invoice", "bank_statement", "bill", "other").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50)
});

router.use(requireAuth);

router.get(
  "/",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      listDocuments(db, {
        firmId: req.user.firmId,
        clientId: req.query.client_id,
        status: req.query.status,
        docType: req.query.doc_type,
        page: req.query.page,
        limit: req.query.limit
      })
    );
    res.status(200).json(result);
  })
);

router.get(
  "/:id",
  validate(documentIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      getDocumentById(db, {
        firmId: req.user.firmId,
        documentId: req.params.id
      })
    );
    res.status(200).json(result);
  })
);

router.get(
  "/:id/versions",
  validate(documentIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const versions = await getVersionsForDocument({
      firmId: req.user.firmId,
      documentId: req.params.id
    });

    res.status(200).json({ versions });
  })
);

router.get(
  "/:id/versions/:versionId",
  validate(versionParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const version = await getVersionDetail({
      firmId: req.user.firmId,
      documentId: req.params.id,
      versionId: req.params.versionId
    });

    res.status(200).json(version);
  })
);

router.delete(
  "/:id",
  requireAdmin,
  validate(documentIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    await req.withTenantTransaction((db) =>
      deleteDocument(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        documentId: req.params.id
      })
    );
    res.status(204).send();
  })
);

router.post(
  "/upload",
  initiateUploadLimiter,
  validate(uploadRequestSchema),
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      initiateUploadForFirm(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        clientId: req.body.client_id,
        fileName: req.body.file_name,
        fileType: req.body.file_type,
        fileSize: req.body.file_size,
        docType: req.body.doc_type
      })
    );

    res.status(200).json(result);
  })
);

router.post(
  "/confirm",
  confirmUploadLimiter,
  validate(confirmSchema),
  asyncHandler(async (req, res) => {
    const confirmation = await req.withTenantTransaction((db) =>
      confirmUploadForFirm(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        documentId: req.body.document_id
      })
    );

    let queue = {
      queued: false
    };

    try {
      const jobId = await enqueueDocumentProcessingJob(confirmation.queuePayload);
      await req.withTenantTransaction((db) =>
        markDocumentQueued(db, {
          firmId: req.user.firmId,
          documentId: req.body.document_id
        })
      );
      queue = {
        queued: true,
        job_id: jobId
      };
    } catch (error) {
      await req.withTenantTransaction((db) =>
        markDocumentQueueFailure(db, {
          firmId: req.user.firmId,
          documentId: req.body.document_id,
          errorMessage: error.message
        })
      );
      queue = {
        queued: false,
        error: error.message
      };
    }

    res.status(200).json({
      ...confirmation.document,
      queue,
      already_confirmed: confirmation.alreadyConfirmed
    });
  })
);

module.exports = router;
