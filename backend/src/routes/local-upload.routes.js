const express = require("express");
const fs = require("fs/promises");
const multer = require("multer");
const path = require("path");
const env = require("../config/env");
const ApiError = require("../utils/api-error");
const { ensureLocalDirectory, resolveLocalStoragePath } = require("../services/s3.service");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024
  }
});

const saveBufferToLocalStorage = async (filename, buffer) => {
  if (!buffer || buffer.length === 0) {
    throw ApiError.badRequest("No file data received");
  }
  const filePath = resolveLocalStoragePath(filename);
  await ensureLocalDirectory(filePath);
  await fs.writeFile(filePath, buffer);
};

router.post(
  "/local-upload/:filename(*)",
  upload.any(),
  async (req, res, next) => {
    try {
      const file = Array.isArray(req.files) ? req.files[0] : null;
      await saveBufferToLocalStorage(req.params.filename, file ? file.buffer : null);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/local-upload/:filename(*)",
  express.raw({
    type: () => true,
    limit: `${env.MAX_UPLOAD_MB}mb`
  }),
  async (req, res, next) => {
    try {
      await saveBufferToLocalStorage(req.params.filename, req.body);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/local-files/:filename(*)", async (req, res, next) => {
  try {
    const filePath = resolveLocalStoragePath(req.params.filename);
    await fs.access(filePath);
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      next(ApiError.notFound("Local file not found"));
      return;
    }
    next(error);
  }
});

module.exports = router;
