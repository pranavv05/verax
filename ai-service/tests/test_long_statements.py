"""Long bank statements: read in full from the PDF's text layer, and
extracted a few pages per LLM call so no single response overflows."""

import json
from unittest.mock import MagicMock, patch

import fitz
import numpy as np
import cv2
import pytest

from app.services import llm_service as llm_service_module
from app.services.llm_service import (
    BANK_CHUNK_MAX_CHARS,
    BANK_MAX_OUTPUT_TOKENS,
    BANK_STATEMENT_PROMPT,
    BANK_TRANSACTIONS_PROMPT,
    LLMService,
    _retry_delay_seconds,
    chunk_pages,
    split_into_pages,
)
from app.services.preprocess_service import MAX_TEXT_LAYER_PAGES, PreprocessService


def _digital_pdf(page_count: int) -> bytes:
    doc = fitz.open()
    for page_number in range(1, page_count + 1):
        page = doc.new_page()
        page.insert_text(
            (72, 72),
            f"HDFC BANK Statement page {page_number}\n"
            f"0{page_number % 9 + 1}/04/2026  UPI/PAYTM/{page_number}  1,250.00  98,400.00",
        )
    data = doc.tobytes()
    doc.close()
    return data


def _scanned_pdf(page_count: int) -> bytes:
    """Pages that are images only: no text layer, like a phone scan."""
    img = np.full((400, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "SCANNED", (20, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    ok, png = cv2.imencode(".png", img)
    assert ok
    doc = fitz.open()
    for _ in range(page_count):
        page = doc.new_page()
        page.insert_image(page.rect, stream=png.tobytes())
    data = doc.tobytes()
    doc.close()
    return data


class TestTextLayer:
    def test_reads_every_page_of_a_long_digital_statement(self):
        out = PreprocessService().extract_text_layer(_digital_pdf(60))
        assert out is not None
        assert out.total_pages == 60
        assert len(out.page_texts) == 60
        assert out.truncated is False
        assert "page 60" in out.page_texts[59]

    def test_scanned_pdf_has_no_text_layer(self):
        assert PreprocessService().extract_text_layer(_scanned_pdf(2)) is None

    def test_an_image_has_no_text_layer(self):
        ok, png = cv2.imencode(".png", np.full((50, 50, 3), 255, dtype=np.uint8))
        assert PreprocessService().extract_text_layer(png.tobytes()) is None

    def test_flags_a_statement_longer_than_the_text_layer_cap(self):
        with patch("app.services.preprocess_service.MAX_TEXT_LAYER_PAGES", 5):
            out = PreprocessService().extract_text_layer(_digital_pdf(7))
        assert out.truncated is True
        assert len(out.page_texts) == 5
        assert MAX_TEXT_LAYER_PAGES >= 100


class TestChunking:
    def test_split_into_pages_undoes_the_ocr_page_markers(self):
        text = "\n--- PAGE 1 ---\n\nfirst\n\n--- PAGE 2 ---\n\nsecond"
        assert split_into_pages(text) == ["first", "second"]

    def test_text_without_markers_is_one_page(self):
        assert split_into_pages("just one page") == ["just one page"]

    def test_groups_small_pages_and_keeps_chunks_under_the_limit(self):
        pages = [f"page {n} " + "x" * 3000 for n in range(10)]
        chunks = chunk_pages(pages, max_chars=8000)
        assert len(chunks) == 5
        assert all(len(chunk) <= 8000 for chunk in chunks)
        joined = "".join(chunks)
        assert all(f"page {n} " in joined for n in range(10))

    def test_splits_an_oversized_page_on_line_boundaries(self):
        page = "\n".join(f"01/04/2026 TXN {n} 100.00" for n in range(1000))
        chunks = chunk_pages([page], max_chars=2000)
        assert len(chunks) > 1
        assert all(len(chunk) <= 2000 for chunk in chunks)
        assert sum(chunk.count("TXN") for chunk in chunks) == 1000


def _txn(n):
    return {"date": "2026-04-01", "narration": f"TXN {n}", "debit": 10, "credit": None, "balance": 100, "reference": None}


def _response(payload: dict):
    response = MagicMock()
    response.choices = [MagicMock(message=MagicMock(content=json.dumps(payload)))]
    return response


def _service():
    with patch.object(llm_service_module, "Groq") as groq_cls:
        groq_cls.return_value = MagicMock()
        return LLMService()


class TestChunkedBankExtraction:
    def test_merges_transactions_from_every_chunk_in_order(self):
        service = _service()
        service._client.chat.completions.create.side_effect = [
            _response({
                "account_holder": "Kumar & Sons",
                "account_number": "5010",
                "bank_name": "HDFC",
                "opening_balance": 1000,
                "closing_balance": None,
                "statement_period_to": None,
                "transactions": [_txn(1), _txn(2)],
            }),
            _response({"transactions": [_txn(3)]}),
            _response({"transactions": [_txn(4)], "closing_balance": 555, "statement_period_to": "2026-04-30"}),
        ]
        pages = ["a" * (BANK_CHUNK_MAX_CHARS - 10)] * 3

        result = service.extract_structured_data("", doc_type="bank_statement", page_texts=pages)

        assert [t["narration"] for t in result["transactions"]] == ["TXN 1", "TXN 2", "TXN 3", "TXN 4"]
        assert result["account_holder"] == "Kumar & Sons"
        assert result["opening_balance"] == 1000
        assert result["closing_balance"] == 555
        assert result["statement_period_to"] == "2026-04-30"

        calls = service._client.chat.completions.create.call_args_list
        assert len(calls) == 3
        assert calls[0].kwargs["messages"][1]["content"].startswith(BANK_STATEMENT_PROMPT)
        assert calls[1].kwargs["messages"][1]["content"].startswith(BANK_TRANSACTIONS_PROMPT)
        assert all(call.kwargs["max_tokens"] == BANK_MAX_OUTPUT_TOKENS for call in calls)

    def test_a_short_statement_is_one_call(self):
        service = _service()
        service._client.chat.completions.create.return_value = _response({"transactions": [_txn(1)]})

        result = service.extract_structured_data("01/04 UPI 100", doc_type="bank_statement")

        assert service._client.chat.completions.create.call_count == 1
        assert len(result["transactions"]) == 1

    def test_ocr_text_is_split_on_page_markers(self):
        service = _service()
        service._client.chat.completions.create.return_value = _response({"transactions": []})
        big_page = "x" * (BANK_CHUNK_MAX_CHARS - 100)
        text = f"--- PAGE 1 ---\n{big_page}\n--- PAGE 2 ---\n{big_page}"

        service.extract_structured_data(text, doc_type="bank_statement")

        assert service._client.chat.completions.create.call_count == 2


class TestBankStatementTotalsCheck:
    """Opening/closing balances survive a run that drops rows, so the
    transactions are replayed against them before the result is trusted."""

    def _extract(self, payload):
        service = _service()
        service._client.chat.completions.create.return_value = _response(payload)
        result = service.extract_structured_data("01/04 UPI 100", doc_type="bank_statement")
        return result, service.calculate_confidence(result, doc_type="bank_statement")

    def test_transactions_that_add_up_pass(self):
        result, confidence = self._extract({
            "account_holder": "Kumar & Sons",
            "account_number": "5010",
            "bank_name": "HDFC",
            "ifsc_code": "HDFC0000123",
            "statement_period_from": "2026-04-01",
            "statement_period_to": "2026-04-30",
            "opening_balance": "1,000.00",
            "closing_balance": 1180,
            "transactions": [
                {"date": "2026-04-01", "narration": "NEFT IN", "debit": None, "credit": "200.00"},
                {"date": "2026-04-02", "narration": "UPI OUT", "debit": 20, "credit": None},
            ],
        })
        assert "_transactions_warning" not in result
        assert confidence > 0.3

    def test_no_transactions_forces_review(self):
        result, confidence = self._extract(
            {"account_holder": "Kumar & Sons", "opening_balance": 1000, "closing_balance": 5000, "transactions": []}
        )
        assert "No transactions were read" in result["_transactions_warning"]
        assert confidence == 0.3

    def test_missing_rows_force_review(self):
        result, confidence = self._extract(
            {"opening_balance": 1000, "closing_balance": 5000, "transactions": [_txn(1), _txn(2)]}
        )
        assert "don't add up" in result["_transactions_warning"]
        assert "980.00" in result["_transactions_warning"]
        assert confidence == 0.3


class TestRetryDelay:
    def _rate_limited(self, retry_after):
        error = RuntimeError("rate limited")
        error.status_code = 429
        error.response = MagicMock(headers={"retry-after": retry_after})
        return error

    def test_honours_retry_after_on_429(self):
        assert _retry_delay_seconds(self._rate_limited("17"), attempt=1) == 17

    def test_caps_a_long_retry_after(self):
        assert _retry_delay_seconds(self._rate_limited("600"), attempt=1) == 60

    @pytest.mark.parametrize("error", [RuntimeError("reset"), None])
    def test_falls_back_to_linear_backoff(self, error):
        err = error or self._rate_limited("not-a-number")
        assert _retry_delay_seconds(err, attempt=2) == 4
