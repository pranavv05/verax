from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import List

import cv2
import fitz
import numpy as np

logger = logging.getLogger(__name__)
MAX_PAGES = 15


def is_blank_page(image, threshold: float = 0.98) -> bool:
    try:
        if hasattr(image, "convert"):
            gray = np.array(image.convert("L"))
        else:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        white_ratio = np.sum(gray > 240) / gray.size
        return white_ratio > threshold
    except Exception:  # noqa: BLE001
        return False


@dataclass
class PreprocessOutput:
    processed_images: List[np.ndarray]
    source_kind: str


class PreprocessService:
    @staticmethod
    def _decode_image_bytes(file_bytes: bytes) -> np.ndarray:
        np_buffer = np.frombuffer(file_bytes, dtype=np.uint8)
        image = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Unable to decode input file as image")
        return image

    @staticmethod
    def _deskew(image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        thresh = cv2.threshold(
            blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )[1]

        coords = np.column_stack(np.where(thresh > 0))
        if coords.size == 0:
            return image

        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        if abs(angle) < 0.3:
            return image

        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        return cv2.warpAffine(
            image,
            matrix,
            (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE
        )

    @staticmethod
    def _denoise_and_boost(image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contrasted = clahe.apply(denoised)
        return cv2.cvtColor(contrasted, cv2.COLOR_GRAY2BGR)

    @staticmethod
    def is_blank_page(image, threshold: float = 0.98) -> bool:
        return is_blank_page(image, threshold)

    def _render_pdf_pages(self, file_bytes: bytes) -> List[np.ndarray]:
        images: List[np.ndarray] = []
        with fitz.open(stream=io.BytesIO(file_bytes), filetype="pdf") as document:
            page_count = min(document.page_count, MAX_PAGES)
            for page_number in range(page_count):
                page = document.load_page(page_number)
                pixmap = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
                img_bytes = pixmap.tobytes("png")
                images.append(self._decode_image_bytes(img_bytes))
        if not images:
            raise ValueError("PDF contains no renderable pages")
        return images

    @staticmethod
    def _is_pdf(file_bytes: bytes) -> bool:
        return file_bytes[:4] == b"%PDF"

    def preprocess(self, file_bytes: bytes) -> PreprocessOutput:
        raw_images: List[np.ndarray]
        source_kind = "image"

        if self._is_pdf(file_bytes):
            raw_images = self._render_pdf_pages(file_bytes)
            source_kind = "pdf"
        else:
            raw_images = [self._decode_image_bytes(file_bytes)]

        processed = []
        skipped_blank = 0
        for raw_image in raw_images:
            if self.is_blank_page(raw_image):
                skipped_blank += 1
                continue
            try:
                deskewed = self._deskew(raw_image)
                enhanced = self._denoise_and_boost(deskewed)
            except Exception as error:  # noqa: BLE001
                logger.warning("Preprocessing failed; using original image: %s", error)
                enhanced = raw_image
            processed.append(enhanced)

        logger.info(
            "Preprocess completed: processed_pages=%d skipped_blank_pages=%d",
            len(processed),
            skipped_blank,
        )
        return PreprocessOutput(processed_images=processed, source_kind=source_kind)
