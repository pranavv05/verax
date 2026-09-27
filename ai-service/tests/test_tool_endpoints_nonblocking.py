"""The /tools endpoints must never run their heavy work on the event loop.

The service runs a single uvicorn worker. When the bank-statement conversion
(pdfplumber/OCR plus a Groq call per narration) ran inside an ``async def``
handler, one conversion froze /health and every /process request until it
finished — long enough for the platform to restart the service mid-job.

Each test swaps the heavy function for a probe that fails if it is called
with a running event loop in its thread, i.e. on the loop rather than on the
thread pool.
"""
from __future__ import annotations

import asyncio
import importlib
import sys
from unittest.mock import MagicMock

import pytest

# CI installs a light dependency set (no OCR/PDF/DB/AWS libraries). The
# endpoints under test never touch them, so stand in for any that are missing.
for _name in (
    "paddleocr",
    "PIL",
    "pytesseract",
    "pdfplumber",
    "pdf2image",
    "psycopg2",
    "psycopg2.extras",
    "boto3",
    "botocore",
    "botocore.config",
    "pandas",
    "openpyxl",
    "openpyxl.styles",
    "openpyxl.utils",
):
    try:
        importlib.import_module(_name)
    except Exception:  # pragma: no cover - depends on the environment
        sys.modules[_name] = MagicMock()

from fastapi.testclient import TestClient  # noqa: E402

from app import main  # noqa: E402
from app.config import settings  # noqa: E402

HEADERS = {"X-AI-Service-Token": settings.ai_service_api_key}


def _off_loop(result):
    def probe(*_args, **_kwargs):
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return result
        raise AssertionError("blocking work ran on the event loop thread")

    return probe


@pytest.fixture()
def client():
    # No `with` block: startup (OCR/LLM/DB clients) is not needed here.
    return TestClient(main.app)


def test_bank_statement_conversion_runs_off_the_event_loop(client, monkeypatch):
    monkeypatch.setattr(main, "bank_statement_to_xml", _off_loop({"transactions": [], "warnings": []}))

    response = client.post(
        "/tools/bank-statement-xml",
        headers=HEADERS,
        files={"file": ("statement.pdf", b"%PDF-1.4 test", "application/pdf")},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"transactions": [], "warnings": []}


def test_register_cleaning_runs_off_the_event_loop(client, monkeypatch):
    monkeypatch.setattr(main, "clean_register_bytes", _off_loop(b"cleaned"))

    response = client.post(
        "/tools/register-clean",
        headers=HEADERS,
        files={
            "file": (
                "register.xlsx",
                b"not really excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200, response.text
    assert response.content == b"cleaned"


def test_bank_statement_export_runs_off_the_event_loop(client, monkeypatch):
    monkeypatch.setattr(main, "generate_xml_with_ledgers", _off_loop(("<ENVELOPE/>", 1)))

    response = client.post(
        "/tools/bank-statement-xml/export",
        headers=HEADERS,
        json={
            "transactions": [
                {
                    "narration": "NEFT ACME TRADING",
                    "debit": 0,
                    "credit": 49560,
                    "tallyDate": "20260317",
                    "ledgerName": "ACME Trading Co.",
                }
            ],
            "company_name": "Mehta Packaging",
            "bank_ledger": "HDFC Bank",
        },
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"xml": "<ENVELOPE/>", "voucherCount": 1}
