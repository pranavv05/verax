/**
 * Symmetric encryption for secrets stored at rest (currently GST taxpayer
 * session tokens).
 *
 * AES-256-GCM, authenticated: tampering is detected on decrypt. The key comes
 * from GSP_TOKEN_ENCRYPTION_KEY (32 bytes, hex or base64) in env — never
 * hard-coded. Each value gets a fresh random 12-byte IV; the stored string is
 * `v1:<iv b64>:<authTag b64>:<ciphertext b64>` so the format is self-describing
 * and versioned for future key rotation.
 *
 * A taxpayer token is a live credential to a client's GST data, so a database
 * dump alone must not expose it — only a dump PLUS the env key can. This is the
 * one secret in the app stored reversibly (passwords/refresh tokens are hashed,
 * which is correct for those; this token must be replayed to the GSP, so it
 * must be recoverable, hence encryption rather than hashing).
 */

const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = "v1";

let cachedKey = null;

/**
 * Resolve the 32-byte key from env. Accepts hex (64 chars) or base64. Throws a
 * clear error if missing/wrong size, so misconfiguration fails loudly at the
 * first encrypt/decrypt rather than silently storing unprotected data.
 */
const getKey = () => {
  if (cachedKey) return cachedKey;
  const raw = process.env.GSP_TOKEN_ENCRYPTION_KEY || "";
  if (!raw) {
    throw new Error(
      "GSP_TOKEN_ENCRYPTION_KEY is not set — required to store GST taxpayer tokens. " +
        "Generate one with: openssl rand -hex 32"
    );
  }
  let key;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== 32) {
    throw new Error(
      `GSP_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Use: openssl rand -hex 32`
    );
  }
  cachedKey = key;
  return cachedKey;
};

const encrypt = (plaintext) => {
  if (plaintext === null || plaintext === undefined) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
};

const decrypt = (payload) => {
  if (payload === null || payload === undefined || payload === "") return null;
  const parts = String(payload).split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed encrypted payload");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
};

const isConfigured = () => Boolean(process.env.GSP_TOKEN_ENCRYPTION_KEY);

// For tests: reset the cached key after changing the env var.
const _resetKeyCache = () => {
  cachedKey = null;
};

module.exports = { encrypt, decrypt, isConfigured, _resetKeyCache };
