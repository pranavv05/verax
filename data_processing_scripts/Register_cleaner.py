"""
Register Cleaner  — Robust Edition
====================================
Handles ALL real-world register layouts:
  • Multiple tables per sheet (separated by blank rows / repeat headers)
  • Multiple TOTAL rows (one per table block — all skipped)
  • "Cancelled" rows (excluded automatically)
  • Split two-row headers  (e.g. "Debit" / "Amount")
  • Merged cells / blank rows / metadata titles
  • Formatting artifacts (_x000D_, extra whitespace, etc.)
  • Any number of sheets in the workbook

All valid transaction rows from every block on every sheet are
collected into a single clean output Excel file.

HOW TO USE
----------
Edit INPUT_FILE and OUTPUT_FILE at the bottom, then run.

Requirements:  pip install pandas openpyxl
"""

import re
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS & PATTERNS
# ─────────────────────────────────────────────────────────────────────────────

HEADER_WORDS = [
    "date", "bill date", "particulars", "party", "ledger", "name", "vendor",
    "billed", "vch", "voucher", "type", "no", "number", "invoice", "bill",
    "debit", "credit", "amount", "bill amt", "dr", "cr",
    "tax", "gst", "igst", "cgst", "sgst", "gstin", "gst no",
    "narration", "remark", "description",
]

TOTAL_RE = re.compile(
    r"^\s*(grand\s+)?(total|subtotal)[s]?\s*[:\-]?\s*$"
    r"|^closing\s+balance|^opening\s+balance",
    re.IGNORECASE,
)

CANCELLED_RE = re.compile(r"^\s*cancelled\s*$", re.IGNORECASE)

_ARTIFACT  = re.compile(r"_x000D_|\r\n|\r|\n")
_MULTISPC  = re.compile(r" {2,}")
_TRAILPUNC = re.compile(r"[,;:\.\s]+$")

DATE_FMTS = [
    "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d",
    "%d-%b-%Y", "%d %b %Y", "%d-%b-%y",
    "%d/%m/%y", "%m/%d/%Y",
    "%d.%m.%Y", "%d.%m.%y",
]

# Columns whose values should be cast to float
NUMERIC_COL_RE = re.compile(
    r"\bamount\b|\bbill\s*amt\b|\bdebit\b|\bcredit\b"
    r"|\bdr\.?\b|\bcr\.?\b"
    r"|\bigst\b|\bcgst\b|\bsgst\b"
    r"|\bbalance\b|\brate\b|\bqty\b|\bquantity\b",
    re.IGNORECASE,
)

# Columns whose values should be parsed as dates
DATE_COL_RE = re.compile(r"\bdate\b", re.IGNORECASE)


# ─────────────────────────────────────────────────────────────────────────────
# ROW-LEVEL HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _cells(row: pd.Series) -> list:
    """Non-empty string values in a row."""
    vals = []
    for v in row:
        try:
            if pd.isna(v):
                continue
        except (TypeError, ValueError):
            pass
        s = str(v).strip()
        if s not in ("", "nan", "NaN"):
            vals.append(s)
    return vals


def _is_empty(row: pd.Series) -> bool:
    return len(_cells(row)) == 0


def _is_total(row: pd.Series) -> bool:
    return any(TOTAL_RE.match(c) for c in _cells(row))


def _is_cancelled(row: pd.Series) -> bool:
    vals = _cells(row)
    if not vals:
        return False
    cancelled = sum(1 for v in vals if CANCELLED_RE.match(v))
    return cancelled >= max(1, len(vals) // 2)


def _header_score(row: pd.Series) -> float:
    vals = _cells(row)
    if len(vals) < 2:
        return 0.0
    hits = sum(1 for v in vals if any(w in v.lower() for w in HEADER_WORDS))
    return hits / len(vals)


def _is_header(row: pd.Series, threshold: float = 0.35) -> bool:
    return _header_score(row) >= threshold


# ─────────────────────────────────────────────────────────────────────────────
# VALUE CLEANERS
# ─────────────────────────────────────────────────────────────────────────────

def _clean_text(val) -> str:
    try:
        if pd.isna(val):
            return ""
    except (TypeError, ValueError):
        pass
    s = _ARTIFACT.sub(" ", str(val))
    s = _MULTISPC.sub(" ", s)
    s = _TRAILPUNC.sub("", s)
    return s.strip()


def _parse_date(val):
    try:
        if pd.isna(val):
            return pd.NaT
    except (TypeError, ValueError):
        pass
    if str(val).strip() == "":
        return pd.NaT
    s = str(val).strip()
    try:
        ts = pd.Timestamp(s)
        if 1990 < ts.year < 2100:
            return ts
    except Exception:
        pass
    for fmt in DATE_FMTS:
        try:
            return pd.to_datetime(s, format=fmt)
        except ValueError:
            continue
    return pd.NaT


def _parse_number(val):
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    if str(val).strip() in ("", "-", "–", "nan", "NaN"):
        return None
    s = re.sub(r"[₹$£€,\s]", "", str(val))
    try:
        return float(s)
    except ValueError:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# BLOCK EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def _build_col_labels(df: pd.DataFrame, header_idx: int, active_cols: list) -> list:
    """
    Merge up to 3 consecutive rows starting at header_idx into column labels.
    Stops expanding when a row contains actual data values (digits not matching keywords).
    """
    labels = {c: "" for c in active_cols}
    for offset in range(3):
        r = header_idx + offset
        if r >= len(df):
            break
        if offset > 0:
            # Stop if this row has data values (not just keyword labels)
            vals = _cells(df.iloc[r])
            has_digit   = any(any(ch.isdigit() for ch in v) for v in vals)
            all_keyword = all(any(w in v.lower() for w in HEADER_WORDS) for v in vals) if vals else True
            if has_digit and not all_keyword:
                break
        for c in active_cols:
            raw_val = df.at[r, c]
            try:
                v = "" if pd.isna(raw_val) else _clean_text(raw_val)
            except (TypeError, ValueError):
                v = _clean_text(raw_val)
            if v:
                labels[c] = (labels[c] + " " + v).strip()
    raw = [labels[c] if labels[c] else f"col_{c}" for c in active_cols]
    # Deduplicate: Amount → Amount, Amount → Amount_2, Amount_3 ...
    seen = {}
    deduped = []
    for name in raw:
        if name in seen:
            seen[name] += 1
            deduped.append(f"{name}_{seen[name]}")
        else:
            seen[name] = 1
            deduped.append(name)
    return deduped


def extract_blocks(df_raw: pd.DataFrame) -> list:
    """
    Scan the full raw sheet. Return list of (label_list, rows_list) tuples,
    one per detected table block, where rows_list is a list of dicts.
    """
    blocks = []
    n      = len(df_raw)
    i      = 0

    while i < n:
        # Skip blank and non-header rows
        if _is_empty(df_raw.iloc[i]) or not _is_header(df_raw.iloc[i]):
            i += 1
            continue

        header_idx = i

        # Active columns = columns that have SOME content from the header onward
        active_cols = [
            c for c in df_raw.columns
            if df_raw.iloc[header_idx:][c]
                   .dropna().astype(str).str.strip().str.len().sum() > 0
        ]
        if not active_cols:
            i += 1
            continue

        col_labels = _build_col_labels(df_raw, header_idx, active_cols)

        # Find first real data row (skip extra sub-header rows)
        data_start = header_idx + 1
        for j in range(data_start, min(data_start + 4, n)):
            vals = _cells(df_raw.iloc[j])
            if not vals:
                data_start = j + 1
                continue
            all_label   = all(not any(ch.isdigit() for ch in v) for v in vals)
            all_keyword = all(any(w in v.lower() for w in HEADER_WORDS) for v in vals)
            if all_label and all_keyword:
                data_start = j + 1
                continue
            break

        # Collect data rows
        rows      = []
        blank_run = 0
        j         = data_start

        while j < n:
            row = df_raw.iloc[j]

            if _is_empty(row):
                blank_run += 1
                if blank_run >= 2:   # 2 consecutive blanks = end of block
                    j += 1
                    break
                j += 1
                continue

            blank_run = 0

            # New header row = start of next block; stop here
            if _is_header(row) and j > data_start:
                break

            # Skip total and cancelled rows
            if _is_total(row) or _is_cancelled(row):
                j += 1
                continue

            rows.append({col_labels[k]: row[c] for k, c in enumerate(active_cols)})
            j += 1

        i = j

        if rows:
            blocks.append((col_labels, rows))

    return blocks


# ─────────────────────────────────────────────────────────────────────────────
# CLEAN A BLOCK
# ─────────────────────────────────────────────────────────────────────────────

def clean_block(col_labels: list, rows: list) -> pd.DataFrame:
    raw = pd.DataFrame(rows, columns=col_labels)
    raw = raw.dropna(axis=1, how="all")

    # Build each column as a plain Python list first, then assemble — avoids
    # all dtype-inference conflicts and duplicate-column indexing issues.
    col_names = list(raw.columns)
    cleaned_cols = {}
    for ci, col in enumerate(col_names):
        series = raw.iloc[:, ci]
        if DATE_COL_RE.search(col):
            cleaned_cols[ci] = pd.to_datetime(series.apply(_parse_date), errors="coerce").tolist()
        elif NUMERIC_COL_RE.search(col):
            cleaned_cols[ci] = series.apply(_parse_number).tolist()
        else:
            cleaned_cols[ci] = [
                (v if v != "" else None)
                for v in series.apply(_clean_text)
            ]

    # Reassemble into a fresh DataFrame using positional column names first
    df = pd.DataFrame({ci: cleaned_cols[ci] for ci in range(len(col_names))})
    df.columns = col_names

    # Drop rows missing both a date and any number
    date_idx = [ci for ci, c in enumerate(col_names) if DATE_COL_RE.search(c)]
    num_idx  = [ci for ci, c in enumerate(col_names) if NUMERIC_COL_RE.search(c)]
    has_date = df.iloc[:, date_idx].notna().any(axis=1) if date_idx else pd.Series(True, index=df.index)
    has_num  = df.iloc[:, num_idx].notna().any(axis=1)  if num_idx  else pd.Series(True, index=df.index)
    df = df[has_date | has_num]

    return df.reset_index(drop=True)


# ─────────────────────────────────────────────────────────────────────────────
# MERGE ALL BLOCKS
# ─────────────────────────────────────────────────────────────────────────────

def _unify_col_names(dfs: list) -> list:
    """
    Rename generic col_N columns by matching them positionally to named columns
    that appear in other DataFrames in the list.
    E.g. if block1 has 'Remarks' at position 5 and block2 has 'col_5' at position 5,
    rename block2s col_5 → Remarks.
    """
    # Build positional name map from all named columns across all blocks
    pos_to_name = {}
    for df in dfs:
        for pos, col in enumerate(df.columns):
            if not col.startswith("col_"):
                pos_to_name[pos] = col

    result = []
    for df in dfs:
        rename_map = {}
        for pos, col in enumerate(df.columns):
            if col.startswith("col_") and pos in pos_to_name:
                rename_map[col] = pos_to_name[pos]
        result.append(df.rename(columns=rename_map) if rename_map else df)
    return result


def merge_all(blocks: list, source_labels: list) -> pd.DataFrame:
    """Tag each block with its source label and union all columns."""
    blocks = _unify_col_names(blocks)
    tagged = []
    for df, label in zip(blocks, source_labels):
        d = df.copy()
        d.insert(0, "Source", label)
        tagged.append(d)

    # Reset each df index before concat to avoid InvalidIndexError on duplicate cols
    tagged = [d.reset_index(drop=True) for d in tagged]
    merged = pd.concat(tagged, ignore_index=True, sort=False)

    # Column order: Source → date cols → text cols → numeric cols
    date_c = [c for c in merged.columns if c != "Source" and DATE_COL_RE.search(c)]
    num_c  = [c for c in merged.columns if NUMERIC_COL_RE.search(c)]
    txt_c  = [c for c in merged.columns if c != "Source" and c not in date_c and c not in num_c]
    ordered = ["Source"] + date_c + txt_c + num_c

    seen, final = set(), []
    for c in ordered:
        if c not in seen and c in merged.columns:
            seen.add(c); final.append(c)
    for c in merged.columns:
        if c not in seen:
            final.append(c)

    return merged[final].reset_index(drop=True)


# ─────────────────────────────────────────────────────────────────────────────
# WRITE OUTPUT EXCEL
# ─────────────────────────────────────────────────────────────────────────────

_H_FILL   = PatternFill("solid", start_color="1F4E79")
_ALT_FILL = PatternFill("solid", start_color="EBF3FB")
_SEP_FILL = PatternFill("solid", start_color="D9E2F3")
_TOT_FILL = PatternFill("solid", start_color="D6E4F0")
_H_FONT   = Font(name="Arial", bold=True, color="FFFFFF", size=10)
_TOT_FONT = Font(name="Arial", bold=True, size=10, color="1F4E79")
_D_FONT   = Font(name="Arial", size=10)
_CENTER   = Alignment(horizontal="center", vertical="center")
_LEFT     = Alignment(horizontal="left",   vertical="center")
_RIGHT    = Alignment(horizontal="right",  vertical="center")
_THIN     = Side(style="thin", color="BDD7EE")
_BORDER   = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)


def _sc(cell, font=None, fill=None, align=None, border=None, fmt=None):
    if font:   cell.font          = font
    if fill:   cell.fill          = fill
    if align:  cell.alignment     = align
    if border: cell.border        = border
    if fmt:    cell.number_format = fmt


def write_output(df: pd.DataFrame, output_path: str):
    wb = Workbook()
    ws = wb.active
    ws.title = "Cleaned Register"

    ncols = len(df.columns)

    # Column widths
    for ci, col in enumerate(df.columns, 1):
        max_len = len(str(col))
        for val in df[col].dropna():
            s = val.strftime("%d-%b-%Y") if hasattr(val, "strftime") else str(val)
            max_len = max(max_len, len(s))
        ws.column_dimensions[get_column_letter(ci)].width = min(max(max_len + 2, 10), 52)

    # Header row
    for ci, col in enumerate(df.columns, 1):
        c = ws.cell(row=1, column=ci, value=col)
        _sc(c, font=_H_FONT, fill=_H_FILL, align=_CENTER, border=_BORDER)
    ws.row_dimensions[1].height = 22

    # Data rows with source-change separators
    prev_source = None
    xl_row      = 1
    alt         = 0
    data_rows   = []   # track (xl_row) of actual data rows for SUM formula

    for _, row in df.iterrows():
        src = row.get("Source", "")

        # Thin separator line between source blocks
        if src != prev_source and prev_source is not None:
            xl_row += 1
            for ci in range(1, ncols + 1):
                _sc(ws.cell(row=xl_row, column=ci), fill=_SEP_FILL, border=_BORDER)
            ws.row_dimensions[xl_row].height = 4
            alt = 0

        prev_source = src
        alt += 1
        xl_row += 1
        data_rows.append(xl_row)
        fill = _ALT_FILL if alt % 2 == 0 else None

        for ci, col in enumerate(df.columns, 1):
            val = row.iloc[ci - 1]
            if DATE_COL_RE.search(col):
                try:
                    _isna = pd.isna(val)
                except (TypeError, ValueError):
                    _isna = False
                cv, fmt, align = (pd.Timestamp(val) if not _isna else None), "DD-MMM-YYYY", _CENTER
            elif NUMERIC_COL_RE.search(col):
                try:
                    _isna = pd.isna(val)
                except (TypeError, ValueError):
                    _isna = False
                cv, fmt, align = (float(val) if not _isna else None), "#,##0.00", _RIGHT
            else:
                try:
                    _isna = pd.isna(val)
                except (TypeError, ValueError):
                    _isna = False
                raw = "" if _isna else str(val).strip()
                cv, fmt, align = (raw if raw and raw != "nan" else None), "@", _LEFT
            c = ws.cell(row=xl_row, column=ci, value=cv)
            _sc(c, font=_D_FONT, fill=fill, align=align, border=_BORDER, fmt=fmt)
        ws.row_dimensions[xl_row].height = 16

    # Grand total row — SUM only actual data rows (skip separator rows)
    num_col_indices = [ci for ci, col in enumerate(df.columns, 1) if NUMERIC_COL_RE.search(col)]
    if num_col_indices and data_rows:
        xl_row += 1
        for ci in range(1, ncols + 1):
            _sc(ws.cell(row=xl_row, column=ci), fill=_TOT_FILL, border=_BORDER)

        first_num = num_col_indices[0]
        if first_num > 1:
            ws.merge_cells(start_row=xl_row, start_column=1,
                           end_row=xl_row, end_column=first_num - 1)
        c = ws.cell(row=xl_row, column=1, value="GRAND TOTAL")
        _sc(c, font=_TOT_FONT, fill=_TOT_FILL, align=_RIGHT, border=_BORDER)

        # Build a SUM formula that only adds actual data rows
        row_refs = ",".join(str(r) for r in data_rows)
        for ci in num_col_indices:
            ltr = get_column_letter(ci)
            # Use a SUMPRODUCT over explicit row list to skip separator rows
            formula = "=" + "+".join(f"{ltr}{r}" for r in data_rows)
            c = ws.cell(row=xl_row, column=ci, value=formula)
            _sc(c, font=_TOT_FONT, fill=_TOT_FILL, align=_RIGHT, border=_BORDER, fmt="#,##0.00")
        ws.row_dimensions[xl_row].height = 20

    ws.freeze_panes = "A2"
    wb.save(output_path)
    print(f"  ✓  Saved → {output_path}  ({len(data_rows)} transaction rows)")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def process(input_file: str, output_file: str):
    print(f"\n  Input  : {input_file}")

    import openpyxl
    wb = openpyxl.load_workbook(input_file, read_only=True, data_only=True)
    sheet_names = wb.sheetnames
    wb.close()

    all_dfs    = []
    all_labels = []
    total      = 0

    for sheet in sheet_names:
        print(f"\n  Sheet  : '{sheet}'")
        df_raw = pd.read_excel(input_file, sheet_name=sheet, header=None, dtype=str)
        blocks = extract_blocks(df_raw)
        print(f"    Found {len(blocks)} table block(s)")

        for b_idx, (col_labels, rows) in enumerate(blocks, 1):
            df = clean_block(col_labels, rows)
            if df.empty:
                print(f"    Block {b_idx}: empty after cleaning — skipped")
                continue
            label = sheet if len(blocks) == 1 else f"{sheet} — Block {b_idx}"
            print(f"    Block {b_idx}: {len(df)} rows  |  columns: {list(df.columns)}")
            all_dfs.append(df)
            all_labels.append(label)
            total += len(df)

    if not all_dfs:
        raise RuntimeError("No transaction data found in any sheet.")

    print(f"\n  Total valid rows: {total}")
    df_final = merge_all(all_dfs, all_labels)
    write_output(df_final, output_file)
    print(f"  Done.\n")
    return df_final


# ─────────────────────────────────────────────────────────────────────────────
# ✏️  CONFIGURATION — edit these two lines, then run
# ─────────────────────────────────────────────────────────────────────────────

INPUT_FILE  = "test41.xlsx"    # path to your input Excel file
OUTPUT_FILE = "output47.xlsx"    # name for the cleaned output file

# ─────────────────────────────────────────────────────────────────────────────

process(INPUT_FILE, OUTPUT_FILE)