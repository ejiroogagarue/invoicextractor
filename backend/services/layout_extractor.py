"""
Layout Extraction Service
=========================
Harnesses Unstructured to understand PDF layout (tables, sections, coordinates).

Motivation:
- Raw OCR text loses spatial context (columns, headers, subtotals).
- Unstructured gives us structured elements so downstream stages stay accurate.
"""

from __future__ import annotations

import asyncio
import os
import time
import fitz  # PyMuPDF for rendering pages into images
import re
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

try:
    from unstructured.partition.image import partition_image

    UNSTRUCTURED_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    partition_image = None
    UNSTRUCTURED_AVAILABLE = False

try:
    from bs4 import BeautifulSoup

    BS4_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    BeautifulSoup = None
    BS4_AVAILABLE = False


@dataclass
class LayoutRowAnnotation:
    """Metadata describing a single table row extracted from layout analysis."""

    row_index: int
    row_type: str
    amount: Optional[float]
    has_zero_amount: bool
    raw_text: str


@dataclass
class LayoutTable:
    """
    Normalized table payload used by downstream stages (LLM + deterministic parser).
    """

    table_id: str
    page_index: int
    headers: List[str]
    rows: List[List[str]]
    section_label: Optional[str] = None
    bbox: Optional[Dict[str, float]] = None
    row_annotations: List[LayoutRowAnnotation] = field(default_factory=list)
    is_multi_page: bool = False
    page_range: str = ""
    source: str = "unstructured"
    confidence: Optional[float] = None

    def to_payload(self) -> Dict[str, Any]:
        """Serialize dataclass into JSON-serializable dict."""
        return {
            "table_id": self.table_id,
            "page_index": self.page_index,
            "page": self.page_index + 1,
            "page_range": self.page_range or str(self.page_index + 1),
            "is_multi_page": self.is_multi_page,
            "section_label": self.section_label,
            "headers": self.headers,
            "all_rows": self.rows,
            "row_annotations": [
                {
                    "row_index": ann.row_index,
                    "row_type": ann.row_type,
                    "amount": ann.amount,
                    "has_zero_amount": ann.has_zero_amount,
                    "raw_text": ann.raw_text,
                }
                for ann in self.row_annotations
            ],
            "bbox": self.bbox,
            "source": self.source,
            "confidence": self.confidence,
        }


class LayoutExtractor:
    """
    Convert PDFs/images into layout-aware hints (tables, headers, text blocks).

    Steps:
    1. Render PDF pages into high-res PNG (via PyMuPDF) so images preserve layout.
    2. Run Unstructured partitioner on each page image (parallel-safe via asyncio.to_thread).
    3. Normalize elements into a compact structure consumed by OpenAIInvoiceExtractor.
    """

    SECTION_HEADER_TYPES = {"Title", "Header", "Heading", "SectionHeader"}
    ROW_TYPE_KEYWORDS: Dict[str, Tuple[str, ...]] = {
        "subtotal": ("subtotal", "sub total"),
        "discount": ("discount", "promo", "rebate"),
        "tax": ("tax", "gst", "vat"),
        "shipping": ("shipping", "delivery", "freight"),
        "total": ("total", "balance due", "amount due"),
        "deposit": ("deposit", "retainer"),
        "fee": ("fee", "surcharge"),
    }

    def __init__(self, zoom: float = 2.0, max_pages: Optional[int] = None):
        self.zoom = zoom
        self.max_pages = max_pages
        self.money_regex = re.compile(r"-?\$?\s*\d[\d,]*\.?\d*")
        self.page_worker_limit = max(1, int(os.getenv("LAYOUT_PAGE_WORKERS", "4")))

    async def extract(self, file_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        """
        Entry point used by FastAPI pipeline.

        Returns:
            {
                "pages": [...],
                "tables": [...],
                "sections": [...],
                "metadata": {...}
            }
        """
        # PHASE 3 OPTIMIZATION: Disable unstructured (179s bottleneck)
        # The table-transformer model has issues ("Cannot copy out of meta tensor")
        # pdfplumber fallback is faster and more reliable for our use case
        print("⚠️  Layout extraction disabled (using fast pdfplumber fallback)")
        return self._empty_payload("disabled_phase3_optimization")
        
        # Original code (kept for reference):
        # if not UNSTRUCTURED_AVAILABLE:
        #     print("⚠️  Unstructured not installed - layout stage disabled.")
        #     return self._empty_payload("unavailable")
        #
        # if mime_type == "application/pdf":
        #     return await self._extract_pdf(file_bytes)
        #
        # if mime_type.startswith("image/"):
        #     return await self._extract_image(file_bytes)
        #
        # print(f"⚠️  Unsupported MIME type for layout extraction: {mime_type}")
        # return self._empty_payload("unsupported")

    async def _extract_pdf(self, file_bytes: bytes) -> Dict[str, Any]:
        document = fitz.open(stream=file_bytes, filetype="pdf")
        try:
            page_count = len(document)
            images: List[Tuple[int, bytes, Tuple[float, float]]] = []
            for index, page in enumerate(document):
                if self.max_pages and index >= self.max_pages:
                    break
                pix = page.get_pixmap(matrix=fitz.Matrix(self.zoom, self.zoom))
                images.append((index, pix.tobytes("png"), (page.rect.width, page.rect.height)))
        finally:
            document.close()

        pages: List[Dict[str, Any]] = []
        tables: List[LayoutTable] = []
        sections: List[Dict[str, Any]] = []
        element_count = 0
        page_timings: List[Dict[str, Any]] = []

        page_semaphore = asyncio.Semaphore(min(self.page_worker_limit, max(1, len(images))))

        async def process_page(entry: Tuple[int, bytes, Tuple[float, float]]):
            page_index, image_bytes, dimensions = entry
            start = time.perf_counter()
            async with page_semaphore:
                elements = await self._partition_image(image_bytes)
            normalized_page = self._normalize_page(
                page_index=page_index,
                elements=elements,
                dimensions=dimensions,
            )
            duration_ms = (time.perf_counter() - start) * 1000
            return page_index, normalized_page, duration_ms

        page_results = await asyncio.gather(*(process_page(entry) for entry in images))
        page_results.sort(key=lambda item: item[0])

        for _, normalized_page, duration_ms in page_results:
            pages.append(normalized_page["page"])
            tables.extend(normalized_page["tables"])
            sections.extend(normalized_page["sections"])
            element_count += normalized_page["element_count"]
            page_number = normalized_page["page"]["page_number"]
            page_timings.append(
                {
                    "page": page_number,
                    "duration_ms": round(duration_ms, 2),
                }
            )

        merged_tables = self._merge_tables(tables)
        metadata = {
            "source": "unstructured-image",
            "page_count": page_count,
            "pages_processed": len(pages),
            "tables_detected": len(merged_tables),
            "elements_detected": element_count,
            "page_timings": page_timings,
            "page_workers": self.page_worker_limit,
        }

        return {
            "pages": pages,
            "tables": [table.to_payload() for table in merged_tables],
            "sections": sections,
            "metadata": metadata,
        }

    async def _extract_image(self, file_bytes: bytes) -> Dict[str, Any]:
        elements = await self._partition_image(file_bytes)
        normalized_page = self._normalize_page(
            page_index=0,
            elements=elements,
            dimensions=(0.0, 0.0),
        )
        metadata = {
            "source": "unstructured-image",
            "page_count": 1,
            "pages_processed": 1,
            "tables_detected": len(normalized_page["tables"]),
            "elements_detected": normalized_page["element_count"],
        }
        return {
            "pages": [normalized_page["page"]],
            "tables": [table.to_payload() for table in normalized_page["tables"]],
            "sections": normalized_page["sections"],
            "metadata": metadata,
        }

    async def _partition_image(self, image_bytes: bytes) -> List[Any]:
        if not partition_image:
            return []

        async def _run_with_strategy(strategy: str):
            return await asyncio.to_thread(
                partition_image,
                file=BytesIO(image_bytes),
                infer_table_structure=True,
                strategy=strategy,
            )

        strategies = ["fast", "auto", "hi_res"]
        last_error: Exception | None = None

        for strategy in strategies:
            try:
                return await _run_with_strategy(strategy)
            except Exception as exc:  # pragma: no cover - safety
                last_error = exc
                # The fast strategy is not supported for images; try the next option.
                if "fast strategy is not available" not in str(exc).lower():
                    print(f"  ⚠️  Unstructured.partition_image failed ({strategy}): {exc}")
                    break

        if last_error:
            print(f"  ⚠️  Unstructured.partition_image failed: {last_error}")
        return []

    def _normalize_page(
        self,
        *,
        page_index: int,
        elements: List[Any],
        dimensions: Tuple[float, float],
    ) -> Dict[str, Any]:
        page_elements: List[Dict[str, Any]] = []
        page_tables: List[LayoutTable] = []
        page_sections: List[Dict[str, Any]] = []
        current_section: Optional[str] = None

        for element_index, element in enumerate(elements or []):
            element_type = getattr(element, "category", element.__class__.__name__)
            text = (getattr(element, "text", "") or "").strip()
            bbox = self._bbox_from_element(element)
            metadata = {
                "type": element_type,
                "text": text,
                "bbox": bbox,
                "page_index": page_index,
                "element_index": element_index,
            }
            page_elements.append(metadata)

            if self._is_section_header(element_type, text):
                current_section = text
                page_sections.append(
                    {
                        "label": text,
                        "page_index": page_index,
                        "page": page_index + 1,
                        "bbox": bbox,
                    }
                )

            if element_type.lower() == "table":
                table = self._table_from_element(
                    element=element,
                    page_index=page_index,
                    table_index=len(page_tables),
                    section_label=current_section,
                    bbox=bbox,
                )
                if table:
                    page_tables.append(table)

        page_payload = {
            "page_index": page_index,
            "page_number": page_index + 1,
            "dimensions": {"width": dimensions[0], "height": dimensions[1]},
            "elements": page_elements,
        }

        return {
            "page": page_payload,
            "tables": page_tables,
            "sections": page_sections,
            "element_count": len(page_elements),
        }

    def _table_from_element(
        self,
        *,
        element: Any,
        page_index: int,
        table_index: int,
        section_label: Optional[str],
        bbox: Optional[Dict[str, float]],
    ) -> Optional[LayoutTable]:
        headers, rows = self._parse_table(element)
        if not rows:
            return None

        annotations = self._annotate_rows(rows)
        table_id = f"p{page_index + 1}-t{table_index + 1}"
        confidence = getattr(getattr(element, "metadata", None), "score", None)
        return LayoutTable(
            table_id=table_id,
            page_index=page_index,
            headers=headers,
            rows=rows,
            section_label=section_label,
            bbox=bbox,
            row_annotations=annotations,
            page_range=str(page_index + 1),
            confidence=confidence,
        )

    def _parse_table(self, element: Any) -> Tuple[List[str], List[List[str]]]:
        headers: List[str] = []
        rows: List[List[str]] = []
        metadata = getattr(element, "metadata", None)
        html = getattr(metadata, "text_as_html", None)

        if html and BS4_AVAILABLE:
            soup = BeautifulSoup(html, "html.parser")
            for row in soup.find_all("tr"):
                cells = [cell.get_text(strip=True) for cell in row.find_all(["th", "td"])]
                if not cells or all(not cell for cell in cells):
                    continue
                if not headers:
                    headers = cells
                else:
                    rows.append(cells)
        else:
            text = (getattr(element, "text", "") or "").strip()
            for line in text.splitlines():
                parts = [part.strip() for part in line.split("  ") if part.strip()]
                if not parts:
                    continue
                if not headers:
                    headers = parts
                else:
                    rows.append(parts)

        cleaned_headers = [header.strip() for header in headers]
        normalized_rows = [row for row in (rows or []) if any(cell.strip() for cell in row)]
        return cleaned_headers, normalized_rows

    def _annotate_rows(self, rows: List[List[str]]) -> List[LayoutRowAnnotation]:
        annotations: List[LayoutRowAnnotation] = []
        for idx, row in enumerate(rows):
            row_text = " | ".join(str(cell or "").strip() for cell in row)
            amount = self._parse_money_from_row(row)
            row_type = self._classify_row(row_text)
            annotations.append(
                LayoutRowAnnotation(
                    row_index=idx,
                    row_type=row_type,
                    amount=amount,
                    has_zero_amount=bool(amount is not None and abs(amount) < 0.01),
                    raw_text=row_text,
                )
            )
        return annotations

    def _classify_row(self, row_text: str) -> str:
        lowered = row_text.lower()
        for row_type, keywords in self.ROW_TYPE_KEYWORDS.items():
            if any(keyword in lowered for keyword in keywords):
                return row_type
        return "line_item"

    def _parse_money_from_row(self, row: List[str]) -> Optional[float]:
        for cell in reversed(row):
            if not cell:
                continue
            match = self.money_regex.search(cell)
            if match:
                value = match.group(0).replace("$", "").replace(",", "").strip()
                try:
                    number = float(value)
                except ValueError:
                    continue
                return number
        return None

    def _merge_tables(self, tables: List[LayoutTable]) -> List[LayoutTable]:
        if not tables:
            return []
        merged: List[LayoutTable] = []
        for table in tables:
            if merged:
                previous = merged[-1]
                if (
                    table.page_index == previous.page_index + 1
                    and self._headers_match(previous.headers, table.headers)
                    and table.section_label == previous.section_label
                ):
                    previous.rows.extend(table.rows)
                    previous.row_annotations.extend(table.row_annotations)
                    previous.is_multi_page = True
                    previous.page_range = f"{previous.page_range.split('-')[0]}-{table.page_index + 1}"
                    continue
            merged.append(table)
        return merged

    def _headers_match(self, headers_a: List[str], headers_b: List[str]) -> bool:
        if len(headers_a) != len(headers_b):
            return False
        normalized_a = [header.lower().strip().replace(" ", "") for header in headers_a]
        normalized_b = [header.lower().strip().replace(" ", "") for header in headers_b]
        matches = sum(1 for h1, h2 in zip(normalized_a, normalized_b) if h1 == h2)
        return matches >= max(1, int(len(normalized_a) * 0.7))

    def _bbox_from_element(self, element: Any) -> Optional[Dict[str, float]]:
        metadata = getattr(element, "metadata", None)
        coords = getattr(metadata, "coordinates", None)
        if not coords:
            return None
        points = getattr(coords, "points", None) or []
        if not points:
            return None
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        return {"x1": min(xs), "y1": min(ys), "x2": max(xs), "y2": max(ys)}

    def _is_section_header(self, element_type: str, text: str) -> bool:
        if not text:
            return False
        if element_type in self.SECTION_HEADER_TYPES:
            return True
        # Short, uppercase strings often represent section dividers
        if len(text) <= 32 and text.isupper():
            return True
        return False

    def _empty_payload(self, reason: str) -> Dict[str, Any]:
        return {
            "pages": [],
            "tables": [],
            "sections": [],
            "metadata": {"source": "unstructured-missing", "reason": reason},
        }

