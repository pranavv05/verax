const path = require("path");
const ApiError = require("./api-error");
const env = require("../config/env");
const { matchesExpectedSignature } = require("./file-signature");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".xlsx", ".xls"]);

const UNSUPPORTED_FILE_MESSAGE = "Only PDF, JPG, PNG, and Excel files are allowed";

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

// Validates a file whose bytes the backend actually received (as opposed to
// assertAllowedFile, which only checks client-declared metadata ahead of a
// presigned-URL upload). Checks the declared MIME type, the extension on the
// original filename, and the file's real byte signature, so a payload
// disguised with a spoofed Content-Type and a renamed extension is rejected.
const assertUploadedFileContent = ({ mimetype, fileName, buffer }) => {
  const extension = path.extname(fileName || "").toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw ApiError.invalidFileType(UNSUPPORTED_FILE_MESSAGE);
  }

  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    throw ApiError.invalidFileType(UNSUPPORTED_FILE_MESSAGE);
  }

  if (!matchesExpectedSignature(buffer, extension)) {
    throw ApiError.invalidFileType(UNSUPPORTED_FILE_MESSAGE);
  }
};

// Validates a file that was uploaded straight to storage via a presigned URL,
// using the stored object's real size and leading bytes (see
// s3.service.js inspectStoredObject). The presigned PUT does not bind the
// size or content the client declared in assertAllowedFile, so without this
// a client — including anyone holding a magic upload link — could store an
// arbitrarily large or non-document file and have it queued for OCR.
const assertStoredUploadIsValid = ({ fileName, size, head }) => {
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (!Number.isFinite(size) || size <= 0) {
    throw ApiError.badRequest("Uploaded file is empty");
  }
  if (size > maxBytes) {
    throw ApiError.badRequest(`File size must be between 1 byte and ${env.MAX_UPLOAD_MB}MB`);
  }

  const extension = path.extname(fileName || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension) || !matchesExpectedSignature(head, extension)) {
    throw ApiError.invalidFileType(UNSUPPORTED_FILE_MESSAGE);
  }
};

module.exports = {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  UNSUPPORTED_FILE_MESSAGE,
  sanitizeFileName,
  assertAllowedFile,
  assertUploadedFileContent,
  assertStoredUploadIsValid
};
