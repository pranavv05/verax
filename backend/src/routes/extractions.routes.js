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

// Largest figure we accept in one field: far above any real invoice, far below
// what would overflow downstream arithmetic or the Tally XML.
const MAX_AMOUNT = 1e13;

// An amount arrives as a number, a blank, or text such as "1,18,000.50" or "₹ 500".
const amountField = Joi.alternatives()
  .try(
    Joi.number().min(-MAX_AMOUNT).max(MAX_AMOUNT),
    Joi.string()
      .allow("", null)
      .custom((value, helpers) => {
        const cleaned = value.replace(/[₹,\s]|rs\.?|inr/gi, "");
        if (cleaned === "") return value;
        const parsed = Number(cleaned);
        if (!Number.isFinite(parsed) || Math.abs(parsed) > MAX_AMOUNT) return helpers.error("any.invalid");
        return value;
      })
  )
  .messages({ "alternatives.match": "must be a valid amount", "any.invalid": "must be a valid amount" });

// Real calendar date as YYYY-MM-DD or DD-MM-YYYY / DD/MM/YYYY, years 1990-2100.
const dateField = Joi.string()
  .trim()
  .allow("", null)
  .custom((value, helpers) => {
    if (value === "") return value;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(value);
    const [year, month, day] = iso ? [iso[1], iso[2], iso[3]].map(Number) : dmy ? [dmy[3], dmy[2], dmy[1]].map(Number) : [];
    if (!year || year < 1990 || year > 2100) return helpers.error("any.invalid");
    const date = new Date(Date.UTC(year, month - 1, day));
    const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    return real ? value : helpers.error("any.invalid");
  })
  .messages({ "any.invalid": "must be a real date (YYYY-MM-DD)" });

const shortText = Joi.string().max(255).allow("", null);

const lineItemSchema = Joi.object({
  description: Joi.string().max(1000).allow("", null).optional(),
  quantity: amountField.optional(),
  unit_price: amountField.optional(),
  total: amountField.optional(),
  tally_item_name: shortText.optional(),
  hsn_code: Joi.string().max(20).allow("", null).optional(),
  uom: Joi.string().max(30).allow("", null).optional(),
  cgst: amountField.optional(),
  sgst: amountField.optional(),
  igst: amountField.optional()
});

const updateSchema = Joi.object({
  vendor_name: Joi.string().max(500).allow("", null).optional(),
  vendor_gstin: Joi.string().max(20).allow("", null).optional(),
  invoice_number: Joi.string().max(100).allow("", null).optional(),
  invoice_date: dateField.optional(),
  subtotal: amountField.optional(),
  taxable_amount: amountField.optional(),
  cgst: amountField.optional(),
  sgst: amountField.optional(),
  igst: amountField.optional(),
  tax_amount: amountField.optional(),
  total_amount: amountField.optional(),
  payment_terms: Joi.string().max(500).allow("", null).optional(),
  tds_section: Joi.string().max(30).allow("", null).optional(),
  tds_amount: amountField.optional(),
  tds_rate: amountField.optional(),
  line_items: Joi.array().items(lineItemSchema).max(500).optional()
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
