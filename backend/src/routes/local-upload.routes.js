const express = require("express");
const fs = require("fs/promises");
const multer = require("multer");
const path = require("path");
const env = require("../config/env");
const ApiError = require("../utils/api-error");
const { assertUploadedFileContent } = require("../utils/upload-validation");
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

const handleMulterUpload = (req, res, next) => {
  upload.any()(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest(`File exceeds ${env.MAX_UPLOAD_MB}MB limit`));
    }
    if (error) {
      return next(error);
    }
    return next();
  });
};

router.post(
  "/local-upload/:filename(*)",
  handleMulterUpload,
  async (req, res, next) => {
    try {
      const file = Array.isArray(req.files) ? req.files[0] : null;
      const buffer = file ? file.buffer : null;
      if (!buffer || buffer.length === 0) {
        throw ApiError.badRequest("No file data received");
      }
      assertUploadedFileContent({
        mimetype: file.mimetype,
        fileName: path.basename(req.params.filename),
        buffer
      });
      await saveBufferToLocalStorage(req.params.filename, buffer);
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
      const buffer = req.body;
      if (!buffer || buffer.length === 0) {
        throw ApiError.badRequest("No file data received");
      }
      const mimetype = (req.headers["content-type"] || "").split(";")[0].trim();
      assertUploadedFileContent({
        mimetype,
        fileName: path.basename(req.params.filename),
        buffer
      });
      await saveBufferToLocalStorage(req.params.filename, buffer);
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
