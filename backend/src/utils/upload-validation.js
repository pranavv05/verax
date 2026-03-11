const path = require("path");
const ApiError = require("./api-error");
const env = require("../config/env");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".xlsx"]);

const sanitizeFileName = (fileName) => {
  const trimmed = (fileName || "").trim();
  if (!trimmed) {
    throw ApiError.badRequest("File name is required");
  }

  if (trimmed.length > 255) {
    throw ApiError.badRequest("File name exceeds 255 characters");
  }

  if (trimmed !== path.basename(trimmed)) {
    throw ApiError.badRequest("Invalid file name");
  }

  if (/[\\/]/.test(trimmed) || /\.\./.test(trimmed) || /[\x00-\x1F]/.test(trimmed)) {
    throw ApiError.badRequest("Invalid file name");
  }

  return trimmed;
};

const assertAllowedFile = ({ fileName, fileType, fileSize }) => {
  const safeFileName = sanitizeFileName(fileName);

  const extension = path.extname(safeFileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw ApiError.badRequest("Unsupported file extension");
  }

  if (!ALLOWED_MIME_TYPES.has(fileType)) {
    throw ApiError.badRequest("Unsupported file type");
  }

  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > maxBytes) {
    throw ApiError.badRequest(`File size must be between 1 byte and ${env.MAX_UPLOAD_MB}MB`);
  }

  return safeFileName;
};

module.exports = {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  sanitizeFileName,
  assertAllowedFile
};
