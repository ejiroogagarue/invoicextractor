"""Invoice extractor provider factory and configuration utilities."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional, Protocol

from .deepseek_ocr import DeepseekInvoiceExtractor

try:
    from .gemini_invoice_extractor import GeminiInvoiceExtractor
except ImportError:  # pragma: no cover - optional dependency until file exists
    GeminiInvoiceExtractor = None  # type: ignore


class InvoiceExtractorProtocol(Protocol):
    """Typing protocol for invoice extractor implementations."""

    name: str

    async def extract_invoice(
        self,
        *,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
    ) -> dict:
        ...


@dataclass(frozen=True)
class OCRSettings:
    provider: str
    model: Optional[str]
    gemini_api_key: Optional[str]
    max_concurrency: int
    request_timeout: float
    max_retries: int
    page_fanout: bool


def get_ocr_settings() -> OCRSettings:
    """Read OCR-related configuration from environment variables."""

    provider = os.getenv("OCR_PROVIDER", "deepseek").strip().lower()
    model = os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip()
    api_key = os.getenv("GEMINI_API_KEY")
    max_concurrency = int(os.getenv("OCR_MAX_CONCURRENCY", "3"))
    request_timeout = float(os.getenv("OCR_REQUEST_TIMEOUT", "60"))
    max_retries = int(os.getenv("OCR_MAX_RETRIES", "3"))
    page_fanout = os.getenv("OCR_PAGE_FANOUT", "true").strip().lower() in {"1", "true", "yes"}

    return OCRSettings(
        provider=provider,
        model=model,
        gemini_api_key=api_key,
        max_concurrency=max_concurrency,
        request_timeout=request_timeout,
        max_retries=max_retries,
        page_fanout=page_fanout,
    )


def get_invoice_extractor(settings: OCRSettings) -> InvoiceExtractorProtocol:
    """Instantiate the configured invoice extractor implementation."""

    if settings.provider == "gemini":
        if GeminiInvoiceExtractor is None:
            raise RuntimeError("Gemini extractor module not available.")
        if not settings.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is required when OCR_PROVIDER is set to 'gemini'."
            )
        return GeminiInvoiceExtractor(
            api_key=settings.gemini_api_key,
            model=settings.model,
            timeout=settings.request_timeout,
            max_retries=settings.max_retries,
            fan_out_pages=settings.page_fanout,
        )

    # Default to DeepSeek implementation
    return DeepseekInvoiceExtractor()


