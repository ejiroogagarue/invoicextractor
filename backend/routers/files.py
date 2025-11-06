# routers/files.py
"""
File Router - Handles file serving and storage

DATA FLOW:
==========
Serves PDF files to frontend for PDF viewer
Handles file upload storage (future)
Manages temporary file cleanup (future)

ENDPOINTS:
==========
GET /files/{filename} - Serve PDF file for viewer
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os
from pathlib import Path

router = APIRouter()

# Configure upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@router.get("/files/{filename}")
async def get_pdf_file(filename: str):
    """
    Serve PDF files for the PDF viewer.
    
    DATA FLOW:
    ----------
    1. Frontend requests PDF: GET /files/invoice_123.pdf
    2. Backend checks if file exists in uploads/
    3. Returns file with proper Content-Type
    4. Frontend PDF viewer displays it
    
    SECURITY:
    ---------
    - Only serves files from uploads/ directory
    - Validates file extension (pdf only)
    - Prevents directory traversal
    
    PARAMETERS:
    -----------
    filename: Name of PDF file to serve
    
    RETURNS:
    --------
    FileResponse with PDF content
    
    ERRORS:
    -------
    404: File not found
    400: Invalid file type
    """
    
    # Security: Prevent directory traversal
    if ".." in filename or filename.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # Security: Only allow PDF files
    if not filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Construct file path
    file_path = UPLOAD_DIR / filename
    
    # Check if file exists
    if not file_path.exists() or not file_path.is_file():
        # Debug: List available files
        available_files = list(UPLOAD_DIR.glob("*.pdf"))
        print(f"ERROR: File not found: {filename}")
        print(f"DEBUG: Available files: {[f.name for f in available_files]}")
        raise HTTPException(
            status_code=404, 
            detail=f"File not found: {filename}. Available files: {[f.name for f in available_files]}"
        )
    
    print(f"DEBUG: Serving file: {file_path}")
    
    # Serve the file with CORS headers
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=filename,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "*",
        }
    )


@router.post("/files/upload")
async def save_uploaded_file(file_bytes: bytes, filename: str):
    """
    Save uploaded file to disk (called internally by OCR router).
    
    This is called by the OCR processing pipeline to persist
    files for later PDF viewer access.
    
    INTERNAL USE ONLY - Not exposed to frontend directly.
    """
    file_path = UPLOAD_DIR / filename
    
    with open(file_path, "wb") as f:
        f.write(file_bytes)
    
    return {"filename": filename, "path": str(file_path)}

