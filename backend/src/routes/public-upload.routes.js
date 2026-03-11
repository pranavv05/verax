const express = require("express");
const Joi = require("joi");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const {
  initiateUploadWithMagicToken,
  confirmUploadWithMagicToken,
  markDocumentQueued,
  markDocumentQueueFailure
} = require("../services/documents.service");
const { enqueueDocumentProcessingJob } = require("../services/document-queue.service");
const { withTenantTransaction } = require("../db/tenant-context");

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

const tokenParamSchema = Joi.object({
  token: Joi.string().pattern(/^[a-zA-Z0-9]{32,128}$/).required()
});

const publicUploadSchema = Joi.object({
  file_name: Joi.string().trim().max(255).required(),
  file_type: Joi.string().trim().max(150).required(),
  file_size: Joi.number().integer().positive().required(),
  doc_type: Joi.string().valid("invoice", "bank_statement", "bill", "other").default("other")
});

const confirmSchema = Joi.object({
  document_id: Joi.string().uuid({ version: ["uuidv4", "uuidv5"] }).required()
});

router.post(
  "/:token/documents/upload",
  uploadRateLimiter,
  validate(tokenParamSchema, "params"),
  validate(publicUploadSchema),
  asyncHandler(async (req, res) => {
    const result = await initiateUploadWithMagicToken({
      token: req.params.token,
      fileName: req.body.file_name,
      fileType: req.body.file_type,
      fileSize: req.body.file_size,
      docType: req.body.doc_type
    });

    res.status(200).json(result);
  })
);

router.post(
  "/:token/documents/confirm",
  uploadRateLimiter,
  validate(tokenParamSchema, "params"),
  validate(confirmSchema),
  asyncHandler(async (req, res) => {
    const confirmation = await confirmUploadWithMagicToken({
      token: req.params.token,
      documentId: req.body.document_id
    });

    let queue = {
      queued: false
    };

    try {
      const jobId = await enqueueDocumentProcessingJob(confirmation.queuePayload);
      await withTenantTransaction({ firmId: confirmation.document.firmId }, (db) =>
        markDocumentQueued(db, {
          firmId: confirmation.document.firmId,
          documentId: req.body.document_id
        })
      );
      queue = {
        queued: true,
        job_id: jobId
      };
    } catch (error) {
      await withTenantTransaction({ firmId: confirmation.document.firmId }, (db) =>
        markDocumentQueueFailure(db, {
          firmId: confirmation.document.firmId,
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
      already_confirmed: confirmation.alreadyConfirmed,
      token_rotation: confirmation.tokenRotation
    });
  })
);

module.exports = router;
