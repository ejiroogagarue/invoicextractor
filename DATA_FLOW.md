# 📊 Data Flow Documentation - Bookkeeper Invoice Processor

## 🎯 Overview

This document provides a complete visual and textual representation of how data flows through the Bookkeeper application, from file upload to final dashboard display.

---

## 🔄 Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTION                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: File Upload (Upload Mode)                                     │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  Frontend: UploadArea.tsx                                              │
│  ┌──────────────────────────────────────────┐                         │
│  │ User drops/selects invoice PDF files     │                         │
│  │ react-dropzone validates files (PDF only)│                         │
│  │ onDrop() callback triggered               │                         │
│  └──────────────┬───────────────────────────┘                         │
│                 │                                                       │
│                 ▼                                                       │
│  App.tsx: handleFilesSelected()                                        │
│  ┌──────────────────────────────────────────┐                         │
│  │ Stores File[] array in state             │                         │
│  │ Clears previous errors/data               │                         │
│  │ Shows "Process Invoices" button           │                         │
│  └───────────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    [User clicks "Process Invoices"]
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Processing Initiation (Processing Mode)                       │
│  ═════════════════════════════════════════════════════════════════════ │
│                                                                         │
│  App.tsx: handleProcessInvoices()                                      │
│  ┌──────────────────────────────────────────┐                         │
│  │ 1. Validate files exist                   │                         │
│  │ 2. Switch mode to "processing"             │                         │
│  │ 3. Set all files status = "pending"        │                         │
│  │ 4. Create FormData with all files          │                         │
│  │ 5. POST to backend API                     │                         │
│  └──────────────┬───────────────────────────┘                         │
│                 │                                                       │
│                 ▼                                                       │
│  Frontend: ProcessingView.tsx                                          │
│  ┌──────────────────────────────────────────┐                         │
│  │ Shows animated progress bar (0 → 95%)    │                         │
│  │ Lists all files with "pending" status     │                         │
│  └───────────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                          [HTTP POST Request]
                                    │
                    POST /ocr/invoice/extract-batch
                    Content-Type: multipart/form-data
                    Body: FormData { files: [File, File, ...] }
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Backend Processing                                            │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  Backend: routers/ocr.py                                               │
│  extract_invoice_data_batch()                                          │
│  ┌──────────────────────────────────────────┐                         │
│  │ 1. Validate files exist                   │                         │
│  │ 2. Create async tasks for each file        │                         │
│  │ 3. Process concurrently (asyncio.gather) │                         │
│  └──────────────┬───────────────────────────┘                         │
│                 │                                                       │
│                 ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ FOR EACH FILE (Parallel Processing):                            │ │
│  │                                                                  │ │
│  │  _process_single_invoice(file)                                  │ │
│  │  ┌────────────────────────────────────────────────────────┐    │ │
│  │  │ Step 3.1: OCR Extraction                                │    │ │
│  │  │ ───────────────────────                                 │    │ │
│  │  │ services/mistral_ocr.py: run_mistral_ocr()             │    │ │
│  │  │ • Encode file to base64                                 │    │ │
│  │  │ • Send to Mistral AI API                                │    │ │
│  │  │ • Receive markdown text + page images                   │    │ │
│  │  │                                                          │    │ │
│  │  │ Returns: {                                               │    │ │
│  │  │   result_markdown: "...",                                │    │ │
│  │  │   pages: 3,                                              │    │ │
│  │  │   duration: 2.5,                                         │    │ │
│  │  │   images: {...}                                          │    │ │
│  │  │ }                                                         │    │ │
│  │  └────────────────────────────────────────────────────────┘    │ │
│  │                         │                                        │ │
│  │                         ▼                                        │ │
│  │  ┌────────────────────────────────────────────────────────┐    │ │
│  │  │ Step 3.2: Table Parsing                                 │    │ │
│  │  │ ──────────────────────                                  │    │ │
│  │  │ _parse_invoice_table(markdown)                          │    │ │
│  │  │ • Find markdown tables with regex                       │    │ │
│  │  │ • Extract headers (Item, Quantity, Rate, Amount)        │    │ │
│  │  │ • Parse each row into line item dict                    │    │ │
│  │  │                                                          │    │ │
│  │  │ Returns: [                                               │    │ │
│  │  │   {item: "...", quantity: "...", rate: "...", ...},     │    │ │
│  │  │   ...                                                    │    │ │
│  │  │ ]                                                        │    │ │
│  │  └────────────────────────────────────────────────────────┘    │ │
│  │                         │                                        │ │
│  │                         ▼                                        │ │
│  │  ┌────────────────────────────────────────────────────────┐    │ │
│  │  │ Step 3.3: Entity Extraction                             │    │ │
│  │  │ ──────────────────────────                              │    │ │
│  │  │ services/entities.py: extract_entities()                │    │ │
│  │  │ • Apply regex patterns for dates, amounts, emails       │    │ │
│  │  │ • Find all matches in text                              │    │ │
│  │  │ • Return entities with positions                        │    │ │
│  │  │                                                          │    │ │
│  │  │ Returns: [                                               │    │ │
│  │  │   {type: "DATE", text: "2024-01-15", ...},              │    │ │
│  │  │   ...                                                    │    │ │
│  │  │ ]                                                        │    │ │
│  │  └────────────────────────────────────────────────────────┘    │ │
│  │                         │                                        │ │
│  │                         ▼                                        │ │
│  │  ┌────────────────────────────────────────────────────────┐    │ │
│  │  │ Step 3.4: Data Extraction                               │    │ │
│  │  │ ────────────────────────                                │    │ │
│  │  │ • Extract invoice number (regex)                        │    │ │
│  │  │ • Extract date (from entities)                          │    │ │
│  │  │ • Calculate total (sum line items)                      │    │ │
│  │  │ • Add vendor name (currently placeholder)               │    │ │
│  │  │                                                          │    │ │
│  │  │ Returns: {                                               │    │ │
│  │  │   filename: "invoice1.pdf",                              │    │ │
│  │  │   invoice_number: "INV-001",                             │    │ │
│  │  │   vendor_name: "SuperStore",                             │    │ │
│  │  │   date: "2024-01-15",                                    │    │ │
│  │  │   total_amount: 1234.56,                                 │    │ │
│  │  │   line_items: [...]                                      │    │ │
│  │  │ }                                                        │    │ │
│  │  └────────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                    │                                  │
│                                    ▼                                  │
│  ┌──────────────────────────────────────────┐                       │
│  │ Step 3.5: Aggregation                     │                       │
│  │ ────────────────────                      │                       │
│  │ After all files processed:                 │                       │
│  │ • Combine all line items                   │                       │
│  │ • Calculate grand total                    │                       │
│  │ • Collect unique vendors                   │                       │
│  │ • Add UUID to each line item               │                       │
│  │ • Tag items with source invoice            │                       │
│  │ • Format total amount                      │                       │
│  │                                            │                       │
│  │ Returns: {                                 │                       │
│  │   summary: {                               │                       │
│  │     total_amount: "1,234.56",             │                       │
│  │     total_invoices_processed: 5,          │                       │
│  │     vendors: ["VendorA", "VendorB"],      │                       │
│  │     processing_errors: []                  │                       │
│  │   },                                       │                       │
│  │   line_items: [{id, item, quantity, ...}],│                       │
│  │   invoices: {...}                          │                       │
│  │ }                                          │                       │
│  └───────────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                          [HTTP Response]
                                    │
                     JSON Response Body (aggregatedData)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Frontend Response Handling                                    │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  App.tsx: handleProcessInvoices() (continued)                          │
│  ┌──────────────────────────────────────────┐                         │
│  │ 1. Receive aggregatedData response         │                         │
│  │ 2. Mark all files as "complete"            │                         │
│  │ 3. Store aggregatedData in state           │                         │
│  │ 4. Wait 800ms (show completion)            │                         │
│  │ 5. Switch mode to "dashboard"              │                         │
│  └───────────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 5: Dashboard Display (Dashboard Mode)                            │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  Dashboard.tsx                                                          │
│  ┌──────────────────────────────────────────┐                         │
│  │ Receives: aggregatedData prop              │                         │
│  │                                            │                         │
│  │ Component 1: SummaryCards                  │                         │
│  │ ────────────────────────                   │                         │
│  │ • Total Amount Card                        │                         │
│  │ • Invoices Processed Card                  │                         │
│  │ • Unique Vendors Card                      │                         │
│  │ • Errors Card (if any)                     │                         │
│  │                                            │                         │
│  │ Component 2: Filter Controls               │                         │
│  │ ────────────────────────────               │                         │
│  │ • Search input (filter by item name)       │                         │
│  │ • Vendor dropdown (filter by vendor)       │                         │
│  │                                            │                         │
│  │ Component 3: MasterTable                   │                         │
│  │ ────────────────────────                   │                         │
│  │ Displays filtered line items:              │                         │
│  │ ┌──────────────────────────────────────┐ │                         │
│  │ │ Item | Qty | Rate | Amount | Vendor  │ │                         │
│  │ │──────┼─────┼──────┼────────┼─────────│ │                         │
│  │ │ ...  | ... | ...  | ...    | ...     │ │                         │
│  │ │ ...  | ... | ...  | ...    | ...     │ │                         │
│  │ └──────────────────────────────────────┘ │                         │
│  │                                            │                         │
│  │ Component 4: Export Button                 │                         │
│  │ ────────────────────────────               │                         │
│  │ • Click → Download CSV                     │                         │
│  │ • Includes filtered items only             │                         │
│  └───────────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 File-by-File Data Flow

### **Backend Files**

#### **1. `main.py`**
- **Role**: FastAPI application entry point
- **Data Flow**: Registers routers and handles CORS
- **Connections**: 
  - Imports `routers/ocr.py` and `routers/telemetry.py`
  - Mounts them at `/ocr` and `/telemetry` prefixes

#### **2. `routers/ocr.py`**
- **Role**: Main invoice processing endpoints
- **Key Functions**:
  - `extract_invoice_data_batch()` - Main endpoint, receives files, returns aggregated data
  - `_process_single_invoice()` - Processes one invoice
  - `_parse_invoice_table()` - Extracts line items from markdown tables
  - `analyze_pdf()` - General document analysis (not used in invoice flow)
- **Data Flow**:
  - IN: `List[UploadFile]` from frontend
  - CALLS: `run_mistral_ocr()`, `_parse_invoice_table()`, `extract_entities()`
  - OUT: `AggregatedData` JSON to frontend

#### **3. `services/mistral_ocr.py`**
- **Role**: OCR processing via Mistral AI
- **Key Function**: `run_mistral_ocr(file_bytes, mime_type)`
- **Data Flow**:
  - IN: Raw file bytes + MIME type
  - PROCESS: Base64 encode → Send to Mistral API → Parse response
  - OUT: `{result_markdown, pages, duration, images}`

#### **4. `services/entities.py`**
- **Role**: Extract entities (dates, amounts, emails, etc.)
- **Key Function**: `extract_entities(text)`
- **Data Flow**:
  - IN: Plain text or markdown
  - PROCESS: Apply regex patterns for each entity type
  - OUT: `[{type, text, offsetStart, offsetEnd}, ...]`

#### **5. `services/structure.py`**
- **Role**: Parse document structure (sections/headings)
- **Key Function**: `parse_sections(markdown)`
- **Data Flow**:
  - IN: Markdown text
  - PROCESS: Find headings, track offsets
  - OUT: `[{id, title, level, startOffset, endOffset}, ...]`

#### **6. `routers/telemetry.py`**
- **Role**: Track user engagement (not used in current flow)
- **Key Function**: `track_engagement(event)`
- **Data Flow**:
  - IN: Engagement event from frontend
  - PROCESS: Log to console (would store in DB in production)
  - OUT: Confirmation response

---

### **Frontend Files**

#### **1. `App.tsx`**
- **Role**: Main orchestrator, state management
- **State**:
  - `mode`: "upload" | "processing" | "dashboard"
  - `files`: File[]
  - `aggregatedData`: Response from backend
  - `processingStatus`: File status map
  - `error`: Error message
- **Key Functions**:
  - `handleFilesSelected()` - Stores files from UploadArea
  - `handleProcessInvoices()` - Sends files to backend, handles response
- **Data Flow**:
  - RECEIVES files from: UploadArea
  - SENDS files to: Backend `/ocr/invoice/extract-batch`
  - RECEIVES response from: Backend
  - PASSES data to: Dashboard component

#### **2. `components/UploadArea.tsx`**
- **Role**: File upload UI with drag & drop
- **Props IN**:
  - `onFileSelected`: Callback to parent
  - `onProcess`: Callback to start processing
  - `disabled`: Boolean
  - `files`: Current files
- **Data Flow**:
  - User drops/selects files → `onDrop()` → `onFileSelected(files)` → App.tsx

#### **3. `components/ProcessingView.tsx`**
- **Role**: Show processing progress
- **Props IN**:
  - `files`: Files being processed
  - `processingStatus`: Status of each file
- **Data Flow**:
  - Receives props from App.tsx
  - Animates progress bar (simulated, not real-time)
  - Displays file status list

#### **4. `Dashboard.tsx`**
- **Role**: Results display coordinator
- **Props IN**:
  - `aggregatedData`: Complete backend response
- **State**:
  - `searchTerm`: Search filter
  - `vendorFilter`: Vendor filter
- **Data Flow**:
  - Receives `aggregatedData` from App.tsx
  - Filters data based on user input
  - Passes filtered data to child components:
    - `SummaryCards` ← `aggregatedData.summary`
    - `MasterTable` ← filtered `line_items`

#### **5. `components/SummaryCards.tsx`**
- **Role**: Display summary metrics
- **Props IN**:
  - `summary`: {total_amount, total_invoices_processed, vendors, processing_errors}
- **Data Flow**:
  - Receives from Dashboard
  - Displays 4 cards (or 3 if no errors)

#### **6. `components/MasterTable.tsx`**
- **Role**: Display line items table
- **Props IN**:
  - `lineItems`: Filtered array of line items
- **Data Flow**:
  - Receives from Dashboard
  - Renders table with all line item details
  - Shows confidence badges

---

## 🔑 Key Data Structures

### **Frontend → Backend (Request)**
```typescript
FormData {
  files: [File, File, File, ...]  // Multiple PDF files
}
```

### **Backend → Frontend (Response)**
```typescript
{
  summary: {
    total_amount: "1,234.56",
    total_invoices_processed: 5,
    vendors: ["VendorA", "VendorB"],
    processing_errors: []
  },
  line_items: [{
    id: "uuid",
    item: "Product Name",
    quantity: "10",
    rate: "$5.00",
    amount: "$50.00",
    vendor: "VendorA",
    date: "2024-01-15",
    source_invoice_id: "inv-INV-001",
    source_invoice_number: "INV-001",
    confidence: "high"
  }],
  invoices: {
    "inv-INV-001": {
      vendor: "VendorA",
      date: "2024-01-15",
      total_amount: 1234.56
    }
  }
}
```

---

## 🎨 Component Tree

```
App.tsx (State Manager)
├─ mode === "upload"
│  └─ UploadArea.tsx
│     ├─ react-dropzone (file input)
│     └─ "Process Invoices" button
│
├─ mode === "processing"
│  └─ ProcessingView.tsx
│     ├─ Progress bar (animated)
│     └─ File status list
│
└─ mode === "dashboard"
   └─ Dashboard.tsx (Filter Logic)
      ├─ SummaryCards.tsx
      │  ├─ Total Amount Card
      │  ├─ Invoices Processed Card
      │  ├─ Vendors Card
      │  └─ Errors Card (conditional)
      │
      ├─ Filter Controls
      │  ├─ Search input
      │  └─ Vendor dropdown
      │
      ├─ MasterTable.tsx
      │  └─ Line items table
      │
      └─ Export Button
         └─ Downloads CSV
```

---

## 🔄 State Transitions

```
┌──────────┐  User selects files   ┌──────────┐
│          │ ───────────────────>  │          │
│  UPLOAD  │                        │  UPLOAD  │
│   MODE   │                        │   MODE   │
│          │ <───────────────────  │ (w/files)│
└──────────┘   handleFilesSelected └──────────┘
                                         │
                                         │ User clicks "Process"
                                         │
                                         ▼
┌──────────┐  Backend responds     ┌──────────┐
│DASHBOARD │ <───────────────────  │PROCESSING│
│   MODE   │                        │   MODE   │
│          │                        │          │
└──────────┘                        └──────────┘
```

---

## 🚀 API Endpoints

### **POST `/ocr/invoice/extract-batch`**
- **Purpose**: Process multiple invoices
- **Request**: `multipart/form-data` with `files` field
- **Response**: `AggregatedData` JSON
- **Called by**: `App.tsx → handleProcessInvoices()`

### **POST `/ocr/analyze`**
- **Purpose**: General document analysis
- **Request**: Single file
- **Response**: OCR markdown + sections + entities
- **Not used in current invoice flow**

### **POST `/telemetry/engagement`**
- **Purpose**: Track user engagement
- **Request**: Engagement event JSON
- **Response**: Confirmation
- **Not currently connected to frontend**

---

## 💡 Future Improvements

### **Real-Time Progress Updates**
Currently, all files are processed concurrently and the frontend receives one response when ALL files are done. For better UX:

**Option 1: Server-Sent Events (SSE)**
```python
# Backend
@router.post("/invoice/extract-batch-stream")
async def extract_batch_stream(files: List[UploadFile]):
    async def event_generator():
        for file in files:
            result = await process_single_invoice(file)
            yield f"data: {json.dumps(result)}\\n\\n"
    return EventSourceResponse(event_generator())
```

```typescript
// Frontend
const eventSource = new EventSource('/ocr/invoice/extract-batch-stream');
eventSource.onmessage = (event) => {
  const result = JSON.parse(event.data);
  // Update progress for this specific file
  setProcessingStatus(prev => ({...prev, [result.filename]: 'complete'}));
};
```

---

## 📚 Summary

This application demonstrates a clean separation of concerns:

1. **Frontend**: Handles UI, file selection, state management, data display
2. **Backend**: Handles OCR, data extraction, aggregation
3. **External API**: Mistral AI for OCR processing

Data flows unidirectionally from user input → backend processing → frontend display, making the system easy to understand, debug, and extend.

---

**Created**: November 5, 2025  
**Project**: Bookkeeper - AI Invoice Processor  
**Version**: 1.0


