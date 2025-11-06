# services/mistral_ocr.py
"""
Mistral OCR Service - Core OCR processing using Mistral AI

DATA FLOW:
==========
INPUT: Raw file bytes + mime type from router
PROCESS: Send to Mistral AI OCR API
OUTPUT: Markdown text + page images

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
"""

import os 
import base64 
import re, time
from mistralai import Mistral
from dotenv import load_dotenv


load_dotenv()

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

if not MISTRAL_API_KEY:
    raise RuntimeError("Missing MISTRAL_API_KEY in .env")

client = Mistral(api_key=MISTRAL_API_KEY)

def run_mistral_ocr(file_bytes: bytes, mime_type: str="application/pdf")-> dict:
    """
    Send document to Mistral OCR and return markdown result.
    
    DATA FLOW:
    ----------
    1. Encode file bytes to base64
    2. Send to Mistral API with document_url
    3. Receive OCR response with pages
    4. Extract markdown text from each page
    5. Extract and remap images
    6. Return structured dictionary
    
    CALLED BY: 
    - _process_single_invoice() in routers/ocr.py
    - analyze_pdf() in routers/ocr.py
    
    PARAMETERS:
    -----------
    file_bytes: Raw bytes of PDF or image file
    mime_type: MIME type (e.g., "application/pdf", "image/png")
    
    RETURNS:
    --------
    {
        "result_markdown": str,  # Combined markdown from all pages
        "pages": int,            # Total number of pages
        "duration": float,       # Processing time in seconds
        "images": {              # Dict mapping img-N to base64 image data
            0: "base64_string...",
            1: "base64_string...",
            ...
        }
    }
    """
    start = time.time()
    encoded_file = base64.b64encode(file_bytes).decode("utf-8")
    document = {
        "type": "document_url" if mime_type == "application/pdf" else "image_url",
        "document_url": f"data:{mime_type};base64,{encoded_file}"
    }
    
    try:
        ocr_response = client.ocr.process(
            model="mistral-ocr-latest",
            document=document,
            include_image_base64=True # set True if you want to display image
        )
        
        # Debug: Check response structure
        print(f"DEBUG: OCR response type: {type(ocr_response)}")
        print(f"DEBUG: OCR response attributes: {[attr for attr in dir(ocr_response) if not attr.startswith('_')]}")
        
        # Process response 
        pages = getattr(ocr_response, "pages", [])
        print(f"DEBUG: Number of pages: {len(pages)}")
        markdown_text = "\n\n".join(p.markdown for p in pages)
        
        # Extract the image data - ensure we always return a dict even if empty
        images = {}
        print(f"DEBUG: Processing {len(pages)} pages...")
        
        for i, p in enumerate(pages):
            try:
                # The attribute is 'images' (plural), not 'image_base64'
                if hasattr(p, 'images'):
                    page_images = getattr(p, 'images', None)
                    print(f"DEBUG: Page {i} has images attribute")
                    print(f"DEBUG: Page {i} images type: {type(page_images)}")
                    
                    # Safely check the value without printing potentially huge base64 strings
                    if page_images is not None:
                        if isinstance(page_images, list):
                            print(f"DEBUG: Page {i} images is a list with {len(page_images)} items")
                            if len(page_images) > 0:
                                # Get first image from list
                                first_img = page_images[0]
                                print(f"DEBUG: First image type: {type(first_img)}")
                                
                                # Check if it's an object with base64 data
                                if hasattr(first_img, '__dict__'):
                                    print(f"DEBUG: First image attributes: {list(first_img.__dict__.keys())}")
                                    # Try common attribute names - including image_base64!
                                    for attr_name in ['image_base64', 'base64', 'data', 'content', 'image_data', 'base64_data']:
                                        if hasattr(first_img, attr_name):
                                            img_data = getattr(first_img, attr_name)
                                            if img_data:
                                                images[i] = img_data
                                                print(f"DEBUG: ✓ Extracted from first_img.{attr_name}, length: {len(str(img_data))} chars")
                                                break
                                elif isinstance(first_img, str):
                                    # It's already a base64 string
                                    images[i] = first_img
                                    print(f"DEBUG: ✓ First image is string, length: {len(first_img)} chars")
                                elif isinstance(first_img, dict):
                                    print(f"DEBUG: First image dict keys: {list(first_img.keys())}")
                                    for key in ['base64', 'data', 'content', 'image']:
                                        if key in first_img:
                                            images[i] = first_img[key]
                                            print(f"DEBUG: ✓ Extracted from dict['{key}']")
                                            break
                        elif isinstance(page_images, dict):
                            print(f"DEBUG: Page {i} images is dict with keys: {list(page_images.keys())}")
                            for key in ['base64', 'data', 'content', 'image']:
                                if key in page_images:
                                    images[i] = page_images[key]
                                    print(f"DEBUG: ✓ Extracted from dict['{key}']")
                                    break
                        elif isinstance(page_images, str):
                            print(f"DEBUG: Page {i} images is string, length: {len(page_images)}")
                            images[i] = page_images
                            print(f"DEBUG: ✓ Extracted string")
                        else:
                            print(f"DEBUG: Page {i} images is {type(page_images)}, trying to access as object")
                            # Try as object with attributes
                            if hasattr(page_images, '__dict__'):
                                print(f"DEBUG: images object attributes: {list(page_images.__dict__.keys())}")
                    else:
                        print(f"DEBUG: Page {i} images is None")
                else:
                    print(f"DEBUG: ✗ Page {i} has no 'images' attribute")
            except Exception as e:
                print(f"DEBUG: Error processing page {i} images: {e}")
                import traceback
                traceback.print_exc()
        
        print(f"DEBUG: Total images extracted: {len(images)}/{len(pages)} pages")
        print(f"DEBUG: Image keys in dict: {list(images.keys())}")
        
        # Also print a sample of markdown to see image references
        if markdown_text:
            img_refs = re.findall(r'!\[.*?\]\((.*?)\)', markdown_text)
            print(f"DEBUG: Found {len(img_refs)} image references in markdown: {img_refs[:10]}")
            
            # Check if markdown contains image references that we need to map
            img_numbers = [re.search(r'img-(\d+)', ref) for ref in img_refs]
            img_numbers = [int(m.group(1)) for m in img_numbers if m]
            print(f"DEBUG: Image numbers from markdown: {sorted(set(img_numbers))}")
            
            # Create a mapping from img-N references to actual page indices with images
            # This maps img-0 -> first page with images, img-1 -> second page with images, etc.
            pages_with_images = sorted(images.keys())
            print(f"DEBUG: Pages that have images: {pages_with_images}")
            
            # Create remapped images dict where img-N maps to Nth image found
            remapped_images = {}
            for img_num in sorted(set(img_numbers)):
                if img_num < len(pages_with_images):
                    actual_page = pages_with_images[img_num]
                    remapped_images[img_num] = images[actual_page]
                    print(f"DEBUG: Mapping img-{img_num} -> page {actual_page}")
            
            # Replace the images dict with remapped version
            images = remapped_images
            print(f"DEBUG: Remapped images dict keys: {list(images.keys())}")
        
        #quick section + entity extraction (placeholder)
        headings = re.findall(r"^(#+)\s(.+)$",markdown_text, flags=re.M)
        sections = [
            {"id": f"s{i}", "title":h[1], "level": len(h[0])}
            for i, h in enumerate(headings)
        ]
        entities = [
            {"type": "DATE", "text": m.group()}
            for m in re.finditer(r"\b\d{4}-\d{2}-\d{2}\b", markdown_text)
        ]
        
        return {
            "result_markdown": markdown_text or "No OCR content found.",
            "pages": len(pages),
            "duration": round(time.time() - start, 2),
            "images": images or {},  # Ensure always a dict, never None
        }
    
    except Exception as e:
        #Raise the exception instead of returning a string.
        # The router will catch this and return a proper 500 error.
        raise RuntimeError(f"mistral OCR failed: {str(e)}")