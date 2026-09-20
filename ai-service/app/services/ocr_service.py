from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

import cv2
import numpy as np
import pytesseract
from paddleocr import PaddleOCR
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)

# A pathological image (huge dimensions, adversarial input) can make PaddleOCR
# or Tesseract hang indefinitely with no library-level timeout of their own.
# Running each engine in a worker thread lets us bound it with a wall-clock
# timeout instead of hanging the whole /process request forever.
_ocr_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ocr-engine")


def _run_with_timeout(func, *args, timeout_seconds: int, label: str):
    future = _ocr_executor.submit(func, *args)
    try:
        return future.result(timeout=timeout_seconds)
    except FutureTimeoutError:
        logger.error("%s timed out after %ds", label, timeout_seconds)
        return ""

_paddle_ocr: PaddleOCR | None = None


def get_paddle_ocr() -> PaddleOCR:
    global _paddle_ocr
    if _paddle_ocr is None:
        _paddle_ocr = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            use_gpu=False,
            show_log=False,
        )
    return _paddle_ocr


def run_paddle_ocr(image: np.ndarray) -> str:
    try:
        ocr = get_paddle_ocr()
        result = ocr.ocr(image, cls=True)
        lines: list[str] = []
        dropped = 0
        if result and result[0]:
            for line in result[0]:
                if line and len(line) >= 2:
                    text = line[1][0]
                    confidence = line[1][1]
                    # Clean, computer-rendered PDF pages score >0.9 almost
                    # uniformly, but real camera photos (uneven lighting,
                    # slight blur/angle) routinely produce legitimate text
                    # in the 0.3-0.5 range. Filtering those out at 0.5 was
                    # silently discarding real invoice text on photos while
                    # never affecting PDFs, which then surfaced downstream
                    # as "not enough text" / garbage-OCR on images only.
                    # The downstream is_ocr_garbage() check is the real
                    # safety net for genuinely unusable text, so keep this
                    # threshold low and let that check decide.
                    if confidence > 0.3:
                        lines.append(text)
                    else:
                        dropped += 1
        text_out = "\n".join(lines)
        logger.info(
            "PaddleOCR: kept %d line(s) (%d chars), dropped %d low-confidence line(s)",
            len(lines),
            len(text_out),
            dropped,
        )
        return text_out
    except Exception as error:  # noqa: BLE001
        logger.error("PaddleOCR failed: %s", error)
        return ""


def preprocess_for_invoice(image: Image.Image) -> Image.Image:
    try:
        img = np.array(image.convert("RGB"))
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

        coords = np.column_stack(np.where(gray < 200))
        if len(coords) > 100:
            # Same OpenCV minAreaRect angle-convention issue as
            # preprocess_service._deskew: normalize into (-45, 45] instead of
            # assuming the pre-4.5 [-90, 0) range, or an upright page's ~90
            # angle gets misread as skew and rotated 90 degrees.
            raw_angle = cv2.minAreaRect(coords)[-1]
            angle = raw_angle % 90
            if angle > 45:
                angle -= 90
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
    devanagari_chars = sum(1 for char in text if "ऀ" <= char <= "ॿ")
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
        if settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    @staticmethod
    def _normalize_whitespace(text: str) -> str:
        return "\n".join(line.strip() for line in text.splitlines() if line.strip())

    @staticmethod
    def _join_pages(page_texts: list[str]) -> str:
        if len(page_texts) <= 1:
            return "\n".join(page_texts).strip()
        return "\n".join(
            f"\n--- PAGE {index} ---\n\n{text}" for index, text in enumerate(page_texts, start=1)
        ).strip()

    @staticmethod
    def _ocr_with_paddle(images: list[np.ndarray]) -> str:
        all_text: list[str] = []
        for image in images:
            text = run_paddle_ocr(image)
            if text:
                all_text.append(text)
        return OCRService._join_pages(all_text)

    @staticmethod
    def _ocr_with_tesseract(images: list[np.ndarray]) -> str:
        all_text: list[str] = []
        for image in images:
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            text = run_tesseract_multilingual(Image.fromarray(rgb))
            if text:
                all_text.append(text)
        return OCRService._join_pages(all_text)

    def extract_text(self, processed_images: list[np.ndarray]) -> tuple[str, str]:
        logger.info("OCR starting: %d preprocessed page(s), trying PaddleOCR first", len(processed_images))
        paddle_text = _run_with_timeout(
            self._ocr_with_paddle,
            processed_images,
            timeout_seconds=settings.ocr_timeout_seconds,
            label="PaddleOCR",
        )
        if len(paddle_text) >= 50:
            logger.info("OCR result: engine=paddleocr chars=%d", len(paddle_text))
            return self._normalize_whitespace(paddle_text), "paddleocr"

        logger.info(
            "PaddleOCR returned only %d char(s) (<50), falling back to Tesseract", len(paddle_text)
        )
        fallback_text = _run_with_timeout(
            self._ocr_with_tesseract,
            processed_images,
            timeout_seconds=settings.ocr_timeout_seconds,
            label="Tesseract",
        )
        if fallback_text:
            logger.info("OCR result: engine=tesseract chars=%d", len(fallback_text))
            return self._normalize_whitespace(fallback_text), "tesseract"

        if paddle_text:
            logger.info("OCR result: engine=paddleocr (fallback empty) chars=%d", len(paddle_text))
            return self._normalize_whitespace(paddle_text), "paddleocr"

        logger.error("OCR produced no usable text from either PaddleOCR or Tesseract")
        raise RuntimeError("OCR did not return usable text")
