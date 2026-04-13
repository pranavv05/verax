from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi import HTTPException

from app.config import settings
from app.models import ProcessRequest
from app.models import ProcessResponse
from app.services.llm_service import LLMService
from app.services.ocr_service import OCRService
from app.services.persistence_service import PersistenceService
from app.services.preprocess_service import PreprocessService
from app.services.s3_service import S3Service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

app = FastAPI(title="Verax AI Service", version="1.0.0")

s3_service: S3Service | None = None
preprocess_service: PreprocessService | None = None
ocr_service: OCRService | None = None
llm_service: LLMService | None = None
persistence_service: PersistenceService | None = None


@app.on_event("startup")
def on_startup() -> None:
    global s3_service
    global preprocess_service
    global ocr_service
    global llm_service
    global persistence_service

    settings.validate()
    s3_service = S3Service()
    preprocess_service = PreprocessService()
    ocr_service = OCRService()
    llm_service = LLMService()
    persistence_service = PersistenceService()
    logger.info("AI service initialized")


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/process", response_model=ProcessResponse)
def process_document(request: ProcessRequest) -> ProcessResponse:
    if not s3_service or not preprocess_service or not ocr_service or not llm_service:
        raise HTTPException(status_code=500, detail="Service not initialized")

    logger.info("Processing document_id=%s key=%s", request.document_id, request.s3_key)

    try:
        file_bytes = s3_service.download_file_bytes(request.s3_key)
        preprocessed = preprocess_service.preprocess(file_bytes)
        raw_text, ocr_engine = ocr_service.extract_text(
            request.s3_key, preprocessed.processed_images
        )
        structured_data = llm_service.extract_structured_data(raw_text, doc_type=request.doc_type)
        confidence_score = llm_service.calculate_confidence(structured_data, doc_type=request.doc_type)

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
    except Exception as error:  # noqa: BLE001
        logger.exception("Failed to process document_id=%s", request.document_id)
        raise HTTPException(status_code=500, detail=str(error)) from error
