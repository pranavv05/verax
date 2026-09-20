const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const { standardApiLimiter } = require("../middlewares/rate-limit.middleware");
const {
  getExtraction,
  updateExtraction,
  approveExtraction,
  reprocessDocument
} = require("../services/extractions.service");
const nameMappingService = require("../services/name-mapping.service");
const complianceService = require("../services/compliance.service");

const router = express.Router();
router.use(requireAuth);
router.use(standardApiLimiter);

const lineItemSchema = Joi.object({
  description: Joi.string().allow("", null).optional(),
  quantity: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  unit_price: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  total: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  tally_item_name: Joi.string().allow("", null).optional(),
  hsn_code: Joi.string().allow("", null).optional(),
  uom: Joi.string().allow("", null).optional(),
  cgst: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  sgst: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  igst: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional()
});

const updateSchema = Joi.object({
  vendor_name: Joi.string().allow("", null).optional(),
  vendor_gstin: Joi.string().allow("", null).optional(),
  invoice_number: Joi.string().allow("", null).optional(),
  invoice_date: Joi.string().allow("", null).optional(),
  subtotal: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  taxable_amount: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  cgst: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  sgst: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  igst: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  tax_amount: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  total_amount: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  payment_terms: Joi.string().allow("", null).optional(),
  tds_section: Joi.string().allow("", null).optional(),
  tds_amount: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  tds_rate: Joi.alternatives().try(Joi.number(), Joi.string().allow("", null)).optional(),
  line_items: Joi.array().items(lineItemSchema).optional()
}).unknown(true);

// GET /api/extractions/:documentId
router.get(
  "/:documentId",
  asyncHandler(async (req, res) => {
    const { firmId } = req.user;
    const { documentId } = req.params;

    const extraction = await req.withTenantTransaction((db) =>
      getExtraction(db, { firmId, documentId })
    );

    if (!extraction) {
      return res.status(200).json({
        extraction: null,
        line_items: [],
        validation: {},
        message: "Document has not been processed yet"
      });
    }

    // Enrich line items with name mapping suggestions
    const lineItems = Array.isArray(extraction.structuredData.line_items)
      ? extraction.structuredData.line_items
      : [];

    const enrichedLineItems = await req.withTenantTransaction(async (db) => {
      const firmMappings = await nameMappingService.getFirmMappings(db, { firmId });
      return lineItems.map((item) => {
        const description = item.description || "";
        const exactMatch = nameMappingService.lookupInMemory(firmMappings, description);
        const suggestions = nameMappingService.fuzzyMatch(firmMappings, description);
        return {
          ...item,
          tally_item_name: item.tally_item_name || exactMatch || description,
          suggestions: suggestions.map((s) => s.tallyName)
        };
      });
    });

    // Run compliance validation
    const validation = await req.withTenantTransaction((db) =>
      complianceService.runAll(db, { firmId, extraction: extraction.structuredData, documentId })
    );

    return res.status(200).json({
      id: extraction.id,
      documentId: extraction.documentId,
      structured_data: extraction.structuredData,
      raw_text: extraction.rawText,
      confidence_score: extraction.confidenceScore,
      reviewed_by: extraction.reviewedBy,
      reviewed_at: extraction.reviewedAt,
      document_status: extraction.documentStatus,
      doc_type: extraction.docType,
      file_name: extraction.fileName,
      processing_error: extraction.processingError,
      line_items: enrichedLineItems,
      validation
    });
  })
);

// PUT /api/extractions/:documentId
router.put(
  "/:documentId",
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const { documentId } = req.params;

    await req.withTenantTransaction((db) =>
      updateExtraction(db, {
        firmId,
        documentId,
        structuredData: req.body,
        userId
      })
    );

    res.status(200).json({ success: true });
  })
);

// POST /api/extractions/:documentId/approve
router.post(
  "/:documentId/approve",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const { documentId } = req.params;

    const result = await req.withTenantTransaction((db) =>
      approveExtraction(db, {
        firmId,
        documentId,
        userId,
        nameMappingService
      })
    );

    res.status(200).json(result);
  })
);

// POST /api/extractions/:documentId/reprocess
router.post(
  "/:documentId/reprocess",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const { documentId } = req.params;

    const result = await req.withTenantTransaction((db) =>
      reprocessDocument(db, { firmId, documentId, userId })
    );

    res.status(200).json(result);
  })
);

module.exports = router;
