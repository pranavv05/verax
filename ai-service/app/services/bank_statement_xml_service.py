from __future__ import annotations

import glob
import io
import logging
import os
import re
import xml.dom.minidom
import xml.etree.ElementTree as ET
from typing import Any
from typing import Callable

import cv2
import numpy as np
import pandas as pd
import pdfplumber
import pytesseract
from fastapi import HTTPException
from groq import Groq
from pdf2image import convert_from_bytes

from app.config import settings
from app.services.ocr_service import get_paddle_ocr
from app.services.preprocess_service import PreprocessService
from app.utils.json_parser import parse_json_object

logger = logging.getLogger(__name__)

# Statements from HDFC/SBI/ICICI net banking are drawn with real ruling lines, so the
# column separators are in the PDF itself. Using them ("lines") keeps every cell aligned
# with the header; deriving rows from text baselines keeps one statement line per row.
# The generous intersection tolerance matters: without it the right-hand balance column,
# whose border only meets the row edges approximately, gets dropped.
LINE_TABLE_SETTINGS = {
    "vertical_strategy": "lines",
    "horizontal_strategy": "text",
    "intersection_tolerance": 10,
    "snap_tolerance": 5,
}
# Fallback for statements with no ruling lines at all — column boundaries are guessed
# from where the text happens to line up, which is unreliable but better than nothing.
TABLE_SETTINGS = {"vertical_strategy": "text", "horizontal_strategy": "text"}

# Columns that exist in the statement but must never be mistaken for the date or the
# narration: the cheque/reference number and the value date duplicate information we
# already take from the Date and Narration columns.
SKIP_COLUMN_KEYWORDS = [
    "chq ref no",
    "chq ref",
    "ref no",
    "cheque no",
    "chq no",
    "instrument no",
    "value dt",
    "value date",
    "serial no",
    "sr no",
    "sl no",
]

# Two or more of these in one header row means the table is the statement summary
# (HDFC prints it on its own final page), not a list of transactions.
SUMMARY_INDICATORS = [
    "opening balance",
    "dr count",
    "cr count",
    "closing bal",
    "total debits",
    "total credits",
    "brought forward",
    "carried forward",
    "statement summary",
]

# Page furniture that repeats on every page: bank address block, footers, disclaimers.
# Matched against text with all spaces removed, because this PDF (and many bank PDFs)
# emit "AccountBranch" and "HDFCBANKLIMITED" with no spaces at all.
NOISE_PATTERNS = [
    "accountbranch",
    "accountno",
    "accountstatus",
    "accounttype",
    "acopendate",
    "banklimited",
    "branchcode",
    "closingbalanceincludes",
    "computergenerated",
    "contentsofthisstatement",
    "crcount",
    "custid",
    "drcount",
    "generatedby",
    "generatedon",
    "gstinnumber",
    "jointholders",
    "neftifsc",
    "nomination",
    "notrequiresignature",
    "odlimit",
    "openingbalance",
    "pageno",
    "phoneno",
    "registeredoffice",
    "requestingbranch",
    "stateaccountbranch",
    "statementofaccount",
]

# Keyword lists are ordered by preference: the earlier a keyword matches, the
# stronger the claim on that column. This lets "Date" beat "Value Dt" (HDFC) and
# "Description" beat "Ref No./Cheque No." (SBI) when both appear in one header row.
DATE_KEYWORDS = [
    "txn date",
    "transaction date",
    "tran date",
    "posting date",
    "date",
    "value date",
    "value dt",
    "dt",
]
NARRATION_KEYWORDS = [
    "narration",
    "description",
    "particulars",
    "transaction details",
    "details",
    "remarks",
    "reference",
    "ref",
    "cheque",
    "chq",
]
DEBIT_KEYWORDS = [
    "withdrawal amt",
    "withdrawal amount",
    "debit amt",
    "debit amount",
    "withdrawal",
    "withdrawals",
    "debit",
    "debits",
    "dr",
    "wdl",
]
CREDIT_KEYWORDS = [
    "deposit amt",
    "deposit amount",
    "credit amt",
    "credit amount",
    "deposit",
    "deposits",
    "credit",
    "credits",
    "cr",
]
BALANCE_KEYWORDS = [
    "closing balance",
    "closing bal",
    "running balance",
    "available balance",
    "balance",
    "bal",
]

# Ordered: earlier fields win when a single header could satisfy two of them.
FIELD_KEYWORDS: dict[str, list[str]] = {
    "date": DATE_KEYWORDS,
    "narration": NARRATION_KEYWORDS,
    "debit": DEBIT_KEYWORDS,
    "credit": CREDIT_KEYWORDS,
    "balance": BALANCE_KEYWORDS,
}

UNPARSEABLE_DETAIL = (
    "Could not parse this bank statement format. Headers found: {headers}. "
    "Supported: HDFC, SBI standard formats."
)

# Unambiguous summary phrases — safe to match anywhere in a narration.
SKIP_NARRATIONS = [
    "opening balance",
    "closing balance",
    "brought forward",
    "carried forward",
    "subtotal",
    "sub total",
    "grand total",
    "account summary",
    "statement summary",
    "statement period",
    "available balance",
    "ledger balance",
]
# "total" on its own is a real word in merchant names ("UPI-TOTAL FITNESS"), so it only
# counts as a summary marker when the narration starts with it.
SKIP_NARRATION_PREFIXES = ["total", "b/f", "c/f"]

CREDIT_TEXT_KEYWORDS = [
    "credit",
    " cr",
    "neft in",
    "neft cr",
    "imps in",
    "upi cr",
    "by transfer",
    "by salary",
    "by interest",
    "salary",
    "interest",
    "refund",
    "deposit",
]
DEBIT_TEXT_KEYWORDS = [
    "debit",
    " dr",
    "neft out",
    "imps out",
    "upi dr",
    "to transfer",
    "to cheque",
    "atm",
    "withdrawal",
    "payment",
    "purchase",
    "wdl",
]

# "01/04/2024", "01-04-24" or "01 Apr 2024" / "01-Apr-2024" / "01 April 2024".
# The month must be a real month name, otherwise narrations like "...5678-RENT 4098"
# get read as dates and their digits are lost.
MONTH_NAMES = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec"
DATE_RE = re.compile(
    r"(?<!\d)\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}(?!\d)"
    rf"|(?<![A-Za-z0-9])\d{{1,2}}[\s\-\/](?:{MONTH_NAMES})[a-z]*[\s\-\/]\d{{2,4}}(?!\d)",
    re.IGNORECASE,
)
# Decimal amounts ("1234.00", "1,23,456.78") or comma-grouped integers ("1,250").
# Deliberately excludes bare integers so cheque/reference numbers are not read as money.
AMOUNT_RE = re.compile(
    r"(?<![\d.,])\d[\d,]*\.\d{1,2}(?![\d])"
    r"|(?<![\d.,])\d{1,3}(?:,\d{2,3})+(?![\d,])"
)
# Retry pattern for statements that print whole-rupee amounts with no separators.
AMOUNT_LOOSE_RE = re.compile(r"(?<![\d.,\/\-])\d{1,9}(?:\.\d{1,2})?(?![\d.,\/\-])")

# Ledger categories the classifier is allowed to return. A response outside this set
# is coerced to "Miscellaneous" rather than trusted verbatim, since the LLM otherwise
# occasionally invents plausible-sounding but unusable category names.
LEDGER_CATEGORIES = [
    "Food & Beverage",
    "Travel & Conveyance",
    "Office Supplies",
    "Utilities",
    "Salary",
    "Loan Repayment",
    "Credit Card Payment",
    "UPI Refund",
    "Bank Charges",
    "Miscellaneous",
]

CLASSIFICATION_SYSTEM_PROMPT = """You are an Indian CA firm's accounting assistant.
Classify each bank transaction narration into a TallyPrime ledger category.

Common Indian ledger categories:
- Food & Beverage (restaurants, food delivery, Swiggy, Zomato, Dominos)
- Travel & Conveyance (Ola, Uber, IRCTC, flights, fuel)
- Office Supplies (stationery, vending machines)
- Utilities (electricity, internet, Airtel, Jio)
- Salary (salary payments, staff payments)
- Loan Repayment (EMI, loan payments)
- Credit Card Payment (CRED, credit card bills)
- UPI Refund (UPIRET transactions)
- Bank Charges (bank fees, charges)
- Miscellaneous (anything that doesn't fit)

For each narration return:
- suggested_ledger: the category name
- confidence: 0.0 to 1.0
- reason: one line explanation

Return ONLY a JSON object of the form
{"classifications": [{"narration": "<narration exactly as given>", "suggested_ledger": "...", "confidence": 0.0, "reason": "..."}]}
with exactly one entry per input narration, in the same order they were given."""

_DEFAULT_CLASSIFICATION = {
    "suggested_ledger": "Miscellaneous",
    "confidence": 0.0,
    "reason": "AI classification unavailable",
}


def _normalize_classification(item: Any) -> dict[str, Any]:
    if not isinstance(item, dict):
        return dict(_DEFAULT_CLASSIFICATION)

    ledger = str(item.get("suggested_ledger") or "").strip()
    if ledger not in LEDGER_CATEGORIES:
        ledger = "Miscellaneous"

    try:
        confidence = float(item.get("confidence"))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    reason = str(item.get("reason") or "").strip() or "No reason provided"

    return {"suggested_ledger": ledger, "confidence": round(confidence, 4), "reason": reason}


def classify_narrations(narrations: list[str]) -> list[dict[str, Any]]:
    """Classify a batch of bank narrations into TallyPrime ledger categories via Groq.

    One request covers the whole statement — narrations are cheap, single-line
    strings, so batching keeps this to one LLM call per document instead of one
    per row. On any failure (timeout, bad JSON, API error) every narration in the
    batch falls back to "Miscellaneous" at 0 confidence rather than raising, since
    a classification failure must never block the underlying XML export.
    """
    if not narrations:
        return []

    numbered = "\n".join(f"{index + 1}. {narration}" for index, narration in enumerate(narrations))
    user_content = (
        f"Classify these {len(narrations)} bank transaction narration(s):\n\n{numbered}"
    )

    try:
        client = Groq(api_key=settings.groq_api_key)
        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            messages=[
                {"role": "system", "content": CLASSIFICATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.1,
            max_tokens=4096,
            timeout=settings.llm_timeout_seconds,
            response_format={"type": "json_object"},
        )
        raw_output = response.choices[0].message.content or ""
        parsed = parse_json_object(raw_output)
        classifications = parsed.get("classifications")
        if not isinstance(classifications, list):
            raise ValueError("Expected a 'classifications' array in the LLM response")
    except Exception as error:  # noqa: BLE001
        logger.error("Narration classification failed: %s", error)
        return [dict(_DEFAULT_CLASSIFICATION) for _ in narrations]

    results: list[dict[str, Any]] = []
    for index in range(len(narrations)):
        item = classifications[index] if index < len(classifications) else None
        results.append(_normalize_classification(item))
    return results


POPPLER_CANDIDATES = [
    r"C:\Program Files\poppler\Library\bin",
    r"C:\Program Files (x86)\poppler\Library\bin",
    r"C:\poppler\Library\bin",
    r"C:\Users\PranavVatsa\AppData\Local\Programs\poppler\Library\bin",
]
# Versioned layouts from the standard Windows poppler releases, e.g.
# C:\poppler-24.08.0\Library\bin or C:\Program Files\poppler-23.11.0\Library\bin
POPPLER_GLOBS = [
    r"C:\Program Files\poppler*\Library\bin",
    r"C:\Program Files (x86)\poppler*\Library\bin",
    r"C:\poppler*\Library\bin",
    r"C:\Users\*\AppData\Local\Programs\poppler*\Library\bin",
    r"C:\tools\poppler*\Library\bin",
]


def get_poppler_path() -> str | None:
    """Locate the poppler bin directory, or None to fall back to PATH (Linux/Docker)."""
    env_path = os.environ.get("POPPLER_PATH")
    if env_path and os.path.exists(env_path):
        return env_path

    for path in POPPLER_CANDIDATES:
        if os.path.exists(path):
            return path

    for pattern in POPPLER_GLOBS:
        for match in sorted(glob.glob(pattern), reverse=True):
            if os.path.isdir(match):
                return match

    return None


def _clean_cell(value: Any) -> str:
    return str(value).replace("\n", " ").strip() if value is not None else ""


def _squash(value: Any) -> str:
    """Lowercase and drop everything that is not a letter or digit.

    Many bank PDFs emit text with no spaces between words ("ClosingBalance",
    "HDFCBANKLIMITED"), so matching has to ignore whitespace and punctuation.
    """
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _parse_amount(value: Any) -> float:
    """Parse an Indian-formatted amount: 85,380.32 / 1,00,000.00 / (1,234.00) / 500 Dr."""
    if value is None:
        return 0.0
    text = str(value).strip()
    if text in ("", "-", "nan", "None", "NaN"):
        return 0.0

    negative = (text.startswith("(") and text.endswith(")")) or text.endswith("-")
    match = re.search(r"\d[\d,]*(?:\.\d+)?", text)
    if not match:
        return 0.0
    try:
        amount = float(match.group(0).replace(",", ""))
    except ValueError:
        return 0.0
    return -amount if negative else amount


def _non_empty_count(values: list[Any]) -> int:
    return sum(1 for value in values if str(value or "").strip())


def _is_summary_narration(narration: str) -> bool:
    lower = narration.lower().strip()
    if any(lower.startswith(prefix) for prefix in SKIP_NARRATION_PREFIXES):
        return True
    return any(keyword in lower for keyword in SKIP_NARRATIONS)


def is_summary_table(headers: list[Any]) -> bool:
    """True when a header row belongs to the statement summary block, not transactions.

    HDFC's final page carries "Opening Balance | Dr Count | Cr Count | Debits |
    Credits | Closing Bal" — the totals, which must never become vouchers.
    """
    joined = "|".join(_squash(header) for header in headers)
    matches = sum(1 for indicator in SUMMARY_INDICATORS if _squash(indicator) in joined)
    return matches >= 2


def _is_noise_row(cells: list[str]) -> bool:
    """True for repeated page furniture: address block, footers, disclaimers."""
    squashed = _squash(" ".join(cells))
    if not squashed:
        return True
    return any(pattern in squashed for pattern in NOISE_PATTERNS)


def _parse_date(value: Any):
    """Return a Timestamp for a cell that holds a date, else None."""
    text = _clean_cell(value)
    if not text:
        return None
    match = DATE_RE.search(text)
    if not match:
        return None
    parsed = pd.to_datetime(match.group(0), errors="coerce", dayfirst=True)
    return None if pd.isna(parsed) else parsed


def _open_pdf(pdf_bytes: bytes):
    try:
        return pdfplumber.open(io.BytesIO(pdf_bytes))
    except Exception as error:
        error_msg = str(error).lower()
        if "password" in error_msg or "encrypted" in error_msg:
            raise HTTPException(
                status_code=422,
                detail="This PDF is password protected. Please remove the password and re-upload.",
            ) from error
        raise HTTPException(status_code=422, detail=f"Could not open PDF: {error}") from error


def _clean_table(table: list[list[Any]]) -> list[list[str]]:
    cleaned: list[list[str]] = []
    for row in table or []:
        cleaned_row = [_clean_cell(cell) for cell in row]
        if any(cleaned_row):
            cleaned.append(cleaned_row)
    return cleaned


def is_scanned_pdf(pdf) -> bool:
    """Scanned = the PDF carries no embedded text layer, so OCR is the only way in.

    A digital statement whose rows are aligned with whitespace rather than ruling
    lines still yields text, so text presence is checked before table structure.
    """
    for page in pdf.pages[:3]:
        text = (page.extract_text() or "").strip()
        if len(text) >= 100:
            return False
        tables = page.extract_tables()
        if not tables:
            continue
        for table in tables:
            rows = [row for row in table if any(cell for cell in row if cell)]
            if len(rows) > 3:
                return False
    return True


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    with _open_pdf(pdf_bytes) as pdf:
        return "\n".join((page.extract_text() or "") for page in pdf.pages).strip()


def _collect_tables(pdf, settings: dict[str, Any]) -> list[list[list[str]]]:
    raw_tables: list[list[list[str]]] = []
    for page_idx, page in enumerate(pdf.pages):
        try:
            tables = page.extract_tables(settings)
        except Exception as error:  # noqa: BLE001
            logger.warning("Table extraction failed on page %d: %s", page_idx + 1, error)
            continue

        kept = 0
        for table in tables:
            cleaned = _clean_table(table)
            if not cleaned:
                continue
            # Truncate at the statement-summary block so its totals never become rows.
            for row_index, row in enumerate(cleaned):
                if is_summary_table(row):
                    logger.info(
                        "Page %d: summary block found at row %d, ignoring the rest of the table",
                        page_idx + 1,
                        row_index,
                    )
                    cleaned = cleaned[:row_index]
                    break
            if cleaned:
                raw_tables.append(cleaned)
                kept += 1
        logger.info("Page %d/%d kept %d of %d table(s)", page_idx + 1, len(pdf.pages), kept, len(tables))
    return raw_tables


def _has_transaction_header(raw_tables: list[list[list[str]]]) -> bool:
    for table in raw_tables:
        for row in table:
            if _looks_like_header(row):
                mapping = _try_detect_columns(row)
                if "date" in mapping and "narration" in mapping:
                    return True
    return False


def _extract_tables_from_pdf(pdf_bytes: bytes) -> tuple[list[list[list[str]]], bool]:
    with _open_pdf(pdf_bytes) as pdf:
        if not pdf.pages:
            raise HTTPException(status_code=422, detail="PDF contains no pages.")
        if is_scanned_pdf(pdf):
            return [], True

        fallback: list[list[list[str]]] = []
        for label, settings in (("ruled", LINE_TABLE_SETTINGS), ("text-aligned", TABLE_SETTINGS)):
            raw_tables = _collect_tables(pdf, settings)
            if _has_transaction_header(raw_tables):
                logger.info("Using %s table strategy (%d table(s))", label, len(raw_tables))
                return raw_tables, False
            if len(raw_tables) > len(fallback):
                fallback = raw_tables
        logger.info("No transaction header under either strategy; keeping %d table(s)", len(fallback))
    return fallback, False


def _normalize_header(value: Any) -> str:
    """Lowercase, drop punctuation, collapse whitespace: 'Chq./Ref.No.' -> 'chq ref no'."""
    text = str(value or "").lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _keyword_match(normalized: str, squashed: str, keywords: list[str]) -> tuple[int, int, int] | None:
    """Best match for a header against a ranked keyword list.

    Returns (tier, rank, exactness). Tier 0 is a whole-word match on the spaced
    header ("withdrawal amt"); tier 1 is a substring match on the space-stripped
    header, which is what catches PDFs that render "WithdrawalAmt." as one token.
    Tier 1 ignores short keywords ("dr", "cr", "bal") — as substrings they fire on
    unrelated words like "des-cr-iption".
    """
    for rank, keyword in enumerate(keywords):
        if re.search(rf"\b{re.escape(keyword)}\b", normalized):
            return 0, rank, 0 if normalized == keyword else 1
    for rank, keyword in enumerate(keywords):
        squashed_keyword = _squash(keyword)
        if len(squashed_keyword) >= 4 and squashed_keyword in squashed:
            return 1, rank, 0 if squashed == squashed_keyword else 1
    return None


def _try_detect_columns(headers: list[str], allow_skipped: bool = False) -> dict[str, int]:
    """Map date/narration/debit/credit/balance onto column indices.

    Every header is scored against every field, then assignments are made
    best-score-first so each field and each column is used at most once. Reference
    and value-date columns are excluded unless `allow_skipped` is set, which is the
    retry for statements where those are the only date/description columns there are.
    """
    candidates: list[tuple[int, int, int, int, int, str]] = []
    for index, header in enumerate(headers):
        normalized = _normalize_header(header)
        squashed = _squash(header)
        if not normalized:
            continue
        if not allow_skipped and _keyword_match(normalized, squashed, SKIP_COLUMN_KEYWORDS):
            continue
        for priority, (field, keywords) in enumerate(FIELD_KEYWORDS.items()):
            match = _keyword_match(normalized, squashed, keywords)
            if match is not None:
                tier, rank, exactness = match
                candidates.append((tier, rank, exactness, priority, index, field))

    candidates.sort()
    result: dict[str, int] = {}
    used_columns: set[int] = set()
    for _tier, _rank, _exactness, _priority, index, field in candidates:
        if field in result or index in used_columns:
            continue
        result[field] = index
        used_columns.add(index)
    return result


def detect_columns(headers: list[str]) -> dict[str, int]:
    mapping = _try_detect_columns(headers)
    if "date" not in mapping or "narration" not in mapping:
        # Retry allowing "Chq./Ref.No." / "Value Dt" to stand in, for statements that
        # have nothing else to offer.
        mapping = _try_detect_columns(headers, allow_skipped=True)
    if "date" not in mapping or "narration" not in mapping:
        logger.warning("Headers found: %s", headers)
        raise HTTPException(
            status_code=422,
            detail=UNPARSEABLE_DETAIL.format(headers=_format_headers(headers)),
        )
    return mapping


def _format_headers(headers: list[str]) -> str:
    cleaned = [_clean_cell(header) for header in headers]
    labelled = [header for header in cleaned if header]
    return ", ".join(labelled) if labelled else "none"


def _looks_like_header(row: list[str]) -> bool:
    """A header row names at least two known columns and holds no dates or amounts."""
    if any(DATE_RE.search(cell) or AMOUNT_RE.search(cell) for cell in row):
        return False
    return len(_try_detect_columns(row)) >= 2


def _candidate_header_row(raw_tables: list[list[list[str]]]) -> list[str]:
    """Best guess at the row that was meant to be the header, for error reporting."""
    rows = [row for table in raw_tables for row in table if any(row)]
    if not rows:
        return []

    # Prefer whichever non-data row names the most known columns; earliest wins ties.
    label_rows = [
        (index, row)
        for index, row in enumerate(rows)
        if not any(DATE_RE.search(cell) or AMOUNT_RE.search(cell) for cell in row)
    ]
    if label_rows:
        best_score, _, best_row = max(
            (len(_try_detect_columns(row)), -index, row) for index, row in label_rows
        )
        if best_score > 0:
            return best_row

    # Nothing matched, so fall back to the row just above the first data row.
    for index, row in enumerate(rows):
        if any(DATE_RE.search(cell) or AMOUNT_RE.search(cell) for cell in row):
            return rows[index - 1] if index else row
    return rows[0]


def _merge_tables(raw_tables: list[list[list[str]]]) -> tuple[pd.DataFrame | None, list[str]]:
    """Merge every extracted table under one header row.

    Returns (None, candidate_headers) when no header row could be identified, so
    the caller can fall back to text parsing and report what it actually saw.
    """
    if not raw_tables:
        return None, []

    # Locate the header row once; every later page repeats it and is skipped.
    headers: list[str] | None = None
    header_table = 0
    header_row = 0
    for table_index, table in enumerate(raw_tables):
        for row_index, row in enumerate(table):
            if _looks_like_header(row):
                headers, header_table, header_row = row, table_index, row_index
                break
        if headers is not None:
            break

    if headers is None:
        return None, _candidate_header_row(raw_tables)

    target_cols = len(headers)
    merged_data: list[list[str]] = []
    for table_index, table in enumerate(raw_tables):
        width = max(len(row) for row in table)
        if width != target_cols:
            # A different shape means a different block — the address panel, the
            # summary, a footer — not a continuation of the transaction table.
            logger.info("Skipping %d-column table (transactions have %d)", width, target_cols)
            continue
        # Anything above the header row is page furniture, not transactions.
        start = header_row + 1 if table_index == header_table else 0
        for row in table[start:]:
            normalized = row[:target_cols] if len(row) > target_cols else row + [""] * (target_cols - len(row))
            if _looks_like_header(normalized) or is_summary_table(normalized):
                continue
            merged_data.append(normalized)

    return pd.DataFrame(merged_data, columns=headers), headers


def _assemble_transactions(
    df: pd.DataFrame,
    mapping: dict[str, int],
) -> tuple[list[dict[str, Any]], int]:
    """Fold wrapped narration rows into the transaction they belong to.

    A statement line whose date cell is empty is the continuation of the line above
    it — HDFC wraps long UPI narrations over as many as four rows. A new transaction
    starts only where a new date appears; a repeated date is still a new transaction,
    since several transactions a day is normal.
    """
    columns = list(df.columns)
    transactions: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    skipped_rows = 0

    for _, row in df.iterrows():
        cells = [_clean_cell(row.iloc[index]) for index in range(len(columns))]
        if not any(cells):
            continue
        if _is_noise_row(cells):
            skipped_rows += 1
            continue

        date_obj = _parse_date(cells[mapping["date"]])
        narration = cells[mapping["narration"]]
        debit = _parse_amount(cells[mapping["debit"]]) if "debit" in mapping else 0.0
        credit = _parse_amount(cells[mapping["credit"]]) if "credit" in mapping else 0.0
        balance = _parse_amount(cells[mapping["balance"]]) if "balance" in mapping else 0.0

        if date_obj is not None:
            if current is not None:
                transactions.append(current)
            current = {
                "date_raw": cells[mapping["date"]],
                "date_obj": date_obj,
                "narration": narration,
                "debit": debit,
                "credit": credit,
                "balance": balance,
                "row": len(transactions) + 1,
            }
            continue

        if current is None:
            # Content above the first transaction — the address block, usually.
            skipped_rows += 1
            continue

        if narration:
            current["narration"] = f"{current['narration']} {narration}".strip()
        # Statements occasionally print the amount on the wrapped line rather than
        # the first one; only fill in what is still missing.
        if current["debit"] == 0 and current["credit"] == 0:
            current["debit"] = debit
            current["credit"] = credit
        if not current["balance"]:
            current["balance"] = balance

    if current is not None:
        transactions.append(current)

    return transactions, skipped_rows


def _standardize(df: pd.DataFrame) -> tuple[pd.DataFrame, int, list[dict[str, Any]]]:
    columns = list(df.columns)
    mapping = detect_columns([str(col) for col in columns])
    logger.info(
        "Column mapping: %s",
        {field: str(columns[index]) for field, index in sorted(mapping.items(), key=lambda kv: kv[1])},
    )

    transactions, skipped_rows = _assemble_transactions(df, mapping)

    rows: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for transaction in transactions:
        narration = transaction["narration"]
        debit = transaction["debit"]
        credit = transaction["credit"]
        date_obj = transaction["date_obj"]

        original_debit = debit
        original_credit = credit
        if debit > 0 and credit > 0:
            if debit >= credit:
                credit = 0.0
            else:
                debit = 0.0
            warnings.append(
                {
                    "row": transaction["row"],
                    "issue": "Both debit and credit populated — used larger value",
                    "originalDebit": original_debit,
                    "originalCredit": original_credit,
                }
            )

        if should_skip_row(narration, debit, credit, date_obj):
            skipped_rows += 1
            continue

        rows.append(
            {
                "Date": _clean_cell(transaction["date_raw"]),
                "Narration": narration,
                "Withdrawal Amt.": debit,
                "Deposit Amt.": credit,
                "Balance": transaction["balance"],
                "Date_Obj": date_obj,
                "Tally_Date": date_obj.strftime("%Y%m%d"),
            }
        )

    return pd.DataFrame(rows), skipped_rows, warnings


def _pil_to_png_bytes(image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _tesseract_image_text(image: np.ndarray) -> str:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return pytesseract.image_to_string(gray, lang="eng", config="--psm 6 --oem 1").strip()


def _paddle_layout_text(image: np.ndarray) -> str:
    """OCR a statement page keeping table rows intact.

    `run_paddle_ocr` returns one detected box per line, which turns every table
    cell into its own line and makes row-wise parsing impossible. Here the boxes
    are regrouped by vertical position and ordered left to right, so a statement
    row comes back as a single line of text.
    """
    ocr = get_paddle_ocr()
    result = ocr.ocr(image, cls=True)

    boxes: list[dict[str, float | str]] = []
    for entry in (result or [None])[0] or []:
        if not entry or len(entry) < 2:
            continue
        polygon, (text, confidence) = entry[0], entry[1]
        text = str(text).strip()
        if not text or confidence <= 0.3:
            continue
        ys = [point[1] for point in polygon]
        xs = [point[0] for point in polygon]
        boxes.append(
            {
                "text": text,
                "y": sum(ys) / len(ys),
                "x": min(xs),
                "height": max(ys) - min(ys),
            }
        )

    if not boxes:
        return ""

    boxes.sort(key=lambda box: box["y"])
    heights = sorted(box["height"] for box in boxes)
    median_height = heights[len(heights) // 2] or 10.0
    tolerance = max(median_height * 0.6, 4.0)

    lines: list[list[dict[str, Any]]] = [[boxes[0]]]
    line_y = boxes[0]["y"]
    for box in boxes[1:]:
        if abs(box["y"] - line_y) <= tolerance:
            lines[-1].append(box)
            line_y = sum(item["y"] for item in lines[-1]) / len(lines[-1])
        else:
            lines.append([box])
            line_y = box["y"]

    rendered: list[str] = []
    for line in lines:
        line.sort(key=lambda box: box["x"])
        rendered.append("  ".join(str(box["text"]) for box in line))
    return "\n".join(rendered)


def should_skip_row(narration: str, debit: float, credit: float, date_val) -> bool:
    narration_lower = narration.lower().strip()
    if any(skip in narration_lower for skip in SKIP_NARRATIONS):
        return True
    if date_val is None and (debit + credit) > 100000:
        return True
    return debit == 0 and credit == 0


def _ocr_scanned_pdf_text(pdf_bytes: bytes) -> str:
    preprocess_service = PreprocessService()
    page_texts: list[str] = []
    poppler_path = get_poppler_path()
    logger.info("Rendering scanned bank statement with poppler_path=%s", poppler_path or "<PATH>")

    try:
        page_images = convert_from_bytes(pdf_bytes, dpi=200, poppler_path=poppler_path)
    except Exception as error:  # noqa: BLE001
        logger.exception("pdf2image could not render the scanned bank statement")
        raise HTTPException(
            status_code=422,
            detail=(
                "This looks like a scanned statement, but the PDF renderer (poppler) is not "
                "available on the server. Install poppler or set POPPLER_PATH, then retry."
            ),
        ) from error

    for page_image in page_images:
        original_png = _pil_to_png_bytes(page_image)
        raw_image = preprocess_service._decode_image_bytes(original_png)  # noqa: SLF001
        deskewed = preprocess_service._deskew(raw_image)  # noqa: SLF001
        processed = preprocess_service._denoise_and_boost(deskewed)  # noqa: SLF001

        try:
            text = _paddle_layout_text(processed)
            if len(text) >= 50:
                page_texts.append(text)
                continue
        except Exception as error:  # noqa: BLE001
            logger.warning("PaddleOCR failed for scanned bank statement page: %s", error)

        fallback_text = _tesseract_image_text(processed)
        if fallback_text:
            page_texts.append(fallback_text)

    return "\n".join(page_texts).strip()


def _direction_from_keywords(narration: str, amount: float) -> tuple[float, float]:
    narration_lower = narration.lower()
    if any(keyword in narration_lower for keyword in CREDIT_TEXT_KEYWORDS):
        return 0.0, amount
    return amount, 0.0


def _split_amounts(
    narration: str,
    amounts: list[float],
    previous_balance: float | None,
) -> tuple[float, float, float]:
    """Work out (debit, credit, balance) for one text-parsed statement line.

    Text-mode rows do not say which column an amount came from, so the running
    balance decides the direction whenever it is available: a balance that went
    up is a credit. Narration keywords are only the fallback.
    """
    if len(amounts) == 1:
        debit, credit = _direction_from_keywords(narration, amounts[0])
        return debit, credit, 0.0

    balance = amounts[-1]
    candidates = [amount for amount in amounts[:-1] if amount > 0]
    if not candidates:
        return 0.0, 0.0, balance

    if previous_balance is not None:
        delta = balance - previous_balance
        amount = min(candidates, key=lambda value: abs(value - abs(delta)))
        # Only trust the delta if some amount on the line actually explains it.
        if abs(abs(delta) - amount) <= max(1.0, amount * 0.01):
            return (0.0, amount, balance) if delta >= 0 else (amount, 0.0, balance)

    debit, credit = _direction_from_keywords(narration, candidates[0])
    return debit, credit, balance


def parse_statement_text(text: str) -> list[dict[str, Any]]:
    transactions: list[dict[str, Any]] = []
    previous_balance: float | None = None
    for line in text.splitlines():
        clean_line = re.sub(r"\s+", " ", line).strip()
        date_match = DATE_RE.search(clean_line)
        if not date_match:
            continue
        if _is_summary_narration(clean_line):
            continue
        # Blank out any further dates (e.g. HDFC's "Value Dt") so their digits are
        # never mistaken for amounts.
        tail = DATE_RE.sub(" ", clean_line[date_match.end() :])
        amount_matches = list(AMOUNT_RE.finditer(tail))
        if not amount_matches:
            amount_matches = [
                match
                for match in AMOUNT_LOOSE_RE.finditer(tail)
                if "." in match.group(0) or len(match.group(0)) <= 6
            ]
        if not amount_matches:
            continue

        date = date_match.group(0)
        narration = tail[: amount_matches[0].start()].strip(" -|")
        amounts = [_parse_amount(match.group(0)) for match in amount_matches]
        if all(amount == 0 for amount in amounts):
            continue

        debit, credit, balance = _split_amounts(narration, amounts, previous_balance)
        if balance:
            previous_balance = balance
        if debit == 0 and credit == 0:
            continue

        transactions.append(
            {
                "Date": date,
                "Narration": narration,
                "Withdrawal Amt.": debit,
                "Deposit Amt.": credit,
                "Balance": balance,
            }
        )

    return transactions


def _rows_from_df(df: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        rows.append(
            {
                "narration": str(row.get("Narration", "") or ""),
                "debit": float(row.get("Withdrawal Amt.", 0.0) or 0.0),
                "credit": float(row.get("Deposit Amt.", 0.0) or 0.0),
                "tallyDate": str(row.get("Tally_Date", "") or ""),
                "suggestedLedger": row.get("Suggested_Ledger"),
                "confidence": row.get("Classification_Confidence"),
            }
        )
    return rows


def _build_voucher_xml(
    rows: list[dict[str, Any]],
    company_name: str,
    bank_ledger: str,
    resolve_party: Callable[[dict[str, Any]], tuple[str, str | None]],
) -> tuple[str, int]:
    """Build the Tally voucher XML for a list of normalized transaction rows.

    `resolve_party` decides, per row, the counterpart ledger name and an optional
    XML comment to place immediately above it — this is what lets the raw export
    (Suspense A/c + an AI-suggestion comment) and the reviewed export (the CA's
    actual ledger choice, no comment) share one XML builder instead of drifting
    out of sync with each other.
    """
    envelope = ET.Element("ENVELOPE")
    header = ET.SubElement(envelope, "HEADER")
    ET.SubElement(header, "TALLYREQUEST").text = "Import Data"

    body = ET.SubElement(envelope, "BODY")
    importdata = ET.SubElement(body, "IMPORTDATA")
    reqdesc = ET.SubElement(importdata, "REQUESTDESC")
    ET.SubElement(reqdesc, "REPORTNAME").text = "Vouchers"
    staticvars = ET.SubElement(reqdesc, "STATICVARIABLES")
    ET.SubElement(staticvars, "SVCURRENTCOMPANY").text = company_name
    reqdata = ET.SubElement(importdata, "REQUESTDATA")

    voucher_count = 0
    for row in rows:
        withdrawal = float(row.get("debit") or 0.0)
        deposit = float(row.get("credit") or 0.0)
        narration = str(row.get("narration") or "")
        tally_date = str(row.get("tallyDate") or "")

        if not tally_date or (withdrawal == 0 and deposit == 0):
            continue

        if deposit > 0:
            voucher_type = "Receipt"
            amount = deposit
            is_receipt = True
        else:
            voucher_type = "Payment"
            amount = withdrawal
            is_receipt = False

        tallymsg = ET.SubElement(reqdata, "TALLYMESSAGE")
        voucher = ET.SubElement(tallymsg, "VOUCHER", VCHTYPE=voucher_type, ACTION="Create")
        ET.SubElement(voucher, "DATE").text = tally_date
        ET.SubElement(voucher, "NARRATION").text = narration
        ET.SubElement(voucher, "VOUCHERTYPENAME").text = voucher_type

        bank_entry = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        ET.SubElement(bank_entry, "LEDGERNAME").text = bank_ledger
        ET.SubElement(bank_entry, "ISDEEMEDPOSITIVE").text = "Yes" if is_receipt else "No"
        ET.SubElement(bank_entry, "AMOUNT").text = f"{'-' if is_receipt else ''}{amount:.2f}"

        party_ledger, comment_text = resolve_party(row)
        party_entry = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        if comment_text:
            party_entry.append(ET.Comment(f" {comment_text} "))
        ET.SubElement(party_entry, "LEDGERNAME").text = party_ledger or "Suspense A/c"
        ET.SubElement(party_entry, "ISDEEMEDPOSITIVE").text = "No" if is_receipt else "Yes"
        ET.SubElement(party_entry, "AMOUNT").text = f"{'' if is_receipt else '-'}{amount:.2f}"

        voucher_count += 1

    raw_xml = ET.tostring(envelope, encoding="utf-8")
    pretty = xml.dom.minidom.parseString(raw_xml).toprettyxml(indent="  ")
    return pretty, voucher_count


def _suggestion_comment(row: dict[str, Any]) -> tuple[str, str]:
    """Suspense A/c stays the real ledger for the raw export — the AI suggestion is
    surfaced only as a comment so the CA can accept or change it in the review step.
    """
    confidence = row.get("confidence")
    pct = round((confidence or 0.0) * 100)
    ledger = row.get("suggestedLedger") or "Miscellaneous"
    return "Suspense A/c", f"Suggested: {ledger} ({pct}%)"


def _generate_xml(
    df: pd.DataFrame,
    company_name: str,
    bank_ledger: str,
) -> tuple[str, int]:
    return _build_voucher_xml(_rows_from_df(df), company_name, bank_ledger, _suggestion_comment)


def generate_xml_with_ledgers(
    transactions: list[dict[str, Any]],
    company_name: str = "My Company",
    bank_ledger: str = "Bank Account",
) -> tuple[str, int]:
    """Build the final Tally XML once the CA has confirmed a ledger per transaction.

    Unlike `_generate_xml`, the counterpart ledger here is whatever the CA settled
    on (their own typed ledger, an accepted AI suggestion, or a saved firm mapping)
    rather than always "Suspense A/c" — this is the "Export to Tally" step of the
    review screen, run after Suspense has already served its purpose.
    """
    rows = [
        {
            "narration": str(txn.get("narration") or ""),
            "debit": float(txn.get("debit") or 0.0),
            "credit": float(txn.get("credit") or 0.0),
            "tallyDate": str(txn.get("tallyDate") or ""),
            "ledgerName": str(txn.get("ledgerName") or "Suspense A/c").strip() or "Suspense A/c",
        }
        for txn in transactions
    ]

    def resolve_party(row: dict[str, Any]) -> tuple[str, str | None]:
        return row.get("ledgerName") or "Suspense A/c", None

    return _build_voucher_xml(rows, company_name, bank_ledger, resolve_party)


def process_bytes(
    pdf_bytes: bytes,
    company_name: str = "My Company",
    bank_ledger: str = "Bank Account",
) -> dict[str, Any]:
    raw_tables, is_scanned = _extract_tables_from_pdf(pdf_bytes)
    warnings: list[dict[str, Any]] = []

    if is_scanned:
        ocr_text = _ocr_scanned_pdf_text(pdf_bytes)
        parsed_rows = parse_statement_text(ocr_text)
        df_input = pd.DataFrame(parsed_rows)
        if df_input.empty:
            raise HTTPException(status_code=422, detail="No transaction rows found after OCR parsing.")
    else:
        df_input, detected_headers = _merge_tables(raw_tables)
        if df_input is None:
            # Statements that export as flowing text (or with unrecognisable table
            # headers) are parsed line by line instead.
            logger.warning("Headers found: %s", detected_headers)
            parsed_rows = parse_statement_text(_extract_text_from_pdf(pdf_bytes))
            if not parsed_rows:
                raise HTTPException(
                    status_code=422,
                    detail=UNPARSEABLE_DETAIL.format(headers=_format_headers(detected_headers)),
                )
            logger.info("Table detection failed; recovered %d row(s) from raw text", len(parsed_rows))
            df_input = pd.DataFrame(parsed_rows)
            warnings.append(
                {
                    "row": 0,
                    "issue": "No table structure detected — transactions were recovered from raw text",
                }
            )
        else:
            logger.info("Headers found: %s", detected_headers)

    df, skipped_rows, row_warnings = _standardize(df_input)
    warnings.extend(row_warnings)
    if df.empty:
        raise HTTPException(status_code=422, detail="No valid transaction rows found after parsing.")

    classifications = classify_narrations(df["Narration"].tolist())
    df["Suggested_Ledger"] = [c["suggested_ledger"] for c in classifications]
    df["Classification_Confidence"] = [c["confidence"] for c in classifications]
    df["Classification_Reason"] = [c["reason"] for c in classifications]

    xml, voucher_count = _generate_xml(df, company_name=company_name, bank_ledger=bank_ledger)

    transactions = [
        {
            "date": str(row.get("Date") or ""),
            "tallyDate": str(row.get("Tally_Date") or ""),
            "narration": str(row.get("Narration") or ""),
            "debit": float(row.get("Withdrawal Amt.") or 0.0),
            "credit": float(row.get("Deposit Amt.") or 0.0),
            "balance": float(row.get("Balance") or 0.0),
            "suggestedLedger": row.get("Suggested_Ledger"),
            "classificationConfidence": row.get("Classification_Confidence"),
            "classificationReason": row.get("Classification_Reason"),
        }
        for _, row in df.iterrows()
    ]

    return {
        "xml": xml,
        "voucherCount": voucher_count,
        "skippedRows": skipped_rows,
        "warnings": warnings,
        "isScanned": is_scanned,
        "transactions": transactions,
    }
