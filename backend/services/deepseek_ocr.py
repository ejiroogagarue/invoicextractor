# services/deepseek_ocr.py
"""
DeepSeek OCR Service - OCR processing using DeepSeek API

DATA FLOW:
==========
INPUT: Raw file bytes + mime type from router
PROCESS: Convert to base64 → Send to DeepSeek Vision API → Extract text
OUTPUT: Markdown text

CALLED BY:
----------
- routers/ocr.py: _process_single_invoice() - For invoice processing
- routers/ocr.py: analyze_pdf() - For general document analysis

RETURNS TO:
-----------
- Dictionary containing:
  * result_markdown: Extracted text in markdown format
  * pages: Number of pages processed
  * duration: Processing time
  * images: Dict of page images (base64 encoded)

DEEPSEEK SETUP:
===============
1. Get API key from: https://platform.deepseek.com/
2. Add to .env file: DEEPSEEK_API_KEY=your_key_here
3. Model used: deepseek-chat (supports vision/image understanding)
"""

import os
import base64
import time
import re
from typing import Dict
from dotenv import load_dotenv
import requests
import json

load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

if not DEEPSEEK_API_KEY:
    raise RuntimeError("Missing DEEPSEEK_API_KEY in .env")

# DeepSeek API endpoint
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"


def run_deepseek_ocr_direct(file_bytes: bytes, mime_type: str = "application/pdf") -> dict:
    """
    DEPRECATED: DeepSeek's chat API doesn't support vision/image input directly.
    Use run_deepseek_ocr() instead which converts PDFs to images first.
    """
    raise NotImplementedError("DeepSeek chat API doesn't support image input. Use run_deepseek_ocr() with PDF conversion.")


def run_deepseek_ocr(file_bytes: bytes, mime_type: str = "application/pdf") -> dict:
    """
    Process document with DeepSeek by converting PDFs to images first.
    
    Since DeepSeek's chat API doesn't support vision/image input directly,
    we use PyMuPDF (fitz) to extract text from PDFs, or convert to images
    for better structured extraction.
    
    DATA FLOW:
    ----------
    1. If PDF: Extract text using PyMuPDF OR convert to image
    2. If Image: Use OCR library (pytesseract) to extract text
    3. Send extracted text to DeepSeek for structuring
    4. DeepSeek formats the text as invoice markdown
    5. Return structured dictionary
    
    CALLED BY: 
    - _process_single_invoice() in routers/ocr.py
    - analyze_pdf() in routers/ocr.py
    
    PARAMETERS:
    -----------
    file_bytes: Raw bytes of PDF or image file
    mime_type: MIME type (e.g., "application/pdf", "image/png", "image/jpeg")
    
    RETURNS:
    --------
    {
        "result_markdown": str,  # Extracted text in markdown format
        "pages": int,            # Number of pages processed
        "duration": float,       # Processing time in seconds
        "images": {}             # Empty dict
    }
    
    APPROACH:
    ---------
    Since DeepSeek doesn't have vision API, we:
    1. Extract raw text from PDF using PyMuPDF
    2. Send text to DeepSeek for intelligent structuring
    3. DeepSeek identifies invoice fields and formats as markdown table
    """
    start = time.time()
    perf_metrics = {}
    
    print(f"DEBUG: DeepSeek OCR starting...")
    print(f"DEBUG: File size: {len(file_bytes)} bytes, type: {mime_type}")
    
    # Step 1: Extract raw text from the document
    text_extract_start = time.time()
    raw_text = ""
    page_count = 1  # Default to 1 page for images
    
    try:
        if mime_type == "application/pdf":
            # Use PyMuPDF to extract text from PDF
            print("DEBUG: Extracting text from PDF using PyMuPDF...")
            try:
                import fitz  # PyMuPDF
                
                # Open PDF from bytes
                pdf_document = fitz.open(stream=file_bytes, filetype="pdf")
                page_count = len(pdf_document)
                
                # Extract text from all pages
                for page_num in range(page_count):
                    page = pdf_document[page_num]
                    raw_text += f"\n\n=== Page {page_num + 1} ===\n\n"
                    raw_text += page.get_text()
                
                pdf_document.close()
                perf_metrics['text_extraction_time'] = (time.time() - text_extract_start) * 1000
                print(f"DEBUG: Extracted {len(raw_text)} characters from {page_count} page(s) ({perf_metrics['text_extraction_time']:.2f}ms)")
                
            except ImportError:
                print("WARNING: PyMuPDF (fitz) not installed. Install with: pip install PyMuPDF")
                raise RuntimeError("PyMuPDF required for PDF processing. Install with: pip install PyMuPDF")
                
        elif mime_type.startswith("image/"):
            # Use pytesseract for image OCR
            print("DEBUG: Performing OCR on image using pytesseract...")
            try:
                from PIL import Image
                import pytesseract
                import io
                
                # Open image from bytes
                image = Image.open(io.BytesIO(file_bytes))
                raw_text = pytesseract.image_to_string(image)
                perf_metrics['text_extraction_time'] = (time.time() - text_extract_start) * 1000
                print(f"DEBUG: Extracted {len(raw_text)} characters from image ({perf_metrics['text_extraction_time']:.2f}ms)")
                page_count = 1  # Images are single page
                
            except ImportError:
                print("WARNING: PIL or pytesseract not installed.")
                raise RuntimeError("PIL and pytesseract required for image processing. Install with: pip install Pillow pytesseract")
        else:
            raise ValueError(f"Unsupported mime type: {mime_type}")
    
    except Exception as e:
        print(f"ERROR: Text extraction failed: {e}")
        raise RuntimeError(f"Failed to extract text from document: {str(e)}")
    
    if not raw_text.strip():
        print("WARNING: No text extracted from document")
        empty_json = {
            "error": "No text could be extracted from this document",
            "line_items": []
        }
        return {
            "result_json": empty_json,
            "result_markdown": json.dumps(empty_json, indent=2),
            "pages": page_count,
            "duration": round(time.time() - start, 2),
            "images": {}
        }
    
    # Step 2: Use DeepSeek to structure the extracted text
    print(f"DEBUG: Sending extracted text to DeepSeek for structuring...")
    
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Craft a prompt to structure the raw text as JSON invoice data
    # TRUST-FIRST: Request comprehensive JSON to avoid regex parsing errors
    system_prompt = """You are an expert at analyzing and structuring invoice data for accounting purposes.
You will be given raw text extracted from an invoice document.
Your task is to extract ALL invoice data and return it as a valid JSON object.

CRITICAL RULES:
1. Extract EVERY field you can find - shipping, discounts, customer info, order IDs, etc.
2. Use null for missing fields - NEVER make up data
3. Use exact numbers from the invoice - do not round or modify
4. Return ONLY valid JSON - no markdown, no explanations, just JSON
5. For line items, extract item name, description, product code if available
6. For financial fields, use numbers (not strings with $ symbols)

TRUST IS PARAMOUNT - missing data is better than incorrect data."""

    json_schema = """{
  "invoice_number": "string or null",
  "date": "string (format as found in invoice) or null",
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
      "item_name": "string (required - product or service name)",
      "description": "string or null (category or additional details)",
      "product_code": "string or null (SKU/product code if present)",
      "quantity": number (required - HOW MANY units, e.g., 2, 5, 1)",
      "rate": number (required - UNIT PRICE, price PER ITEM, NOT total)",
      "amount": number (required - TOTAL for this line: quantity × rate)"
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
    "total": number (required if found),
    "balance_due": number or null
  },
  "payment_terms": "string or null",
  "notes": "string or null"
}"""

    user_prompt = f"""Here is the raw text extracted from an invoice document:

---
{raw_text}
---

Analyze this invoice and extract ALL data into the JSON structure below.
Return ONLY valid JSON - no markdown code fences, no explanations, just the JSON object.

Required JSON structure:
{json_schema}

CRITICAL INSTRUCTIONS FOR LINE ITEMS:
- quantity = HOW MANY items (e.g., if invoice says "2 chairs", quantity = 2)
- rate = UNIT PRICE (price for ONE item, e.g., $50.00 per chair)
- amount = TOTAL PRICE for that line (quantity × rate, e.g., 2 × $50 = $100)
- EXAMPLE: "3 Office Desks @ $200 each = $600"
  → quantity: 3, rate: 200, amount: 600

OTHER IMPORTANT FIELDS:
- Extract shipping amount if present (critical for accounting)
- Extract discount percentage AND amount if present
- Extract all line items with quantity, rate, and amount
- Use null for any field you cannot find
- Preserve exact numbers from the invoice - do not calculate or modify"""
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
        "temperature": 0.1,  # Low temperature for consistent extraction
        "max_tokens": 4096
    }
    
    try:
        api_call_start = time.time()
        print("DEBUG: Sending request to DeepSeek API...")
        response = requests.post(
            DEEPSEEK_API_URL,
            headers=headers,
            json=payload,
            timeout=120  # 2 minute timeout
        )
        
        perf_metrics['api_call_time'] = (time.time() - api_call_start) * 1000
        print(f"DEBUG: DeepSeek API response status: {response.status_code} ({perf_metrics['api_call_time']:.2f}ms)")
        
        if response.status_code != 200:
            print(f"DEBUG: DeepSeek API error: {response.text}")
            raise RuntimeError(f"DeepSeek API error: {response.status_code} - {response.text}")
        
        result = response.json()
        
        # Extract the JSON text from the response
        json_parse_start = time.time()
        if "choices" in result and len(result["choices"]) > 0:
            response_text = result["choices"][0]["message"]["content"]
            print(f"DEBUG: Extracted {len(response_text)} characters of text")
            
            # Try to extract JSON (might be wrapped in markdown code fences)
            json_text = response_text.strip()
            
            # Remove markdown code fences if present
            if json_text.startswith("```"):
                # Find the first newline after ```
                first_newline = json_text.find("\n")
                if first_newline != -1:
                    json_text = json_text[first_newline:].strip()
                # Remove trailing ```
                json_text = re.sub(r'```\s*$', '', json_text).strip()
            
            # Try to parse as JSON
            try:
                invoice_json = json.loads(json_text)
                perf_metrics['json_parse_time'] = (time.time() - json_parse_start) * 1000
                print(f"DEBUG: Successfully parsed JSON with {len(invoice_json.get('line_items', []))} line items ({perf_metrics['json_parse_time']:.2f}ms)")
                print(f"DEBUG: JSON keys: {list(invoice_json.keys())}")
            except json.JSONDecodeError as e:
                print(f"DEBUG: JSON parse error: {e}")
                print(f"DEBUG: Response text (first 500 chars): {response_text[:500]}")
                # Return error structure
                invoice_json = {
                    "error": "Failed to parse JSON response",
                    "raw_response": response_text[:1000],  # First 1000 chars for debugging
                    "line_items": []
                }
        else:
            print("DEBUG: No content in DeepSeek response")
            invoice_json = {
                "error": "No content in DeepSeek response",
                "line_items": []
            }
        
        # Calculate duration
        duration = round(time.time() - start, 2)
        
        # Print performance summary
        print(f"DEBUG: DeepSeek OCR complete in {duration}s")
        print(f"DEBUG: Performance breakdown:")
        print(f"  - Text Extraction: {perf_metrics.get('text_extraction_time', 0):.2f}ms")
        print(f"  - API Call:        {perf_metrics.get('api_call_time', 0):.2f}ms")
        print(f"  - JSON Parsing:    {perf_metrics.get('json_parse_time', 0):.2f}ms")
        
        # Return both JSON and markdown (for backward compatibility)
        # The markdown is now just a stringified version of the JSON for debugging
        return {
            "result_json": invoice_json,  # NEW: Structured JSON data
            "result_markdown": json.dumps(invoice_json, indent=2) if isinstance(invoice_json, dict) else response_text,  # Keep for backward compat
            "pages": page_count,
            "duration": duration,
            "images": {},  # Not extracting page images with DeepSeek
            "performance": perf_metrics  # NEW: Performance breakdown
        }
    
    except requests.exceptions.Timeout:
        raise RuntimeError("DeepSeek API request timed out after 120 seconds")
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"DeepSeek API request failed: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"DeepSeek OCR failed: {str(e)}")


# Alternative function that handles PDFs by converting to images first
def run_deepseek_ocr_with_pdf_conversion(file_bytes: bytes, mime_type: str = "application/pdf") -> dict:
    """
    Enhanced version that converts PDFs to images before OCR.
    
    This provides better results for PDFs by converting each page to an image
    and processing separately with DeepSeek's vision model.
    
    Requires: pdf2image library (pip install pdf2image)
    Also requires: poppler-utils (brew install poppler on macOS)
    """
    try:
        from pdf2image import convert_from_bytes
        from PIL import Image
        import io
        
        start = time.time()
        
        if mime_type == "application/pdf":
            print("DEBUG: Converting PDF to images...")
            
            # Convert PDF pages to images
            images = convert_from_bytes(file_bytes, dpi=200)
            print(f"DEBUG: PDF converted to {len(images)} page(s)")
            
            all_markdown = []
            
            # Process each page
            for i, img in enumerate(images):
                print(f"DEBUG: Processing page {i+1}/{len(images)}...")
                
                # Convert PIL Image to bytes
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='PNG')
                img_bytes = img_byte_arr.getvalue()
                
                # Process this page with DeepSeek
                page_result = run_deepseek_ocr(img_bytes, "image/png")
                all_markdown.append(f"## Page {i+1}\n\n{page_result['result_markdown']}")
            
            # Combine all pages
            combined_markdown = "\n\n---\n\n".join(all_markdown)
            duration = round(time.time() - start, 2)
            
            return {
                "result_markdown": combined_markdown,
                "pages": len(images),
                "duration": duration,
                "images": {}
            }
        else:
            # For images, use regular OCR
            return run_deepseek_ocr(file_bytes, mime_type)
    
    except ImportError:
        print("WARNING: pdf2image not installed. Falling back to direct PDF processing.")
        print("Install with: pip install pdf2image")
        print("Also install poppler: brew install poppler (macOS) or apt-get install poppler-utils (Linux)")
        return run_deepseek_ocr(file_bytes, mime_type)
    except Exception as e:
        print(f"WARNING: PDF conversion failed: {e}. Falling back to direct processing.")
        return run_deepseek_ocr(file_bytes, mime_type)

