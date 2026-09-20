from __future__ import annotations

import logging
import os
import time
from typing import Any

from groq import Groq

from app.config import settings
from app.utils.json_parser import parse_json_object

logger = logging.getLogger("ai-service")

# A single transient Groq hiccup (rate limit, brief 5xx, connection reset)
# would otherwise fail the whole document with no automatic recovery. Two
# retries with a short backoff absorbs that without adding a dependency.
GROQ_MAX_ATTEMPTS = 3
GROQ_RETRY_BACKOFF_SECONDS = 2

# ── Invoice / Bill ────────────────────────────────────────────────────────────

EXTRACTION_PROMPT = """You are an expert at extracting structured data
from Indian tax invoices and bills. You understand GST, TDS, HSN codes,
and Indian business document formats.

The document text may span multiple pages separated by
"--- PAGE N ---" markers. Extract information from ALL pages
combined — line items, totals, and other fields may appear on
any page, not just the first.

STEP 1 — DOCUMENT TYPE CHECK:
First determine if this is an invoice or bill.
It is NOT an invoice/bill if it contains:
- Bank transaction columns (Debit, Credit, Balance, Narration)
- Salary components (Basic, HRA, PF, ESI, Gross, Net Pay)
- Purchase order headers (PO Number, Delivery Date, Terms)
- Completely unreadable or blank text

If NOT an invoice or bill, return ONLY:
{"document_type_detected": "unknown", "confidence": 0.0}

STEP 2 — EXTRACT THESE FIELDS:
If it IS an invoice or bill, extract the following.
For any field not found, use null — never guess.

{
  "document_type_detected": "invoice",
  "invoice_number": "exact invoice/bill number as printed",
  "invoice_date": "YYYY-MM-DD format. Convert DD/MM/YYYY or DD-MM-YYYY",
  "due_date": "YYYY-MM-DD or null",
  "supplier_name": "vendor/seller company name",
  "supplier_gstin": "15-character GSTIN in format: 2 digits + 10 alphanum + 1 digit + 1 letter + 1 digit",
  "supplier_address": "full address or null",
  "buyer_name": "buyer/consignee name or null",
  "buyer_gstin": "buyer GSTIN or null",
  "place_of_supply": "state name or state code or null",
  "line_items": [
    {
      "description": "item description exactly as printed",
      "hsn_code": "HSN/SAC code or null",
      "quantity": number or null,
      "unit": "unit of measure (Nos, Kg, L, etc.) or null",
      "rate": number (price per unit) or null,
      "amount": number (quantity x rate, before tax) or null,
      "discount": number or null
    }
  ],
  "taxable_amount": total before tax as number,
  "cgst_rate": CGST percentage as number (e.g. 9 for 9%) or null,
  "cgst_amount": CGST amount as number or null,
  "sgst_rate": SGST percentage as number or null,
  "sgst_amount": SGST amount as number or null,
  "igst_rate": IGST percentage as number or null,
  "igst_amount": IGST amount as number or null,
  "cess_amount": cess/additional tax amount or null,
  "tds_section": "TDS section like 194C, 194J etc. or null",
  "tds_rate": TDS percentage as number or null,
  "tds_amount": TDS deducted amount as number or null,
  "total_amount": final invoice total as number,
  "amount_in_words": "amount in words if printed or null",
  "payment_terms": "payment terms or null",
  "bank_details": "supplier bank account details or null",
  "notes": "any other important information or null"
}

STEP 3 — COMMON INDIAN INVOICE PATTERNS TO HANDLE:

Dates: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, D MMM YYYY (1 Apr 2025)
Numbers: Indian format 1,23,456.78 — parse as 123456.78
GSTIN: Always 15 characters. First 2 = state code, next 10 = PAN,
       next 3 = entity suffix. Validate format before returning.
GST types: CGST+SGST for intra-state, IGST for inter-state — never both
Multi-rate GST: Some invoices have multiple GST rates —
  sum all CGST amounts into cgst_amount, same for SGST/IGST
HSN codes: 4-8 digit numbers — include leading zeros if printed

GRAND TOTAL RULES (for invoices with a multi-row / multi-item table):
- For the total_amount field, use ONLY the Grand Total row's final
  "Total Amount (incl. tax)" column value. Do not sum individual rows
  yourself.
- For cgst_amount, use ONLY the Grand Total row's CGST Amount column.
- For sgst_amount, use ONLY the Grand Total row's SGST/UTGST Amount column.
- Do not perform arithmetic. Read the printed Grand Total values directly
  from the document.
- For invoices with multiple line items, the grand total row is usually
  the last row in bold.
TDS: May appear as deduction from total — tds_amount reduces the payable amount

OCR ERROR CORRECTION:
Common OCR mistakes on Indian invoices — silently correct these:
- 0 and O confusion in GSTIN: GSTINs never contain O, replace O with 0
  in positions 1-2 and 13 (digit positions)
- l and 1 confusion: in numeric fields, replace l with 1
- I and 1 confusion in amounts: in amount fields, replace I with 1
- Rs. or INR prefix on amounts: strip and return as number only
- Trailing/leading spaces in all string fields: strip them

MATH VALIDATION:
After extraction, verify:
- taxable_amount + cgst_amount + sgst_amount + igst_amount
  (approximately) = total_amount (allow 2% variance for rounding)
- If mismatch > 2%: still return extracted values but set
  confidence lower (see Step 4)

STEP 4 — CONFIDENCE SCORE:
Compute confidence as a float 0.0 to 1.0:
Start at 1.0, apply these deductions:
  invoice_number missing: -0.10
  invoice_date missing or invalid format: -0.15
  supplier_name missing: -0.10
  supplier_gstin missing: -0.10
  supplier_gstin invalid format (not 15 chars): -0.05
  total_amount missing: -0.20
  taxable_amount missing: -0.10
  line_items empty or null: -0.10
  tax math validation fails (>2% variance): -0.10
  any field looks like OCR garbage (random chars, no vowels in name): -0.05

Return confidence as a number. Minimum is 0.0.

STEP 5 — OUTPUT FORMAT:
Return ONLY valid JSON. No markdown, no backticks, no explanation.
The first character of your response must be { and the last must be }
Every numeric field must be a single literal number (e.g. 171336.24) —
compute any sums or totals yourself and never output an arithmetic
expression like 171336.00 + 15390.24 as a field value.
"""

INVOICE_PROMPT = EXTRACTION_PROMPT

INVOICE_KEYS = [
    "document_type_detected",
    "confidence",
    "_ocr_note",
    "_tax_math_warning",
    "low_confidence_fields",
    "supplier_name",
    "supplier_gstin",
    "supplier_address",
    "buyer_name",
    "buyer_gstin",
    "place_of_supply",
    "due_date",
    "vendor_name",
    "vendor_gstin",
    "invoice_number",
    "invoice_date",
    "line_items",
    "taxable_amount",
    "subtotal",
    "cgst_rate",
    "cgst_amount",
    "cgst",
    "sgst_rate",
    "sgst_amount",
    "sgst",
    "igst_rate",
    "igst_amount",
    "igst",
    "cess_amount",
    "tax_amount",
    "total_amount",
    "amount_in_words",
    "payment_terms",
    "bank_details",
    "notes",
    "tds_section",
    "tds_rate",
    "tds_amount",
]

# ── Bank Statement ─────────────────────────────────────────────────────────────

BANK_STATEMENT_PROMPT = (
    "Extract the following fields from this Indian bank statement as JSON:\n"
    "account_holder (string), account_number (string), bank_name (string), "
    "ifsc_code (string), statement_period_from (ISO date string), "
    "statement_period_to (ISO date string), opening_balance (number), "
    "closing_balance (number), "
    "transactions (array of {date (ISO date), narration (string), "
    "debit (number or null), credit (number or null), balance (number or null), "
    "reference (string or null)}).\n"
    "If a field is not found, return null. Return only valid JSON."
)

BANK_STATEMENT_KEYS = [
    "account_holder",
    "account_number",
    "bank_name",
    "ifsc_code",
    "statement_period_from",
    "statement_period_to",
    "opening_balance",
    "closing_balance",
    "transactions",
]

# ── Confidence weight maps ─────────────────────────────────────────────────────

INVOICE_CONFIDENCE_KEYS = [
    "vendor_name",
    "invoice_number",
    "invoice_date",
    "line_items",
    "total_amount",
]

BANK_CONFIDENCE_KEYS = [
    "account_holder",
    "account_number",
    "bank_name",
    "statement_period_from",
    "statement_period_to",
    "transactions",
]


def is_ocr_garbage(text: str) -> bool:
    if not text or len(text.strip()) < 50:
        return True

    alnum = sum(char.isalnum() for char in text)
    total = len(text)
    if total == 0 or alnum / total < 0.3:
        return True

    words = text.split()
    if len(words) < 10:
        return True

    return False


def _to_number(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(",", "").strip())
        except ValueError:
            return 0.0
    return 0.0


def validate_and_adjust_confidence(extracted: dict) -> dict:
    raw_confidence = extracted.get("confidence")
    logger.info("LLM raw confidence: %r", raw_confidence)
    try:
        confidence = raw_confidence if raw_confidence is not None else 0.5
        if not isinstance(confidence, (int, float)):
            confidence = 0.5
        confidence = max(0.0, min(1.0, float(confidence)))

        if not extracted.get("total_amount"):
            confidence = min(confidence, 0.3)
        if not extracted.get("invoice_date"):
            confidence = min(confidence, 0.35)
        if not (extracted.get("supplier_name") or extracted.get("vendor_name")):
            confidence = min(confidence, 0.35)

        gstin = extracted.get("supplier_gstin") or extracted.get("vendor_gstin") or ""
        # gstin can come back as a non-string (or an already-invalid type) from
        # a noisy LLM pass — len()/[:2] on a non-string used to raise, which
        # was swallowed by the except below and returned the raw, unadjusted
        # LLM confidence untouched (see the logged warning there).
        if isinstance(gstin, str) and gstin and (len(gstin) != 15 or not gstin[:2].isdigit()):
            confidence = min(confidence, 0.7)
            extracted["supplier_gstin"] = None
            extracted["vendor_gstin"] = None

        taxable = _to_number(extracted.get("taxable_amount") or extracted.get("subtotal") or 0)
        cgst = _to_number(extracted.get("cgst_amount") or extracted.get("cgst") or 0)
        sgst = _to_number(extracted.get("sgst_amount") or extracted.get("sgst") or 0)
        igst = _to_number(extracted.get("igst_amount") or extracted.get("igst") or 0)
        cess = _to_number(extracted.get("cess_amount") or 0)
        total = _to_number(extracted.get("total_amount") or 0)

        if total > 0 and taxable > 0:
            # cess is part of the printed grand total on invoices that have
            # it (e.g. luxury/sin goods); the previous version omitted it,
            # so any invoice with cess always failed this check and had its
            # confidence capped at the hardcoded 0.75 below regardless of
            # actual extraction quality.
            computed = taxable + cgst + sgst + igst + cess
            variance = abs(computed - total) / total
            if variance > 0.02:
                confidence = min(confidence, 0.75)
                extracted["_tax_math_warning"] = (
                    f"Tax math variance {variance:.1%}: "
                    f"computed {computed}, extracted total {total}"
                )

        extracted["confidence"] = round(confidence, 3)
        logger.info("Final confidence after adjustment: %s", extracted["confidence"])
        return extracted
    except Exception as error:  # noqa: BLE001
        logger.error(
            "validate_and_adjust_confidence failed, returning raw LLM confidence unadjusted: %s",
            error,
        )
        fallback = raw_confidence
        extracted["confidence"] = round(fallback if isinstance(fallback, (int, float)) else 0.5, 3)
        return extracted


class LLMService:
    def __init__(self) -> None:
        self._client = Groq(api_key=settings.groq_api_key)

    # ── normalisation helpers ──────────────────────────────────────────────────

    @staticmethod
    def _normalize_line_items(value: Any) -> list[dict[str, Any]] | None:
        if not isinstance(value, list):
            return None
        normalized = []
        for item in value:
            if not isinstance(item, dict):
                continue
            normalized.append(
                {
                    "description": item.get("description"),
                    "quantity": item.get("quantity"),
                    "unit_price": item.get("unit_price") or item.get("rate"),
                    "rate": item.get("rate") or item.get("unit_price"),
                    "total": item.get("total") or item.get("amount"),
                    "amount": item.get("amount") or item.get("total"),
                    "hsn_code": item.get("hsn_code"),
                    "uom": item.get("uom") or item.get("unit"),
                    "unit": item.get("unit") or item.get("uom"),
                    "discount": item.get("discount"),
                }
            )
        return normalized

    @staticmethod
    def _normalize_transactions(value: Any) -> list[dict[str, Any]] | None:
        if not isinstance(value, list):
            return None
        normalized = []
        for txn in value:
            if not isinstance(txn, dict):
                continue
            normalized.append(
                {
                    "date": txn.get("date"),
                    "narration": txn.get("narration"),
                    "debit": txn.get("debit"),
                    "credit": txn.get("credit"),
                    "balance": txn.get("balance"),
                    "reference": txn.get("reference"),
                }
            )
        return normalized

    def _normalize_invoice_payload(self, data: dict[str, Any]) -> dict[str, Any]:
        normalized: dict[str, Any] = {}
        for key in INVOICE_KEYS:
            if key == "line_items":
                normalized[key] = self._normalize_line_items(data.get(key))
            else:
                normalized[key] = data.get(key) if key in data else None
        normalized["vendor_name"] = normalized.get("vendor_name") or normalized.get("supplier_name")
        normalized["vendor_gstin"] = normalized.get("vendor_gstin") or normalized.get("supplier_gstin")
        normalized["supplier_name"] = normalized.get("supplier_name") or normalized.get("vendor_name")
        normalized["supplier_gstin"] = normalized.get("supplier_gstin") or normalized.get("vendor_gstin")
        normalized["subtotal"] = normalized.get("subtotal") or normalized.get("taxable_amount")
        normalized["taxable_amount"] = normalized.get("taxable_amount") or normalized.get("subtotal")
        normalized["cgst"] = normalized.get("cgst") or normalized.get("cgst_amount")
        normalized["sgst"] = normalized.get("sgst") or normalized.get("sgst_amount")
        normalized["igst"] = normalized.get("igst") or normalized.get("igst_amount")
        normalized["cgst_amount"] = normalized.get("cgst_amount") or normalized.get("cgst")
        normalized["sgst_amount"] = normalized.get("sgst_amount") or normalized.get("sgst")
        normalized["igst_amount"] = normalized.get("igst_amount") or normalized.get("igst")
        return normalized

    def _normalize_bank_payload(self, data: dict[str, Any]) -> dict[str, Any]:
        normalized: dict[str, Any] = {}
        for key in BANK_STATEMENT_KEYS:
            if key == "transactions":
                normalized[key] = self._normalize_transactions(data.get(key))
            else:
                normalized[key] = data.get(key) if key in data else None
        return normalized

    # ── confidence ─────────────────────────────────────────────────────────────

    @staticmethod
    def _confidence(structured_data: dict[str, Any], keys: list[str]) -> float:
        missing = 0
        for key in keys:
            value = structured_data.get(key)
            if isinstance(value, list):
                if len(value) == 0:
                    missing += 1
            elif value in (None, ""):
                missing += 1
        score = 1.0 - (0.15 * missing)
        return round(max(score, 0.0), 4)

    def calculate_confidence(
        self, structured_data: dict[str, Any], doc_type: str = "invoice"
    ) -> float:
        model_confidence = structured_data.get("confidence")
        if isinstance(model_confidence, (int, float)):
            return round(max(0.0, min(1.0, float(model_confidence))), 4)
        if doc_type == "bank_statement":
            return self._confidence(structured_data, BANK_CONFIDENCE_KEYS)
        return self._confidence(structured_data, INVOICE_CONFIDENCE_KEYS)

    # ── extraction ─────────────────────────────────────────────────────────────

    def extract_structured_data(
        self, ocr_text: str, doc_type: str = "invoice"
    ) -> dict[str, Any]:
        if doc_type != "bank_statement" and is_ocr_garbage(ocr_text):
            return {
                "document_type_detected": "unknown",
                "confidence": 0.0,
                "_ocr_note": "OCR produced insufficient text for extraction",
            }

        if doc_type == "bank_statement":
            prompt = BANK_STATEMENT_PROMPT
        else:
            # invoice, bill, other all use the invoice prompt
            prompt = INVOICE_PROMPT

        response = None
        last_error: Exception | None = None
        for attempt in range(1, GROQ_MAX_ATTEMPTS + 1):
            try:
                response = self._client.chat.completions.create(
                    # llama-3.1-70b-versatile was decommissioned by Groq and now
                    # returns 400 model_decommissioned. llama-3.3-70b-versatile is
                    # its direct replacement. Overridable so the next deprecation
                    # does not require a code change.
                    model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a strict JSON extraction engine for Indian financial documents.",
                        },
                        {
                            "role": "user",
                            "content": f"{prompt}\n\nOCR_TEXT:\n{ocr_text[:120000]}",
                        },
                    ],
                    temperature=0.1,
                    max_tokens=2000,
                    timeout=settings.llm_timeout_seconds,
                    response_format={"type": "json_object"},
                )
                break
            except Exception as e:  # noqa: BLE001
                last_error = e
                # A 4xx like bad-request/auth/model-not-found will fail identically
                # on retry — only worth retrying once we know it's worth trying at all.
                status_code = getattr(e, "status_code", None)
                if status_code is not None and 400 <= status_code < 500:
                    break
                if attempt < GROQ_MAX_ATTEMPTS:
                    logger.warning(
                        f"Groq extraction attempt {attempt}/{GROQ_MAX_ATTEMPTS} failed, retrying: {e}"
                    )
                    time.sleep(GROQ_RETRY_BACKOFF_SECONDS * attempt)

        if response is None:
            logger.error(f"Groq extraction failed after {GROQ_MAX_ATTEMPTS} attempt(s): {last_error}")
            return {
                "document_type_detected": "unknown",
                "confidence": 0.0,
                "_llm_error": str(last_error),
            }

        raw_output = response.choices[0].message.content or ""
        try:
            parsed = parse_json_object(raw_output)
        except (ValueError, TypeError) as e:
            # A truncated or malformed Groq response (e.g. hit max_tokens
            # mid-object) must degrade like an API failure, not bubble up as
            # an unhandled 500 that loses the OCR text and confidence.
            logger.error(f"Failed to parse LLM JSON response: {e}")
            return {
                "document_type_detected": "unknown",
                "confidence": 0.0,
                "_llm_error": f"malformed_json_response: {e}",
            }

        if doc_type == "bank_statement":
            return self._normalize_bank_payload(parsed)
        normalized = self._normalize_invoice_payload(parsed)
        return validate_and_adjust_confidence(normalized)
