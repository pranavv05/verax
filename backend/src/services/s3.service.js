const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");
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

const createUploadUrl = async ({ key, contentType }) => {
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
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
};

const assertObjectExists = async ({ key }) => {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key
      })
    );
  } catch (error) {
    const code = error?.$metadata?.httpStatusCode;
    if (code === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") {
      throw ApiError.badRequest("Uploaded file was not found in object storage");
    }
    throw error;
  }
};

const deleteObject = async ({ key }) => {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key
    })
  );
};

module.exports = {
  createUploadUrl,
  createDownloadUrl,
  uploadTextObject,
  assertObjectExists,
  deleteObject
};
