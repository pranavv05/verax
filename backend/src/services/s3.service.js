const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const env = require("../config/env");
const ApiError = require("../utils/api-error");

const resolvedCredentials =
  env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
      }
    : undefined;

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: resolvedCredentials
});

const LOCAL_STORAGE_ROOT = path.resolve(__dirname, "../../local-storage");
const LOCAL_BASE_URL = `http://localhost:${env.PORT}`;

const normalizeLocalStorageKey = (key) => String(key || "").replace(/\\/g, "/").replace(/^\/+/, "");

const resolveLocalStoragePath = (key) => {
  const normalizedKey = normalizeLocalStorageKey(key);
  const resolvedPath = path.resolve(LOCAL_STORAGE_ROOT, normalizedKey);
  if (!resolvedPath.startsWith(LOCAL_STORAGE_ROOT)) {
    throw ApiError.badRequest("Invalid local storage path");
  }
  return resolvedPath;
};

const ensureLocalDirectory = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const createUploadUrl = async ({ key, contentType }) => {
  if (env.LOCAL_STORAGE) {
    return {
      url: `${LOCAL_BASE_URL}/api/local-upload/${encodeURIComponent(normalizeLocalStorageKey(key))}`,
      expiresIn: env.UPLOAD_URL_EXPIRY_SECONDS
    };
  }

  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: env.UPLOAD_URL_EXPIRY_SECONDS
  });

  return {
    url,
    expiresIn: env.UPLOAD_URL_EXPIRY_SECONDS
  };
};

const createDownloadUrl = async ({ key, expiresIn = env.TALLY_EXPORT_URL_EXPIRY_SECONDS }) => {
  if (env.LOCAL_STORAGE) {
    return {
      url: `${LOCAL_BASE_URL}/api/local-files/${encodeURIComponent(normalizeLocalStorageKey(key))}`,
      expiresIn
    };
  }

  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn
  });

  return {
    url,
    expiresIn
  };
};

const uploadTextObject = async ({ key, body, contentType = "application/xml" }) => {
  if (env.LOCAL_STORAGE) {
    const filePath = resolveLocalStoragePath(key);
    await ensureLocalDirectory(filePath);
    await fs.writeFile(filePath, body, "utf8");
    return;
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
};

const downloadFileAsBuffer = async ({ key }) => {
  if (env.LOCAL_STORAGE) {
    const filePath = resolveLocalStoragePath(key);
    return fs.readFile(filePath);
  }

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key
    })
  );

  if (typeof response.Body?.transformToByteArray === "function") {
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

// Enough leading bytes to identify every supported type's signature
// (utils/file-signature.js needs at most 12).
const STORED_OBJECT_HEAD_BYTES = 64;

const objectNotFound = (where) =>
  ApiError.badRequest(`Uploaded file was not found in ${where}`);

// Returns the stored object's real size and its first bytes. The browser
// uploads straight to storage via a presigned URL, so the backend never sees
// the bytes during upload — this is how confirm verifies what actually
// arrived, rather than trusting the size/type the client declared up front.
const inspectStoredObject = async ({ key }) => {
  if (env.LOCAL_STORAGE) {
    let handle;
    try {
      handle = await fs.open(resolveLocalStoragePath(key), "r");
      const { size } = await handle.stat();
      const head = Buffer.alloc(Math.min(size, STORED_OBJECT_HEAD_BYTES));
      if (head.length > 0) {
        await handle.read(head, 0, head.length, 0);
      }
      return { size, head };
    } catch (error) {
      if (error && error.code === "ENOENT") {
        throw objectNotFound("local storage");
      }
      throw error;
    } finally {
      await handle?.close();
    }
  }

  let size;
  try {
    const headResult = await s3Client.send(
      new HeadObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key
      })
    );
    size = Number(headResult.ContentLength || 0);
  } catch (error) {
    const code = error?.$metadata?.httpStatusCode;
    if (code === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") {
      throw objectNotFound("object storage");
    }
    throw error;
  }

  if (size === 0) {
    return { size, head: Buffer.alloc(0) };
  }

  const rangeEnd = Math.min(size, STORED_OBJECT_HEAD_BYTES) - 1;
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Range: `bytes=0-${rangeEnd}`
    })
  );
  const bytes = await response.Body.transformToByteArray();
  return { size, head: Buffer.from(bytes) };
};

const deleteObject = async ({ key }) => {
  if (env.LOCAL_STORAGE) {
    try {
      await fs.unlink(resolveLocalStoragePath(key));
    } catch (error) {
      if (!error || error.code !== "ENOENT") {
        throw error;
      }
    }
    return;
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key
    })
  );
};

module.exports = {
  LOCAL_STORAGE_ROOT,
  resolveLocalStoragePath,
  ensureLocalDirectory,
  createUploadUrl,
  createDownloadUrl,
  uploadTextObject,
  downloadFileAsBuffer,
  inspectStoredObject,
  deleteObject
};
