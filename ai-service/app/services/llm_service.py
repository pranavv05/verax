from __future__ import annotations

from typing import Any

from openai import OpenAI

from app.config import settings
from app.utils.json_parser import parse_json_object

# ── Invoice / Bill ────────────────────────────────────────────────────────────

INVOICE_PROMPT = (
    "Extract the following fields from this Indian invoice or bill as JSON:\n"
    "vendor_name, vendor_gstin, invoice_number, invoice_date, "
    "line_items (array of {description, quantity, unit_price, total, hsn_code, uom}), "
    "subtotal, cgst, sgst, igst, tax_amount, total_amount, payment_terms, "
    "tds_section, tds_rate, tds_amount.\n"
    "If a field is not found, return null. Return only valid JSON."
)

INVOICE_KEYS = [
    "vendor_name",
    "vendor_gstin",
    "invoice_number",
    "invoice_date",
    "line_items",
    "subtotal",
    "cgst",
    "sgst",
    "igst",
    "tax_amount",
    "total_amount",
    "payment_terms",
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


class LLMService:
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key)

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
                    "unit_price": item.get("unit_price"),
                    "total": item.get("total"),
                    "hsn_code": item.get("hsn_code"),
                    "uom": item.get("uom"),
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
        if doc_type == "bank_statement":
            return self._confidence(structured_data, BANK_CONFIDENCE_KEYS)
        return self._confidence(structured_data, INVOICE_CONFIDENCE_KEYS)

    # ── extraction ─────────────────────────────────────────────────────────────

    def extract_structured_data(
        self, ocr_text: str, doc_type: str = "invoice"
    ) -> dict[str, Any]:
        if doc_type == "bank_statement":
            prompt = BANK_STATEMENT_PROMPT
        else:
            # invoice, bill, other all use the invoice prompt
            prompt = INVOICE_PROMPT

        response = self._client.responses.create(
            model=settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": "You are a strict JSON extraction engine for Indian financial documents.",
                },
                {
                    "role": "user",
                    "content": f"{prompt}\n\nOCR_TEXT:\n{ocr_text[:120000]}",
                },
            ],
            temperature=0,
        )

        raw_output = response.output_text or ""
        parsed = parse_json_object(raw_output)

        if doc_type == "bank_statement":
            return self._normalize_bank_payload(parsed)
        return self._normalize_invoice_payload(parsed)
