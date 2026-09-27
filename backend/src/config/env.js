const path = require("path");
const dotenv = require("dotenv");
const Joi = require("joi");
const { getProductionConfigErrors } = require("./deployment-checks");

// Load backend/.env FIRST so it takes precedence: dotenv never overwrites a var
// that is already set, so whichever file is loaded first wins. The repo-root .env
// is loaded second and only fills in vars the backend-local file did not define.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  // Optional: a separate, least-privilege connection string for the app's
  // runtime pool. DATABASE_URL is also used by knex to run migrations,
  // which need DDL rights (CREATE TABLE/POLICY/ROLE). If the role behind
  // DATABASE_URL is a Postgres superuser (as it is for the bootstrap role
  // in the official postgres Docker image, which self-hosted docker-compose
  // deploys use), Row Level Security is silently bypassed for the app,
  // since Postgres never applies RLS to superusers. Set APP_DATABASE_URL to
  // the `ca_app` role created by migration 20260825000000 to close that
  // hole. Managed Postgres (e.g. Render) already provisions a non-superuser
  // connection role, so this is not required there.
  APP_DATABASE_URL: Joi.string().uri().allow("").optional(),
  REDIS_URL: Joi.string().uri().required(),
  LOCAL_STORAGE: Joi.boolean().truthy("true").falsy("false").default(false),
  // Production refuses LOCAL_STORAGE unless this is set — only for a
  // self-hosted server whose storage is a persistent, backed-up volume.
  ALLOW_LOCAL_STORAGE_IN_PRODUCTION: Joi.boolean().truthy("true").falsy("false").default(false),
  AWS_REGION: Joi.string().default("ap-south-1"),
  AWS_S3_BUCKET: Joi.when("LOCAL_STORAGE", {
    is: true,
    then: Joi.string().allow("").optional(),
    otherwise: Joi.string().required()
  }),
  AWS_ACCESS_KEY_ID: Joi.string().allow("").optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow("").optional(),
  // AI_SERVICE_URL/AI_SERVICE_API_KEY are the only AI-service-related vars the backend
  // needs — OCR/LLM provider config (e.g. GROQ_API_KEY) lives entirely in ai-service's own env.
  AI_SERVICE_URL: Joi.string().uri().required(),
  AI_SERVICE_API_KEY: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().allow("").optional()
  }),
  AI_SERVICE_TIMEOUT_MS: Joi.number().integer().min(1000).default(900000),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  // Client portal is a separate auth world — its own signing key, never JWT_SECRET.
  CLIENT_JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .invalid(Joi.ref("JWT_SECRET"), Joi.ref("JWT_REFRESH_SECRET"))
    .messages({
      "any.invalid": "CLIENT_JWT_SECRET must differ from JWT_SECRET and JWT_REFRESH_SECRET"
    }),
  CLIENT_JWT_EXPIRY: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default("15m"),
  CLIENT_REFRESH_TOKEN_EXPIRY_DAYS: Joi.number().integer().min(1).default(30),
  FRONTEND_URL: Joi.string().uri().required(),
  // Express "trust proxy" setting — how many reverse-proxy hops sit in front
  // of this process. Rate limiting and audit logs key on req.ip; behind a
  // proxy (Render's edge, or the Caddy service in docker-compose.prod.yml)
  // req.ip is otherwise the proxy's own address, which collapses every user
  // into one shared rate-limit bucket. Set to the exact hop count (Render: 1).
  // Leave false when the process is exposed directly — trusting a proxy that
  // isn't there lets any client spoof its IP via X-Forwarded-For.
  TRUST_PROXY: Joi.alternatives()
    .try(Joi.boolean().truthy("true").falsy("false"), Joi.number().integer().min(0), Joi.string().trim().min(1))
    .empty("")
    .default(false),
  EMAIL_PROVIDER: Joi.string().valid("smtp", "resend").default("smtp"),
  RESEND_API_KEY: Joi.string().allow("").optional(),
  SMTP_HOST: Joi.string().allow("").optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_USER: Joi.string().allow("").optional(),
  SMTP_PASS: Joi.string().allow("").optional(),
  EMAIL_FROM_NAME: Joi.string().default("Verax TallyOCR"),
  EMAIL_FROM_ADDRESS: Joi.string().email().default("noreply@verax.in"),
  DEMO_NOTIFICATION_EMAIL: Joi.string().email().default("verax.hello@gmail.com"),
  GSP_API_URL: Joi.string().uri().default("https://gsp.adaequare.com"),
  GSP_USERNAME: Joi.string().allow("").optional(),
  GSP_PASSWORD: Joi.string().allow("").optional(),
  GSP_DISABLED: Joi.boolean().truthy("true").falsy("false").default(false),
  ACCESS_TOKEN_TTL_MINUTES: Joi.number().integer().min(1).default(15),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(7),
  REFRESH_COOKIE_NAME: Joi.string().default("ca_refresh_token"),
  // Client upload links are reusable until they expire (30 days by default),
  // so the link in the client's email or WhatsApp keeps working across
  // batches. A firm can kill a leaked link with "Reset upload link".
  MAGIC_LINK_SINGLE_USE: Joi.boolean().truthy("true").falsy("false").default(false),
  MAGIC_LINK_EXPIRY_HOURS: Joi.number().integer().min(1).default(720),
  UPLOAD_URL_EXPIRY_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  TALLY_EXPORT_URL_EXPIRY_SECONDS: Joi.number().integer().min(60).max(86400).default(900),
  MAX_UPLOAD_MB: Joi.number().integer().min(1).max(100).default(50),
  MAX_TOOL_UPLOAD_MB: Joi.number().integer().min(1).max(100).default(25),
  DOCUMENT_WORKER_CONCURRENCY: Joi.number().integer().min(1).max(50).default(3),
  // Controls whether document-processing.worker.js also runs the
  // scheduled-requests BullMQ worker in-process (the default, matching the
  // single verax-worker service in render.yaml). Set to "false" only when
  // running backend/src/workers/scheduled-requests.worker.js as its own
  // deployable process — leaving both on by default is redundant-but-safe
  // (BullMQ delivers each job to exactly one consumer), not double-processing.
  SCHEDULED_REQUESTS_EMBEDDED: Joi.boolean().truthy("true").falsy("false").default(true),
  REVIEW_CONFIDENCE_THRESHOLD: Joi.number().min(0).max(1).default(0.4),
  // How admins hear about processed documents by email. "digest": one email
  // per admin each morning (08:00 IST). "instant": one email per document.
  // "off": in-app notifications only. Failure alerts are always sent at once.
  DOCUMENT_READY_EMAILS: Joi.string().valid("digest", "instant", "off").default("digest"),
  // Postgres pool/statement guards. Without these, a hung query or a leaked
  // client holds a connection forever with no automatic recovery — on a
  // managed Postgres plan with a hard connection cap, that eventually starves
  // every other request. DB_STATEMENT_TIMEOUT_MS kills any single query that
  // runs longer than this; raise it per-deployment if a real workload (e.g. a
  // large bulk import) legitimately needs more.
  DB_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  DB_POOL_IDLE_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(500).default(5000),
  DB_STATEMENT_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000)
}).unknown(true);

const { value, error } = envSchema.validate(process.env, {
  abortEarly: false,
  stripUnknown: false
});

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

if (value.NODE_ENV === "production") {
  const productionErrors = getProductionConfigErrors(value);
  if (productionErrors.length > 0) {
    throw new Error(`Production configuration error:\n- ${productionErrors.join("\n- ")}`);
  }
}

module.exports = Object.freeze({
  NODE_ENV: value.NODE_ENV,
  PORT: value.PORT,
  DATABASE_URL: value.DATABASE_URL,
  APP_DATABASE_URL: value.APP_DATABASE_URL,
  REDIS_URL: value.REDIS_URL,
  LOCAL_STORAGE: value.LOCAL_STORAGE,
  ALLOW_LOCAL_STORAGE_IN_PRODUCTION: value.ALLOW_LOCAL_STORAGE_IN_PRODUCTION,
  AWS_REGION: value.AWS_REGION,
  AWS_S3_BUCKET: value.AWS_S3_BUCKET,
  AWS_ACCESS_KEY_ID: value.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: value.AWS_SECRET_ACCESS_KEY,
  AI_SERVICE_URL: value.AI_SERVICE_URL,
  AI_SERVICE_API_KEY: value.AI_SERVICE_API_KEY,
  AI_SERVICE_TIMEOUT_MS: value.AI_SERVICE_TIMEOUT_MS,
  JWT_SECRET: value.JWT_SECRET,
  JWT_REFRESH_SECRET: value.JWT_REFRESH_SECRET,
  CLIENT_JWT_SECRET: value.CLIENT_JWT_SECRET,
  CLIENT_JWT_EXPIRY: value.CLIENT_JWT_EXPIRY,
  CLIENT_REFRESH_TOKEN_EXPIRY_DAYS: value.CLIENT_REFRESH_TOKEN_EXPIRY_DAYS,
  CLIENT_REFRESH_TOKEN_TTL_SECONDS: value.CLIENT_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
  FRONTEND_URL: value.FRONTEND_URL,
  TRUST_PROXY: value.TRUST_PROXY,
  EMAIL_PROVIDER: value.EMAIL_PROVIDER,
  RESEND_API_KEY: value.RESEND_API_KEY,
  SMTP_HOST: value.SMTP_HOST,
  SMTP_PORT: value.SMTP_PORT,
  SMTP_USER: value.SMTP_USER,
  SMTP_PASS: value.SMTP_PASS,
  EMAIL_FROM_NAME: value.EMAIL_FROM_NAME,
  EMAIL_FROM_ADDRESS: value.EMAIL_FROM_ADDRESS,
  DEMO_NOTIFICATION_EMAIL: value.DEMO_NOTIFICATION_EMAIL,
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
  DOCUMENT_WORKER_CONCURRENCY: value.DOCUMENT_WORKER_CONCURRENCY,
  SCHEDULED_REQUESTS_EMBEDDED: value.SCHEDULED_REQUESTS_EMBEDDED,
  REVIEW_CONFIDENCE_THRESHOLD: value.REVIEW_CONFIDENCE_THRESHOLD,
  DOCUMENT_READY_EMAILS: value.DOCUMENT_READY_EMAILS,
  DB_POOL_MAX: value.DB_POOL_MAX,
  DB_POOL_IDLE_TIMEOUT_MS: value.DB_POOL_IDLE_TIMEOUT_MS,
  DB_POOL_CONNECTION_TIMEOUT_MS: value.DB_POOL_CONNECTION_TIMEOUT_MS,
  DB_STATEMENT_TIMEOUT_MS: value.DB_STATEMENT_TIMEOUT_MS
});
