const path = require("path");
const dotenv = require("dotenv");
const Joi = require("joi");

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  LOCAL_STORAGE: Joi.boolean().truthy("true").falsy("false").default(false),
  AWS_REGION: Joi.string().default("ap-south-1"),
  AWS_S3_BUCKET: Joi.when("LOCAL_STORAGE", {
    is: true,
    then: Joi.string().allow("").optional(),
    otherwise: Joi.string().required()
  }),
  AWS_ACCESS_KEY_ID: Joi.string().allow("").optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow("").optional(),
  AI_SERVICE_URL: Joi.string().uri().required(),
  AI_SERVICE_API_KEY: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().allow("").optional()
  }),
  AI_SERVICE_TIMEOUT_MS: Joi.number().integer().min(1000).default(120000),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  FRONTEND_URL: Joi.string().uri().required(),
  EMAIL_PROVIDER: Joi.string().valid("smtp", "resend").default("smtp"),
  RESEND_API_KEY: Joi.string().allow("").optional(),
  SMTP_HOST: Joi.string().allow("").optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_USER: Joi.string().allow("").optional(),
  SMTP_PASS: Joi.string().allow("").optional(),
  EMAIL_FROM_NAME: Joi.string().default("Verax TallyOCR"),
  EMAIL_FROM_ADDRESS: Joi.string().email().default("noreply@verax.in"),
  GSP_API_URL: Joi.string().uri().default("https://gsp.adaequare.com"),
  GSP_USERNAME: Joi.string().allow("").optional(),
  GSP_PASSWORD: Joi.string().allow("").optional(),
  GSP_DISABLED: Joi.boolean().truthy("true").falsy("false").default(false),
  ACCESS_TOKEN_TTL_MINUTES: Joi.number().integer().min(1).default(15),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(7),
  REFRESH_COOKIE_NAME: Joi.string().default("ca_refresh_token"),
  MAGIC_LINK_SINGLE_USE: Joi.boolean().truthy("true").falsy("false").default(true),
  MAGIC_LINK_EXPIRY_HOURS: Joi.number().integer().min(1).default(24),
  UPLOAD_URL_EXPIRY_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  TALLY_EXPORT_URL_EXPIRY_SECONDS: Joi.number().integer().min(60).max(86400).default(900),
  MAX_UPLOAD_MB: Joi.number().integer().min(1).max(100).default(50),
  MAX_TOOL_UPLOAD_MB: Joi.number().integer().min(1).max(100).default(25),
  DOCUMENT_WORKER_CONCURRENCY: Joi.number().integer().min(1).max(50).default(3)
}).unknown(true);

const { value, error } = envSchema.validate(process.env, {
  abortEarly: false,
  stripUnknown: false
});

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

module.exports = Object.freeze({
  NODE_ENV: value.NODE_ENV,
  PORT: value.PORT,
  DATABASE_URL: value.DATABASE_URL,
  REDIS_URL: value.REDIS_URL,
  LOCAL_STORAGE: value.LOCAL_STORAGE,
  AWS_REGION: value.AWS_REGION,
  AWS_S3_BUCKET: value.AWS_S3_BUCKET,
  AWS_ACCESS_KEY_ID: value.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: value.AWS_SECRET_ACCESS_KEY,
  AI_SERVICE_URL: value.AI_SERVICE_URL,
  AI_SERVICE_API_KEY: value.AI_SERVICE_API_KEY,
  AI_SERVICE_TIMEOUT_MS: value.AI_SERVICE_TIMEOUT_MS,
  JWT_SECRET: value.JWT_SECRET,
  JWT_REFRESH_SECRET: value.JWT_REFRESH_SECRET,
  FRONTEND_URL: value.FRONTEND_URL,
  EMAIL_PROVIDER: value.EMAIL_PROVIDER,
  RESEND_API_KEY: value.RESEND_API_KEY,
  SMTP_HOST: value.SMTP_HOST,
  SMTP_PORT: value.SMTP_PORT,
  SMTP_USER: value.SMTP_USER,
  SMTP_PASS: value.SMTP_PASS,
  EMAIL_FROM_NAME: value.EMAIL_FROM_NAME,
  EMAIL_FROM_ADDRESS: value.EMAIL_FROM_ADDRESS,
  GSP_API_URL: value.GSP_API_URL,
  GSP_USERNAME: value.GSP_USERNAME,
  GSP_PASSWORD: value.GSP_PASSWORD,
  GSP_DISABLED: value.GSP_DISABLED,
  ACCESS_TOKEN_TTL_MINUTES: value.ACCESS_TOKEN_TTL_MINUTES,
  REFRESH_TOKEN_TTL_DAYS: value.REFRESH_TOKEN_TTL_DAYS,
  REFRESH_TOKEN_TTL_SECONDS: value.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  REFRESH_COOKIE_NAME: value.REFRESH_COOKIE_NAME,
  MAGIC_LINK_SINGLE_USE: value.MAGIC_LINK_SINGLE_USE,
  MAGIC_LINK_EXPIRY_HOURS: value.MAGIC_LINK_EXPIRY_HOURS,
  UPLOAD_URL_EXPIRY_SECONDS: value.UPLOAD_URL_EXPIRY_SECONDS,
  TALLY_EXPORT_URL_EXPIRY_SECONDS: value.TALLY_EXPORT_URL_EXPIRY_SECONDS,
  MAX_UPLOAD_MB: value.MAX_UPLOAD_MB,
  MAX_TOOL_UPLOAD_MB: value.MAX_TOOL_UPLOAD_MB,
  DOCUMENT_WORKER_CONCURRENCY: value.DOCUMENT_WORKER_CONCURRENCY
});
