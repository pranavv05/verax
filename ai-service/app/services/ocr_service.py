from __future__ import annotations

import cv2
import numpy as np
import pytesseract
import boto3
from PIL import Image

from app.config import settings


def preprocess_for_invoice(image: Image.Image) -> Image.Image:
    try:
        img = np.array(image.convert("RGB"))
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

        coords = np.column_stack(np.where(gray < 200))
        if len(coords) > 100:
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = 90 + angle
            if abs(angle) > 0.5:
                h, w = gray.shape
                center = (w // 2, h // 2)
                matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
                gray = cv2.warpAffine(
                    gray,
                    matrix,
                    (w, h),
                    flags=cv2.INTER_CUBIC,
                    borderMode=cv2.BORDER_REPLICATE,
                )

        gray = cv2.fastNlMeansDenoising(gray, h=10)
        binary = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            10,
        )

        h, w = binary.shape
        if w < 1500:
            scale = 1500 / w
            binary = cv2.resize(
                binary,
                None,
                fx=scale,
                fy=scale,
                interpolation=cv2.INTER_CUBIC,
            )

        return Image.fromarray(binary)
    except Exception:  # noqa: BLE001
        return image


def run_tesseract_invoice(image: Image.Image) -> str:
    processed = preprocess_for_invoice(image)
    results: list[tuple[int, str]] = []
    for psm in [3, 4, 6]:
        text = pytesseract.image_to_string(
            processed,
            lang="eng",
            config=(
                f"--psm {psm} --oem 1 "
                "-c tessedit_char_blacklist=|~`"
                " -c preserve_interword_spaces=1"
            ),
        )
        results.append((len(text.strip()), text))

    results.sort(reverse=True)
    return results[0][1] if results else ""


def detect_script(text: str) -> str:
    devanagari_chars = sum(1 for char in text if "\u0900" <= char <= "\u097F")
    if devanagari_chars > 5:
        return "hin"
    return "eng"


def run_tesseract_multilingual(image: Image.Image) -> str:
    eng_text = run_tesseract_invoice(image)
    if detect_script(eng_text) == "hin":
        processed = preprocess_for_invoice(image)
        hin_text = pytesseract.image_to_string(
            processed,
            lang="hin+eng",
            config="--psm 6 --oem 1",
        )
        return hin_text if len(hin_text) > len(eng_text) else eng_text
    return eng_text


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
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            text = run_tesseract_multilingual(Image.fromarray(rgb))
            if text:
                all_text.append(text)
        return "\n".join(all_text).strip()

    def extract_text(self, s3_key: str, processed_images: list[np.ndarray]) -> tuple[str, str]:
        textract_error = None
        try:
            textract_text = self._ocr_with_textract(s3_key)
            if len(textract_text) >= 50:
                return textract_text, "textract"
        except Exception as error:  # noqa: BLE001
            textract_error = error

        fallback_text = self._ocr_with_tesseract(processed_images)
        if fallback_text:
            return self._normalize_whitespace(fallback_text), "tesseract"

        if textract_error is not None:
            raise RuntimeError(f"OCR failed with Textract and Tesseract fallback: {textract_error}")
        raise RuntimeError("OCR did not return usable text")
