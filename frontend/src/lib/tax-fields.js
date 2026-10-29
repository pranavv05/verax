const hasValue = (data, keys) =>
  keys.some((key) => data?.[key] !== null && data?.[key] !== undefined && String(data[key]).trim() !== "");

/**
 * Whether an empty tax field on the Review page is worth a "Check" flag.
 *
 * An invoice charges either CGST + SGST (within a state) or IGST (between
 * states), never both, so the pair it doesn't use is meant to be empty. And
 * "Total tax" is optional once the individual taxes are there. Flagging those
 * told the CA to verify fields that were correctly blank.
 */
export const isTaxFieldExpected = (data, key) => {
  const hasIgst = hasValue(data, ["igst", "igst_amount"]);
  const hasCgstSgst = hasValue(data, ["cgst", "cgst_amount", "sgst", "sgst_amount"]);
  if (key === "cgst" || key === "sgst") return !hasIgst;
  if (key === "igst") return !hasCgstSgst;
  if (key === "tax_amount") return !hasIgst && !hasCgstSgst;
  // Most invoices carry no TDS; blank TDS fields only need a look when some TDS was read.
  if (key.startsWith("tds_")) return hasValue(data, ["tds_section", "tds_rate", "tds_amount"]);
  return true;
};
