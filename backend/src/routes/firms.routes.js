const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const bcrypt = require("bcryptjs");
const env = require("../config/env");
const ApiError = require("../utils/api-error");
const { withTenantTransaction } = require("../db/tenant-context");
const { getRefreshCookieOptions } = require("../services/auth.service");
const { standardApiLimiter } = require("../middlewares/rate-limit.middleware");
const { getFirmSettings, updateFirmSettings, getCurrentUser } = require("../services/firms.service");
const firmData = require("../services/firm-data.service");

const router = express.Router();

const updateFirmSettingsSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required()
});

router.get(
  "/settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const firm = await req.withTenantTransaction((db) =>
      getFirmSettings(db, { firmId: req.user.firmId })
    );
    res.status(200).json({ firm });
  })
);

router.put(
  "/settings",
  requireAuth,
  requireAdmin,
  validate(updateFirmSettingsSchema),
  asyncHandler(async (req, res) => {
    const firm = await req.withTenantTransaction((db) =>
      updateFirmSettings(db, {
        firmId: req.user.firmId,
        userId: req.user.userId,
        name: req.body.name
      })
    );
    res.status(200).json({ firm });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await req.withTenantTransaction((db) =>
      getCurrentUser(db, {
        firmId: req.user.firmId,
        userId: req.user.userId
      })
    );
    res.status(200).json({ user });
  })
);

// ── Data export & account deletion (DPDP) ────────────────────────────────────

const auditFirm = (db, { firmId, userId, action, metadata }) =>
  db.query(
    `INSERT INTO audit_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, 'firm', $1, $4::jsonb)`,
    [firmId, userId ?? null, action, JSON.stringify(metadata || {})]
  );

// POST /api/firms/export-link — a 10-minute signed link the browser can
// download directly (a streamed ZIP can be gigabytes; fetch-to-blob can't).
router.post(
  "/export-link",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    await req.withTenantTransaction((db) =>
      auditFirm(db, { firmId, userId, action: "firm_data_export_requested" })
    );
    const token = firmData.createExportToken({ firmId, userId });
    res.status(200).json({ path: `/api/firms/export?token=${encodeURIComponent(token)}` });
  })
);

// GET /api/firms/export?token= — streams the ZIP. Authorised by the signed
// link, not the session, so the browser can save it straight to disk.
router.get(
  "/export",
  standardApiLimiter,
  asyncHandler(async (req, res) => {
    const { firmId, userId } = firmData.verifyExportToken(req.query.token);
    const data = await withTenantTransaction({ firmId }, (db) => firmData.collectFirmData(db, { firmId }));

    const day = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="verax-export-${firmData.safeName(data.firmName, "firm").replace(/\s+/g, "-")}-${day}.zip"`
    );
    res.setHeader("Cache-Control", "no-store");

    let summary;
    try {
      summary = await firmData.writeFirmExport(data, res);
    } catch (error) {
      // Headers are already sent; cut the connection so the browser shows a
      // failed download rather than saving a truncated ZIP as if complete.
      process.stderr.write(`[firm-export] failed for firm ${firmId}: ${error.message}\n`);
      res.destroy(error);
      return;
    }
    await withTenantTransaction({ firmId }, (db) =>
      auditFirm(db, { firmId, userId, action: "firm_data_exported", metadata: summary })
    ).catch(() => {});
  })
);

const deleteFirmSchema = Joi.object({
  confirmFirmName: Joi.string().trim().required(),
  password: Joi.string().required()
});

// POST /api/firms/delete — permanently erase the firm and everything in it.
router.post(
  "/delete",
  requireAuth,
  requireAdmin,
  validate(deleteFirmSchema),
  asyncHandler(async (req, res) => {
    const { firmId, userId } = req.user;
    const { storageKeys, counts } = await req.withTenantTransaction(async (db) => {
      const result = await db.query(
        `SELECT u.password_hash, f.name AS firm_name
         FROM users u, firms f
         WHERE u.id = $1 AND u.firm_id = $2 AND f.id = $2 AND u.deleted_at IS NULL`,
        [userId, firmId]
      );
      if (result.rowCount === 0) throw ApiError.notFound("Firm not found");
      const { password_hash: hash, firm_name: firmName } = result.rows[0];
      // 403, not 401: a wrong password here must not look like an expired
      // session and log the admin out mid-confirmation.
      if (!(await bcrypt.compare(req.body.password, hash))) {
        throw ApiError.forbidden("That password is incorrect.");
      }
      if (req.body.confirmFirmName.trim() !== firmName.trim()) {
        throw ApiError.badRequest("Type your firm's name exactly as shown to confirm.");
      }
      return firmData.deleteFirmData(db, { firmId });
    });

    const failed = await firmData.deleteStoredFiles(storageKeys);
    // The firm's own audit trail is erased with it, so leave an operational
    // record in the server log — ids and counts only, no personal data.
    process.stdout.write(
      `${JSON.stringify({
        event: "firm_deleted",
        firmId,
        actorUserId: userId,
        at: new Date().toISOString(),
        rows: counts,
        files: { deleted: storageKeys.length - failed.length, failed: failed.length }
      })}\n`
    );
    if (failed.length) {
      process.stderr.write(`[firm-delete] ${failed.length} stored file(s) for firm ${firmId} need manual removal: ${JSON.stringify(failed)}\n`);
    }

    res.clearCookie(env.REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    res.status(200).json({ deleted: true, filesDeleted: storageKeys.length - failed.length, filesFailed: failed.length });
  })
);

module.exports = router;
