# routers/ocr.py
"""
OCR Router - Handles all invoice processing endpoints

DATA FLOW OVERVIEW (JSON-BASED EXTRACTION):
===========================================
1. Frontend uploads files → /invoice/extract-batch endpoint
2. Files sent to _process_single_invoice() for concurrent processing
3. Each invoice goes through the configured OCR provider (Gemini or DeepSeek):
   - Provider extracts and structures invoice data (JSON schema)
   - JSON parsed directly → All fields extracted (shipping, discount, etc.)
   - calculate_extraction_confidence() → Field presence/quality scoring
   - validate_invoice_math() → Mathematical validation
   - determine_review_status() → Trust-based review decision
4. Results aggregated and returned to frontend
5. Frontend displays in Dashboard component

TRUST-FIRST DESIGN:
===================
- JSON extraction eliminates regex parsing errors
- All invoice fields captured (shipping, discounts, customer info)
- Field-level confidence scoring
- Mathematical validation ensures accuracy
- Human-in-the-loop review for low-confidence extractions

CONNECTIONS:
============
→ services/invoice_extractor.py: Provider factory & settings
→ services/validation.py: Mathematical validation and trust scoring
→ Frontend: App.tsx → handleProcessInvoices() receives response
"""

from typing import List, Any, Dict
from fastapi import APIRouter, File, UploadFile, HTTPException, Header
from fastapi.responses import JSONResponse
# OCR Provider abstraction
from services.invoice_extractor import (
    get_invoice_extractor,
    get_ocr_settings,
    InvoiceExtractorProtocol,
)
from services.structure import parse_sections
from services.entities import extract_entities
from services.validation import (
    validate_invoice_math,
    calculate_validation_confidence,
    determine_review_status,
    parse_currency
)
import time 
import asyncio
import uuid
import re


_ocr_settings = get_ocr_settings()
_invoice_extractor: InvoiceExtractorProtocol = get_invoice_extractor(_ocr_settings)

print(
    f"OCR provider initialised -> provider: {_invoice_extractor.name}, "
    f"model: {getattr(_invoice_extractor, '_model', 'n/a')}, "
    f"max concurrency: {_ocr_settings.max_concurrency}"
)


router = APIRouter()


def calculate_extraction_confidence(invoice_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate confidence score based on field presence, quality, and completeness.
    
    TRUST-FIRST PRINCIPLE:
    - Critical fields present = high confidence
    - Field quality checks (format validation)
    - Completeness (how many fields extracted)
    - Data consistency (line items valid)
    
    Returns:
    {
        'overall_confidence': float (0.0-1.0),
        'field_presence_score': float,
        'field_quality_score': float,
        'completeness_score': float,
        'data_consistency_score': float,
        'scores': dict with detailed breakdown
    }
    """
    scores = {
        'field_presence': 0.0,
        'field_quality': 0.0,
        'completeness': 0.0,
        'data_consistency': 0.0
    }
    
    # 1. Critical fields presence (30% weight)
    critical_fields = ['invoice_number', 'date', 'financial_summary']
    critical_present = 0
    
    if invoice_json.get('invoice_number'):
        critical_present += 1
    if invoice_json.get('date'):
        critical_present += 1
    if invoice_json.get('financial_summary') and invoice_json['financial_summary'].get('total'):
        critical_present += 1
    
    scores['field_presence'] = critical_present / len(critical_fields)
    
    # 2. Field quality - values make sense (25% weight)
    quality_score = 0.0
    quality_checks = 0
    
    # Invoice number format check
    inv_num = invoice_json.get('invoice_number')
    if inv_num:
        if isinstance(inv_num, str) and len(inv_num) > 0:
            quality_score += 1.0
        quality_checks += 1
    
    # Date format check (any non-empty string is acceptable)
    if invoice_json.get('date'):
        if isinstance(invoice_json['date'], str) and len(invoice_json['date']) > 0:
            quality_score += 0.9
        quality_checks += 1
    
    # Financial fields are numeric and positive
    financial = invoice_json.get('financial_summary', {})
    for field in ['total', 'subtotal', 'shipping', 'tax']:
        value = financial.get(field)
        if value is not None:
            try:
                num_value = float(value) if isinstance(value, str) else value
                if isinstance(num_value, (int, float)) and num_value >= 0:
                    quality_score += 1.0
                quality_checks += 1
            except (ValueError, TypeError):
                pass
    
    scores['field_quality'] = quality_score / quality_checks if quality_checks > 0 else 0.5
    
    # 3. Completeness - how many fields extracted (20% weight)
    all_possible_fields = [
        'invoice_number', 'date', 'vendor', 'customer', 
        'shipping_info', 'order_id', 'line_items', 
        'financial_summary'
    ]
    fields_present = 0
    for field in all_possible_fields:
        if field == 'line_items':
            if invoice_json.get(field) and len(invoice_json[field]) > 0:
                fields_present += 1
        elif field == 'financial_summary':
            if invoice_json.get(field) and isinstance(invoice_json[field], dict):
                # Check if has at least one financial value
                if any(invoice_json[field].get(k) is not None for k in ['total', 'subtotal', 'shipping', 'tax']):
                    fields_present += 1
        elif invoice_json.get(field):
            fields_present += 1
    
    scores['completeness'] = fields_present / len(all_possible_fields)
    
    # 4. Data consistency - line items valid (25% weight)
    line_items = invoice_json.get('line_items', [])
    if line_items and len(line_items) > 0:
        valid_items = 0
        for item in line_items:
            # Check if item has required fields and they're valid
            has_quantity = item.get('quantity') is not None
            has_rate = item.get('rate') is not None
            has_amount = item.get('amount') is not None
            has_name = item.get('item_name') or item.get('item')  # Support both formats
            
            if has_quantity and has_rate and has_amount and has_name:
                # Check if values are numeric
                try:
                    qty = float(item['quantity']) if isinstance(item['quantity'], str) else item['quantity']
                    rate = float(item['rate']) if isinstance(item['rate'], str) else item['rate']
                    amount = float(item['amount']) if isinstance(item['amount'], str) else item['amount']
                    if isinstance(qty, (int, float)) and isinstance(rate, (int, float)) and isinstance(amount, (int, float)):
                        valid_items += 1
                except (ValueError, TypeError):
                    pass
        
        scores['data_consistency'] = valid_items / len(line_items) if len(line_items) > 0 else 0.0
    else:
        scores['data_consistency'] = 0.0
    
    # Weighted average
    overall_confidence = (
        scores['field_presence'] * 0.30 +
        scores['field_quality'] * 0.25 +
        scores['completeness'] * 0.20 +
        scores['data_consistency'] * 0.25
    )
    
    return {
        'overall_confidence': round(overall_confidence, 2),
        'field_presence_score': round(scores['field_presence'], 2),
        'field_quality_score': round(scores['field_quality'], 2),
        'completeness_score': round(scores['completeness'], 2),
        'data_consistency_score': round(scores['data_consistency'], 2),
        'scores': scores
    }


def _parse_invoice_table(markdown: str):
    """
    DEPRECATED: This function is no longer used.
    
    We now use JSON extraction from DeepSeek which provides structured data
    directly, eliminating the need for regex-based markdown table parsing.
    
    This function is kept for backward compatibility but should not be called
    in the new JSON-based extraction flow.
    
    Parse a markdown table to extract structured line items.
    
    DATA FLOW:
    ----------
    Input: Markdown text from DeepSeek containing tables
    Output: List of dictionaries with line item data
    
    CALLED BY: (DEPRECATED - no longer called)
    RETURNS TO: (DEPRECATED)
    
    Expected table format:
    | Item | Quantity | Rate | Amount |
    |------|----------|------|--------|
    | ...  | ...      | ...  | ...    |
    
    This is a simplified parser and may need tuning for different table
    formats (e.g., "Description" vs "Item", "Price" vs "Rate").
    """
    try:
        # Clean markdown - remove code fences if present
        cleaned_markdown = re.sub(r'```markdown\s*', '', markdown)
        cleaned_markdown = re.sub(r'```\s*', '', cleaned_markdown)
        
        # Find the table block. This regex looks for a table starting with a header row.
        table_match = re.search(r'(\|.*\|[\s\S]*?\|.*\|)', cleaned_markdown)
        if not table_match:
            print("DEBUG: No table found in markdown")
            return []
        
        table_text = table_match.group(1)
        rows = [r.strip() for r in table_text.split('\n') if r.strip()]
        
        print(f"DEBUG: Found table with {len(rows)} total rows")
        
        # Separate header from data rows
        # Header is usually first row, separator is second (|-----|)
        if len(rows) < 2:
            print("DEBUG: Table too short")
            return []
        
        header_row = rows[0]
        
        # Filter out separator rows (|-----|-----| pattern)
        data_rows = []
        for i, row in enumerate(rows[1:], start=1):
            # Check if it's a separator row
            cells = [c.strip() for c in row.split('|')]
            is_separator = all(re.match(r'^[\s\-:]*$', cell) for cell in cells if cell)
            
            if is_separator:
                print(f"DEBUG: Row {i} is separator, skipping")
                continue
            
            data_rows.append(row)
        
        print(f"DEBUG: {len(data_rows)} data rows after filtering separators")
        
        # Parse header to find column indices
        headers = [h.strip().lower() for h in header_row.split('|') if h.strip()]
        
        print(f"DEBUG: Table headers: {headers}")
        
        try:
            item_col_index = headers.index('item')
            quantity_col_index = headers.index('quantity')
            rate_col_index = headers.index('rate')
            amount_col_index = headers.index('amount')
        except ValueError:
            # If any of the required columns are missing, we can't parse the table.
            print(f"DEBUG: Could not find all required columns. Headers: {headers}")
            return []
        
        line_items = []
        for row_idx, row in enumerate(data_rows, start=1):
            cells = [c.strip() for c in row.split('|') if c.strip()]  # Remove empty cells
            
            # Skip rows that don't have enough cells
            required_cols = max(item_col_index, quantity_col_index, rate_col_index, amount_col_index) + 1
            if len(cells) < required_cols:
                print(f"DEBUG: Row {row_idx} skipped - not enough cells ({len(cells)} < {required_cols})")
                continue
            
            # Skip rows where quantity is missing or is a dash (category rows)
            quantity_value = cells[quantity_col_index] if quantity_col_index < len(cells) else ""
            if not quantity_value or quantity_value in ['-', '—', '–', 'N/A', '', '*No line items found*']:
                print(f"DEBUG: Row {row_idx} skipped - no quantity (category/description row)")
                continue
            
            # Extract the item data
            item_data = {
                "item": cells[item_col_index] if item_col_index < len(cells) else "",
                "quantity": cells[quantity_col_index] if quantity_col_index < len(cells) else "",
                "rate": cells[rate_col_index] if rate_col_index < len(cells) else "",
                "amount": cells[amount_col_index] if amount_col_index < len(cells) else "",
            }
            
            print(f"DEBUG: Row {row_idx} extracted: {item_data['item'][:30]}... qty={item_data['quantity']}")
            line_items.append(item_data)
                
        print(f"DEBUG: Total line items extracted: {len(line_items)}")
        return line_items
    except Exception as e:
        print(f"DEBUG: Error parsing table: {e}")
        return []

# --- END OF NEW FUNCTION ----


         
        
# ========================================================================
# HELPER FUNCTION: Process Individual Invoice
# ========================================================================
async def _process_single_invoice(
    file: UploadFile,
    extractor: InvoiceExtractorProtocol,
) -> Dict[str, Any]:
    """
    Processes a single invoice file and returns the extracted data.
    
    DATA FLOW (JSON-BASED):
    ------------------------
    1. Receives: UploadFile from extract_invoice_data_batch()
    2. Invokes configured OCR provider → Get structured JSON (no regex needed!)
    3. Extracts: All fields directly from JSON (invoice_number, date, vendor, etc.)
    4. Normalizes: Line items to our internal format
    5. Calculates: Extraction confidence based on field presence/quality
    6. Validates: Mathematical integrity (line items, subtotals, totals)
    7. Determines: Review status based on trust-first accounting rules
    8. Returns: Complete invoice data with confidence scores
    
    CALLED BY: extract_invoice_data_batch() via asyncio.gather()
    RETURNS TO: extract_invoice_data_batch() → aggregates results
    
    OUTPUT STRUCTURE:
    {
        "filename": str,
        "invoice_number": str,
        "vendor_name": str,
        "date": str,
        "total_amount": float,
        "subtotal": float,
        "shipping": float,  # Now captured from JSON!
        "discount_amount": float,  # Now captured from JSON!
        "tax": float,
        "line_items": [...],
        "confidence": {
            "overall": float,
            "extraction": float,
            "validation": float,
            "extraction_details": {...}
        },
        "math_validation": {...},
        "review_status": str,
        "auto_approve": bool
    }
    """
    try:
        import time as time_module
        invoice_uid = str(uuid.uuid4())
        invoice_perf = {}
        invoice_start = time_module.time()
        
        print(f"DEBUG: Processing {file.filename}...")
        contents = await file.read()
        print(f"DEBUG: Read {len(contents)} bytes from {file.filename}")
        mime_type = file.content_type
        
        # Save file for PDF viewer access
        file_save_start = time_module.time()
        from pathlib import Path
        upload_dir = Path("uploads")
        upload_dir.mkdir(exist_ok=True)
        file_path = upload_dir / file.filename
        with open(file_path, "wb") as f:
            f.write(contents)
        invoice_perf['file_save_time'] = (time_module.time() - file_save_start) * 1000
        print(f"DEBUG: Saved file to {file_path} ({invoice_perf['file_save_time']:.2f}ms)")
        
        provider_name = getattr(extractor, "name", "unknown")
        print(f"DEBUG: Calling {provider_name} OCR for {file.filename}...")
        ocr_start = time_module.time()
        ocr_result = await extractor.extract_invoice(
            file_bytes=contents,
            filename=file.filename,
            mime_type=mime_type,
        )
        invoice_perf['ocr_time'] = (time_module.time() - ocr_start) * 1000
        invoice_perf['provider'] = provider_name
        model_name = getattr(extractor, "_model", None)
        if model_name:
            invoice_perf['model'] = model_name
        provider_metrics = ocr_result.get('performance', {}) or {}
        invoice_perf['provider_breakdown'] = provider_metrics.get('provider_breakdown', provider_metrics)
        print(
            f"DEBUG: OCR complete for {file.filename} "
            f"({invoice_perf['ocr_time']:.2f}ms via {provider_name})"
        )
        
        # Extract JSON data (NEW: Trust-first JSON extraction)
        invoice_json = ocr_result.get("result_json", {})
        
        if invoice_json.get("error"):
            print(f"DEBUG: Error in JSON extraction: {invoice_json.get('error')}")
            raise Exception(f"Failed to extract invoice data: {invoice_json.get('error')}")
        
        print(f"DEBUG: Extracted JSON with keys: {list(invoice_json.keys())}")
        print(f"DEBUG: Line items count: {len(invoice_json.get('line_items', []))}")
        
        # Extract line items - normalize to our format
        raw_line_items = invoice_json.get('line_items', [])
        line_items = []
        for idx, item in enumerate(raw_line_items):
            # DEBUG: Log raw line item data
            print(f"DEBUG: Raw line item {idx}: {item}")
            
            # Normalize: DeepSeek returns 'item_name', we use 'item'
            normalized_item = {
                "item": item.get('item_name') or item.get('item') or "",
                "quantity": str(item.get('quantity', '')),
                "rate": str(item.get('rate', '')),
                "amount": str(item.get('amount', '')),
            }
            
            # DEBUG: Log normalized values
            print(f"DEBUG: Normalized item {idx}: qty={normalized_item['quantity']}, rate={normalized_item['rate']}, amount={normalized_item['amount']}")
            
            # Add optional fields if present
            if item.get('description'):
                normalized_item['description'] = item['description']
            if item.get('product_code'):
                normalized_item['product_code'] = item['product_code']
            line_items.append(normalized_item)
        
        print(f"DEBUG: Normalized {len(line_items)} line items total")
        
        # Extract invoice metadata
        inv_number = invoice_json.get('invoice_number') or "Unknown"
        inv_date = invoice_json.get('date') or "Unknown Date"
        
        # Extract vendor information
        vendor_info = invoice_json.get('vendor', {})
        vendor_name = vendor_info.get('name') if isinstance(vendor_info, dict) else (vendor_info if isinstance(vendor_info, str) else "Unknown Vendor")
        
        # Extract financial summary
        financial = invoice_json.get('financial_summary', {})
        
        # Helper function to safely extract numeric values
        def safe_float(value):
            if value is None:
                return 0.0
            try:
                return float(value) if isinstance(value, str) else float(value)
            except (ValueError, TypeError):
                return 0.0
        
        subtotal = safe_float(financial.get('subtotal'))
        shipping = safe_float(financial.get('shipping'))
        tax = safe_float(financial.get('tax'))
        total = safe_float(financial.get('total') or financial.get('balance_due'))
        
        # Extract discount (can be in discount.amount or discount object)
        discount_obj = financial.get('discount', {})
        if isinstance(discount_obj, dict):
            discount_amount = safe_float(discount_obj.get('amount'))
        else:
            discount_amount = 0.0
        
        print(f"DEBUG: Financial summary - Subtotal: {subtotal}, Shipping: {shipping}, Discount: {discount_amount}, Tax: {tax}, Total: {total}")
        
        # Build invoice data
        invoice_data = {
            "invoice_uid": invoice_uid,
            "filename": file.filename,
            "invoice_number": inv_number,
            "vendor_name": vendor_name,
            "date": inv_date,
            "total_amount": total,
            "subtotal": subtotal,
            "shipping": shipping,
            "discount_amount": discount_amount,
            "tax": tax,
            "line_items": line_items,
        }
        
        # Add optional fields if present
        if invoice_json.get('order_id'):
            invoice_data['order_id'] = invoice_json['order_id']
        if invoice_json.get('customer'):
            invoice_data['customer'] = invoice_json['customer']
        if invoice_json.get('shipping_info'):
            invoice_data['shipping_info'] = invoice_json['shipping_info']
        
        # === VALIDATION & TRUST LAYER ===
        print(f"DEBUG: Validating math for {file.filename}...")
        
        # Calculate extraction confidence (NEW: Based on field presence/quality)
        extraction_conf_result = calculate_extraction_confidence(invoice_json)
        extraction_confidence = extraction_conf_result['overall_confidence']
        
        print(f"DEBUG: Extraction confidence: {extraction_confidence:.2f} (field_presence: {extraction_conf_result['field_presence_score']:.2f}, quality: {extraction_conf_result['field_quality_score']:.2f}, completeness: {extraction_conf_result['completeness_score']:.2f}, consistency: {extraction_conf_result['data_consistency_score']:.2f})")
        
        # Perform mathematical validation
        validation_results = validate_invoice_math(invoice_data)
        
        # DEBUG: Log math validation results
        validation_start = time_module.time()
        print(f"DEBUG: Math validation - Overall valid: {validation_results['overall_valid']}")
        print(f"DEBUG: Line items valid: {validation_results['line_items_valid']}")
        print(f"DEBUG: Subtotal valid: {validation_results['subtotal_valid']}")
        print(f"DEBUG: Total valid: {validation_results['total_valid']}")
        if validation_results.get('errors'):
            print(f"DEBUG: Validation errors: {validation_results['errors']}")
        
        # Calculate validation confidence
        validation_confidence = calculate_validation_confidence(validation_results)
        
        # Check for critical fields
        has_critical_fields = all([
            invoice_data.get('invoice_number') and invoice_data.get('invoice_number') != "Unknown",
            invoice_data.get('date') and invoice_data.get('date') != "Unknown Date",
            invoice_data.get('total_amount') and invoice_data.get('total_amount') > 0
        ])
        
        # Combined confidence (validation is weighted heavily for accounting)
        # Trust-first: Math validation is 70%, extraction quality is 30%
        overall_confidence = (validation_confidence * 0.7) + (extraction_confidence * 0.3)
        
        # Determine review status based on accounting rules
        review_decision = determine_review_status(
            overall_confidence,
            validation_results,
            has_critical_fields
        )
        
        invoice_perf['validation_time'] = (time_module.time() - validation_start) * 1000
        invoice_perf['total_invoice_time'] = (time_module.time() - invoice_start) * 1000
        
        print(f"DEBUG: Validation complete. Status: {review_decision['status']}, Overall Confidence: {overall_confidence:.2f}")
        print(f"DEBUG: Invoice processing time: {invoice_perf['total_invoice_time']:.2f}ms")
        
        # Add validation metadata to response
        invoice_data.update({
            "confidence": {
                "overall": round(overall_confidence, 2),
                "extraction": round(extraction_confidence, 2),
                "validation": round(validation_confidence, 2),
                "extraction_details": extraction_conf_result  # NEW: Detailed extraction scores
            },
            "math_validation": validation_results,
            "review_status": review_decision['status'],
            "review_reason": review_decision['reason'],
            "auto_approve": review_decision['auto_approve'],
            "provider": provider_name,
            "performance": invoice_perf  # NEW: Performance metrics
        })
        
        return invoice_data
    except Exception as e:
        # Re-raise the exception to be caught by the gather
        raise Exception(f"Failed to process {file.filename}: {str(e)}")

# --- END NEW HELPER FUNCTIONS ---



# ========================================================================
# ENDPOINT: Single Document Analysis
# ========================================================================
@router.post("/analyze")
async def analyze_pdf(file: UploadFile = File(...)):
    """
    Accept PDF or image file and return OCR markdown with structure analysis.
    
    DATA FLOW:
    ----------
    1. Frontend uploads single file
    2. File → configured OCR provider → Get structured payload
    3. Markdown → parse_sections() → Document structure
    4. Markdown → extract_entities() → Dates, amounts, emails, etc.
    5. Return combined results to frontend
    
    FRONTEND CONNECTION:
    This endpoint is for general document analysis (not specifically invoices).
    Use /invoice/extract-batch for invoice processing.
    
    RESPONSE STRUCTURE:
    {
        "result_markdown": str,    # Full OCR text
        "pages": int,              # Number of pages
        "duration": float,         # Processing time
        "sections": [...],         # Document structure
        "entities": [...],         # Extracted entities
        "images": {...}            # Page images (base64)
    }
    """
    try:
        print("DEBUG: Starting analysis...")
        start_time = time.time()
        contents = await file.read()
        mime_type = file.content_type
        
        #Run OCR 
        print("DEBUG: Running OCR...")
        # Run OCR via configured provider
        ocr_result = await _invoice_extractor.extract_invoice(
            file_bytes=contents,
            filename=file.filename,
            mime_type=mime_type,
        )
      
        
        #Extract the actual markdown text from the result dictionary
        markdown_text = ocr_result["result_markdown"]
        
        # parse structure and enitities 
        print("DEBUG: Parsing sections...")
        sections = parse_sections(markdown_text)
        print("DEBUG: Extracting entities...")
        entities = extract_entities(markdown_text)
        
        processing_time = time.time() - start_time
        print("DEBUG: Preparing response...")
        # Ensure images is always a dict, never None
        images = ocr_result.get("images", {})
        if images is None:
            images = {}
        
        return JSONResponse(content={
            "result_markdown": markdown_text, # Use the extracted text here
            "pages": ocr_result.get("pages", 0), # Use the values from the OCR result
            "duration": ocr_result.get("duration"),
            "sections": sections, #Use the newly parsed sections
            "entities": entities , # Use the newly extracted entities
            "images": images,  # Always return a dict, even if empty
        })
    except Exception as e:
        print(f"DEBUG: An exception occurred: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
    
# ========================================================================
# ENDPOINT: Batch Invoice Processing (MAIN ENDPOINT)
# ========================================================================
@router.post("/invoice/extract-batch")
async def extract_invoice_data_batch(files: List[UploadFile] = File(...)):
    """
    Accepts multiple invoice files, extracts data from each, and returns an aggregated result.
    Processes all files concurrently and returns the complete result.
    
    DATA FLOW:
    ----------
    1. RECEIVES: Multiple invoice files from frontend (FormData with 'files')
    
    2. CONCURRENT PROCESSING:
       For each file (in parallel via asyncio.gather):
       → _process_single_invoice(file)
         → run_mistral_ocr() → Get markdown
         → _parse_invoice_table() → Get line items
         → extract_entities() → Get dates, amounts
         → Calculate totals
    
    3. AGGREGATION:
       - Combine all line items from all invoices
       - Calculate grand total across all invoices
       - Collect unique vendors
       - Tag each line item with source invoice
       - Add unique IDs to each line item
    
    4. RETURNS TO: Frontend App.tsx → handleProcessInvoices()
    
    FRONTEND CONNECTION:
    --------------------
    Called by: frontend/src/App.tsx → handleProcessInvoices()
    Response goes to: Dashboard component via aggregatedData state
    
    RESPONSE STRUCTURE:
    {
        "summary": {
            "total_amount": str,              # Formatted: "1,234.56"
            "total_invoices_processed": int,
            "vendors": [str],                 # Unique vendor list
            "processing_errors": [str]        # Error messages if any
        },
        "line_items": [{
            "id": str,                        # UUID
            "item": str,
            "quantity": str,
            "rate": str,
            "amount": str,
            "vendor": str,
            "date": str,
            "source_invoice_id": str,         # e.g., "inv-12345"
            "source_invoice_number": str,
            "confidence": str                 # "high", "medium", "low"
        }],
        "invoices": {
            "inv-12345": {
                "vendor": str,
                "date": str,
                "total_amount": float
            }
        }
    }
    """
    # ═══════════════════════════════════════════════════════════
    # PERFORMANCE TRACKING START
    # ═══════════════════════════════════════════════════════════
    import time as time_module
    perf_start = time_module.time()
    perf_timings = {}
    
    print(f"\n{'═' * 60}")
    print(f"🚀 BACKEND PERFORMANCE TRACKING")
    print(f"{'═' * 60}")
    print(
        f"Received {len(files) if files else 0} files | "
        f"Provider: {_invoice_extractor.name} | Concurrency: {_ocr_settings.max_concurrency}"
    )
    for i, file in enumerate(files):
        print(f"  File {i+1}: {file.filename}, size: {file.size if hasattr(file, 'size') else 'unknown'}")
    
    if not files: 
        raise HTTPException(status_code=400, detail="No files provided.")
    
    # Stage 3a: File Saving (concurrent with processing)
    # (Tracked inside _process_single_invoice)
    
    # Stage 3b: OCR Extraction (concurrent)
    print(f"\n⚙️  Starting concurrent processing of {len(files)} files...")
    ocr_start = time_module.time()
    
    semaphore = asyncio.Semaphore(max(1, _ocr_settings.max_concurrency))

    async def _guarded_process(upload_file: UploadFile):
        async with semaphore:
            return await _process_single_invoice(upload_file, _invoice_extractor)

    tasks = [_guarded_process(file) for file in files]

    # Wait for all files to be processed 
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    perf_timings['ocr_time'] = (time_module.time() - ocr_start) * 1000  # Convert to ms
    print(f"✓ OCR extraction complete: {perf_timings['ocr_time']:.2f}ms")
    print(f"  Results: {len(results)} files processed")
    
    # Stage 3c & 3d: Aggregation and Validation (tracked in results)
    validation_start = time_module.time()
    
    #--- Aggregate successful results ---
    aggregated_data = {
        "summary": {
            "total_amount": 0.0,
            "total_invoices_processed": 0,
            "vendors": set(),
            "processing_errors": [],
            # NEW: Trust & validation statistics
            "auto_approved_count": 0,
            "needs_review_count": 0,
            "math_errors_count": 0,
            "average_confidence": 0.0
        },
        "line_items": [],
        "invoices": {}
    }
    
    for result in results:
        if isinstance(result, Exception):
            # Handle processing errors for a specifc file 
            error_message = str(result)
            aggregated_data["summary"]["processing_errors"].append(error_message)
            continue
        
        # --- Aggregate data from successful processing --- 
        invoice_id = result.get("invoice_uid") or f"inv-{uuid.uuid4()}"
        aggregated_data["summary"]["total_invoices_processed"] += 1
        
        total_amount = result.get("total_amount", 0)
        if isinstance(total_amount, (int, float)):
            aggregated_data["summary"]["total_amount"] += total_amount
            
        aggregated_data["summary"]["vendors"].add(result.get("vendor_name", "Unknown Vendor"))
        
        # NEW: Track validation statistics
        review_status = result.get("review_status", "REQUIRES_REVIEW")
        if review_status == "AUTO_APPROVED":
            aggregated_data["summary"]["auto_approved_count"] += 1
        else:
            aggregated_data["summary"]["needs_review_count"] += 1
        
        # Track math errors
        math_validation = result.get("math_validation", {})
        if not math_validation.get("overall_valid", True):
            aggregated_data["summary"]["math_errors_count"] += 1
        
        # Add unique IDS to line items and tag them with source invoice 
        for idx, item in enumerate(result.get("line_items", [])):
            # Get validation result for this specific line item
            line_item_validation = None
            if math_validation.get("line_items") and idx < len(math_validation["line_items"]):
                line_item_validation = math_validation["line_items"][idx]
            
            item["id"] = str(uuid.uuid4())
            item["source_invoice_id"] = invoice_id
            item["source_invoice_number"] = result.get("invoice_number")
            item["vendor"] = result.get("vendor_name")
            item["date"] = result.get("date")
            
            # NEW: Add validation confidence instead of placeholder
            if line_item_validation:
                item["confidence"] = line_item_validation.get("confidence", 0.85)
                item["math_valid"] = line_item_validation.get("valid", True)
                item["calculated_amount"] = line_item_validation.get("calculated_amount")
            else:
                item["confidence"] = result.get("confidence", {}).get("overall", 0.85)
                item["math_valid"] = True
            
            aggregated_data["line_items"].append(item)
            
        #Store individual invoice details with validation data
        aggregated_data["invoices"][invoice_id] = {
            "invoice_uid": invoice_id,
            "filename": result.get("filename"),  # CRITICAL: Needed for PDF viewer
            "invoice_number": result.get("invoice_number"),  # For display
            "vendor": result.get("vendor_name"),
            "date": result.get("date"),
            "total_amount": result.get("total_amount"),
            "subtotal": result.get("subtotal"),
            "shipping": result.get("shipping"),
            "discount_amount": result.get("discount_amount"),
            "tax": result.get("tax"),
            "line_items": result.get("line_items", []),  # Include line items for review
            # NEW: Validation and confidence data
            "confidence": result.get("confidence", {}),
            "math_validation": result.get("math_validation", {}),
            "review_status": result.get("review_status", "REQUIRES_REVIEW"),
            "auto_approve": result.get("auto_approve", False)
        }
    
    #--- Finalize the summary ----
    aggregated_data["summary"]["vendors"] = list(aggregated_data["summary"]["vendors"])
    aggregated_data["summary"]["total_amount"] = f"{aggregated_data['summary']['total_amount']:,.2f}"
    
    # Calculate average confidence across all processed invoices
    total_confidence = sum(
        result.get("confidence", {}).get("overall", 0.0) 
        for result in results 
        if not isinstance(result, Exception)
    )
    processed_count = aggregated_data["summary"]["total_invoices_processed"]
    if processed_count > 0:
        aggregated_data["summary"]["average_confidence"] = round(total_confidence / processed_count, 2)
    else:
        aggregated_data["summary"]["average_confidence"] = 0.0
    
    perf_timings['aggregation_time'] = (time_module.time() - validation_start) * 1000
    print(f"✓ Aggregation complete: {perf_timings['aggregation_time']:.2f}ms")
    print(f"  Auto-approved: {aggregated_data['summary']['auto_approved_count']}, Needs review: {aggregated_data['summary']['needs_review_count']}")
    
    # Calculate total backend time
    perf_timings['total_time'] = (time_module.time() - perf_start) * 1000
    
    # Extract detailed timing from individual invoice results
    file_save_times = []
    validation_times = []
    provider_breakdowns = []
    
    for result in results:
        if isinstance(result, Exception):
            continue
        if result.get('performance'):
            performance = result['performance']
            file_save_times.append(performance.get('file_save_time', 0))
            validation_times.append(performance.get('validation_time', 0))
            if performance.get('provider_breakdown'):
                provider_breakdowns.append(performance['provider_breakdown'])
    
    # Calculate averages and totals
    avg_file_save = sum(file_save_times) / len(file_save_times) if file_save_times else 0
    avg_validation = sum(validation_times) / len(validation_times) if validation_times else 0
    total_file_save = sum(file_save_times)
    total_validation = sum(validation_times)
    
    # Provider breakdown
    provider_breakdown = {}
    if provider_breakdowns:
        numeric_keys = {"text_extraction_time", "api_call_time", "json_parse_time"}
        for key in numeric_keys:
            values = [d.get(key) for d in provider_breakdowns if isinstance(d.get(key), (int, float))]
            if values:
                provider_breakdown[key] = sum(values) / len(values)

        sample_breakdown = provider_breakdowns[0]
        if isinstance(sample_breakdown, dict):
            for meta_key in ("provider", "model"):
                if sample_breakdown.get(meta_key):
                    provider_breakdown[meta_key] = sample_breakdown[meta_key]
    
    # Add performance metrics to response
    aggregated_data['performance_metrics'] = {
        'total_time': perf_timings['total_time'],
        'file_save_time': total_file_save,
        'ocr_time': perf_timings['ocr_time'],
        'validation_time': total_validation,
        'aggregation_time': perf_timings['aggregation_time'],
        'provider_breakdown': provider_breakdown,
        'per_invoice_avg': perf_timings['total_time'] / len(files) if files else 0,
        'files_processed': len(files),
        'successful': len([r for r in results if not isinstance(r, Exception)]),
        'failed': len([r for r in results if isinstance(r, Exception)])
    }
    
    # Print performance summary
    print(f"\n{'═' * 60}")
    print(f"📊 BACKEND PERFORMANCE SUMMARY")
    print(f"{'═' * 60}")
    print(f"Total Time: {perf_timings['total_time']:.2f}ms ({perf_timings['total_time']/1000:.2f}s)")
    print(f"Per Invoice: {perf_timings['total_time']/len(files):.2f}ms")
    print(f"\nBREAKDOWN:")
    print(f"  File Save:    {total_file_save:.2f}ms ({total_file_save/perf_timings['total_time']*100:.1f}%)")
    print(f"  OCR Extract:  {perf_timings['ocr_time']:.2f}ms ({perf_timings['ocr_time']/perf_timings['total_time']*100:.1f}%) ⚠️ BOTTLENECK")
    print(f"  Validation:   {total_validation:.2f}ms ({total_validation/perf_timings['total_time']*100:.1f}%)")
    print(f"  Aggregation:  {perf_timings['aggregation_time']:.2f}ms ({perf_timings['aggregation_time']/perf_timings['total_time']*100:.1f}%)")
    if provider_breakdown:
        print(f"\nOCR BREAKDOWN (avg per invoice):")
        for key, value in provider_breakdown.items():
            if isinstance(value, (int, float)):
                label = key.replace('_', ' ').title()
                print(f"  {label}: {value:.2f}ms")
    print(f"{'═' * 60}\n")
    
    return JSONResponse(content=aggregated_data)
# --- END NEW ENDPOINT



    
