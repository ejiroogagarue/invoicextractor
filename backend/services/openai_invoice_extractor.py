"""
OpenAI Invoice Extractor
========================
GPT-4o Mini for structuring invoice data from extracted text.

Two-stage pipeline:
1. Text Extraction (PaddleOCR/PyMuPDF) → 0.1-0.5s
2. GPT-4o Mini Structuring → 2-4s

Total: ~3-5s per invoice (vs 10s with Gemini)

Advantages:
- Fast API response (2-4s vs 9-10s)
- JSON mode (guaranteed valid structure)
- Better at complex/proposal formats
- Cost-effective with free credits
"""

import os
import json
import time
import asyncio
import copy
from typing import Dict, Any, List, Optional

# OpenAI imports - will be optional until installed
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    AsyncOpenAI = None

from services.text_extractor import TextExtractor, PageText
from services.universal_feature_extractor import UniversalFeatureExtractor
from services.layout_extractor import LayoutExtractor
from services.performance_tracker import get_tracker
from services.deterministic_extractor import DeterministicExtractor

LLM_MAX_CONCURRENT = max(1, int(os.getenv("LLM_MAX_CONCURRENT", "3")))
LLM_STAGE_SEMAPHORE = asyncio.Semaphore(LLM_MAX_CONCURRENT)

# ═══════════════════════════════════════════════════════════
# PROMPTS (Reused from Gemini for consistency)
# ═══════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are an expert financial document analyst. Extract EVERY data point from invoices with absolute precision."""

JSON_SCHEMA = """{
  "invoice_number": "string or null",
  "date": "string",
  "vendor": {
    "name": "string or null",
    "address": "string or null"
  },
  "customer": {
    "name": "string or null",
    "billing_address": "string or null"
  },
  "shipping_info": {
    "address": "string or null",
    "city": "string or null",
    "state": "string or null",
    "country": "string or null",
    "postal_code": "string or null",
    "ship_mode": "string or null"
  },
  "order_id": "string or null",
  "line_items": [
    {
      "item_name": "string",
      "description": "string or null",
      "product_code": "string or null",
      "quantity": number,
      "rate": number,
      "amount": number
    }
  ],
  "financial_summary": {
    "subtotal": number or null,
    "discount": {
      "percent": number or null,
      "amount": number or null
    },
    "shipping": number or null,
    "tax": number or null,
    "total": number or null,
    "balance_due": number or null
  },
  "payment_terms": "string or null",
  "notes": "string or null"
}"""

USER_PROMPT_TEMPLATE = """You will receive text extracted from an invoice document. Analyse it carefully and return a single VALID JSON object matching the schema below. Do not include markdown fences or commentary. Use null for any missing field and preserve exact numeric values.

JSON schema:
{json_schema}

CRITICAL RULES:
- `quantity` is how many units.
- `rate` is the unit price (per item) with no currency symbols.
- `amount` is the total for the line (quantity × rate).
- Extract shipping, discounts, and taxes when present.
- Never invent data. Use null if you cannot find a value.

SOURCE DOCUMENT:
{document}
"""

HINTS_BASED_PROMPT_TEMPLATE = """You are an intelligent invoice analyzer. You will receive:
1. HINTS: Automatically extracted tokens from the invoice
2. LAYOUT SUMMARY: Section headers + table coordinates
3. RAW TEXT: The full invoice text

Your task is to map these hints to the correct fields in the JSON schema.

EXTRACTED HINTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Currency Amounts Found: {currency_amounts}
Dates Found: {dates}
Companies Found: {companies}
Potential Invoice Numbers: {invoice_numbers}
Labeled Fields: {labeled_fields}

Layout Sections:
{layout_sections_summary}

Table Structures (layout-aware):
{table_sample}

Deterministic Line Items (rule-based preview):
{deterministic_preview}

RAW TEXT CONTEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{raw_text}

JSON SCHEMA TO RETURN:
{json_schema}

CHUNK CONTEXT:
{chunk_note}

INSTRUCTIONS:
1. Use the hints to quickly locate relevant data
2. Map currency amounts to correct fields (total, subtotal, tax, etc.)
3. Choose the correct company as vendor vs customer
4. Section headers indicate logical groupings; keep section context if possible
5. Extract line items from ALL table structures provided
6. CRITICAL: Process EVERY table - extract line items from each table
7. If multiple tables are provided, combine all line items into one array
8. Do not skip any tables - extract from all of them (even zero-amount rows)
9. Validate math: quantity × rate should equal amount
10. Use null for any field you cannot determine
11. Return ONLY valid JSON, no markdown fences

Return the complete JSON:"""


class OpenAIInvoiceExtractor:
    """
    OpenAI GPT-4o Mini implementation of InvoiceExtractorProtocol.
    
    Uses two-stage extraction:
    1. Text extraction (TextExtractor with PaddleOCR/PyMuPDF)
    2. GPT-4o Mini structuring (JSON mode)
    """
    
    name = "openai"
    
    def __init__(self):
        """
        Initialize OpenAI client and text extractor.
        
        Reads OPENAI_API_KEY from environment.
        """
        # Check if OpenAI is available
        if not OPENAI_AVAILABLE:
            raise RuntimeError(
                "OpenAI SDK not installed. Run: pip install openai"
            )
        
        # Get API key from environment
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY environment variable not set. "
                "Add it to your .env file."
            )
        
        # Initialize OpenAI async client
        self.client = AsyncOpenAI(api_key=api_key)
        
        # Initialize text extractor (PaddleOCR + PyMuPDF)
        self.text_extractor = TextExtractor()
        self.layout_extractor = LayoutExtractor()
        
        # Initialize universal feature extractor (hints-based extraction)
        self.feature_extractor = UniversalFeatureExtractor()
        
        # Initialize deterministic extractor (Phase 3: regex-based extraction)
        self.deterministic_extractor = DeterministicExtractor()
        
        # Model configuration
        self.model = "gpt-4o-mini"  # Fast, cost-effective model
        self._model = self.model  # For compatibility with performance tracking
        self.temperature = 0.1  # Low temperature for consistent results
        self.timeout = 120.0  # 120s timeout (increased for complex documents)
        self.max_retries = 3  # Retry failed requests
        self.max_rows_per_table = 30  # Limit rows per table sent to LLM
        self.max_rows_per_chunk = 30   # Reduced from 60 to 30 for faster LLM responses
        self.page_summary_chars = 350  # Characters per page summary after page 1
        self.max_concurrent_chunks = 5  # Increased from 3 to 5 for more parallelism
        
        # Token tracking
        self._total_input_tokens = 0
        self._total_output_tokens = 0
    
    async def extract_invoice(
        self,
        *,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
    ) -> Dict[str, Any]:
        """
        Extract structured invoice data from PDF/image.
        
        Two-stage process:
        1. Extract text (0.1-0.5s)
        2. Structure with GPT-4o Mini (2-4s)
        
        MULTI-PAGE SUPPORT:
        - Extracts text from ALL pages (via TextExtractor)
        - Extracts tables from ALL pages (via TableExtractor/pdfplumber)
        - Uses all_rows from tables to capture ALL line items from ALL pages
        - This ensures multi-page invoices are fully processed
        
        Args:
            file_bytes: Raw file content
            filename: Original filename
            mime_type: MIME type (e.g., 'application/pdf')
        
        Returns:
            Dictionary with:
            - result_json: Structured invoice data
            - result_markdown: JSON as formatted string
            - pages: Number of pages processed
            - duration: Total processing time
            - performance: Performance metrics
        """
        perf: Dict[str, float] = {}
        perf_metadata: Dict[str, str] = {
            "provider": self.name,
            "model": self.model
        }
        start_time = time.time()
        
        # Reset token counters for this invoice
        self._total_input_tokens = 0
        self._total_output_tokens = 0
        
        # ═══════════════════════════════════════════════════════════
        # STAGE 1: Text Extraction (0.1-0.5s for text PDFs, ~500ms per page for scanned PDFs)
        # ═══════════════════════════════════════════════════════════
        print(f"  → Stage 1: Extracting text from {filename}...")
        text_start = time.perf_counter()
        
        # Run text extraction (now async with parallel page processing)
        # For scanned PDFs, pages are processed in parallel (4x-10x faster)
        pages = await self.text_extractor.extract(file_bytes, mime_type)
        
        perf["text_extraction_time"] = (time.perf_counter() - text_start) * 1000
        print(f"     ✓ Extracted {len(pages)} page(s) in {perf['text_extraction_time']:.0f}ms")
        
        # Handle case where no text could be extracted
        if not pages:
            duration = round(time.time() - start_time, 2)
            return {
                "result_json": {
                    "error": "No text could be extracted from this document",
                    "line_items": [],
                },
                "result_markdown": json.dumps(
                    {
                        "error": "No text could be extracted from this document",
                        "line_items": [],
                    },
                    indent=2,
                ),
                "pages": 0,
                "duration": duration,
                "images": {},
                "performance": {**perf, **perf_metadata},
            }
        
        # Combine all pages into single text document
        document_text = "\n\n".join(
            f"=== PAGE {page.index + 1} ===\n{page.content}"
            for page in pages
        )
        condensed_text = self._build_condensed_text(pages)
        
        # Log document size for debugging
        text_length = len(document_text)
        print(f"     Document text: {text_length:,} characters")
        
        # ═══════════════════════════════════════════════════════════
        # STAGE 1.2: Layout Extraction (Unstructured)
        # ═══════════════════════════════════════════════════════════
        print("  → Stage 1.2: Analyzing layout (tables, sections, coordinates)...")
        layout_start = time.perf_counter()
        layout_data = await self.layout_extractor.extract(file_bytes, mime_type)
        perf["layout_extraction_time"] = (time.perf_counter() - layout_start) * 1000
        layout_tables = layout_data.get("tables", [])
        layout_sections = layout_data.get("sections", [])
        layout_pages = layout_data.get("pages", [])
        perf["layout_metadata"] = layout_data.get("metadata", {})
        print(f"     ✓ Layout extractor detected {len(layout_tables)} structured table(s)")
        
        # Stage 1.5 (fallback) - pdfplumber if Unstructured returned nothing
        fallback_table_perf = None
        if not layout_tables:
            print("     ⚠️  Layout analyzer returned no tables, falling back to pdfplumber...")
            table_start = time.perf_counter()
            from services.table_extractor import TableExtractor
            table_extractor = TableExtractor()
            extracted_tables, fallback_table_perf = await asyncio.to_thread(
                table_extractor.extract_tables,
                file_bytes
            )
            perf["table_extraction_time"] = (time.perf_counter() - table_start) * 1000
            if fallback_table_perf:
                perf["table_performance"] = fallback_table_perf
                print(
                    f"     ✓ Fallback tables detected: "
                    f"{fallback_table_perf.get('tables_after_merge', 0)}"
                )
            layout_tables = self._convert_pdfplumber_tables(extracted_tables)
            layout_sections = []
            layout_pages = []
        
        layout_index = self._build_layout_index(layout_tables)
        
        # ═══════════════════════════════════════════════════════════
        # STAGE 2: Universal Feature Extraction (hints extraction)
        # ═══════════════════════════════════════════════════════════
        print(f"  → Stage 2: Extracting universal hints...")
        extract_start = time.perf_counter()
        
        hints = self.feature_extractor.extract(document_text)
        
        # Add layout-aware data to hints
        hints["layout_tables"] = layout_tables
        hints["layout_sections"] = layout_sections
        hints["layout_pages"] = layout_pages
        hints["layout_metadata"] = layout_data.get("metadata", {})
        hints["tables_detected"] = len(layout_tables)
        
        # PHASE 3: Use new deterministic extractor
        (
            deterministic_items,
            ambiguous_rows,
            deterministic_stats,
        ) = self.deterministic_extractor.extract_line_items(layout_tables)
        
        print(f"     → Deterministic extraction: {len(deterministic_items)} items, {len(ambiguous_rows)} ambiguous rows")
        print(f"       Deterministic percentage: {len(deterministic_items) / max(deterministic_stats.get('rows_scanned', 1), 1) * 100:.1f}%")
        
        hints["deterministic_line_items"] = deterministic_items
        hints["ambiguous_rows"] = ambiguous_rows
        hints["deterministic_stats"] = deterministic_stats
        
        # Still extract financial rows for summary
        financial_rows = self._extract_financial_rows(layout_tables)
        hints["financial_row_hints"] = financial_rows
        
        perf["hint_extraction_time"] = (time.perf_counter() - extract_start) * 1000
        print(f"     ✓ Hints extracted in {perf['hint_extraction_time']:.0f}ms")
        
        # ═══════════════════════════════════════════════════════════
        # STAGE 3: GPT-4o Mini Intelligent Mapping (2-4s)
        # ═══════════════════════════════════════════════════════════
        print(f"  → Stage 3: Mapping hints with GPT-4o Mini (timeout: {self.timeout:.0f}s)...")
        api_start = time.perf_counter()
        
        llm_wait_start = time.perf_counter()
        async with LLM_STAGE_SEMAPHORE:
            perf["llm_queue_wait"] = (time.perf_counter() - llm_wait_start) * 1000
            # Send hints + raw text for intelligent mapping
            invoice_json = await self._structure_with_chunks(hints, condensed_text)
        invoice_json.setdefault("line_items", [])
        for item in invoice_json["line_items"]:
            item.setdefault("_source", "llm")
        
        # PHASE 3: Prioritize deterministic items (add them first)
        deterministic_items = hints.get('deterministic_line_items', [])
        
        # Start with deterministic items
        invoice_json.setdefault("line_items", []).extend(deterministic_items)
        
        # Track which items came from deterministic extraction
        deterministic_appended = len(deterministic_items)
        
        if deterministic_appended:
            print(f"     ✓ Added {deterministic_appended} deterministic line items (regex-based, FREE)")
        
        # Merge LLM items (avoiding duplicates)
        llm_items_added = 0
        existing_keys = set()
        for item in deterministic_items:
            key = (
                (item.get("item_name") or "").strip().lower(),
                str(item.get("amount")),
            )
            existing_keys.add(key)
        
        # Add LLM items that aren't duplicates
        llm_items = [item for item in invoice_json.get("line_items", []) if item.get("_source") == "llm"]
        for item in llm_items:
            key = (
                (item.get("item_name") or "").strip().lower(),
                str(item.get("amount")),
            )
            if key not in existing_keys:
                llm_items_added += 1
                existing_keys.add(key)
        
        if llm_items_added:
            print(f"     ✓ Added {llm_items_added} LLM items (for ambiguous rows)")
        
        financial_rows = hints.get("financial_row_hints", [])
        self._apply_financial_hints(invoice_json, financial_rows)
        self._attach_line_item_provenance(invoice_json, layout_index)
        
        invoice_json["layout_context"] = {
            "tables": [
                {
                    "table_id": table.get("table_id"),
                    "page": table.get("page"),
                    "section_label": table.get("section_label"),
                    "bbox": table.get("bbox"),
                }
                for table in layout_tables
            ],
            "sections": layout_sections,
        }
        
        chunk_count = invoice_json.pop("_chunk_count", 1)
        confidence, confidence_summary = self._compute_confidence(
            invoice_json,
            deterministic_items,
            chunk_count,
        )
        invoice_json["extraction_confidence"] = confidence
        invoice_json["confidence_summary"] = confidence_summary
        invoice_json["line_item_coverage"] = {
            "deterministic_detected": len(deterministic_items),
            "deterministic_appended": deterministic_appended,
            "rows_scanned": deterministic_stats.get("rows_scanned"),
            "row_types": deterministic_stats.get("row_types"),
            "chunk_count": chunk_count,
        }
        
        # Log LLM output for diagnostics
        line_items_count = len(invoice_json.get('line_items', []))
        print(f"     → LLM returned {line_items_count} line items")
        if line_items_count > 0:
            print(f"       Sample line item: {invoice_json['line_items'][0]}")
        else:
            print(f"       ⚠️  No line items extracted!")
        
        perf["api_call_time"] = (time.perf_counter() - api_start) * 1000
        print(f"     ✓ Structured in {perf['api_call_time']:.0f}ms")
        
        # ═══════════════════════════════════════════════════════════
        # JSON Parsing (minimal since JSON mode guarantees valid JSON)
        # ═══════════════════════════════════════════════════════════
        parse_start = time.perf_counter()
        # invoice_json is already a dict (JSON mode ensures valid JSON)
        perf["json_parse_time"] = (time.perf_counter() - parse_start) * 1000
        
        duration = round(time.time() - start_time, 2)
        
        # ═══════════════════════════════════════════════════════════
        # Performance Metrics Summary
        # ═══════════════════════════════════════════════════════════
        performance = {**perf, **perf_metadata}
        performance["provider_breakdown"] = {
            "provider": perf_metadata.get("provider"),
            "model": perf_metadata.get("model"),
            "text_extraction_time": perf.get("text_extraction_time", 0),
            "table_extraction_time": perf.get("table_extraction_time", 0),
            "hint_extraction_time": perf.get("hint_extraction_time", 0),
            "api_call_time": perf.get("api_call_time", 0),
            "json_parse_time": perf.get("json_parse_time", 0),
        }
        
        # Include detailed table performance if available
        if perf.get("table_performance"):
            performance["table_performance"] = perf["table_performance"]
        
        # Add token usage to performance metrics
        performance["input_tokens"] = self._total_input_tokens
        performance["output_tokens"] = self._total_output_tokens
        performance["total_tokens"] = self._total_input_tokens + self._total_output_tokens
        
        print(f"     ✓ Total: {duration:.2f}s")
        print(f"     ✓ Tokens: {self._total_input_tokens:,} input + {self._total_output_tokens:,} output = {self._total_input_tokens + self._total_output_tokens:,} total")
        
        # ═══════════════════════════════════════════════════════════
        # Performance Tracking (for metrics collection)
        # ═══════════════════════════════════════════════════════════
        tracker = get_tracker()
        tracker.track_invoice(
            filename=filename,
            system_version="phase3",  # Phase 3: Hybrid Extraction
            stage_times={
                "layout": perf.get("layout_extraction_time", 0) / 1000,  # Convert ms to seconds
                "deterministic": perf.get("hint_extraction_time", 0) / 1000,
                "llm": perf.get("api_call_time", 0) / 1000,
                "validation": perf.get("json_parse_time", 0) / 1000,
            },
            token_usage={
                "input_tokens": self._total_input_tokens,
                "output_tokens": self._total_output_tokens,
            },
            extraction_stats={
                "total_items": len(invoice_json.get("line_items", [])),
                "deterministic_items": invoice_json.get("line_item_coverage", {}).get("deterministic_appended", 0),
                "llm_items": len(invoice_json.get("line_items", [])) - invoice_json.get("line_item_coverage", {}).get("deterministic_appended", 0),
            },
            quality_metrics={
                "validation_pass": invoice_json.get("extraction_confidence", 0) > 0.7,
                "confidence_score": invoice_json.get("extraction_confidence", 0),
            },
            metadata={
                "page_count": len(pages),
                "chunk_count": chunk_count,
                "layout_source": "unstructured" if layout_tables and not fallback_table_perf else "pdfplumber",
            },
            success=True,
            error_message=None
        )
        
        return {
            "result_json": invoice_json,
            "result_markdown": json.dumps(invoice_json, indent=2),
            "pages": len(pages),
            "duration": duration,
            "images": {},
            "performance": performance,
        }
    
    def _find_header_index(self, headers: List[str], keywords: List[str]) -> Optional[int]:
        """Find index of header containing any keyword."""
        for idx, header in enumerate(headers):
            cleaned = header.lower().replace(" ", "")
            for keyword in keywords:
                if keyword in cleaned:
                    return idx
        return None
    
    def _extract_financial_rows(self, tables: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract financial summary rows (subtotals, tax, etc.) from tables."""
        financial_rows: List[Dict[str, Any]] = []
        
        for table in tables or []:
            rows = table.get("all_rows", []) or []
            annotations = table.get("row_annotations", []) or []
            
            for row_index, row in enumerate(rows):
                if not row:
                    continue
                
                annotation = annotations[row_index] if row_index < len(annotations) else {}
                row_type = annotation.get("row_type", "line_item")
                
                if row_type in {"subtotal", "discount", "tax", "total", "shipping", "deposit", "fee"}:
                    financial_rows.append({
                        "row_type": row_type,
                        "amount": annotation.get("amount"),
                        "raw_text": annotation.get("raw_text") or " | ".join(str(cell) for cell in row),
                        "page": table.get("page"),
                        "section_label": table.get("section_label"),
                        "table_id": table.get("table_id"),
                    })
        
        return financial_rows
    
    def _extract_deterministic_items(
        self,
        tables: List[Dict[str, Any]],
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
        """
        Lightweight parser for obvious qty/rate/amount tables.
        Returns:
            (deterministic_line_items, financial_rows, stats)
        """
        deterministic_items: List[Dict[str, Any]] = []
        financial_rows: List[Dict[str, Any]] = []
        stats: Dict[str, Any] = {
            "rows_scanned": 0,
            "row_types": {},
        }
        
        for table in tables or []:
            headers = [str(h or "").strip().lower() for h in table.get("headers", [])]
            rows = table.get("all_rows", []) or []
            annotations = table.get("row_annotations", []) or []
            stats["rows_scanned"] += len(rows)
            
            if not headers or not rows:
                continue
            
            item_idx = self._find_header_index(headers, ["item", "description", "product", "service"])
            qty_idx = self._find_header_index(headers, ["qty", "quantity", "hours"])
            rate_idx = self._find_header_index(headers, ["rate", "price", "unit"])
            amount_idx = self._find_header_index(headers, ["amount", "total", "line"])
            
            for row_index, row in enumerate(rows):
                if not row:
                    continue
                
                annotation = annotations[row_index] if row_index < len(annotations) else {}
                row_type = annotation.get("row_type", "line_item")
                stats["row_types"][row_type] = stats["row_types"].get(row_type, 0) + 1
                
                raw_text = annotation.get("raw_text") or " | ".join(str(cell) for cell in row)
                amount_value = annotation.get("amount")
                
                if row_type in {"subtotal", "discount", "tax", "total", "shipping", "deposit", "fee"}:
                    financial_rows.append({
                        "row_type": row_type,
                        "amount": amount_value,
                        "raw_text": raw_text,
                        "page": table.get("page"),
                        "section_label": table.get("section_label"),
                        "table_id": table.get("table_id"),
                    })
                    continue
                
                if item_idx is None or amount_idx is None:
                    continue
                
                if item_idx >= len(row):
                    continue
                
                item_name = self._clean_cell(row[item_idx])
                if not item_name:
                    continue
                
                quantity = (
                    self._clean_cell(row[qty_idx]) if qty_idx is not None and qty_idx < len(row) else ""
                )
                rate = (
                    self._parse_money_cell(row[rate_idx])
                    if rate_idx is not None and rate_idx < len(row)
                    else None
                )
                amount = (
                    self._parse_money_cell(row[amount_idx]) if amount_idx < len(row) else amount_value
                )
                
                item_payload = {
                    "item_name": item_name,
                    "description": None,
                    "product_code": None,
                    "quantity": quantity,
                    "rate": rate if rate is not None else 0.0,
                    "amount": amount if amount is not None else 0.0,
                    "_source": "deterministic",
                    "_source_table_id": table.get("table_id"),
                    "_source_row_index": row_index,
                    "_source_section": table.get("section_label"),
                    "_source_page": table.get("page"),
                    "_source_snippet": raw_text,
                    "_row_type": row_type,
                }
                deterministic_items.append(item_payload)
        
        stats["deterministic_items"] = len(deterministic_items)
        return deterministic_items, financial_rows, stats

    def _clean_cell(self, value: Any) -> str:
        return str(value).strip() if value is not None else ""

    def _parse_money_cell(self, value: Any) -> Optional[float]:
        cleaned = self._clean_cell(value).replace("$", "").replace(",", "")
        if not cleaned:
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None

    def _convert_pdfplumber_tables(self, tables: List[Any]) -> List[Dict[str, Any]]:
        """
        Normalize pdfplumber ExtractedTable objects into layout-style payload.
        """
        normalized: List[Dict[str, Any]] = []
        for idx, table in enumerate(tables or []):
            rows = getattr(table, "rows", []) or []
            annotations = []
            for row_index, row in enumerate(rows):
                row_text = " | ".join(str(cell) for cell in row)
                amount = self._parse_money_cell(row[-1] if row else None)
                annotations.append({
                    "row_index": row_index,
                    "row_type": "line_item",
                    "amount": amount,
                    "has_zero_amount": bool(amount is not None and abs(amount) < 0.01),
                    "raw_text": row_text,
                })
            normalized.append({
                "table_id": f"fallback-{idx + 1}",
                "page_index": getattr(table, "page", 0),
                "page": getattr(table, "page", 0) + 1,
                "page_range": getattr(table, "page_range", str(getattr(table, "page", 0) + 1)),
                "is_multi_page": getattr(table, "is_multi_page", False),
                "section_label": None,
                "headers": getattr(table, "headers", []),
                "all_rows": rows,
                "row_annotations": annotations,
                "bbox": None,
                "source": "pdfplumber",
            })
        return normalized

    def _apply_financial_hints(
        self,
        invoice_json: Dict[str, Any],
        financial_rows: List[Dict[str, Any]],
    ) -> None:
        if not financial_rows:
            return
        summary = invoice_json.setdefault("financial_summary", {})
        summary.setdefault("discount", {"percent": None, "amount": None})
        for row in financial_rows:
            row_type = row.get("row_type")
            amount = row.get("amount")
            if amount is None:
                continue
            if row_type == "subtotal" and not summary.get("subtotal"):
                summary["subtotal"] = amount
            elif row_type == "discount":
                discount = summary.setdefault("discount", {"percent": None, "amount": None})
                if discount.get("amount") in (None, 0):
                    discount["amount"] = abs(amount)
            elif row_type == "tax" and not summary.get("tax"):
                summary["tax"] = amount
            elif row_type == "shipping" and not summary.get("shipping"):
                summary["shipping"] = amount
            elif row_type == "total" and not summary.get("total"):
                summary["total"] = amount
            elif row_type == "deposit" and not summary.get("deposit"):
                summary["deposit"] = amount
        invoice_json["financial_lineage"] = financial_rows

    def _build_layout_index(self, tables: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        index: List[Dict[str, Any]] = []
        for table in tables or []:
            rows = table.get("all_rows", []) or []
            annotations = table.get("row_annotations", []) or []
            for row_index, row in enumerate(rows):
                annotation = annotations[row_index] if row_index < len(annotations) else {}
                index.append({
                    "table_id": table.get("table_id"),
                    "row_index": row_index,
                    "page": table.get("page"),
                    "section_label": table.get("section_label"),
                    "row_type": annotation.get("row_type", "line_item"),
                    "amount": annotation.get("amount"),
                    "raw_text": annotation.get("raw_text") or " | ".join(str(cell) for cell in row),
                    "cells": row,
                })
        return index

    def _attach_line_item_provenance(
        self,
        invoice_json: Dict[str, Any],
        layout_index: List[Dict[str, Any]],
    ) -> None:
        if not layout_index:
            return
        used_rows = {
            (
                item.get("_source_table_id"),
                item.get("_source_row_index"),
            )
            for item in invoice_json.get("line_items", [])
            if item.get("_source") == "deterministic"
        }
        for item in invoice_json.get("line_items", []):
            if item.get("_source") == "deterministic":
                continue
            match = self._find_best_row_match(item, layout_index, used_rows)
            if not match:
                continue
            key = (match.get("table_id"), match.get("row_index"))
            used_rows.add(key)
            item["_source_table_id"] = match.get("table_id")
            item["_source_row_index"] = match.get("row_index")
            item["_source_section"] = match.get("section_label")
            item["_source_page"] = match.get("page")
            item["_source_snippet"] = match.get("raw_text")
            item["_row_type"] = match.get("row_type", "line_item")

    def _find_best_row_match(
        self,
        line_item: Dict[str, Any],
        layout_index: List[Dict[str, Any]],
        used_rows: set,
    ) -> Optional[Dict[str, Any]]:
        target_amount = self._safe_float(line_item.get("amount"))
        target_name = (line_item.get("item_name") or "").strip().lower()
        best_match: Optional[Dict[str, Any]] = None
        best_score = -1
        for row in layout_index:
            key = (row.get("table_id"), row.get("row_index"))
            if key in used_rows:
                continue
            if row.get("row_type") != "line_item":
                continue
            row_amount = self._safe_float(row.get("amount"))
            score = 0
            if target_amount is not None and row_amount is not None:
                if abs(row_amount - target_amount) <= 0.01:
                    score += 3
                else:
                    continue
            if target_name and target_name in (row.get("raw_text") or "").lower():
                score += 2
            if score > best_score:
                best_score = score
                best_match = row
        return best_match

    def _safe_float(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
    
    def _build_condensed_text(self, pages: List[PageText]) -> str:
        """
        Keep page 1 in full, summarize subsequent pages to keep prompts small.
        """
        parts: List[str] = []
        for page in pages:
            header = f"=== PAGE {page.index + 1} ==="
            content = (page.content or "").strip()
            if page.index == 0:
                parts.append(f"{header}\n{content}")
                continue
            snippet = content[: self.page_summary_chars]
            if len(content) > self.page_summary_chars:
                snippet = snippet.rstrip() + " ..."
            parts.append(f"{header}\n{snippet}")
        return "\n\n".join(parts)
    
    def _compute_confidence(
        self,
        invoice_json: Dict[str, Any],
        deterministic_items: List[Dict[str, Any]],
        chunk_count: int,
    ) -> tuple[float, str]:
        total_items = len(invoice_json.get("line_items", []))
        deterministic_count = len(deterministic_items or [])
        coverage = deterministic_count / total_items if total_items else 0.0
        has_totals = bool(invoice_json.get("financial_summary", {}).get("total"))
        base = 0.9 if has_totals else 0.75
        chunk_penalty = min(0.25, max(chunk_count - 1, 0) * 0.05)
        confidence = max(0.3, min(0.99, base * 0.7 + coverage * 0.3 - chunk_penalty))
        summary = (
            f"{deterministic_count}/{total_items or 1} deterministic matches; "
            f"{chunk_count} chunk(s) processed."
        )
        return round(confidence, 2), summary
    
    def _chunk_tables_for_llm(self, tables: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """
        Limit rows per table and split tables into manageable LLM chunks.
        """
        if not tables:
            return []
        
        chunks: List[List[Dict[str, Any]]] = []
        current_chunk: List[Dict[str, Any]] = []
        current_row_budget = 0
        
        for table in tables:
            table_copy = copy.deepcopy(table)
            all_rows = table_copy.get("all_rows", [])
            if len(all_rows) > self.max_rows_per_table:
                table_copy["all_rows"] = all_rows[: self.max_rows_per_table]
                table_copy["truncated_row_count"] = len(all_rows)
            else:
                table_copy["truncated_row_count"] = len(all_rows)
            table_rows = max(1, len(table_copy.get("all_rows", [])))
            
            if current_chunk and current_row_budget + table_rows > self.max_rows_per_chunk:
                chunks.append(current_chunk)
                current_chunk = []
                current_row_budget = 0
            
            current_chunk.append(table_copy)
            current_row_budget += table_rows
        
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks
    
    async def _structure_with_chunks(self, hints: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
        """
        Split tables into smaller batches to keep GPT prompts fast & cheap.
        """
        tables = hints.get("layout_tables") or hints.get("pdfplumber_tables", [])
        table_chunks = self._chunk_tables_for_llm(tables)
        
        if not table_chunks:
            return await self._structure_with_hints(hints, raw_text)
        
        combined_invoice: Dict[str, Any] = {}
        total_chunks = len(table_chunks)
        
        print(f"     → Chunking tables into {total_chunks} batch(es)")
        
        semaphore = asyncio.Semaphore(self.max_concurrent_chunks)
        
        async def process_chunk(idx: int, chunk_tables: List[Dict[str, Any]]):
            async with semaphore:
                chunk_hints = dict(hints)
                chunk_hints["layout_tables"] = chunk_tables
                result = await self._structure_with_hints(
                    chunk_hints,
                    raw_text,
                    chunk_index=idx,
                    total_chunks=total_chunks,
                )
                return idx, result, chunk_tables
        
        tasks = [
            asyncio.create_task(process_chunk(idx, chunk))
            for idx, chunk in enumerate(table_chunks)
        ]
        chunk_results = await asyncio.gather(*tasks, return_exceptions=True)
        chunk_results = [res for res in chunk_results if not isinstance(res, Exception)]
        chunk_results.sort(key=lambda pair: pair[0])
        
        for idx, chunk_invoice, chunk_tables in chunk_results:
            combined_invoice.setdefault("line_items", [])
            combined_invoice.setdefault("line_items_meta", [])
            
            if idx == 0:
                combined_invoice.update({k: v for k, v in chunk_invoice.items() if k != "line_items"})
            
            combined_invoice["line_items"].extend(chunk_invoice.get("line_items", []))
            combined_invoice["line_items_meta"].append({
                "chunk_index": idx + 1,
                "chunk_total": total_chunks,
                "items_returned": len(chunk_invoice.get("line_items", [])),
                "table_ids": [table.get("table_id") for table in chunk_tables],
            })
            
            if not chunk_invoice.get("line_items"):
                combined_invoice.setdefault("_chunk_alerts", []).append({
                    "chunk_index": idx + 1,
                    "table_ids": [table.get("table_id") for table in chunk_tables],
                    "reason": "LLM returned 0 line items for this chunk",
                })
        
        combined_invoice["_chunk_count"] = total_chunks
        return combined_invoice
    
    async def _structure_with_hints(
        self,
        hints: Dict[str, Any],
        raw_text: str,
        chunk_index: int = 0,
        total_chunks: int = 1,
    ) -> Dict[str, Any]:
        """
        Structure invoice data using hints and raw text with GPT-4o Mini.
        
        TRUST-FIRST APPROACH:
        - Sends full text (no artificial truncation) for accurate extraction
        - Filters $0 values from tables to focus on costs
        - Ensures all pages are captured for multi-page invoices
        
        Uses JSON mode to guarantee valid JSON structure.
        GPT maps extracted hints to the schema using its intelligence.
        
        Args:
            hints: Universal hints extracted from document
            raw_text: Full raw text for context
        
        Returns:
            Structured invoice data as dictionary
        """
        import json as json_module
        
        def filter_zero_cost_rows(rows: List[List[str]], headers: List[str]) -> List[List[str]]:
            """
            Filter out rows where amount/cost columns are $0.
            
            This focuses LLM on actual costs and reduces token usage
            while maintaining accuracy for meaningful data.
            """
            if not rows or not headers:
                return rows
            
            # Find amount/cost column indices
            amount_indices = []
            for i, header in enumerate(headers):
                header_lower = header.lower()
                if any(keyword in header_lower for keyword in ['amount', 'cost', 'total', 'price', 'charge']):
                    amount_indices.append(i)
            
            if not amount_indices:
                return rows  # Can't filter if no amount column found
            
            filtered_rows = []
            for row in rows:
                # Check if any amount column has non-zero value
                has_cost = False
                for idx in amount_indices:
                    if idx < len(row):
                        cell_value = str(row[idx]).strip()
                        # Remove currency symbols and parse
                        cell_value = cell_value.replace('$', '').replace(',', '').replace('USD', '').strip()
                        try:
                            amount = float(cell_value)
                            if amount > 0.01:  # More than 1 cent
                                has_cost = True
                                break
                        except (ValueError, TypeError):
                            # If can't parse, keep the row (might be text)
                            has_cost = True
                            break
                
                # Only include rows with costs
                if has_cost:
                    filtered_rows.append(row)
            
            return filtered_rows
        
        chunk_note = "Single chunk covering the full document."
        if total_chunks > 1:
            if chunk_index == 0:
                chunk_note = (
                    f"Chunk {chunk_index + 1}/{total_chunks}: include header fields AND line items."
                )
            else:
                chunk_note = (
                    f"Chunk {chunk_index + 1}/{total_chunks}: ONLY add new line_items "
                    "from these tables. Leave other fields null."
                )
        
        # Format structured tables from pdfplumber for prompt
        tables_detail = ""
        layout_tables = hints.get("layout_tables") or hints.get("pdfplumber_tables")
        if layout_tables:
            tables_list = []
            
            # Process ALL tables (not just first 5) to capture line items from all pages
            for i, table in enumerate(layout_tables):
                page_label = table.get("page") or table.get("page_index", 0) + 1
                all_rows = table.get('all_rows', [])
                headers = table.get('headers', [])
                
                print(
                    f"     Processing Table {i+1} "
                    f"(Table ID: {table.get('table_id')}) from Page {page_label}: "
                    f"{len(all_rows)} rows"
                )
                filtered_rows = all_rows  # Use all rows for now
                if not filtered_rows:
                    continue
                
                table_info = f"Table {i+1} (Page {page_label}, {len(filtered_rows)} rows"
                if table.get('section_label'):
                    table_info += f", Section: {table.get('section_label')}"
                if table.get('is_multi_page'):
                    table_info += f", spans pages {table.get('page_range', '')}"
                table_info += "):\n"
                table_info += f"Headers: {', '.join(headers)}\n"
                
                total_rows = table.get("truncated_row_count", len(filtered_rows))
                rows_for_prompt = filtered_rows[: self.max_rows_per_table]
                if total_rows > len(rows_for_prompt):
                    table_info += (
                        f"Showing first {len(rows_for_prompt)} of {total_rows} rows "
                        "(chunked for performance):\n"
                    )
                else:
                    table_info += "Rows:\n"
                
                for row in rows_for_prompt:
                    table_info += "  " + " | ".join(str(cell) for cell in row) + "\n"
                tables_list.append(table_info)
            
            tables_detail = "\n".join(tables_list)
        else:
            # Fallback to simple table detection if pdfplumber didn't find tables
            table_sample = "\n".join([
                "  " + " | ".join(row[:6])  # First 6 columns
                for row in hints.get('tables', [])[:5]  # First 5 rows
            ]) or "  (No clear tables found)"
            tables_detail = table_sample
        
        # Build hints-based prompt
        # TRUST-FIRST: Send full text (or very high limit) to ensure accurate extraction
        # Most invoices are < 30000 chars, but we set high limit for multi-page invoices
        # Cost is minimal compared to value of accurate data extraction
        text_limit = min(len(raw_text), 50000)  # 50k char limit (covers 10+ page invoices)
        text_used = raw_text[:text_limit] if len(raw_text) > text_limit else raw_text
        
        if len(raw_text) > text_limit:
            print(f"     ⚠️  Text truncated from {len(raw_text):,} to {text_limit:,} chars (very large invoice)")
        else:
            print(f"     ✓ Sending full text ({len(raw_text):,} chars) for accurate extraction")
        
        # Log what's being sent to LLM
        if layout_tables:
            total_tables = len(layout_tables)
            total_rows = sum(len(table.get('all_rows', [])) for table in layout_tables)
            print(f"     → Sending {total_tables} tables to LLM")
            print(f"     → Total rows across all tables: {total_rows}")
            print(f"     → Text length: {len(text_used):,} chars")
        
        deterministic_preview = "(not available)"
        deterministic_items = hints.get('deterministic_line_items', [])
        if deterministic_items and chunk_index == 0:
            deterministic_preview = json_module.dumps(deterministic_items[:10], indent=2)
        elif total_chunks > 1 and chunk_index > 0:
            deterministic_preview = "(deterministic preview included in chunk 1)"
        
        sections_detail = "(not available)"
        layout_sections_list = hints.get("layout_sections") or []
        if layout_sections_list:
            lines = [
                f"- Page {section.get('page')}: {section.get('label')}"
                for section in layout_sections_list[:10]
            ]
            if len(layout_sections_list) > 10:
                lines.append(f"... ({len(layout_sections_list) - 10} more sections)")
            sections_detail = "\n".join(lines)
        
        user_prompt = HINTS_BASED_PROMPT_TEMPLATE.format(
            json_schema=JSON_SCHEMA,
            currency_amounts=", ".join(hints.get('currency_amounts', [])[:10]),
            dates=", ".join(hints.get('dates', [])),
            companies=", ".join(hints.get('companies', [])),
            invoice_numbers=", ".join(hints.get('potential_invoice_numbers', [])),
            labeled_fields=json_module.dumps(hints.get('labeled_fields', {}), indent=2),
            table_sample=tables_detail,
            layout_sections_summary=sections_detail,
            # TRUST-FIRST: Full text (or 50k limit) ensures accurate extraction
            # This prioritizes accuracy and trust over cost optimization
            raw_text=text_used,
            chunk_note=chunk_note,
            deterministic_preview=deterministic_preview
        )
        
        last_error: Exception = None
        
        # Retry logic with exponential backoff
        for attempt in range(1, self.max_retries + 1):
            try:
                # ═══════════════════════════════════════════════════
                # Call OpenAI API with JSON mode
                # ═══════════════════════════════════════════════════
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": SYSTEM_PROMPT
                        },
                        {
                            "role": "user",
                            "content": user_prompt
                        }
                    ],
                    temperature=self.temperature,
                    response_format={"type": "json_object"},  # Force JSON mode
                    timeout=self.timeout,
                )
                
                # Track token usage
                if hasattr(response, 'usage') and response.usage:
                    self._total_input_tokens += response.usage.prompt_tokens
                    self._total_output_tokens += response.usage.completion_tokens
                
                # Extract JSON from response
                content = response.choices[0].message.content
                return json.loads(content)
                
            except json.JSONDecodeError as e:
                # JSON mode should prevent this, but handle gracefully
                last_error = e
                print(f"  ⚠️  JSON decode error (attempt {attempt}/{self.max_retries}): {e}")
                
            except Exception as e:
                last_error = e
                error_msg = str(e)
                if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                    print(f"  ⚠️  OpenAI API timeout (attempt {attempt}/{self.max_retries})")
                    print(f"     This may be due to:")
                    print(f"     - Slow internet connection")
                    print(f"     - Very large/complex document")
                    print(f"     - OpenAI API being slow")
                else:
                    print(f"  ⚠️  OpenAI API error (attempt {attempt}/{self.max_retries}): {e}")
            
            # Exponential backoff before retry
            if attempt < self.max_retries:
                wait_time = min(2 ** attempt, 5)  # Max 5 seconds
                print(f"     Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
        
        # All retries failed
        assert last_error is not None
        error_msg = str(last_error)
        if "timeout" in error_msg.lower():
            raise RuntimeError(
                f"OpenAI API timed out after {self.max_retries} attempts ({self.timeout}s each). "
                f"This may be due to slow internet or a very complex document. "
                f"Try again or check your connection."
            )
        raise RuntimeError(
            f"Failed to structure invoice after {self.max_retries} attempts: {last_error}"
        )
