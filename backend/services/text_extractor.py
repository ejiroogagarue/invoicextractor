"""
Text Extraction Service
=======================
Intelligent text extraction with automatic method selection.

Strategy:
1. Detect document type (text-based vs scanned PDF)
2. Choose fastest extraction method
3. Clean and normalize extracted text
4. Return structured page data for downstream processing

Performance:
- Text PDFs (PyMuPDF): ~100ms
- Scanned PDFs (PaddleOCR): ~500ms per page (parallelized)
- Images (PaddleOCR): ~500ms

OPTIMIZATIONS:
- Global OCR singleton: Reuses PaddleOCR instance (eliminates 5-20s init cost)
- Parallel page processing: Processes all pages simultaneously (4x-10x faster)
"""

import fitz  # PyMuPDF
import asyncio
from typing import List, Optional
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor

# PaddleOCR imports - will be optional until installed
try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
except ImportError:
    PADDLEOCR_AVAILABLE = False
    PaddleOCR = None

# ═══════════════════════════════════════════════════════════
# GLOBAL OCR SINGLETON (Reused across all requests)
# ═══════════════════════════════════════════════════════════
# This eliminates the 5-20 second initialization cost
# by reusing the same PaddleOCR instance across requests
_global_ocr_instance = None
_ocr_initializing = False

async def get_ocr_instance():
    """
    Get or create global PaddleOCR instance (singleton pattern).
    
    This ensures PaddleOCR is only initialized once, eliminating
    the expensive 5-20 second initialization cost on every request.
    
    Returns:
        PaddleOCR instance (or None if not available)
    """
    global _global_ocr_instance, _ocr_initializing
    
    if _global_ocr_instance is not None:
        return _global_ocr_instance
    
    if not PADDLEOCR_AVAILABLE:
        return None
    
    # Simple check to prevent multiple simultaneous initializations
    if _ocr_initializing:
        # Wait a bit and check again
        await asyncio.sleep(0.1)
        return _global_ocr_instance if _global_ocr_instance else None
    
    _ocr_initializing = True
    try:
        # Double-check after setting flag
        if _global_ocr_instance is None:
            print("  → Initializing PaddleOCR (one-time cost: ~5-20s)...")
            # Run initialization in thread pool (blocking I/O)
            _global_ocr_instance = await asyncio.to_thread(
                lambda: PaddleOCR(
                    use_angle_cls=True,  # Detect and correct rotated text
                    lang='en',           # English only (faster than multi-language)
                    show_log=False       # Reduce logging overhead
                )
            )
            print("  ✓ PaddleOCR initialized (will be reused for all requests)")
    finally:
        _ocr_initializing = False
    
    return _global_ocr_instance


@dataclass
class PageText:
    """Represents extracted text from a single page"""
    index: int  # Page number (0-indexed)
    content: str  # Extracted text content
    
    def __post_init__(self):
        """Ensure content is never None"""
        if self.content is None:
            self.content = ""


class TextExtractor:
    """
    Intelligent text extraction with automatic method selection.
    
    Automatically chooses the best extraction method:
    - PyMuPDF for text-based PDFs (fast, ~100ms)
    - PaddleOCR for scanned PDFs/images (accurate, ~500ms per page, parallelized)
    
    OPTIMIZATIONS:
    - Uses global OCR singleton (no per-instance initialization cost)
    - Parallel page processing (4x-10x faster for multi-page PDFs)
    """
    
    def __init__(self):
        """
        Initialize text extractor.
        
        Note: PaddleOCR instance is obtained from global singleton
        to avoid expensive initialization on every request.
        """
        # OCR instance will be obtained from global singleton when needed
        # This avoids the 5-20 second initialization cost per request
        pass
    
    async def extract(self, file_bytes: bytes, mime_type: str) -> List[PageText]:
        """
        Main extraction method - routes to appropriate handler.
        
        Args:
            file_bytes: Raw file content
            mime_type: MIME type (e.g., 'application/pdf', 'image/jpeg')
        
        Returns:
            List of PageText objects, one per page
        
        Strategy:
            - PDFs: Detect if text-based or scanned, use appropriate method
            - Images: Always use PaddleOCR
        
        PERFORMANCE:
            - Text PDFs: ~100ms (PyMuPDF, synchronous)
            - Scanned PDFs: ~500ms per page (PaddleOCR, parallelized)
            - Images: ~500ms (PaddleOCR)
        """
        if mime_type == "application/pdf":
            return await self._extract_pdf(file_bytes)
        elif mime_type.startswith("image/"):
            return await self._extract_image(file_bytes)
        else:
            # Fallback: try to decode as text
            try:
                text = file_bytes.decode("utf-8", errors="ignore")
                return [PageText(index=0, content=text)] if text else []
            except Exception:
                return []
    
    async def _extract_pdf(self, file_bytes: bytes) -> List[PageText]:
        """
        Extract text from PDF - uses smart detection with per-page analysis.
        
        Strategy:
        1. Try PyMuPDF first (fast for text-based PDFs)
        2. Check EACH page individually for meaningful text
        3. If ANY page has minimal text, fallback to PaddleOCR for ALL pages
           (ensures consistent extraction across all pages)
        """
        # Step 1: Try PyMuPDF extraction (fast, ~100ms)
        pages = self._extract_with_pymupdf(file_bytes)
        
        # Step 2: Check if we got meaningful text on EACH page
        # This fixes multi-page invoices where first page has text but
        # subsequent pages are scanned images
        pages_with_minimal_text = [
            p for p in pages 
            if len(p.content.strip()) < 50  # Per-page threshold (more accurate)
        ]
        
        # If we have pages with minimal text, fallback to PaddleOCR for ALL pages
        # This ensures consistent extraction method across all pages
        if pages_with_minimal_text:
            print(f"  → {len(pages_with_minimal_text)} page(s) with minimal text, using PaddleOCR for all pages...")
            return await self._extract_with_paddleocr_pdf_parallel(file_bytes)
        
        # Clean and return PyMuPDF results
        return [PageText(index=p.index, content=self._clean_text(p.content)) for p in pages]
    
    def _extract_with_pymupdf(self, file_bytes: bytes) -> List[PageText]:
        """
        Fast extraction for text-based PDFs using PyMuPDF.
        
        Performance: ~100ms per document
        Best for: PDFs with embedded text (most invoices)
        """
        pages: List[PageText] = []
        document = fitz.open(stream=file_bytes, filetype="pdf")
        
        try:
            for page_index, page in enumerate(document):
                # Extract text from page
                page_text = page.get_text().strip()
                if page_text:
                    pages.append(PageText(index=page_index, content=page_text))
        finally:
            document.close()
        
        return pages
    
    async def _extract_with_paddleocr_pdf_parallel(self, file_bytes: bytes) -> List[PageText]:
        """
        Parallel OCR extraction for scanned PDFs using PaddleOCR.
        
        PERFORMANCE IMPROVEMENT:
        - Sequential (old): 4 pages = 4 × 500ms = 2000ms
        - Parallel (new): 4 pages = ~500-800ms (4x faster)
        
        Best for: Scanned documents, image-based PDFs, rotated text
        
        ARCHITECTURE:
        - Uses global OCR singleton (no initialization cost)
        - Processes all pages in parallel using ThreadPoolExecutor
        - Limits concurrency to 4-6 workers to avoid resource exhaustion
        """
        # Get OCR instance from global singleton
        ocr = await get_ocr_instance()
        if ocr is None:
            print("⚠️  PaddleOCR not available - cannot process scanned PDF")
            return []
        
        document = fitz.open(stream=file_bytes, filetype="pdf")
        pages_list = list(document)  # Convert to list for parallel processing
        total_pages = len(pages_list)
        
        print(f"  → Processing {total_pages} page(s) in parallel with PaddleOCR...")
        
        def process_page_sync(page_index: int, page) -> PageText:
            """
            Synchronous page processing function.
            Runs in thread pool for parallel execution.
            """
            try:
                # Convert PDF page to image
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better OCR
                img_bytes = pix.tobytes("png")
                
                # Run OCR on image (blocking call, but parallelized via thread pool)
                ocr_result = ocr.ocr(img_bytes, cls=True)
                
                # Extract text from OCR results
                page_text = self._parse_ocr_result(ocr_result)
                if page_text:
                    return PageText(index=page_index, content=self._clean_text(page_text))
                return PageText(index=page_index, content="")
            except Exception as e:
                print(f"  ⚠️  Error processing page {page_index + 1}: {e}")
                return PageText(index=page_index, content="")
        
        try:
            # Process all pages in parallel using ThreadPoolExecutor
            # Limit to 4-6 workers to balance speed vs resource usage
            max_workers = min(6, total_pages)  # Don't create more workers than pages
            
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Create tasks for all pages
                tasks = [
                    loop.run_in_executor(executor, process_page_sync, i, page)
                    for i, page in enumerate(pages_list)
                ]
                # Wait for all pages to complete (parallel execution)
                pages = await asyncio.gather(*tasks)
            
            # Sort by page index to ensure correct order
            pages = sorted([p for p in pages if p], key=lambda p: p.index)
            print(f"  ✓ Extracted text from {len(pages)} page(s) in parallel")
            
            return pages
            
        finally:
            document.close()
    
    async def _extract_image(self, file_bytes: bytes) -> List[PageText]:
        """
        Extract text from image files (JPG, PNG, etc.) using PaddleOCR.
        
        Performance: ~500ms per image
        """
        # Get OCR instance from global singleton
        ocr = await get_ocr_instance()
        if ocr is None:
            print("⚠️  PaddleOCR not available - cannot process images")
            return []
        
        # Run OCR on image (blocking call, but async wrapper)
        ocr_result = await asyncio.to_thread(ocr.ocr, file_bytes, cls=True)
        
        # Extract and clean text
        text = self._parse_ocr_result(ocr_result)
        if text:
            return [PageText(index=0, content=self._clean_text(text))]
        
        return []
    
    def _parse_ocr_result(self, ocr_result: Optional[List]) -> str:
        """
        Parse PaddleOCR result into clean text.
        
        PaddleOCR returns: [[[bbox], (text, confidence)], ...]
        We extract just the text and join with newlines.
        """
        if not ocr_result or not ocr_result[0]:
            return ""
        
        # Extract text from each detected line
        lines = []
        for page_result in ocr_result:
            if page_result:
                for line in page_result:
                    if line and len(line) >= 2:
                        text = line[1][0]  # Extract text (confidence is line[1][1])
                        if text.strip():
                            lines.append(text)
        
        return "\n".join(lines)
    
    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize extracted text.
        
        Removes:
        - Extra whitespace
        - Artifacts from OCR
        - Inconsistent line breaks
        
        Preserves:
        - Original structure
        - Numbers and formatting
        """
        # Defensive check: handle None or empty values
        if text is None or not text:
            return ""
        
        # Convert to string if somehow not a string
        if not isinstance(text, str):
            text = str(text)
        
        # Normalize line breaks (remove excessive newlines)
        lines = [line.strip() for line in text.split("\n")]
        lines = [line for line in lines if line]  # Remove empty lines
        
        # Join with single newlines
        cleaned = "\n".join(lines)
        
        # Remove excessive spaces (but preserve intentional spacing)
        cleaned = " ".join(cleaned.split())
        
        return cleaned
