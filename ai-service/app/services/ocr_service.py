from __future__ import annotations

import cv2
import numpy as np
import pytesseract
import boto3

from app.config import settings


class OCRService:
    def __init__(self) -> None:
        kwargs: dict = {"region_name": settings.aws_region}
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            kwargs["aws_access_key_id"] = settings.aws_access_key_id
            kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        self._textract = boto3.client("textract", **kwargs)
        if settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    @staticmethod
    def _normalize_whitespace(text: str) -> str:
        return "\n".join(line.strip() for line in text.splitlines() if line.strip())

    def _ocr_with_textract(self, s3_key: str) -> str:
        response = self._textract.detect_document_text(
            Document={
                "S3Object": {
                    "Bucket": settings.aws_s3_bucket,
                    "Name": s3_key
                }
            }
        )
        lines = [
            block.get("Text", "")
            for block in response.get("Blocks", [])
            if block.get("BlockType") == "LINE"
        ]
        return self._normalize_whitespace("\n".join(lines))

    @staticmethod
    def _ocr_with_tesseract(images: list[np.ndarray]) -> str:
        all_text: list[str] = []
        for image in images:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            text = pytesseract.image_to_string(gray, lang="eng")
            if text:
                all_text.append(text)
        return "\n".join(all_text).strip()

    def extract_text(self, s3_key: str, processed_images: list[np.ndarray]) -> tuple[str, str]:
        textract_error = None
        try:
            textract_text = self._ocr_with_textract(s3_key)
            if len(textract_text) >= 20:
                return textract_text, "textract"
        except Exception as error:  # noqa: BLE001
            textract_error = error

        fallback_text = self._ocr_with_tesseract(processed_images)
        if fallback_text:
            return self._normalize_whitespace(fallback_text), "tesseract"

        if textract_error is not None:
            raise RuntimeError(f"OCR failed with Textract and Tesseract fallback: {textract_error}")
        raise RuntimeError("OCR did not return usable text")
