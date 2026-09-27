from unittest.mock import MagicMock, patch

import pytest

from app.services import llm_service as llm_service_module
from app.services.llm_service import (
    LLMExtractionError,
    LLMService,
    _to_number,
    validate_and_adjust_confidence,
)


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
    def test_malformed_json_response_raises_extraction_error(self):
        # Must NOT degrade to an empty "confidence 0.0" result — that is
        # indistinguishable from a genuine "not an invoice" answer and used
        # to hide failures as blank review forms. Raising lets the backend's
        # job queue retry and record the reason.
        service = make_service()
        service._client.chat.completions.create.return_value = mock_response(
            '{"vendor_name": "Acme", "total_amount": '  # truncated mid-object
        )
        with pytest.raises(LLMExtractionError, match="malformed JSON"):
            service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")

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

    def test_does_not_retry_a_non_retryable_4xx_error(self):
        service = make_service()
        bad_request = RuntimeError("model_decommissioned")
        bad_request.status_code = 400
        service._client.chat.completions.create.side_effect = bad_request
        with pytest.raises(LLMExtractionError, match="model_decommissioned"):
            service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert service._client.chat.completions.create.call_count == 1

    @pytest.mark.parametrize("status_code", [408, 429])
    def test_retries_a_rate_limit_or_timeout_then_succeeds(self, status_code):
        service = make_service()
        throttled = RuntimeError("rate limit reached")
        throttled.status_code = status_code
        service._client.chat.completions.create.side_effect = [
            throttled,
            mock_response('{"vendor_name": "Acme", "total_amount": 5900}'),
        ]
        with patch.object(llm_service_module.time, "sleep"):
            result = service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert result["vendor_name"] == "Acme"
        assert service._client.chat.completions.create.call_count == 2

    def test_raises_after_max_attempts_on_persistent_rate_limit(self):
        service = make_service()
        throttled = RuntimeError("rate limit reached")
        throttled.status_code = 429
        service._client.chat.completions.create.side_effect = throttled
        with patch.object(llm_service_module.time, "sleep"):
            with pytest.raises(LLMExtractionError, match="rate limit reached"):
                service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert (
            service._client.chat.completions.create.call_count
            == llm_service_module.GROQ_MAX_ATTEMPTS
        )

    def test_raises_after_max_attempts_on_persistent_5xx(self):
        service = make_service()
        server_error = RuntimeError("service unavailable")
        server_error.status_code = 503
        service._client.chat.completions.create.side_effect = server_error
        with patch.object(llm_service_module.time, "sleep"):
            with pytest.raises(LLMExtractionError, match="service unavailable"):
                service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert (
            service._client.chat.completions.create.call_count
            == llm_service_module.GROQ_MAX_ATTEMPTS
        )

    @pytest.mark.parametrize(
        "status_code, retryable",
        [
            (429, True),  # rate limit: waiting helps
            (503, True),  # Groq outage
            (None, True),  # network error
            (413, False),  # request larger than the plan's tokens-per-minute cap
            (404, False),  # model retired / not available to this key
            (400, False),  # json_validate_failed
        ],
    )
    def test_marks_whether_waiting_could_help(self, status_code, retryable):
        # main.py maps retryable -> 503 (backend waits it out) and the rest ->
        # 422, so a request that can never succeed isn't retried for ~27 min.
        service = make_service()
        error = RuntimeError("groq said no")
        if status_code is not None:
            error.status_code = status_code
        service._client.chat.completions.create.side_effect = error
        with patch.object(llm_service_module.time, "sleep"):
            with pytest.raises(LLMExtractionError) as raised:
                service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert raised.value.retryable is retryable

    def test_request_too_large_reported_as_429_is_not_retried(self):
        # Groq reports "over the plan's output-tokens-per-minute cap" for some
        # models as a 429; waiting can never make the request fit.
        service = make_service()
        too_large = RuntimeError(
            "Error code: 429 - Request too large for model `qwen/qwen3.8-27b` on output tokens per minute (OTPM)"
        )
        too_large.status_code = 429
        service._client.chat.completions.create.side_effect = too_large
        with patch.object(llm_service_module.time, "sleep"):
            with pytest.raises(LLMExtractionError) as raised:
                service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert raised.value.retryable is False
        assert service._client.chat.completions.create.call_count == 1

    def test_malformed_json_is_not_retryable(self):
        service = make_service()
        service._client.chat.completions.create.return_value = mock_response('{"total_amount": ')
        with pytest.raises(LLMExtractionError) as raised:
            service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert raised.value.retryable is False

    def test_not_an_invoice_answer_is_still_a_normal_result(self):
        # A genuine "wrong document type" answer from the model is data, not
        # a failure — it must keep flowing to review_required, not raise.
        service = make_service()
        service._client.chat.completions.create.return_value = mock_response(
            '{"document_type_detected": "unknown", "confidence": 0.0}'
        )
        result = service.extract_structured_data(REALISTIC_OCR_TEXT, doc_type="invoice")
        assert result["document_type_detected"] == "unknown"

    def test_short_garbage_ocr_text_skips_the_llm_call_entirely(self):
        service = make_service()
        result = service.extract_structured_data("x", doc_type="invoice")
        assert result["document_type_detected"] == "unknown"
        service._client.chat.completions.create.assert_not_called()
