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
from typing import Dict, Any

# OpenAI imports - will be optional until installed
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    AsyncOpenAI = None

from services.text_extractor import TextExtractor
from services.universal_feature_extractor import UniversalFeatureExtractor


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
2. RAW TEXT: The full invoice text

Your task is to map these hints to the correct fields in the JSON schema.

EXTRACTED HINTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Currency Amounts Found: {currency_amounts}
Dates Found: {dates}
Companies Found: {companies}
Potential Invoice Numbers: {invoice_numbers}
Labeled Fields: {labeled_fields}

Table Structures (extracted with pdfplumber):
{table_sample}

RAW TEXT CONTEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{raw_text}

JSON SCHEMA TO RETURN:
{json_schema}

INSTRUCTIONS:
1. Use the hints to quickly locate relevant data
2. Map currency amounts to correct fields (total, subtotal, tax, etc.)
3. Choose the correct company as vendor vs customer
4. Extract line items from table structures
5. Validate math: quantity × rate should equal amount
6. Use null for any field you cannot determine
7. Return ONLY valid JSON, no markdown fences

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
        
        # Initialize universal feature extractor (hints-based extraction)
        self.feature_extractor = UniversalFeatureExtractor()
        
        # Model configuration
        self.model = "gpt-4o-mini"  # Fast, cost-effective model
        self._model = self.model  # For compatibility with performance tracking
        self.temperature = 0.1  # Low temperature for consistent results
        self.timeout = 60.0  # 60s timeout (same as Gemini for complex documents)
        self.max_retries = 3  # Retry failed requests
    
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
        
        # Log document size for debugging
        text_length = len(document_text)
        print(f"     Document text: {text_length:,} characters")
        
        # ═══════════════════════════════════════════════════════════
        # STAGE 1.5: Table Extraction (pdfplumber)
        # ═══════════════════════════════════════════════════════════
        print(f"  → Stage 1.5: Extracting tables with pdfplumber...")
        table_start = time.perf_counter()
        
        from services.table_extractor import TableExtractor
        table_extractor = TableExtractor()
        extracted_tables, table_perf = await asyncio.to_thread(
            table_extractor.extract_tables,
            file_bytes
        )
        
        perf["table_extraction_time"] = (time.perf_counter() - table_start) * 1000
        print(f"     ✓ Tables extracted: {table_perf.get('tables_detected', 0)} tables in {perf['table_extraction_time']:.0f}ms")
        if table_perf.get('tables_after_merge'):
            print(f"     ✓ After merging: {table_perf['tables_after_merge']} tables")
        
        # Convert to LLM format
        table_structure = table_extractor.to_llm_format(extracted_tables)
        
        # Store table performance metrics
        perf["table_performance"] = table_perf
        
        # ═══════════════════════════════════════════════════════════
        # STAGE 2: Universal Feature Extraction (hints extraction)
        # ═══════════════════════════════════════════════════════════
        print(f"  → Stage 2: Extracting universal hints...")
        extract_start = time.perf_counter()
        
        hints = self.feature_extractor.extract(document_text)
        
        # Add structured table data to hints
        hints['pdfplumber_tables'] = table_structure['tables']
        hints['tables_detected'] = table_structure['tables_detected']
        
        perf["hint_extraction_time"] = (time.perf_counter() - extract_start) * 1000
        print(f"     ✓ Hints extracted in {perf['hint_extraction_time']:.0f}ms")
        
        # ═══════════════════════════════════════════════════════════
        # STAGE 3: GPT-4o Mini Intelligent Mapping (2-4s)
        # ═══════════════════════════════════════════════════════════
        print(f"  → Stage 3: Mapping hints with GPT-4o Mini (timeout: {self.timeout:.0f}s)...")
        api_start = time.perf_counter()
        
        # Send hints + raw text for intelligent mapping
        invoice_json = await self._structure_with_hints(hints, document_text)
        
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
        
        print(f"     ✓ Total: {duration:.2f}s")
        
        return {
            "result_json": invoice_json,
            "result_markdown": json.dumps(invoice_json, indent=2),
            "pages": len(pages),
            "duration": duration,
            "images": {},
            "performance": performance,
        }
    
    async def _structure_with_hints(self, hints: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
        """
        Structure invoice data using hints and raw text with GPT-4o Mini.
        
        Uses JSON mode to guarantee valid JSON structure.
        GPT maps extracted hints to the schema using its intelligence.
        
        Args:
            hints: Universal hints extracted from document
            raw_text: Full raw text for context
        
        Returns:
            Structured invoice data as dictionary
        """
        import json as json_module
        
        # Format structured tables from pdfplumber for prompt
        # IMPORTANT: Use all_rows instead of sample_rows to capture ALL line items from ALL pages
        # This fixes the multi-page invoice issue where only first page data was extracted.
        # Cost impact: Minimal (~$0.0001-0.0002 per invoice) because:
        # - Tables are already extracted (no additional extraction cost)
        # - Table rows are token-efficient (structured data vs raw text)
        # - Only adding ~50-100 rows per invoice (much cheaper than full text)
        tables_detail = ""
        if hints.get('pdfplumber_tables'):
            tables_list = []
            # Process ALL tables (not just first 5) to capture line items from all pages
            for i, t in enumerate(hints['pdfplumber_tables']):
                table_info = f"Table {i+1} (Page {t['page']}, {t['row_count']} rows"
                if t.get('is_multi_page'):
                    table_info += f", spans pages {t.get('page_range', '')}"
                table_info += "):\n"
                table_info += f"Headers: {', '.join(t['headers'])}\n"
                table_info += "All rows:\n"
                # Use all_rows instead of sample_rows - this captures ALL line items from ALL pages
                # The table_extractor already extracted all rows from all pages, we just need to use them
                for row in t.get('all_rows', []):
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
        user_prompt = HINTS_BASED_PROMPT_TEMPLATE.format(
            json_schema=JSON_SCHEMA,
            currency_amounts=", ".join(hints.get('currency_amounts', [])[:10]),
            dates=", ".join(hints.get('dates', [])),
            companies=", ".join(hints.get('companies', [])),
            invoice_numbers=", ".join(hints.get('potential_invoice_numbers', [])),
            labeled_fields=json_module.dumps(hints.get('labeled_fields', {}), indent=2),
            table_sample=tables_detail,
            # Increased from 3000 to 5000 chars to ensure full first page is captured
            # First page typically contains: vendor info, invoice number, dates, header details
            # This ensures we capture all header context while keeping costs low
            # Cost impact: ~$0.0001 per invoice (minimal increase)
            raw_text=raw_text[:5000]  # Full first page + start of page 2 if needed
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
