/**
 * wa.me click-to-chat requires the full international number (country code +
 * number, no "+"). Clients are stored as plain 10-digit Indian mobile numbers
 * — client-import.service.js's validatePhone rejects anything else — so a
 * bare 10-digit number is unambiguously a local number missing its +91.
 * Verax is India-only (GST/Tally), so that assumption always holds here.
 */
export const toWhatsAppPhone = (rawPhone) => {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
};

/** Builds a wa.me click-to-chat URL with a prefilled message. */
export const buildWhatsAppShareUrl = ({ phone, message }) => {
  const phoneDigits = toWhatsAppPhone(phone);
  const base = phoneDigits ? `https://wa.me/${phoneDigits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
};
