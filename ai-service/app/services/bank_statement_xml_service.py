"""
Bank Statement XML Service
==========================
Adapter around the Bank_Statement_Processor_xml logic for use inside the
Verax AI service.

Public API
----------
    process_bytes(pdf_bytes: bytes, company_name: str, bank_ledger: str) -> bytes

Accepts raw PDF file bytes, runs the full table-extraction and Tally XML
generation pipeline, and returns the XML as UTF-8 bytes (suitable for
streaming directly back in an HTTP response).

Key difference from the original script: instead of reading/writing file
paths the entry point reads from ``io.BytesIO`` and returns bytes rather
than writing to a file.  Uses ``pdfplumber`` for table extraction — fully
rule-based, no LLM, zero hallucination risk on financial figures.
"""

from __future__ import annotations

import io
import logging
import re
import xml.dom.minidom
import xml.etree.ElementTree as ET

import pandas as pd
import pdfplumber

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# TABLE EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def _extract_tables_from_bytes(pdf_bytes: bytes) -> list[list[list[str]]]:
    """
    Open a PDF from bytes and extract all tables across all pages.
    Returns a list of tables, each table being a list of rows (list of str).
    """
    raw_tables: list[list[list[str]]] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            tables = page.extract_tables(
                table_settings={"vertical_strategy": "text", "horizontal_strategy": "text"}
            )
            for table in tables:
                if not table:
                    continue
                cleaned: list[list[str]] = []
                for row in table:
                    cleaned_row = [
                        str(cell).replace("\n", " ").strip() if cell else ""
                        for cell in row
                    ]
                    if any(cleaned_row):
                        cleaned.append(cleaned_row)
                if cleaned:
                    raw_tables.append(cleaned)
            logger.info(
                "Page %d/%d — found %d table(s)",
                page_idx + 1,
                len(pdf.pages),
                len(tables),
            )
    return raw_tables


# ─────────────────────────────────────────────────────────────────────────────
# TABLE MERGING & HEADER DETECTION
# ─────────────────────────────────────────────────────────────────────────────

_HEADER_KEYWORDS = (
    "date", "narration", "description", "particulars", "details",
    "amount", "withdrawal", "deposit", "balance", "ref", "chq",
)


def _looks_like_header(row: list[str]) -> bool:
    joined = " ".join(row).lower()
    return any(kw in joined for kw in _HEADER_KEYWORDS)


def _merge_tables(raw_tables: list[list[list[str]]]) -> pd.DataFrame:
    """
    Merge all page-level tables into a single DataFrame.
    Identifies the most common column count as the target, detects a header
    row, then appends all data rows.
    """
    if not raw_tables:
        raise RuntimeError("No tables found in the PDF.")

    col_counts = [len(table[0]) for table in raw_tables if table]
    target_cols = max(set(col_counts), key=col_counts.count)
    logger.info("Target column count: %d", target_cols)

    headers: list[str] | None = None
    merged_data: list[list[str]] = []

    for table in raw_tables:
        for row in table:
            if len(row) == target_cols:
                if headers is None and _looks_like_header(row):
                    headers = row
                    continue
                merged_data.append(row)
            elif len(row) > target_cols:
                merged_data.append(row[:target_cols])
            else:
                merged_data.append(row + [""] * (target_cols - len(row)))

    if headers is None:
        headers = [f"Col_{i}" for i in range(target_cols)]

    return pd.DataFrame(merged_data, columns=headers)


# ─────────────────────────────────────────────────────────────────────────────
# COLUMN STANDARDISATION
# ─────────────────────────────────────────────────────────────────────────────

_DATE_KW    = ("date", "txn date", "transaction date", "value date")
_DESC_KW    = ("narration", "description", "particulars", "details", "remarks")
_DEBIT_KW   = ("withdrawal amt", "debit", "dr", "withdraw")
_CREDIT_KW  = ("deposit amt", "credit", "cr", "deposit")


def _map_column(col_lower: str) -> str | None:
    col_nospace = col_lower.replace(" ", "")
    for kw in _DATE_KW:
        if kw.replace(" ", "") in col_nospace:
            return "Date"
    for kw in _DESC_KW:
        if kw.replace(" ", "") in col_nospace:
            return "Narration"
    for kw in _DEBIT_KW:
        if kw.replace(" ", "") in col_nospace:
            return "Withdrawal Amt."
    for kw in _CREDIT_KW:
        if kw.replace(" ", "") in col_nospace:
            return "Deposit Amt."
    return None


def _standardize(df: pd.DataFrame) -> pd.DataFrame:
    col_map: dict[str, str] = {}
    seen_targets: set[str] = set()

    for col in df.columns:
        target = _map_column(str(col).lower().strip())
        if target and target not in seen_targets:
            col_map[col] = target
            seen_targets.add(target)

    df = df.rename(columns=col_map)

    for required in ("Date", "Narration", "Withdrawal Amt.", "Deposit Amt."):
        if required not in df.columns:
            logger.warning("Column '%s' not found — adding empty.", required)
            df[required] = ""

    # Parse amounts
    for col in ("Withdrawal Amt.", "Deposit Amt."):
        df[col] = (
            df[col]
            .astype(str)
            .str.replace(",", "", regex=False)
            .pipe(pd.to_numeric, errors="coerce")
            .fillna(0.0)
        )

    # Parse dates
    df["Date_Obj"] = pd.to_datetime(df["Date"], errors="coerce", dayfirst=True)
    df["Tally_Date"] = df["Date_Obj"].dt.strftime("%Y%m%d")

    df = df.dropna(subset=["Date_Obj"])
    logger.info("Shape after standardisation: %s", df.shape)
    return df


# ─────────────────────────────────────────────────────────────────────────────
# TALLY XML GENERATION
# ─────────────────────────────────────────────────────────────────────────────

def _generate_xml(df: pd.DataFrame, company_name: str, bank_ledger: str) -> bytes:
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
        withdrawal: float = row.get("Withdrawal Amt.", 0.0)
        deposit:    float = row.get("Deposit Amt.", 0.0)
        narration:  str   = str(row.get("Narration", ""))
        tally_date: str   = str(row.get("Tally_Date", ""))

        if not tally_date or tally_date == "nan":
            continue
        if withdrawal == 0 and deposit == 0:
            continue

        if deposit > 0:
            vch_type   = "Receipt"
            amount     = deposit
            is_receipt = True
        else:
            vch_type   = "Payment"
            amount     = withdrawal
            is_receipt = False

        tallymsg = ET.SubElement(reqdata, "TALLYMESSAGE")
        voucher  = ET.SubElement(tallymsg, "VOUCHER", VCHTYPE=vch_type, ACTION="Create")

        ET.SubElement(voucher, "DATE").text          = tally_date
        ET.SubElement(voucher, "NARRATION").text     = narration
        ET.SubElement(voucher, "VOUCHERTYPENAME").text = vch_type

        # Bank ledger entry
        bank_entry = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        ET.SubElement(bank_entry, "LEDGERNAME").text = bank_ledger
        if is_receipt:
            ET.SubElement(bank_entry, "ISDEEMEDPOSITIVE").text = "Yes"
            ET.SubElement(bank_entry, "AMOUNT").text = f"-{amount:.2f}"
        else:
            ET.SubElement(bank_entry, "ISDEEMEDPOSITIVE").text = "No"
            ET.SubElement(bank_entry, "AMOUNT").text = f"{amount:.2f}"

        # Suspense counterpart entry
        party_entry = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        ET.SubElement(party_entry, "LEDGERNAME").text = "Suspense A/c"
        if is_receipt:
            ET.SubElement(party_entry, "ISDEEMEDPOSITIVE").text = "No"
            ET.SubElement(party_entry, "AMOUNT").text = f"{amount:.2f}"
        else:
            ET.SubElement(party_entry, "ISDEEMEDPOSITIVE").text = "Yes"
            ET.SubElement(party_entry, "AMOUNT").text = f"-{amount:.2f}"

        voucher_count += 1

    logger.info("Generated %d vouchers.", voucher_count)

    raw_xml = ET.tostring(envelope, encoding="utf-8")
    pretty   = xml.dom.minidom.parseString(raw_xml).toprettyxml(indent="  ")
    return pretty.encode("utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def process_bytes(
    pdf_bytes: bytes,
    company_name: str = "My Company",
    bank_ledger: str = "Bank Account",
) -> bytes:
    """
    Accept raw PDF file bytes, run the full bank-statement → Tally XML
    pipeline, and return the resulting XML as UTF-8 bytes.

    Raises ``RuntimeError`` if no transaction data can be found.
    """
    raw_tables = _extract_tables_from_bytes(pdf_bytes)
    df         = _merge_tables(raw_tables)
    df         = _standardize(df)

    if df.empty:
        raise RuntimeError("No valid transaction rows found after parsing.")

    return _generate_xml(df, company_name=company_name, bank_ledger=bank_ledger)
