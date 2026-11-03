// Hosting-platform domains that are on the Public Suffix List: every
// subdomain of one (my-app.vercel.app) is its own "site" to a browser, so it
// can never be same-site with the API. The refresh-token cookie is
// SameSite=Strict and the access token lives only in memory, so a frontend
// served from one of these while the API is elsewhere logs users out on every
// page reload — the frontend and API must share a registrable domain (e.g.
// app.yourdomain.in + api.yourdomain.in).
const PLATFORM_SUFFIXES = [
  "vercel.app",
  "onrender.com",
  "netlify.app",
  "herokuapp.com",
  "pages.dev",
  "github.io",
  "fly.dev",
  "up.railway.app",
  "azurewebsites.net",
  "web.app",
  "firebaseapp.com"
];

const getPlatformSuffix = (hostname) =>
  PLATFORM_SUFFIXES.find((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)) || null;

// Returns a warning string when FRONTEND_URL can't share cookies with the
// API, or null when it's fine (or unparseable — env.js already validates it).
const getFrontendDomainWarning = (frontendUrl) => {
  let hostname;
  try {
    hostname = new URL(frontendUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  const suffix = getPlatformSuffix(hostname);
  if (!suffix) {
    return null;
  }
  return (
    `FRONTEND_URL (${hostname}) is on the shared platform domain "${suffix}", which browsers ` +
    "treat as its own site. The SameSite=Strict refresh cookie will not be sent to the API from " +
    "there, so users will be logged out on every page reload. Serve the frontend and API from " +
    "one domain you own (e.g. app.yourdomain.in and api.yourdomain.in)."
  );
};

/**
 * Settings that let a production backend start but then fail silently for
 * real clients. Returns a list of problems; env.js refuses to boot on any.
 *
 * - No working email provider: invites, portal passwords, password resets and
 *   document alerts are "sent" into a log line nobody reads.
 * - LOCAL_STORAGE on a platform with an ephemeral disk (Render, most PaaS):
 *   every client document is lost on the next deploy. Self-hosted servers with
 *   a persistent volume can opt in with ALLOW_LOCAL_STORAGE_IN_PRODUCTION.
 * - A signing secret copied unchanged from an example file: those values are
 *   public in this repository, so anyone could forge a login for any firm.
 * - A non-https FRONTEND_URL: the refresh cookie is Secure in production and
 *   is never sent over plain http, so nobody could stay logged in.
 */
const SECRET_KEYS = ["JWT_SECRET", "JWT_REFRESH_SECRET", "CLIENT_JWT_SECRET", "AI_SERVICE_API_KEY"];
// Fragments of every placeholder in .env.example / .env.production.example /
// CI config. Matching is case-insensitive.
const PLACEHOLDER_MARKERS = [
  "replace-with",
  "replace_with",
  "change-me",
  "change_me",
  "changeme",
  "placeholder",
  "min_32_chars",
  "your-secret",
  "your_secret",
  "example",
  "ci-only"
];

const getPlaceholderSecrets = (config) =>
  SECRET_KEYS.filter((key) => {
    const value = String(config[key] || "").toLowerCase();
    return value && PLACEHOLDER_MARKERS.some((marker) => value.includes(marker));
  });

const getProductionConfigErrors = (config) => {
  const errors = [];
  const provider = config.EMAIL_PROVIDER || "smtp";

  if (provider === "resend") {
    if (!config.RESEND_API_KEY) {
      errors.push("EMAIL_PROVIDER is \"resend\" but RESEND_API_KEY is not set.");
    }
  } else {
    const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((key) => !config[key]);
    if (missing.length > 0) {
      errors.push(
        `No email provider configured (missing ${missing.join(", ")}). Set SMTP_HOST/SMTP_USER/SMTP_PASS, ` +
          "or EMAIL_PROVIDER=resend with RESEND_API_KEY — without one, client invites, portal passwords " +
          "and password resets are never delivered."
      );
    }
  }

  const placeholders = getPlaceholderSecrets(config);
  if (placeholders.length > 0) {
    errors.push(
      `${placeholders.join(", ")} still ${placeholders.length === 1 ? "has its" : "have their"} example value. ` +
        "Example values are public, so anyone could sign their own login tokens. Generate real ones with " +
        "`openssl rand -hex 32` (a different value for each)."
    );
  }

  try {
    if (config.FRONTEND_URL && new URL(config.FRONTEND_URL).protocol !== "https:") {
      errors.push(
        "FRONTEND_URL must be https:// in production — the login cookie is Secure and browsers never send " +
          "it over plain http, so every page reload would log users out."
      );
    }
  } catch {
    // env.js already rejects a malformed FRONTEND_URL.
  }

  if (config.LOCAL_STORAGE && !config.ALLOW_LOCAL_STORAGE_IN_PRODUCTION) {
    errors.push(
      "LOCAL_STORAGE=true stores client documents on this server's disk, which most hosts wipe on every " +
        "deploy. Use S3 (AWS_S3_BUCKET) in production, or set ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true only " +
        "on a self-hosted server whose storage is a persistent, backed-up volume."
    );
  }

  return errors;
};

module.exports = { getFrontendDomainWarning, getProductionConfigErrors };
