from __future__ import annotations

import io
import logging
import re
import tempfile
import xml.dom.minidom
import xml.etree.ElementTree as ET
from typing import Any

import cv2
import numpy as np
import pandas as pd
import pdfplumber
import pytesseract
from fastapi import HTTPException
from pdf2image import convert_from_path

from app.services.ocr_service import run_paddle_ocr
from app.services.preprocess_service import PreprocessService

logger = logging.getLogger(__name__)

TABLE_SETTINGS = {"vertical_strategy": "text", "horizontal_strategy": "text"}

DATE_KEYWORDS = ["date", "txn date", "value date", "transaction date", "posting date"]
NARRATION_KEYWORDS = [
    "narration",
    "description",
    "particulars",
    "remarks",
    "transaction details",
    "details",
    "reference",
]
DEBIT_KEYWORDS = ["debit", "dr", "withdrawal", "withdrawals", "debit amount"]
CREDIT_KEYWORDS = ["credit", "cr", "deposit", "deposits", "credit amount"]
BALANCE_KEYWORDS = ["balance", "running balance", "available balance", "closing balance"]

SKIP_NARRATIONS = [
    "opening balance",
    "closing balance",
    "total",
    "brought forward",
    "carried forward",
    "subtotal",
    "grand total",
    "account summary",
    "statement period",
    "available balance",
    "ledger balance",
]

CREDIT_TEXT_KEYWORDS = [
    "credit",
    " cr",
    "neft in",
    "imps in",
    "upi cr",
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
    "atm",
    "withdrawal",
    "payment",
    "purchase",
    "wdl",
]

DATE_RE = re.compile(r"\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}")
AMOUNT_RE = re.compile(r"[\d,]+\.\d{2}")


def _clean_cell(value: Any) -> str:
    return str(value).replace("\n", " ").strip() if value is not None else ""


def _parse_amount(value: Any) -> float:
    if value is None:
        return 0.0
    text = str(value).strip()
    if text in ("", "-", "nan", "None"):
        return 0.0
    text = re.sub(r"[^\d.\-]", "", text)
    try:
        return float(text)
    except ValueError:
        return 0.0


def _non_empty_count(values: list[Any]) -> int:
    return sum(1 for value in values if str(value or "").strip())


def _is_summary_narration(narration: str) -> bool:
    lower = narration.lower()
    return any(keyword in lower for keyword in SKIP_NARRATIONS)


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
    for page in pdf.pages[:3]:
        tables = page.extract_tables()
        if not tables:
            continue
        for table in tables:
            rows = [row for row in table if any(cell for cell in row if cell)]
            if len(rows) > 3:
                return False
    return True


def _extract_tables_from_pdf(pdf_bytes: bytes) -> tuple[list[list[list[str]]], bool]:
    raw_tables: list[list[list[str]]] = []
    with _open_pdf(pdf_bytes) as pdf:
        if not pdf.pages:
            raise HTTPException(status_code=422, detail="PDF contains no pages.")
        if is_scanned_pdf(pdf):
            return [], True
        for page_idx, page in enumerate(pdf.pages):
            tables = page.extract_tables(TABLE_SETTINGS)
            for table in tables:
                cleaned = _clean_table(table)
                if cleaned:
                    raw_tables.append(cleaned)
            logger.info("Page %d/%d found %d table(s)", page_idx + 1, len(pdf.pages), len(tables))
    return raw_tables, False


def _try_detect_columns(headers: list[str]) -> dict[str, int]:
    result: dict[str, int] = {}
    for i, header in enumerate(headers):
        h_low = str(header or "").lower().strip()
        if not h_low:
            continue
        if any(keyword in h_low for keyword in DATE_KEYWORDS) and "date" not in result:
            result["date"] = i
        elif any(keyword in h_low for keyword in NARRATION_KEYWORDS) and "narration" not in result:
            result["narration"] = i
        elif any(keyword in h_low for keyword in DEBIT_KEYWORDS) and "debit" not in result:
            result["debit"] = i
        elif any(keyword in h_low for keyword in CREDIT_KEYWORDS) and "credit" not in result:
            result["credit"] = i
        elif any(keyword in h_low for keyword in BALANCE_KEYWORDS) and "balance" not in result:
            result["balance"] = i
    return result


def detect_columns(headers: list[str]) -> dict[str, int]:
    mapping = _try_detect_columns(headers)
    if "date" not in mapping or "narration" not in mapping:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not detect required columns (Date, Narration). "
                "Please ensure the PDF has a standard table format."
            ),
        )
    return mapping


def _looks_like_header(row: list[str]) -> bool:
    return bool(_try_detect_columns(row))


def _merge_tables(raw_tables: list[list[list[str]]]) -> pd.DataFrame:
    if not raw_tables:
        raise HTTPException(status_code=422, detail="No tables found in the PDF.")

    col_counts = [len(table[0]) for table in raw_tables if table]
    target_cols = max(set(col_counts), key=col_counts.count)
    headers: list[str] | None = None
    merged_data: list[list[str]] = []

    for table in raw_tables:
        for row in table:
            normalized = row[:target_cols] if len(row) > target_cols else row + [""] * (target_cols - len(row))
            if headers is None and _looks_like_header(normalized):
                headers = normalized
                continue
            if headers is not None and _looks_like_header(normalized):
                continue
            merged_data.append(normalized)

    if headers is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not detect required columns (Date, Narration) in this statement. "
                "Please ensure the PDF has a standard table format."
            ),
        )

    return pd.DataFrame(merged_data, columns=headers)


def _standardize(df: pd.DataFrame) -> tuple[pd.DataFrame, int, list[dict[str, Any]]]:
    columns = list(df.columns)
    mapping = detect_columns([str(col) for col in columns])

    rows: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    skipped_rows = 0

    for row_number, (_, row) in enumerate(df.iterrows(), start=1):
        values = [row.iloc[i] for i in range(len(columns))]
        date_raw = row.iloc[mapping["date"]]
        narration = _clean_cell(row.iloc[mapping["narration"]])
        debit = _parse_amount(row.iloc[mapping["debit"]]) if "debit" in mapping else 0.0
        credit = _parse_amount(row.iloc[mapping["credit"]]) if "credit" in mapping else 0.0
        balance = _parse_amount(row.iloc[mapping["balance"]]) if "balance" in mapping else 0.0
        date_obj = pd.to_datetime(date_raw, errors="coerce", dayfirst=True)
        date_val = None if pd.isna(date_obj) else date_obj

        if _non_empty_count(values) < 2:
            skipped_rows += 1
            continue

        original_debit = debit
        original_credit = credit
        if debit > 0 and credit > 0:
            if debit >= credit:
                credit = 0.0
            else:
                debit = 0.0
            warnings.append(
                {
                    "row": row_number,
                    "issue": "Both debit and credit populated — used larger value",
                    "originalDebit": original_debit,
                    "originalCredit": original_credit,
                }
            )

        if should_skip_row(narration, debit, credit, date_val):
            skipped_rows += 1
            continue
        if pd.isna(date_obj):
            skipped_rows += 1
            continue

        rows.append(
            {
                "Date": _clean_cell(date_raw),
                "Narration": narration,
                "Withdrawal Amt.": debit,
                "Deposit Amt.": credit,
                "Balance": balance,
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

    with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp_pdf:
        tmp_pdf.write(pdf_bytes)
        tmp_pdf.flush()
        page_images = convert_from_path(tmp_pdf.name, dpi=200)

        for page_image in page_images:
            original_png = _pil_to_png_bytes(page_image)
            raw_image = preprocess_service._decode_image_bytes(original_png)  # noqa: SLF001
            deskewed = preprocess_service._deskew(raw_image)  # noqa: SLF001
            processed = preprocess_service._denoise_and_boost(deskewed)  # noqa: SLF001

            try:
                text = run_paddle_ocr(processed)
                if len(text) >= 50:
                    page_texts.append(text)
                    continue
            except Exception as error:  # noqa: BLE001
                logger.warning("PaddleOCR failed for scanned bank statement page: %s", error)

            fallback_text = _tesseract_image_text(processed)
            if fallback_text:
                page_texts.append(fallback_text)

    return "\n".join(page_texts).strip()


def parse_statement_text(text: str) -> list[dict[str, Any]]:
    transactions: list[dict[str, Any]] = []
    for line in text.splitlines():
        clean_line = re.sub(r"\s+", " ", line).strip()
        date_match = DATE_RE.search(clean_line)
        if not date_match:
            continue
        if _is_summary_narration(clean_line):
            continue
        amount_matches = list(AMOUNT_RE.finditer(clean_line))
        if not amount_matches:
            continue

        date = date_match.group(0)
        narration_start = date_match.end()
        narration_end = amount_matches[0].start()
        narration = clean_line[narration_start:narration_end].strip(" -")
        amounts = [_parse_amount(match.group(0)) for match in amount_matches]
        if all(amount == 0 for amount in amounts):
            continue

        debit = 0.0
        credit = 0.0
        balance = 0.0
        narration_lower = narration.lower()

        if len(amounts) >= 3:
            debit, credit, balance = amounts[0], amounts[1], amounts[2]
        elif len(amounts) == 2:
            balance = amounts[1]
            if any(keyword in narration_lower for keyword in CREDIT_TEXT_KEYWORDS):
                credit = amounts[0]
            else:
                debit = amounts[0]
        else:
            amount = amounts[0]
            if any(keyword in narration_lower for keyword in CREDIT_TEXT_KEYWORDS):
                credit = amount
            elif any(keyword in narration_lower for keyword in DEBIT_TEXT_KEYWORDS):
                debit = amount
            else:
                debit = amount

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


def _generate_xml(
    df: pd.DataFrame,
    company_name: str,
    bank_ledger: str,
) -> tuple[str, int]:
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
    for _, row in df.iterrows():
        withdrawal = float(row.get("Withdrawal Amt.", 0.0) or 0.0)
        deposit = float(row.get("Deposit Amt.", 0.0) or 0.0)
        narration = str(row.get("Narration", "") or "")
        tally_date = str(row.get("Tally_Date", "") or "")

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

        party_entry = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        ET.SubElement(party_entry, "LEDGERNAME").text = "Suspense A/c"
        ET.SubElement(party_entry, "ISDEEMEDPOSITIVE").text = "No" if is_receipt else "Yes"
        ET.SubElement(party_entry, "AMOUNT").text = f"{'' if is_receipt else '-'}{amount:.2f}"

        voucher_count += 1

    raw_xml = ET.tostring(envelope, encoding="utf-8")
    pretty = xml.dom.minidom.parseString(raw_xml).toprettyxml(indent="  ")
    return pretty, voucher_count


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
        df_input = _merge_tables(raw_tables)

    df, skipped_rows, row_warnings = _standardize(df_input)
    warnings.extend(row_warnings)
    if df.empty:
        raise HTTPException(status_code=422, detail="No valid transaction rows found after parsing.")

    xml, voucher_count = _generate_xml(df, company_name=company_name, bank_ledger=bank_ledger)
    return {
        "xml": xml,
        "voucherCount": voucher_count,
        "skippedRows": skipped_rows,
        "warnings": warnings,
        "isScanned": is_scanned,
    }
