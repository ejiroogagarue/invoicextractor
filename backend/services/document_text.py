"""Utility helpers for extracting plain text from invoice documents."""

from __future__ import annotations

import io
import time
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class TextExtractionResult:
    """Container for raw text extraction results."""

    text: str
    page_count: int
    perf_metrics: Dict[str, float]


def extract_text_from_document(file_bytes: bytes, mime_type: str) -> TextExtractionResult:
    """Extract raw text from a PDF or image document.

    Returns a :class:`TextExtractionResult` containing the extracted text,
    page count and timing metadata (in milliseconds).
    """

    perf_metrics: Dict[str, float] = {}
    text_extract_start = time.time()
    raw_text = ""
    page_count = 1

    if mime_type == "application/pdf":
        raw_text, page_count = _extract_text_from_pdf(file_bytes)
    elif mime_type.startswith("image/"):
        raw_text, page_count = _extract_text_from_image(file_bytes)
    else:
        raise ValueError(f"Unsupported mime type: {mime_type}")

    perf_metrics["text_extraction_time"] = (time.time() - text_extract_start) * 1000

    return TextExtractionResult(text=raw_text, page_count=page_count, perf_metrics=perf_metrics)


def _extract_text_from_pdf(file_bytes: bytes) -> tuple[str, int]:
    try:
        import fitz  # type: ignore
    except ImportError as exc:  # pragma: no cover - library availability
        raise RuntimeError(
            "PyMuPDF (fitz) is required for PDF processing. Install with: pip install PyMuPDF"
        ) from exc

    pdf_document = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        page_count = len(pdf_document)
        raw_text_parts = []
        for page_num in range(page_count):
            page = pdf_document[page_num]
            raw_text_parts.append(f"\n\n=== Page {page_num + 1} ===\n\n")
            raw_text_parts.append(page.get_text())
        raw_text = "".join(raw_text_parts)
    finally:
        pdf_document.close()

    return raw_text, page_count


def _extract_text_from_image(file_bytes: bytes) -> tuple[str, int]:
    try:
        from PIL import Image
        import pytesseract
    except ImportError as exc:  # pragma: no cover - library availability
        raise RuntimeError(
            "Pillow and pytesseract are required for image processing. Install with: pip install Pillow pytesseract"
        ) from exc

    image = Image.open(io.BytesIO(file_bytes))
    raw_text = pytesseract.image_to_string(image)
    return raw_text, 1




