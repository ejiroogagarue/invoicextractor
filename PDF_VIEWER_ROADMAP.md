# PDF Viewer Implementation Roadmap

## 🎯 Goal
Build a side-by-side PDF viewer that allows users to review extracted data against the original invoice, edit incorrect values, and approve/reject invoices with confidence.

---

## ✅ Prerequisites (COMPLETE)

- [x] JSON extraction working correctly
- [x] Quantity, rate, amount extracted accurately
- [x] Shipping and discount captured
- [x] Math validation passing
- [x] Confidence scoring implemented
- [x] Trust layer complete

---

## 🚀 Phase 1: Basic PDF Viewer (Week 1)

### Goal: Display PDF next to extracted data

### Tasks:

#### 1.1 Install Dependencies
```bash
cd frontend
npm install @llamaindex/pdf-viewer
```

#### 1.2 Backend: PDF Serving Endpoint
**File:** `backend/main.py` or `backend/routers/files.py`

**Add endpoint to serve PDF files:**
```python
from fastapi import APIRouter
from fastapi.responses import FileResponse
import os

@router.get("/files/{filename}")
async def get_pdf(filename: str):
    """Serve PDF files for viewer"""
    file_path = f"uploads/{filename}"  # Or your storage location
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="application/pdf")
    raise HTTPException(status_code=404, detail="File not found")
```

#### 1.3 Frontend: Create ReviewInterface Component
**File:** `frontend/src/components/ReviewInterface.tsx`

```typescript
import React from 'react';
import { PDFViewer, PdfFocusProvider } from '@llamaindex/pdf-viewer';
import '@llamaindex/pdf-viewer/index.css';
import './ReviewInterface.css';

interface ReviewInterfaceProps {
  invoiceData: any;
  pdfUrl: string;
}

export const ReviewInterface: React.FC<ReviewInterfaceProps> = ({
  invoiceData,
  pdfUrl
}) => {
  const pdfFile = {
    id: invoiceData.invoice_number,
    url: pdfUrl,
  };

  return (
    <PdfFocusProvider>
      <div className="review-container">
        {/* Left Panel: PDF Viewer */}
        <div className="pdf-panel">
          <h3>Original Invoice</h3>
          <PDFViewer 
            file={pdfFile}
            containerClassName="invoice-pdf-viewer"
          />
        </div>

        {/* Right Panel: Extracted Data */}
        <div className="data-panel">
          <h3>Extracted Data</h3>
          <ExtractedDataPanel data={invoiceData} />
        </div>
      </div>
    </PdfFocusProvider>
  );
};
```

#### 1.4 Frontend: Create ExtractedDataPanel Component
**File:** `frontend/src/components/ExtractedDataPanel.tsx`

```typescript
import React from 'react';
import { ConfidenceBadge } from './ConfidenceBadge';

interface ExtractedDataPanelProps {
  data: any;
}

export const ExtractedDataPanel: React.FC<ExtractedDataPanelProps> = ({ data }) => {
  return (
    <div className="extracted-data">
      {/* Header Information */}
      <div className="invoice-header">
        <div className="field">
          <label>Invoice #:</label>
          <span>{data.invoice_number}</span>
          <ConfidenceBadge confidence={data.confidence.overall} />
        </div>
        
        <div className="field">
          <label>Date:</label>
          <span>{data.date}</span>
          <ConfidenceBadge confidence={data.confidence.overall} />
        </div>
        
        <div className="field">
          <label>Vendor:</label>
          <span>{data.vendor_name}</span>
          <ConfidenceBadge confidence={data.confidence.overall} />
        </div>
      </div>

      {/* Line Items Table */}
      <div className="line-items-section">
        <h4>Line Items</h4>
        <table className="line-items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
              <th>Trust</th>
            </tr>
          </thead>
          <tbody>
            {data.line_items.map((item: any, idx: number) => (
              <tr key={idx}>
                <td>{item.item}</td>
                <td>{item.quantity}</td>
                <td>${item.rate}</td>
                <td>${item.amount}</td>
                <td><ConfidenceBadge confidence={item.confidence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial Summary */}
      <div className="financial-summary">
        <div className="summary-line">
          <span>Subtotal:</span>
          <span>${data.subtotal}</span>
        </div>
        <div className="summary-line">
          <span>Shipping:</span>
          <span>${data.shipping}</span>
        </div>
        <div className="summary-line">
          <span>Discount:</span>
          <span>-${data.discount_amount}</span>
        </div>
        <div className="summary-line">
          <span>Tax:</span>
          <span>${data.tax}</span>
        </div>
        <div className="summary-line total">
          <span>Total:</span>
          <span>${data.total_amount}</span>
          <ConfidenceBadge confidence={data.confidence.validation} />
        </div>
      </div>

      {/* Review Actions */}
      <div className="review-actions">
        <button className="btn-approve">Approve</button>
        <button className="btn-reject">Needs Review</button>
      </div>
    </div>
  );
};
```

#### 1.5 Frontend: Styling
**File:** `frontend/src/components/ReviewInterface.css`

```css
.review-container {
  display: flex;
  height: calc(100vh - 60px);
  gap: 20px;
  padding: 20px;
}

.pdf-panel {
  flex: 0 0 40%;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  background: white;
  overflow: hidden;
}

.data-panel {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  background: white;
  overflow-y: auto;
}

.invoice-pdf-viewer {
  height: calc(100% - 40px);
  border: 1px solid #ddd;
  border-radius: 4px;
}

.extracted-data .field {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.extracted-data label {
  font-weight: 600;
  min-width: 120px;
}

.line-items-table {
  width: 100%;
  border-collapse: collapse;
  margin: 15px 0;
}

.line-items-table th,
.line-items-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.financial-summary {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.summary-line.total {
  font-weight: bold;
  font-size: 1.1em;
  border-top: 2px solid #333;
  padding-top: 15px;
  margin-top: 10px;
}

.review-actions {
  display: flex;
  gap: 15px;
  margin-top: 30px;
  justify-content: center;
}

.btn-approve,
.btn-reject {
  padding: 12px 30px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-approve {
  background: #10b981;
  color: white;
  border: none;
}

.btn-approve:hover {
  background: #059669;
}

.btn-reject {
  background: #f59e0b;
  color: white;
  border: none;
}

.btn-reject:hover {
  background: #d97706;
}
```

#### 1.6 Frontend: Update Routing
**File:** `frontend/src/App.tsx`

Add review route:
```typescript
import { ReviewInterface } from './components/ReviewInterface';

// In your routing or state management:
const [selectedInvoice, setSelectedInvoice] = useState(null);
const [viewMode, setViewMode] = useState<'dashboard' | 'review'>('dashboard');

// When user clicks to review an invoice:
const handleReviewInvoice = (invoiceId: string) => {
  const invoice = aggregatedData.invoices[invoiceId];
  setSelectedInvoice(invoice);
  setViewMode('review');
};

// Render logic:
{viewMode === 'dashboard' ? (
  <Dashboard 
    aggregatedData={aggregatedData}
    onReviewInvoice={handleReviewInvoice}
  />
) : (
  <ReviewInterface 
    invoiceData={selectedInvoice}
    pdfUrl={`http://localhost:8000/files/${selectedInvoice.filename}`}
  />
)}
```

### Deliverables:
- [ ] PDF viewer displays on left side
- [ ] Extracted data displays on right side
- [ ] Side-by-side layout responsive
- [ ] Confidence badges showing
- [ ] Basic navigation between dashboard and review

**Estimated Time:** 4-6 hours

---

## 🔗 Phase 2: Data → PDF Navigation (Week 2)

### Goal: Click a field → Jump to that location in the PDF

### Approach: Client-Side Text Matching

Since DeepSeek doesn't provide PDF coordinates, we'll search the PDF for the extracted text:

```typescript
import { pdfjs } from 'react-pdf';

async function findTextInPDF(pdfUrl: string, searchText: string) {
  const pdf = await pdfjs.getDocument(pdfUrl).promise;
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Search for text and get coordinates
    const items = textContent.items;
    for (let item of items) {
      if (item.str.includes(searchText)) {
        return {
          page: pageNum,
          coordinates: {
            x: item.transform[4],
            y: item.transform[5],
          }
        };
      }
    }
  }
  return null;
}
```

### Tasks:
- [ ] Implement text search in PDF
- [ ] Add "Jump to PDF" buttons next to fields
- [ ] Scroll PDF viewer to location
- [ ] Highlight text in PDF
- [ ] Add visual indicator

**Estimated Time:** 6-8 hours

---

## ✏️ Phase 3: Inline Editing (Week 3)

### Goal: Allow users to edit incorrect extractions

### Tasks:
- [ ] Make fields editable (click to edit)
- [ ] Track changes in state
- [ ] Re-validate math on edits
- [ ] Mark edited fields
- [ ] Add save/discard buttons
- [ ] Create audit log

**Estimated Time:** 8-10 hours

---

## 🔄 Phase 4: PDF → Data Linking (Week 4)

### Goal: Click text in PDF → Highlight corresponding field

### Tasks:
- [ ] Capture PDF text selections
- [ ] Match selection to extracted fields
- [ ] Highlight corresponding data field
- [ ] Optional: Fill missing fields from selection

**Estimated Time:** 8-10 hours

---

## 📝 Phase 5: Editable Table (Week 5)

### Goal: Edit line items directly

### Tasks:
- [ ] Make table cells editable
- [ ] Add/remove rows
- [ ] Auto-calculate amounts
- [ ] Re-validate on changes
- [ ] Track all modifications

**Estimated Time:** 6-8 hours

---

## 🎯 Success Metrics

### Phase 1 Success:
- ✅ PDF displays correctly
- ✅ Extracted data displays side-by-side
- ✅ Users can visually verify data
- ✅ Navigation between dashboard and review works

### Overall Success:
- Users can review invoices 3x faster
- 90%+ approval rate for high-confidence invoices
- Easy correction of mistakes
- Full audit trail of changes

---

## 📦 Total Estimated Time

- **Phase 1 (Basic Viewer):** 4-6 hours
- **Phase 2 (Navigation):** 6-8 hours
- **Phase 3 (Editing):** 8-10 hours
- **Phase 4 (Bidirectional):** 8-10 hours
- **Phase 5 (Table Editing):** 6-8 hours

**Total:** 32-42 hours (4-5 weeks at 8 hours/week)

---

## 🚀 Ready to Start?

Let me know when you want to begin, and we'll start with Phase 1!

**Trust, simplicity, and speed** - that's what we're building. 💪


