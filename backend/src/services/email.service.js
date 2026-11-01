const env = require("../config/env");

/**
 * Email delivery.
 *
 * Contract (unchanged, relied on by every caller): sendEmail NEVER throws. It
 * always resolves to { sent, provider, error?, preview? }, and callers branch on
 * `sent`. This module adds production hardening on top of that contract:
 *
 *  - a hard per-attempt timeout, so a hung SMTP/Resend connection cannot block
 *    a request or a worker job forever;
 *  - bounded retries with backoff for transient failures (network, 4xx/5xx the
 *    provider may recover from), so one blip does not drop an invite or a
 *    password reset;
 *  - a single reused SMTP transporter with a connection pool, instead of
 *    building (and leaking) a fresh transporter on every send;
 *  - verifyTransport(), a startup/health self-test that confirms the configured
 *    provider can actually authenticate.
 *
 * Behaviour preserved: in non-production, an unconfigured provider logs a
 * preview and returns { sent:false, preview }. In production, env.js already
 * refuses to boot without a working provider (deployment-checks.js).
 */

const SEND_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

const formatSender = () => `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`;

const isSmtpConfigured = () => Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const isResendConfigured = () => Boolean(env.RESEND_API_KEY);

const activeProvider = () => env.EMAIL_PROVIDER || "smtp";

const isProviderConfigured = (provider = activeProvider()) =>
  provider === "resend" ? isResendConfigured() : isSmtpConfigured();

const logEmailPreview = ({ to, subject, html }) => {
  console.info("[email/preview]", {
    to,
    subject,
    from: formatSender(),
    html
  });
};

/** Reject if `promise` does not settle within `ms`, so no send can hang. */
const withTimeout = (promise, ms, label) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── SMTP transporter (built once, pooled, reused) ──────────────────────────────

let cachedSmtpTransporter = null;

const getSmtpTransporter = () => {
  if (cachedSmtpTransporter) return cachedSmtpTransporter;
  const nodemailer = require("nodemailer");
  cachedSmtpTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: Number(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    },
    // A connection pool avoids a fresh TCP+TLS handshake per email and caps
    // concurrent connections so a burst of sends can't exhaust the SMTP relay.
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS
  });
  return cachedSmtpTransporter;
};

const sendWithResend = async ({ to, subject, html }) => {
  const { Resend } = require("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: formatSender(),
    to,
    subject,
    html
  });
  // The Resend SDK returns an error object rather than throwing; surface it so
  // the retry loop and the caller see a real failure.
  if (error) {
    throw new Error(error.message || "Resend returned an error");
  }
};

const sendWithSmtp = async ({ to, subject, html }) => {
  await getSmtpTransporter().sendMail({
    from: formatSender(),
    to,
    subject,
    html
  });
};

const deliverOnce = async (provider, message) => {
  const send = provider === "resend" ? sendWithResend : sendWithSmtp;
  await withTimeout(send(message), SEND_TIMEOUT_MS, `${provider} send`);
};

const sendEmail = async ({ to, subject, html }) => {
  const provider = activeProvider();

  if (!isProviderConfigured(provider)) {
    if (env.NODE_ENV !== "production") {
      logEmailPreview({ to, subject, html });
      return { sent: false, provider, preview: html };
    }
    const error = `${provider} email provider is not configured`;
    console.error("[email/send] configuration error", { provider, to, subject, error });
    return { sent: false, provider, error };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await deliverOnce(provider, { to, subject, html });
      return { sent: true, provider, attempts: attempt };
    } catch (error) {
      lastError = error && error.message ? error.message : String(error);
      console.error("[email/send] attempt failed", {
        provider,
        to,
        subject,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        error: lastError
      });
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }

  return { sent: false, provider, error: lastError, attempts: MAX_ATTEMPTS };
};

/**
 * Confirm the configured provider can authenticate. Used by a startup check and
 * a health endpoint. Never throws; returns { ok, provider, configured, error? }.
 */
const verifyTransport = async () => {
  const provider = activeProvider();
  if (!isProviderConfigured(provider)) {
    return { ok: false, provider, configured: false };
  }
  try {
    if (provider === "resend") {
      // The Resend SDK has no cheap verify; configured key is the best signal.
      return { ok: true, provider, configured: true };
    }
    await withTimeout(getSmtpTransporter().verify(), SEND_TIMEOUT_MS, "smtp verify");
    return { ok: true, provider, configured: true };
  } catch (error) {
    return {
      ok: false,
      provider,
      configured: true,
      error: error && error.message ? error.message : String(error)
    };
  }
};

/** Close the pooled transporter (graceful shutdown). */
const closeTransport = () => {
  if (cachedSmtpTransporter && typeof cachedSmtpTransporter.close === "function") {
    cachedSmtpTransporter.close();
  }
  cachedSmtpTransporter = null;
};

module.exports = {
  sendEmail,
  verifyTransport,
  closeTransport,
  // exported for tests
  isProviderConfigured
};
