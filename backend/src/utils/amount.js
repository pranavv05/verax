/**
 * Reads an amount from extracted data: a number, or a string like "1,40,066.00".
 *
 * Blank means missing, not zero. The Review page saves an empty field as "",
 * and Number("") is 0 — which made every invoice approved there with "Total
 * tax" left blank fail the export's tax-math check (CGST+SGST+IGST = 21366,
 * "but tax_amount = 0") and report ₹0 GST against GSTR-2B.
 */
const toAmount = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

module.exports = { toAmount };
