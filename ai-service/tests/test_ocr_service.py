"""PaddleOCR's shared predictor must never run on two threads at once."""

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import numpy as np

from app.services import ocr_service


class _OneAtATimeOCR:
    def __init__(self):
        self.active = 0
        self.max_active = 0
        self._guard = threading.Lock()

    def ocr(self, image, cls=True):
        with self._guard:
            self.active += 1
            self.max_active = max(self.max_active, self.active)
        time.sleep(0.05)
        with self._guard:
            self.active -= 1
        return [[[None, ("TEXT", 0.99)]]]


def test_concurrent_calls_are_serialized():
    fake = _OneAtATimeOCR()
    image = np.zeros((10, 10, 3), dtype=np.uint8)
    with patch.object(ocr_service, "_paddle_ocr", fake):
        with ThreadPoolExecutor(4) as pool:
            results = list(pool.map(ocr_service.run_paddle_ocr, [image] * 4))

    assert results == ["TEXT"] * 4
    assert fake.max_active == 1


def test_a_broken_tesseract_fallback_keeps_paddle_text():
    image = np.zeros((10, 10, 3), dtype=np.uint8)

    def tesseract_missing(images):
        raise RuntimeError("tesseract is not installed or it's not in your PATH")

    with patch.object(ocr_service.OCRService, "_ocr_with_paddle", staticmethod(lambda images: "TOTAL 2236")), \
            patch.object(ocr_service.OCRService, "_ocr_with_tesseract", staticmethod(tesseract_missing)):
        text, engine = ocr_service.OCRService().extract_text([image])

    assert (text, engine) == ("TOTAL 2236", "paddleocr")
