"""
Invoice Extractor Provider Factory
===================================
Configuration utilities and factory for invoice extraction providers.

SUPPORTED PROVIDERS:
--------------------
1. OpenAI (gpt-4o-mini)
   - Fast: 2-4s per invoice
   - Accurate: Better at complex/proposal formats
   - Cost: Cheap with free credits

2. Gemini (gemini-flash-latest)
   - Reliable: Free tier available
   - Slower: 9-10s per invoice
   - Good for standard invoices

3. DeepSeek
   - Fallback: Last resort
   - Slower and less accurate
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional, Protocol

from .deepseek_ocr import DeepseekInvoiceExtractor

try:
    from .gemini_invoice_extractor import GeminiInvoiceExtractor
except ImportError:  # pragma: no cover - optional dependency until file exists
    GeminiInvoiceExtractor = None  # type: ignore

try:
    from .openai_invoice_extractor import OpenAIInvoiceExtractor
except ImportError:  # pragma: no cover - optional dependency until installed
    OpenAIInvoiceExtractor = None  # type: ignore


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
    """
    OCR configuration settings.
    
    Attributes:
        provider: OCR provider name (openai, gemini, deepseek)
        model: Model name (e.g., gpt-4o-mini, gemini-flash-latest)
        openai_api_key: OpenAI API key (for OpenAI provider)
        gemini_api_key: Gemini API key (for Gemini provider)
        max_concurrency: Maximum concurrent invoice processing
        request_timeout: API request timeout in seconds
        max_retries: Maximum retry attempts on failure
        page_fanout: Whether to process pages separately
    """
    provider: str
    model: Optional[str]
    openai_api_key: Optional[str]
    gemini_api_key: Optional[str]
    max_concurrency: int
    request_timeout: float
    max_retries: int
    page_fanout: bool


def get_ocr_settings() -> OCRSettings:
    """
    Read OCR-related configuration from environment variables.
    
    ENVIRONMENT VARIABLES:
    ----------------------
    OCR_PROVIDER: Provider name (openai, gemini, deepseek) - defaults to "openai"
    OPENAI_API_KEY: OpenAI API key (required for OpenAI provider)
    GEMINI_API_KEY: Gemini API key (required for Gemini provider)
    GEMINI_MODEL: Gemini model name (defaults to gemini-flash-latest)
    OCR_MAX_CONCURRENCY: Max concurrent requests (defaults to 4 for OpenAI)
    OCR_REQUEST_TIMEOUT: API timeout in seconds (defaults to 60)
    OCR_MAX_RETRIES: Max retry attempts (defaults to 3)
    OCR_PAGE_FANOUT: Process pages separately (defaults to true)
    
    Returns:
        OCRSettings instance with configuration
    """
    # ═══════════════════════════════════════════════════════════
    # Provider selection (default to OpenAI for speed)
    # ═══════════════════════════════════════════════════════════
    provider = os.getenv("OCR_PROVIDER", "openai").strip().lower()
    
    # ═══════════════════════════════════════════════════════════
    # API keys
    # ═══════════════════════════════════════════════════════════
    openai_api_key = os.getenv("OPENAI_API_KEY")
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    
    # ═══════════════════════════════════════════════════════════
    # Model configuration
    # ═══════════════════════════════════════════════════════════
    model = os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip()
    
    # ═══════════════════════════════════════════════════════════
    # Performance settings
    # ═══════════════════════════════════════════════════════════
    # Default concurrency: 4 (OpenAI is faster, can handle more)
    max_concurrency = int(os.getenv("OCR_MAX_CONCURRENCY", "4"))
    request_timeout = float(os.getenv("OCR_REQUEST_TIMEOUT", "60"))
    max_retries = int(os.getenv("OCR_MAX_RETRIES", "3"))
    page_fanout = os.getenv("OCR_PAGE_FANOUT", "true").strip().lower() in {"1", "true", "yes"}

    return OCRSettings(
        provider=provider,
        model=model,
        openai_api_key=openai_api_key,
        gemini_api_key=gemini_api_key,
        max_concurrency=max_concurrency,
        request_timeout=request_timeout,
        max_retries=max_retries,
        page_fanout=page_fanout,
    )


def get_invoice_extractor(settings: OCRSettings) -> InvoiceExtractorProtocol:
    """
    Instantiate the configured invoice extractor implementation.
    
    PROVIDER SELECTION:
    -------------------
    1. OpenAI (Primary) - Fast and cost-effective
       - Requires: OPENAI_API_KEY
       - Performance: 2-4s per invoice
       - Best for: All document types
    
    2. Gemini (Fallback 1) - Reliable with free tier
       - Requires: GEMINI_API_KEY
       - Performance: 9-10s per invoice
       - Best for: Standard invoices
    
    3. DeepSeek (Fallback 2) - Last resort
       - No API key required
       - Performance: Varies
       - Best for: Simple documents
    
    Args:
        settings: OCR configuration settings
    
    Returns:
        Configured invoice extractor instance
    
    Raises:
        RuntimeError: If required API key is missing
    """
    # ═══════════════════════════════════════════════════════════
    # OpenAI Provider (Primary - Fast & Cost-Effective)
    # ═══════════════════════════════════════════════════════════
    if settings.provider == "openai":
        if OpenAIInvoiceExtractor is None:
            raise RuntimeError(
                "OpenAI extractor module not available. "
                "Install dependencies: pip install openai paddleocr paddlepaddle"
            )
        if not settings.openai_api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is required when OCR_PROVIDER is set to 'openai'. "
                "Add it to your .env file."
            )
        
        print(f"✅ Using OpenAI provider (gpt-4o-mini)")
        return OpenAIInvoiceExtractor()
    
    # ═══════════════════════════════════════════════════════════
    # Gemini Provider (Fallback 1 - Reliable)
    # ═══════════════════════════════════════════════════════════
    if settings.provider == "gemini":
        if GeminiInvoiceExtractor is None:
            raise RuntimeError("Gemini extractor module not available.")
        if not settings.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is required when OCR_PROVIDER is set to 'gemini'. "
                "Add it to your .env file."
            )
        
        print(f"✅ Using Gemini provider ({settings.model})")
        return GeminiInvoiceExtractor(
            api_key=settings.gemini_api_key,
            model=settings.model,
            timeout=settings.request_timeout,
            max_retries=settings.max_retries,
            fan_out_pages=settings.page_fanout,
        )
    
    # ═══════════════════════════════════════════════════════════
    # DeepSeek Provider (Fallback 2 - Last Resort)
    # ═══════════════════════════════════════════════════════════
    print(f"✅ Using DeepSeek provider (default)")
    return DeepseekInvoiceExtractor()


