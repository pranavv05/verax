/**
 * Client-side GSTIN validation.
 *
 * Deliberately mirrors `backend/src/services/compliance.service.js` (state-code
 * table, PAN pattern, 'Z' at position 14, mod-36 checksum) so the signup form
 * gives the same verdict the server would. It is a UX affordance only — the
 * server remains the authority.
 */

const VALID_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13",
  "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26",
  "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "97"
]);

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const gstinChecksum = (gstin14) => {
  let total = 0;
  for (let i = 0; i < 14; i += 1) {
    const idx = GSTIN_CHARS.indexOf(gstin14[i].toUpperCase());
    if (idx < 0) return null;
    const factor = i % 2 === 0 ? 1 : 2;
    const product = idx * factor;
    total += Math.floor(product / 36) + (product % 36);
  }
  const remainder = total % 36;
  return GSTIN_CHARS[(36 - (remainder % 36)) % 36];
};

export const normalizeGstin = (value = "") => value.replace(/\s/g, "").toUpperCase();

/**
 * Returns { state: "empty" | "incomplete" | "valid" | "invalid", message }.
 * "incomplete" lets the form stay quiet while the user is still typing.
 */
export const validateGstin = (value) => {
  const cleaned = normalizeGstin(value || "");

  if (cleaned.length === 0) {
    return { state: "empty", message: null };
  }

  if (cleaned.length < 15) {
    return {
      state: "incomplete",
      message: `${cleaned.length}/15 characters`
    };
  }

  if (cleaned.length > 15) {
    return { state: "invalid", message: "GSTIN must be exactly 15 characters" };
  }

  const stateCode = cleaned.substring(0, 2);
  if (!VALID_STATE_CODES.has(stateCode)) {
    return { state: "invalid", message: `Unknown state code '${stateCode}'` };
  }

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleaned.substring(2, 12))) {
    return { state: "invalid", message: "Characters 3-12 are not a valid PAN" };
  }

  if (cleaned[13] !== "Z") {
    return { state: "invalid", message: "The 14th character must be 'Z'" };
  }

  const expected = gstinChecksum(cleaned.substring(0, 14));
  if (expected && cleaned[14] !== expected) {
    return { state: "invalid", message: `Checksum mismatch — expected '${expected}'` };
  }

  return { state: "valid", message: "Valid GSTIN" };
};
