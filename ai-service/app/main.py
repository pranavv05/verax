from __future__ import annotations

import hmac
import logging

import pandas as pd
import psycopg2
from fastapi import Depends
from fastapi import FastAPI
from fastapi import File
from fastapi import Header
from fastapi import HTTPException
from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from app.config import settings
from app.models import ProcessRequest
from app.models import ProcessResponse
from app.services.llm_service import LLMExtractionError
from app.services.llm_service import LLMService
from app.services.ocr_service import OCRService
from app.services.persistence_service import PersistenceService
from app.services.preprocess_service import PreprocessService
from app.services.register_cleaner_service import process_bytes as clean_register_bytes
from app.services.bank_statement_xml_service import process_bytes as bank_statement_to_xml
from app.services.bank_statement_xml_service import generate_xml_with_ledgers
from app.models import BankStatementExportRequest
from app.services.s3_service import S3Service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

app = FastAPI(title="Verax AI Service", version="1.0.0")

s3_service: S3Service | None = None
preprocess_service: PreprocessService | None = None
ocr_service: OCRService | None = None
llm_service: LLMService | None = None
persistence_service: PersistenceService | None = None


def require_service_token(x_ai_service_token: str | None = Header(default=None)) -> None:
    if not hmac.compare_digest(x_ai_service_token or "", settings.ai_service_api_key):
        raise HTTPException(status_code=401, detail="Invalid AI service token")


async def read_upload_file_limited(file: UploadFile) -> bytes:
    max_bytes = settings.max_tool_upload_mb * 1024 * 1024
    chunks: list[bytes] = []
    total = 0

    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Tool uploads must be {settings.max_tool_upload_mb}MB or smaller",
            )
        chunks.append(chunk)

    return b"".join(chunks)


@app.on_event("startup")
def on_startup() -> None:
    global s3_service
    global preprocess_service
    global ocr_service
    global llm_service
    global persistence_service

    _ = pd.DataFrame()
    print(f"pandas {pd.__version__} OK")

    settings.validate()
    s3_service = S3Service()
    preprocess_service = PreprocessService()
    ocr_service = OCRService()
    llm_service = LLMService()
    persistence_service = PersistenceService()
    logger.info("AI service initialized")


@app.get("/health")
def health_check(response: Response) -> dict:
    # Checks actual DB reachability, not just "the process is up" — a
    # liveness-only check can't detect a service that's running but can't
    # reach Postgres (persistence_service writes name-mapping corrections
    # back on every approved extraction when AI_WRITE_BACK_ENABLED=true).
    # Runs in FastAPI's threadpool since this is a sync def, so the short
    # blocking connect below doesn't stall the event loop.
    try:
        conn = psycopg2.connect(settings.app_database_url, connect_timeout=4)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        finally:
            conn.close()
    except Exception as error:  # noqa: BLE001 - health check must never 500, only 503
        response.status_code = 503
        return {"status": "error", "message": str(error)}
    return {"status": "ok"}


@app.post(
    "/process",
    response_model=ProcessResponse,
    dependencies=[Depends(require_service_token)],
)
def process_document(request: ProcessRequest) -> ProcessResponse:
    if not s3_service or not preprocess_service or not ocr_service or not llm_service:
        raise HTTPException(status_code=500, detail="Service not initialized")

    logger.info("Processing document_id=%s key=%s", request.document_id, request.s3_key)

    try:
        file_bytes = s3_service.download_file_bytes(request.s3_key)

        # Bank statements downloaded from net banking are digital PDFs: their
        # own text is exact and costs no OCR, so a long statement is read in
        # full (up to MAX_TEXT_LAYER_PAGES) instead of stopping at the OCR cap.
        text_layer = (
            preprocess_service.extract_text_layer(file_bytes)
            if request.doc_type == "bank_statement"
            else None
        )
        page_texts: list[str] | None = None
        if text_layer is not None:
            page_texts = text_layer.page_texts
            raw_text = OCRService._normalize_whitespace(OCRService._join_pages(page_texts))
            ocr_engine = "pdf_text"
            source_kind = "pdf"
            pages_read = len(page_texts)
            total_pages = text_layer.total_pages
            truncated = text_layer.truncated
        else:
            preprocessed = preprocess_service.preprocess(file_bytes)
            raw_text, ocr_engine = ocr_service.extract_text(preprocessed.processed_images)
            source_kind = preprocessed.source_kind
            pages_read = len(preprocessed.processed_images)
            total_pages = preprocessed.total_pages
            truncated = preprocessed.truncated
        logger.info(
            "document_id=%s source_kind=%s ocr_engine=%s pages=%d/%d",
            request.document_id,
            source_kind,
            ocr_engine,
            pages_read,
            total_pages,
        )

        structured_data = llm_service.extract_structured_data(
            raw_text, doc_type=request.doc_type, page_texts=page_texts
        )
        confidence_score = llm_service.calculate_confidence(structured_data, doc_type=request.doc_type)

        if truncated:
            # MAX_PAGES previously truncated a long PDF (e.g. a full month's
            # bank statement) with no signal anywhere that pages were
            # dropped — the CA had no way to know 185 pages of transactions
            # were missing from what looked like a normal, confidently
            # extracted document. Force review and make the reason visible
            # on the Review page (ReviewPage.jsx renders _page_truncation_warning
            # the same way it already renders _tax_math_warning).
            structured_data["_page_truncation_warning"] = (
                f"Only the first {pages_read} of {total_pages} pages in this document "
                "were processed. The remaining pages were not read. Split the PDF "
                "and upload the rest as a separate document."
            )
            confidence_score = min(confidence_score, 0.3)

        logger.info(
            "document_id=%s source_kind=%s ocr_engine=%s raw_text_chars=%d confidence=%.3f document_type_detected=%s",
            request.document_id,
            source_kind,
            ocr_engine,
            len(raw_text),
            confidence_score,
            structured_data.get("document_type_detected"),
        )

        if settings.ai_write_back_enabled:
            if not request.firm_id:
                logger.warning(
                    "Skipping DB write-back for document_id=%s because firm_id is missing",
                    request.document_id
                )
            elif persistence_service:
                persistence_service.persist_extraction(
                    firm_id=request.firm_id,
                    document_id=request.document_id,
                    raw_text=raw_text,
                    structured_data=structured_data,
                    confidence_score=confidence_score
                )

        return ProcessResponse(
            document_id=request.document_id,
            structured_data=structured_data,
            confidence_score=confidence_score,
            raw_text=raw_text,
            ocr_engine=ocr_engine
        )
    except HTTPException:
        raise
    except LLMExtractionError as error:
        # Upstream dependency failure, not a bug here. 503 only when waiting
        # can help (the backend then retries without spending an attempt);
        # 422 when the same request would fail again (see LLMExtractionError).
        logger.error("LLM extraction failed for document_id=%s: %s", request.document_id, error)
        status_code = 503 if error.retryable else 422
        raise HTTPException(status_code=status_code, detail=str(error)) from error
    except Exception as error:  # noqa: BLE001
        logger.exception("Failed to process document_id=%s", request.document_id)
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/tools/register-clean", dependencies=[Depends(require_service_token)])
async def register_clean(file: UploadFile = File(...)) -> Response:
    """Accept an Excel file, return a cleaned Excel file."""
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are accepted")
    try:
        raw_bytes = await read_upload_file_limited(file)
        # CPU-bound pandas/openpyxl work: run it on the thread pool so it can't
        # stall the event loop (and with it /health and every /process call).
        cleaned_bytes = await run_in_threadpool(clean_register_bytes, raw_bytes)
        safe_name = file.filename.rsplit(".", 1)[0] + "_cleaned.xlsx"
        return Response(
            content=cleaned_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Register clean failed")
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/tools/bank-statement-xml")
async def bank_statement_xml(
    _: None = Depends(require_service_token),
    file: UploadFile = File(...),
    company_name: str = "My Company",
    bank_ledger: str = "Bank Account",
) -> dict:
    """Accept a bank statement PDF, return TallyPrime XML plus warnings."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    try:
        raw_bytes = await read_upload_file_limited(file)
        # pdfplumber/OCR plus a Groq call per narration can take minutes. Inside
        # an async handler that blocked the single uvicorn worker's event loop,
        # freezing document processing and failing the platform health check.
        return await run_in_threadpool(
            bank_statement_to_xml,
            raw_bytes,
            company_name=company_name,
            bank_ledger=bank_ledger,
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Bank statement XML conversion failed")
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/tools/bank-statement-xml/export")
async def bank_statement_xml_export(
    payload: BankStatementExportRequest,
    _: None = Depends(require_service_token),
) -> dict:
    """Build the final Tally XML once the CA has confirmed a ledger per transaction."""
    try:
        xml, voucher_count = await run_in_threadpool(
            generate_xml_with_ledgers,
            [txn.model_dump() for txn in payload.transactions],
            company_name=payload.company_name,
            bank_ledger=payload.bank_ledger,
        )
        return {"xml": xml, "voucherCount": voucher_count}
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Bank statement XML export failed")
        raise HTTPException(status_code=500, detail=str(error)) from error
