const express = require("express");
const Joi = require("joi");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth } = require("../middlewares/auth.middleware");
const {
  initiateUploadForFirm,
  confirmUploadForFirm,
  markDocumentQueued,
  markDocumentQueueFailure
} = require("../services/documents.service");
const { enqueueDocumentProcessingJob } = require("../services/document-queue.service");

const router = express.Router();

const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "Upload limit reached. Please try again later.",
    statusCode: 429
  }
});

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

router.use(requireAuth);

router.post(
  "/upload",
  uploadRateLimiter,
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
  uploadRateLimiter,
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
