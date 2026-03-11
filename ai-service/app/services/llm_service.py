from __future__ import annotations

from typing import Any

from openai import OpenAI

from app.config import settings
from app.utils.json_parser import parse_json_object

EXTRACTION_PROMPT = (
    "Extract the following fields from this Indian financial document as JSON:\n"
    "vendor_name, vendor_gstin, invoice_number, invoice_date, "
    "line_items (array of {description, quantity, unit_price, total}), "
    "subtotal, tax_amount, total_amount, payment_terms.\n"
    "If a field is not found, return null. Return only valid JSON."
)

EXPECTED_KEYS = [
    "vendor_name",
    "vendor_gstin",
    "invoice_number",
    "invoice_date",
    "line_items",
    "subtotal",
    "tax_amount",
    "total_amount",
    "payment_terms"
]


class LLMService:
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key)

    @staticmethod
    def _normalize_line_items(value: Any) -> list[dict[str, Any]] | None:
        if value is None:
            return None
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
                    "total": item.get("total")
                }
            )
        return normalized

    def _normalize_payload(self, data: dict[str, Any]) -> dict[str, Any]:
        normalized: dict[str, Any] = {}
        for key in EXPECTED_KEYS:
            if key == "line_items":
                normalized[key] = self._normalize_line_items(data.get(key))
            else:
                normalized[key] = data.get(key) if key in data else None
        return normalized

    @staticmethod
    def calculate_confidence(structured_data: dict[str, Any]) -> float:
        missing_count = 0
        for key in EXPECTED_KEYS:
            value = structured_data.get(key)
            if key == "line_items":
                if not isinstance(value, list) or len(value) == 0:
                    missing_count += 1
            elif value in (None, "", []):
                missing_count += 1

        score = 1.0 - (0.1 * missing_count)
        if score < 0:
            return 0.0
        return round(score, 4)

    def extract_structured_data(self, ocr_text: str) -> dict[str, Any]:
        response = self._client.responses.create(
            model=settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": "You are a strict JSON extraction engine."
                },
                {
                    "role": "user",
                    "content": f"{EXTRACTION_PROMPT}\n\nOCR_TEXT:\n{ocr_text[:120000]}"
                }
            ],
            temperature=0
        )

        raw_output = response.output_text or ""
        parsed = parse_json_object(raw_output)
        return self._normalize_payload(parsed)
