import fitz
import numpy as np
import cv2
import pytest

from app.services.preprocess_service import MAX_PAGES, PreprocessService


def _make_pdf(page_count: int) -> bytes:
    doc = fitz.open()
    for i in range(page_count):
        page = doc.new_page()
        page.insert_text((72, 72), f"Page {i + 1} of {page_count} — invoice content")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def _make_png() -> bytes:
    img = np.full((100, 100, 3), 255, dtype=np.uint8)
    cv2.putText(img, "INV", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


@pytest.fixture
def service():
    return PreprocessService()


class TestPageTruncation:
    def test_a_pdf_longer_than_max_pages_is_flagged_truncated(self, service):
        # Regression test: this used to silently drop every page past
        # MAX_PAGES with no signal anywhere that pages were missing.
        pdf_bytes = _make_pdf(MAX_PAGES + 5)
        out = service.preprocess(pdf_bytes)
        assert out.total_pages == MAX_PAGES + 5
        assert out.truncated is True
        assert len(out.processed_images) <= MAX_PAGES

    def test_a_pdf_at_or_under_max_pages_is_not_flagged_truncated(self, service):
        pdf_bytes = _make_pdf(3)
        out = service.preprocess(pdf_bytes)
        assert out.total_pages == 3
        assert out.truncated is False
        assert len(out.processed_images) == 3

    def test_a_single_image_input_is_never_flagged_truncated(self, service):
        out = service.preprocess(_make_png())
        assert out.total_pages == 1
        assert out.truncated is False
