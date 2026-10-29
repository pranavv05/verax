"""CI installs a light dependency set (see .github/workflows/ci.yml), without
PaddleOCR's several-hundred-MB install. ocr_service imports it at module level,
so stand in for it when absent; the tests patch the engine they exercise."""
import importlib
import sys
from unittest.mock import MagicMock

try:
    importlib.import_module("paddleocr")
except ImportError:
    sys.modules["paddleocr"] = MagicMock()
