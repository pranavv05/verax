const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const {
  initiateUploadWithMagicToken,
  confirmUploadWithMagicToken,
  markDocumentQueued,
  markDocumentQueueFailure
} = require("../services/documents.service");
const { enqueueDocumentProcessingJob } = require("../services/document-queue.service");
const { withTenantTransaction, setLocalConfig } = require("../db/tenant-context");
const { createNotification } = require("../services/notifications.service");
const ApiError = require("../utils/api-error");
const { buildPublicUploadLimiters } = require("../middlewares/rate-limit.middleware");

const router = express.Router();

// Separate budgets for initiate and confirm (one file = one of each).
const uploadLimiters = buildPublicUploadLimiters();

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

const getClientUploadNotificationContext = async (db, { firmId, documentId }) => {
  const documentResult = await db.query(
    `
      SELECT d.id, d.file_name, c.id AS client_id, c.name AS client_name
      FROM documents d
      JOIN clients c ON c.id = d.client_id
      WHERE d.id = $1
        AND d.firm_id = $2
        AND d.deleted_at IS NULL
        AND c.deleted_at IS NULL
      LIMIT 1
    `,
    [documentId, firmId]
  );

  if (documentResult.rowCount === 0) {
    return null;
  }

  const adminsResult = await db.query(
    `
      SELECT id
      FROM users
      WHERE firm_id = $1
        AND role = 'admin'
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `,
    [firmId]
  );

  return {
    document: documentResult.rows[0],
    admins: adminsResult.rows
  };
};

const mapClientStatus = (status) =>
  ({
    uploaded: "Received",
    processing: "Processing",
    extracted: "Processing",
    review_required: "Under Review",
    reviewed: "Under Review",
    exported: "Complete"
  }[status] || "Received");

const getUploadStatusByToken = async (db, { token }) => {
  // Client first, then the firm: under the magic_link auth context the firms
  // RLS policy only shows the firm once app.current_firm_id is set, so
  // joining firms here returned no row and every status page 404'd.
  const clientResult = await db.query(
    `
      SELECT c.id, c.firm_id, c.name AS client_name
      FROM clients c
      WHERE c.upload_token = $1
        AND c.deleted_at IS NULL
      LIMIT 1
    `,
    [token]
  );

  if (clientResult.rowCount === 0) {
    throw ApiError.notFound("Upload link not found");
  }

  await setLocalConfig(db, "app.current_firm_id", clientResult.rows[0].firm_id);
  const firmResult = await db.query("SELECT name FROM firms WHERE id = $1 AND deleted_at IS NULL", [
    clientResult.rows[0].firm_id
  ]);
  if (firmResult.rowCount === 0) {
    throw ApiError.notFound("Upload link not found");
  }

  const client = { ...clientResult.rows[0], firm_name: firmResult.rows[0].name };

  const documentsResult = await db.query(
    `
      SELECT id, file_name, doc_type, status, created_at, updated_at
      FROM documents
      WHERE firm_id = $1
        AND client_id = $2
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [client.firm_id, client.id]
  );

  return {
    firmName: client.firm_name,
    clientName: client.client_name,
    documents: documentsResult.rows.map((document) => ({
      id: document.id,
      fileName: document.file_name,
      documentType: document.doc_type,
      status: mapClientStatus(document.status),
      uploadedAt: document.created_at,
      updatedAt: document.updated_at
    }))
  };
};

router.get(
  "/:token/status",
  validate(tokenParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const status = await withTenantTransaction(
      {
        authContext: "magic_link",
        uploadToken: req.params.token
      },
      (db) => getUploadStatusByToken(db, { token: req.params.token })
    );

    res.status(200).json(status);
  })
);

router.post(
  "/:token/documents/upload",
  uploadLimiters.initiate,
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
  uploadLimiters.confirm,
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

    if (!confirmation.alreadyConfirmed) {
      try {
        const context = await withTenantTransaction({ firmId: confirmation.document.firmId }, (db) =>
          getClientUploadNotificationContext(db, {
            firmId: confirmation.document.firmId,
            documentId: req.body.document_id
          })
        );

        if (context) {
          for (const admin of context.admins) {
            try {
              await createNotification({
                firmId: confirmation.document.firmId,
                userId: admin.id,
                type: "client_upload",
                title: "Client uploaded a document",
                message: `${context.document.client_name} uploaded ${context.document.file_name}.`,
                entityType: "document",
                entityId: req.body.document_id
              });
            } catch (notificationError) {
              process.stderr.write(
                `Notification failed for public upload ${req.body.document_id}: ${String(notificationError.message || notificationError)}\n`
              );
            }
          }
        }
      } catch (notificationContextError) {
        process.stderr.write(
          `Notification context failed for public upload ${req.body.document_id}: ${String(notificationContextError.message || notificationContextError)}\n`
        );
      }
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
