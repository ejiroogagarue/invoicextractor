# Layra Architecture Design Document

**Project:** Layra - Trust-First Invoice Processing System  
**Version:** 1.0  
**Date:** November 6, 2025  
**Target Platform:** Google Cloud Platform (GCP)

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Data Flow](#data-flow)
6. [Technology Stack](#technology-stack)
7. [Google Cloud Deployment](#google-cloud-deployment)
8. [Getting Started in Cloud Shell](#getting-started-in-cloud-shell)
9. [API Reference](#api-reference)
10. [Performance Considerations](#performance-considerations)

---

## 1. System Overview

### **Purpose**
Layra is an AI-powered invoice processing system designed for accountants and finance teams. It extracts data from PDF invoices, validates mathematical accuracy, and provides a trust-first review interface.

### **Core Principles**
- **Trust:** Mathematical validation and confidence scoring
- **Simplicity:** Clean UI with minimal cognitive load
- **Speed:** Concurrent processing and performance tracking

### **Key Capabilities**
- PDF invoice extraction using AI (DeepSeek)
- Mathematical validation (quantity × rate = amount)
- Multi-layer confidence scoring
- Auto-approval for high-confidence invoices
- Human-in-the-loop review with PDF viewer
- Performance bottleneck identification

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER BROWSER                               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    React Frontend (Port 3000)                 │   │
│  │                                                               │   │
│  │  Components:                                                  │   │
│  │  ├─ UploadArea (drag-and-drop PDFs)                         │   │
│  │  ├─ ProcessingView (real-time progress)                     │   │
│  │  ├─ Dashboard (summary cards + data table)                  │   │
│  │  └─ ReviewInterface (side-by-side PDF viewer)               │   │
│  │                                                               │   │
│  │  Services:                                                    │   │
│  │  └─ pdfTextLocator.ts (PDF search & highlighting)           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────┬───────────────────────────────────────────┘
                            │ HTTP/REST API
                            │ (axios)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Port 8000)                       │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        API Layer                              │   │
│  │                                                               │   │
│  │  Routers:                                                     │   │
│  │  ├─ /ocr/invoice/extract-batch (main processing endpoint)   │   │
│  │  ├─ /files/{filename} (PDF serving)                         │   │
│  │  └─ /health (health check)                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            │                                          │
│                            ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Service Layer                              │   │
│  │                                                               │   │
│  │  deepseek_ocr.py:                                            │   │
│  │  ├─ PDF text extraction (PyMuPDF)                           │   │
│  │  ├─ DeepSeek API call (AI structuring)                      │   │
│  │  └─ JSON parsing & validation                               │   │
│  │                                                               │   │
│  │  validation.py:                                              │   │
│  │  ├─ Mathematical validation (line items, totals)            │   │
│  │  ├─ Confidence scoring (extraction + validation)            │   │
│  │  └─ Review status determination                             │   │
│  │                                                               │   │
│  │  entities.py:                                                │   │
│  │  └─ Data extraction utilities                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            │                                          │
│                            ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Data Layer                                 │   │
│  │                                                               │   │
│  │  uploads/ directory:                                         │   │
│  │  └─ Stores uploaded PDF files for PDF viewer                │   │
│  └─────────────────────────────────────────────────────────────┘   │
└───────────────────────────┬───────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    External Services                                 │
│                                                                       │
│  ┌──────────────────────┐                                           │
│  │   DeepSeek API       │  AI-powered invoice extraction            │
│  │   (platform.deepseek)│  - Receives raw PDF text                 │
│  │                      │  - Returns structured JSON                │
│  └──────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend Architecture

### **Technology Stack**
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite (fast development server)
- **HTTP Client:** Axios
- **PDF Viewer:** @llamaindex/pdf-viewer
- **PDF Processing:** pdfjs-dist (client-side text search)
- **Styling:** CSS Modules

### **Component Hierarchy**

```
App.tsx (Root Component)
│
├─ UploadArea.tsx
│  └─ Handles file selection and drag-and-drop
│
├─ ProcessingView.tsx
│  └─ Shows real-time processing status
│
├─ Dashboard.tsx
│  ├─ SummaryCards.tsx (statistics)
│  ├─ MasterTable.tsx (all line items)
│  └─ Invoice list with review buttons
│
└─ ReviewInterface.tsx
   ├─ PDF Viewer (left panel)
   │  └─ @llamaindex/pdf-viewer component
   │
   └─ ExtractedDataPanel.tsx (right panel)
      ├─ Invoice metadata
      ├─ Line items table
      ├─ Financial summary
      └─ ConfidenceBadge.tsx (trust indicators)
```

### **State Management**

```typescript
// Main App State (App.tsx)
interface AppState {
  mode: 'upload' | 'processing' | 'dashboard' | 'review';
  files: File[];
  aggregatedData: AggregatedData | null;
  selectedInvoice: InvoiceData | null;
  selectedInvoiceId: string | null;
  error: string | null;
  processingStatus: { [filename: string]: 'pending' | 'complete' | 'error' };
}

// Aggregated Data Structure
interface AggregatedData {
  summary: {
    total_amount: string;
    total_invoices_processed: number;
    vendors: string[];
    auto_approved_count: number;
    needs_review_count: number;
    math_errors_count: number;
    average_confidence: number;
  };
  line_items: LineItem[];
  invoices: {
    [invoiceId: string]: InvoiceData;
  };
  performance_metrics: PerformanceMetrics;
}
```

### **Key Frontend Services**

#### **pdfTextLocator.ts**
```typescript
class PDFTextLocator {
  // Loads PDF using pdfjs-dist
  async loadPDF(pdfUrl: string): Promise<void>
  
  // Searches for text and returns location
  async findText(searchText: string): Promise<TextLocation | null>
}

interface TextLocation {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### **Data Flow (Frontend)**

```
1. User uploads PDFs
   └─> UploadArea sets files in state

2. User clicks "Process Invoices"
   └─> App.tsx calls handleProcessInvoices()
       ├─> Creates FormData with files
       ├─> POST to /ocr/invoice/extract-batch
       ├─> Tracks performance timing
       └─> Updates state with aggregatedData

3. Dashboard displays results
   └─> SummaryCards shows statistics
   └─> MasterTable shows all line items
   └─> User can click "Review Invoice"

4. ReviewInterface opens
   └─> Left: PDF viewer loads from /files/{filename}
   └─> Right: ExtractedDataPanel shows data
   └─> User clicks data field
       └─> pdfTextLocator finds text in PDF
       └─> PDF scrolls to page and highlights text
```

---

## 4. Backend Architecture

### **Technology Stack**
- **Framework:** FastAPI (async Python web framework)
- **PDF Processing:** PyMuPDF (fitz) for text extraction
- **AI Integration:** DeepSeek API (via requests)
- **Validation:** Custom mathematical validation logic
- **Async Processing:** asyncio for concurrent invoice processing

### **Directory Structure**

```
backend/
├── main.py                 # FastAPI application entry point
├── .env                    # Environment variables (API keys)
│
├── routers/
│   ├── ocr.py             # Invoice processing endpoints (901 lines)
│   ├── files.py           # PDF file serving
│   └── telemetry.py       # Health checks
│
├── services/
│   ├── deepseek_ocr.py    # DeepSeek AI integration (437 lines)
│   ├── validation.py      # Math validation & confidence scoring
│   ├── entities.py        # Data extraction utilities
│   └── structure.py       # Document structure parsing
│
├── schemas/
│   └── ocr_schema.py      # Pydantic data models
│
├── utils/
│   └── file_utils.py      # File handling utilities
│
└── uploads/               # Uploaded PDF storage
```

### **Core Endpoints**

#### **POST /ocr/invoice/extract-batch**
**Purpose:** Main invoice processing endpoint

**Request:**
```
Content-Type: multipart/form-data
Body: files[] (multiple PDF files)
```

**Response:**
```json
{
  "summary": {
    "total_amount": "12,345.67",
    "total_invoices_processed": 5,
    "vendors": ["Vendor A", "Vendor B"],
    "auto_approved_count": 3,
    "needs_review_count": 2,
    "math_errors_count": 1,
    "average_confidence": 0.87
  },
  "line_items": [
    {
      "id": "uuid",
      "item": "Product Name",
      "quantity": 2,
      "rate": 50.00,
      "amount": 100.00,
      "vendor": "Vendor A",
      "date": "2025-01-15",
      "source_invoice_id": "inv-12345",
      "confidence": 0.95,
      "math_valid": true
    }
  ],
  "invoices": {
    "inv-12345": {
      "filename": "invoice.pdf",
      "invoice_number": "12345",
      "vendor": "Vendor A",
      "date": "2025-01-15",
      "total_amount": 100.00,
      "confidence": {...},
      "math_validation": {...},
      "review_status": "AUTO_APPROVED",
      "auto_approve": true
    }
  },
  "performance_metrics": {
    "total_time": 12500.0,
    "file_save_time": 120.0,
    "ocr_time": 11200.0,
    "validation_time": 90.0,
    "aggregation_time": 45.0,
    "deepseek_breakdown": {
      "text_extraction_time": 235.0,
      "api_call_time": 10800.0,
      "json_parse_time": 12.0
    }
  }
}
```

#### **GET /files/{filename}**
**Purpose:** Serve uploaded PDF files for the PDF viewer

**Response:** PDF file with CORS headers

### **Processing Pipeline**

```python
# 1. File Reception (main.py)
@router.post("/ocr/invoice/extract-batch")
async def extract_invoice_data_batch(files: List[UploadFile]):
    # Receives multiple PDF files
    
    # 2. Concurrent Processing (asyncio.gather)
    tasks = [_process_single_invoice(file) for file in files]
    results = await asyncio.gather(*tasks)
    
    # 3. Aggregation
    aggregated_data = aggregate_results(results)
    
    return aggregated_data
```

```python
# Per-Invoice Processing (_process_single_invoice)
async def _process_single_invoice(file: UploadFile):
    # Step 1: Save file for PDF viewer
    save_file_to_uploads(file)
    
    # Step 2: OCR Extraction
    ocr_result = run_deepseek_ocr(file_bytes, mime_type)
    # └─> Extract text with PyMuPDF
    # └─> Send to DeepSeek API
    # └─> Parse JSON response
    
    # Step 3: Data Normalization
    invoice_data = normalize_invoice_data(ocr_result)
    
    # Step 4: Confidence Scoring
    extraction_confidence = calculate_extraction_confidence(invoice_data)
    
    # Step 5: Mathematical Validation
    validation_results = validate_invoice_math(invoice_data)
    validation_confidence = calculate_validation_confidence(validation_results)
    
    # Step 6: Combined Confidence & Review Decision
    overall_confidence = (validation_confidence * 0.7) + (extraction_confidence * 0.3)
    review_decision = determine_review_status(
        overall_confidence,
        validation_results,
        has_critical_fields
    )
    
    return invoice_data
```

### **DeepSeek OCR Service**

```python
# services/deepseek_ocr.py
def run_deepseek_ocr(file_bytes: bytes, mime_type: str) -> dict:
    # Step 1: Extract raw text from PDF
    raw_text = extract_text_with_pymupdf(file_bytes)
    # └─> Uses PyMuPDF (fitz) to read PDF text
    # └─> Fast: ~200ms per invoice
    
    # Step 2: Send to DeepSeek API
    response = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
        json={
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt + raw_text}
            ],
            "temperature": 0.1
        }
    )
    # └─> AI structures text into JSON
    # └─> Slow: ~9.8s per invoice (BOTTLENECK)
    
    # Step 3: Parse JSON response
    invoice_json = json.loads(response_text)
    # └─> Fast: <1ms
    
    return {
        "result_json": invoice_json,
        "pages": page_count,
        "duration": duration,
        "performance": perf_metrics
    }
```

### **Validation Service**

```python
# services/validation.py
def validate_invoice_math(invoice_data: dict) -> dict:
    """
    Validates mathematical integrity:
    1. Line items: quantity × rate = amount (±1¢ tolerance)
    2. Subtotal: sum of all line item amounts
    3. Grand total: subtotal + shipping - discount + tax
    """
    
    validation_results = {
        "overall_valid": True,
        "line_items_valid": True,
        "subtotal_valid": True,
        "total_valid": True,
        "validation_errors": []
    }
    
    # Validate each line item
    for item in line_items:
        calculated = item['quantity'] * item['rate']
        actual = item['amount']
        if abs(calculated - actual) > 0.01:  # 1¢ tolerance
            validation_results["line_items_valid"] = False
            validation_results["validation_errors"].append({
                "severity": "CRITICAL",
                "field": f"line_item_{i}",
                "message": f"Math error: {qty} × {rate} = {calc}, but invoice shows {actual}"
            })
    
    return validation_results

def calculate_validation_confidence(validation_results: dict) -> float:
    """
    Returns confidence score based on validation:
    - All valid: 1.0
    - Subtotal/total errors: 0.5
    - Line item errors: 0.3
    """
    if validation_results["overall_valid"]:
        return 1.0
    elif validation_results["line_items_valid"]:
        return 0.5
    else:
        return 0.3
```

### **Trust-First Accounting Rules**

```python
def determine_review_status(
    overall_confidence: float,
    validation_results: dict,
    has_critical_fields: bool
) -> dict:
    """
    Determines if invoice should be auto-approved or requires review.
    
    AUTO-APPROVE IF:
    - Overall confidence ≥ 95%
    - All math calculations valid
    - Critical fields present (invoice #, date, total)
    
    REQUIRE REVIEW IF:
    - Math errors detected
    - Missing critical fields
    - Confidence < 95%
    """
    
    if (overall_confidence >= 0.95 and 
        validation_results["overall_valid"] and 
        has_critical_fields):
        return {
            "status": "AUTO_APPROVED",
            "auto_approve": True,
            "reason": "High confidence and valid calculations"
        }
    else:
        return {
            "status": "REQUIRES_REVIEW",
            "auto_approve": False,
            "reason": "Math errors or low confidence"
        }
```

---

## 5. Data Flow

### **Complete End-to-End Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER UPLOADS PDFs                                            │
│    └─> Frontend: UploadArea component                           │
│        └─> Sets files[] in App state                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. USER CLICKS "PROCESS INVOICES"                              │
│    └─> Frontend: App.handleProcessInvoices()                    │
│        ├─> Creates FormData with files                          │
│        ├─> Starts performance timing                            │
│        └─> POST /ocr/invoice/extract-batch                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. BACKEND RECEIVES FILES                                       │
│    └─> Backend: extract_invoice_data_batch()                    │
│        ├─> Validates file types                                 │
│        ├─> Creates async tasks for each file                    │
│        └─> Launches concurrent processing                       │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. PER-INVOICE PROCESSING (Parallel)                           │
│    └─> Backend: _process_single_invoice()                       │
│                                                                  │
│    Step 4a: Save PDF to uploads/                               │
│    └─> For PDF viewer access                                    │
│                                                                  │
│    Step 4b: OCR Extraction                                      │
│    └─> deepseek_ocr.run_deepseek_ocr()                         │
│        ├─> Extract text with PyMuPDF (~200ms)                  │
│        ├─> Send to DeepSeek API (~9.8s) ⚠️ BOTTLENECK          │
│        └─> Parse JSON response (<1ms)                          │
│                                                                  │
│    Step 4c: Data Normalization                                  │
│    └─> Convert AI output to standard format                     │
│                                                                  │
│    Step 4d: Extraction Confidence Scoring                       │
│    └─> Based on field presence, quality, completeness          │
│                                                                  │
│    Step 4e: Mathematical Validation                             │
│    └─> validation.validate_invoice_math()                       │
│        ├─> Check quantity × rate = amount                      │
│        ├─> Verify subtotal = sum of line items                 │
│        └─> Verify total = subtotal + shipping - discount + tax │
│                                                                  │
│    Step 4f: Validation Confidence Scoring                       │
│    └─> 1.0 if all valid, 0.5 if partial, 0.3 if errors        │
│                                                                  │
│    Step 4g: Combined Confidence                                 │
│    └─> (validation * 0.7) + (extraction * 0.3)                 │
│                                                                  │
│    Step 4h: Review Status Determination                         │
│    └─> AUTO_APPROVED if confidence ≥ 95% AND math valid        │
│    └─> REQUIRES_REVIEW otherwise                               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. AGGREGATION                                                  │
│    └─> Backend: Combine all invoice results                     │
│        ├─> Merge all line items                                │
│        ├─> Calculate summary statistics                         │
│        ├─> Collect performance metrics                          │
│        └─> Format response JSON                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. RESPONSE TO FRONTEND                                         │
│    └─> Frontend: Receives aggregatedData                        │
│        ├─> Logs performance breakdown to console               │
│        ├─> Updates state                                        │
│        └─> Transitions to Dashboard mode                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. DASHBOARD DISPLAY                                            │
│    └─> Frontend: Dashboard component                            │
│        ├─> SummaryCards shows statistics                        │
│        ├─> MasterTable shows all line items                     │
│        └─> Invoice list with review buttons                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. USER CLICKS "REVIEW INVOICE"                                │
│    └─> Frontend: App.handleReviewInvoice()                      │
│        ├─> Sets selectedInvoice in state                        │
│        └─> Transitions to Review mode                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. REVIEW INTERFACE                                             │
│    └─> Frontend: ReviewInterface component                      │
│        ├─> Left: PDF viewer loads from /files/{filename}       │
│        └─> Right: ExtractedDataPanel shows data                │
│                                                                  │
│    User clicks data field (e.g., "Invoice #: 12345")          │
│    └─> ReviewInterface.handleFieldClick()                       │
│        ├─> pdfTextLocator.findText("12345")                    │
│        ├─> Finds text location in PDF                          │
│        ├─> Scrolls PDF to correct page                         │
│        └─> Highlights text with yellow overlay                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Technology Stack

### **Frontend**
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool & dev server |
| Axios | 1.x | HTTP client |
| @llamaindex/pdf-viewer | Latest | PDF rendering |
| pdfjs-dist | 3.11.174 | PDF text search |

### **Backend**
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.12+ | Programming language |
| FastAPI | 0.115+ | Web framework |
| Uvicorn | 0.38+ | ASGI server |
| PyMuPDF (fitz) | Latest | PDF text extraction |
| Pydantic | 2.x | Data validation |
| python-multipart | Latest | File upload handling |

### **External Services**
| Service | Purpose | Cost |
|---------|---------|------|
| DeepSeek API | AI invoice extraction | ~$0.001 per invoice |

### **Development Tools**
- **Version Control:** Git
- **Package Management:** pip (Python), npm (Node.js)
- **Code Quality:** ESLint (frontend), Black (backend)
- **Testing:** pytest (backend), Vitest (frontend)

---

## 7. Google Cloud Deployment

### **Recommended GCP Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Cloud Load Balancer (HTTPS)                           │   │
│  │  └─> SSL Certificate (managed)                         │   │
│  └────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Cloud Run (Frontend)                                  │   │
│  │  ├─ Container: node:18-alpine                          │   │
│  │  ├─ Build: npm run build                               │   │
│  │  ├─ Serve: nginx or serve                              │   │
│  │  └─ Auto-scaling: 0-10 instances                       │   │
│  └────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Cloud Run (Backend)                                   │   │
│  │  ├─ Container: python:3.12-slim                        │   │
│  │  ├─ Run: uvicorn main:app                              │   │
│  │  ├─ CPU: 2 vCPU, Memory: 2GB                          │   │
│  │  ├─ Timeout: 300s (for long AI calls)                 │   │
│  │  └─ Auto-scaling: 0-10 instances                       │   │
│  └────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Cloud Storage                                         │   │
│  │  └─ Bucket: layra-uploads                              │   │
│  │     └─ Stores uploaded PDF files                       │   │
│  └────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Secret Manager                                        │   │
│  │  └─ DEEPSEEK_API_KEY (encrypted)                       │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### **Cost Estimation (Monthly)**

**Cloud Run (Frontend):**
- Requests: 100,000/month
- Cost: ~$5/month

**Cloud Run (Backend):**
- Requests: 10,000/month (100 invoices/day)
- CPU time: ~10s per request
- Cost: ~$20/month

**Cloud Storage:**
- Storage: 10GB (PDFs)
- Cost: ~$0.20/month

**DeepSeek API:**
- 3,000 invoices/month
- Cost: ~$3/month

**Total: ~$30/month**

---

## 8. Getting Started in Cloud Shell

### **Step 1: Clone Repository**

```bash
# In Google Cloud Shell
git clone https://github.com/ejiroogagarue/invoicextractor.git
cd invoicextractor
```

### **Step 2: Set Up Backend**

```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv env
source env/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
DEEPSEEK_API_KEY=your_deepseek_api_key_here
EOF

# Replace with your actual API key
nano .env  # Edit and save

# Test backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### **Step 3: Set Up Frontend (New Cloud Shell Tab)**

```bash
# Navigate to frontend
cd invoicextractor/frontend

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
npm install

# Update API endpoint for Cloud Shell
# Edit src/App.tsx and change:
# http://localhost:8000 → https://8000-YOUR-CLOUD-SHELL-URL

# Start frontend
npm run dev -- --host 0.0.0.0 --port 3000
```

### **Step 4: Access via Cloud Shell Web Preview**

```bash
# In Cloud Shell, click "Web Preview" button
# Select "Preview on port 3000"
# This will open the frontend in a new tab
```

### **Step 5: Test the System**

1. Upload sample PDF invoices
2. Click "Process Invoices"
3. View results in Dashboard
4. Click "Review Invoice" to test PDF viewer

### **Cloud Shell Limitations**

⚠️ **Important Notes:**
- Cloud Shell sessions timeout after 20 minutes of inactivity
- Storage is temporary (use Cloud Storage for persistence)
- Web Preview URLs change with each session
- Not suitable for production (use Cloud Run instead)

---

## 9. API Reference

### **Backend Endpoints**

#### **POST /ocr/invoice/extract-batch**
Extract and process multiple invoice PDFs.

**Request:**
```bash
curl -X POST http://localhost:8000/ocr/invoice/extract-batch \
  -F "files=@invoice1.pdf" \
  -F "files=@invoice2.pdf"
```

**Response:** See section 4 for detailed response structure.

#### **GET /files/{filename}**
Retrieve uploaded PDF file.

**Request:**
```bash
curl http://localhost:8000/files/invoice_12345.pdf
```

**Response:** PDF file (application/pdf)

#### **GET /health**
Health check endpoint.

**Request:**
```bash
curl http://localhost:8000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-06T18:00:00Z"
}
```

---

## 10. Performance Considerations

### **Current Performance Profile**

**Per Invoice (8 invoices tested):**
- **Total Time:** 10 seconds
- **Breakdown:**
  - File Save: 22ms (0.2%)
  - PDF Text Extract: 164ms (1.6%)
  - **DeepSeek API: 9,807ms (98.2%)** ⚠️ **BOTTLENECK**
  - JSON Parse: 0.09ms (0.001%)
  - Validation: 0.1ms (0.001%)

### **Optimization Strategies**

**1. Parallel Processing (Already Implemented)**
- Multiple invoices processed concurrently
- Uses asyncio.gather()
- Reduces total time vs sequential processing

**2. API Optimization (Future)**
- **Switch to Groq:** 5-10x faster (9.8s → 1-2s per invoice)
- **Switch to GPT-4o-mini:** 2-3x faster (9.8s → 3-4s per invoice)
- **Local Ollama:** 2x faster + no API costs

**3. Caching (Future)**
- Cache results by PDF content hash
- 99% faster for duplicate invoices
- Use Redis or Cloud Memorystore

**4. Progressive Loading (Future)**
- Stream results as they complete
- Display first invoice while others process
- Improves perceived performance

### **Scalability**

**Current Limits:**
- **Concurrent Requests:** Limited by FastAPI workers
- **File Size:** No explicit limit (tested up to 5MB)
- **Concurrent Invoices:** 8-10 recommended per batch

**Cloud Run Scaling:**
- Auto-scales from 0 to configured max instances
- Each instance can handle multiple concurrent requests
- Suitable for 100-1000 invoices/day

---

## 📝 **Summary**

Layra is a well-architected, trust-first invoice processing system with:

✅ **Clean Separation:** Frontend (React) and Backend (FastAPI) are decoupled  
✅ **Async Processing:** Concurrent invoice processing for speed  
✅ **Trust-First:** Mathematical validation and confidence scoring  
✅ **Performance Tracking:** Detailed bottleneck identification  
✅ **Cloud-Ready:** Designed for Google Cloud Platform deployment  

**Primary Bottleneck:** DeepSeek API (9.8s per invoice, 98% of time)  
**Optimization Path:** Switch to Groq or GPT-4o-mini for 5-10x speedup

---

## 🚀 **Quick Start Commands**

```bash
# Backend (Terminal 1)
cd backend
python3 -m venv env && source env/bin/activate
pip install -r requirements.txt
echo "DEEPSEEK_API_KEY=your_key" > .env
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 3000

# Access: Cloud Shell Web Preview → Port 3000
```

---

**Document Version:** 1.0  
**Last Updated:** November 6, 2025  
**Maintainer:** @ejiroogagarue

