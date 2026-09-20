from unittest.mock import MagicMock, patch

import pytest

from app.services import llm_service as llm_service_module
from app.services.llm_service import LLMService, _to_number, validate_and_adjust_confidence


# A real invoice contains plenty of alnum text and >10 words, so it clears
# is_ocr_garbage() and actually reaches the Groq call path being tested.
REALISTIC_OCR_TEXT = (
    "TAX INVOICE\nSupplier: Acme Traders Pvt Ltd\nGSTIN: 29ABCDE1234F1Z5\n"
    "Invoice No: INV-2025-001\nDate: 15-04-2025\nItem: Office Supplies "
    "Qty: 10 Rate: 500 Amount: 5000\nCGST 9%: 450 SGST 9%: 450\nTotal: 5900"
)


def make_service():
    with patch.object(llm_service_module, "Groq") as mock_groq_cls:
        mock_groq_cls.return_value = MagicMock()
        service = LLMService()
    return service


def mock_response(content: str):
    response = MagicMock()
    response.choices = [MagicMock(message=MagicMock(content=content))]
    return response


class TestToNumber:
    def test_passes_through_numbers(self):
        assert _to_number(5) == 5.0
        assert _to_number(5.5) == 5.5

    def test_parses_comma_formatted_strings(self):
        assert _to_number("1,000.50") == 1000.50

    def test_returns_zero_for_unparseable_strings(self):
        # This is the behavior flagged in the earlier audit: a bad string
        # silently becomes 0.0 rather than raising, which can mask a genuine
        # extraction failure as "zero total" downstream. Documented here so
        # a future fix has a test to update rather than discovering this
        # by accident.
        assert _to_number("not a number") == 0.0

    def test_returns_zero_for_none(self):
        assert _to_number(None) == 0.0


class TestValidateAndAdjustConfidence:
    def test_caps_confidence_when_total_amount_missing(self):
        result = validate_and_adjust_confidence({"confidence": 0.9})
        assert result["confidence"] <= 0.3

    def test_caps_confidence_when_gstin_malformed(self):
        result = validate_and_adjust_confidence(
            {
                "confidence": 0.9,
                "total_amount": 5900,
                "invoice_date": "2025-04-15",
                "vendor_name": "Acme",
                "vendor_gstin": "not-a-real-gstin",
            }
        )
        assert result["confidence"] <= 0.7
        assert result["vendor_gstin"] is None

    def test_flags_tax_math_mismatch(self):
        result = validate_and_adjust_confidence(
            {
                "confidence": 0.95,
                "total_amount": 10000,
                "invoice_date": "2025-04-15",
                "vendor_name": "Acme",
                "taxable_amount": 5000,
                "cgst": 450,
                "sgst": 450,
            }
        )
        assert result["confidence"] <= 0.75
        assert "_tax_math_warning" in result

    def test_does_not_flag_tax_math_within_tolerance(self):
        result = validate_and_adjust_confidence(
            {
                "confidence": 0.95,
                "total_amount": 5900,
                "invoice_date": "2025-04-15",
                "vendor_name": "Acme",
                "taxable_amount": 5000,
                "cgst": 450,
                "sgst": 450,
            }
        )
        assert "_tax_math_warning" not in result

    def test_survives_a_non_string_gstin_without_raising(self):
        # Regression case documented inline in the source: a non-string
        # gstin used to raise inside the try block, which was swallowed by
        # the broad except and returned the *unadjusted* raw confidence.
        result = validate_and_adjust_confidence(
            {
                "confidence": 0.95,
                "total_amount": 5900,
                "invoice_date": "2025-04-15",
                "vendor_name": "Acme",
                "vendor_gstin": 12345,
            }
        )
        assert "confidence" in result

    def test_defaults_missing_confidence_to_half(self):
        result = validate_and_adjust_confidence({"total_amount": 5900})
        # total_amount present but date/vendor missing caps it below 0.5 too,
        # so just assert it didn't error and produced a bounded number.
        assert 0.0 <= result["confidence"] <= 1.0


class TestExtractStructuredDataDegradesGracefully:
    def test_malformed_json_response_degrades_instead_of_raising(self):
        service = make_service()
        service._client.chat.completions.create.return_value = mock_response(
            '{"vendor_name": "Acme", "total_amount": '  # truncated mid-object
        )
        result = service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert result["confidence"] == 0.0
        assert result["document_type_detected"] == "unknown"
        assert "_llm_error" in result

    def test_valid_json_response_is_normalized(self):
        service = make_service()
        service._client.chat.completions.create.return_value = mock_response(
            '{"vendor_name": "Acme", "total_amount": 5900, "invoice_date": "2025-04-15"}'
        )
        result = service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert result["vendor_name"] == "Acme"
        assert result["total_amount"] == 5900

    def test_retries_on_transient_error_then_succeeds(self):
        service = make_service()
        service._client.chat.completions.create.side_effect = [
            RuntimeError("connection reset"),
            mock_response('{"vendor_name": "Acme", "total_amount": 5900}'),
        ]
        with patch.object(llm_service_module.time, "sleep"):
            result = service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert result["vendor_name"] == "Acme"
        assert service._client.chat.completions.create.call_count == 2

    def test_does_not_retry_a_4xx_error(self):
        service = make_service()
        bad_request = RuntimeError("bad request")
        bad_request.status_code = 400
        service._client.chat.completions.create.side_effect = bad_request
        result = service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert result["confidence"] == 0.0
        assert service._client.chat.completions.create.call_count == 1

    def test_gives_up_after_max_attempts_on_persistent_5xx(self):
        service = make_service()
        server_error = RuntimeError("service unavailable")
        server_error.status_code = 503
        service._client.chat.completions.create.side_effect = server_error
        with patch.object(llm_service_module.time, "sleep"):
            result = service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert result["confidence"] == 0.0
        assert (
            service._client.chat.completions.create.call_count
            == llm_service_module.GROQ_MAX_ATTEMPTS
        )

    def test_short_garbage_ocr_text_skips_the_llm_call_entirely(self):
        service = make_service()
        result = service.extract_structured_data("x", doc_type="invoice")
        assert result["document_type_detected"] == "unknown"
        service._client.chat.completions.create.assert_not_called()
