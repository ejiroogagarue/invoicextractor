# PDF ↔ Data Linking Implementation Plan

## 🎯 Goal
Enable users to click extracted data → see highlighted source in PDF, and vice versa.

**Trust Principle:** Users can verify every piece of data against the original document instantly.

---

## 🔄 Two-Way Linking Design

### Scenario 1: Data → PDF (Click to Verify)
```
User Action: Clicks "Invoice #: 36258" in data panel
System Response:
1. PDF scrolls to page containing invoice number
2. Text "36258" highlighted in yellow
3. Zoom to that region for better visibility
```

### Scenario 2: PDF → Data (Select to Identify)
```
User Action: Selects/clicks text in PDF
System Response:
1. Identify which data field contains that text
2. Scroll data panel to that field
3. Highlight the field in the data panel
4. Show field name (e.g., "This is the Invoice Number")
```

---

## 🛠️ Technical Approach

### Challenge: DeepSeek doesn't provide coordinates

**Problem:** DeepSeek gives us:
```json
{
  "invoice_number": "36258"
}
```

But NOT:
```json
{
  "invoice_number": "36258",
  "invoice_number_location": {
    "page": 1,
    "x": 450,
    "y": 120,
    "width": 100,
    "height": 20
  }
}
```

### Solution: Client-Side Text Search

Use `pdfjs-dist` to search the PDF for extracted text and find coordinates:

```typescript
async function findTextInPDF(
  pdfUrl: string,
  searchText: string
): Promise<TextLocation | null> {
  const pdf = await pdfjs.getDocument(pdfUrl).promise;
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Search for text and get coordinates
    for (let item of textContent.items) {
      if (item.str.includes(searchText)) {
        return {
          page: pageNum,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height
        };
      }
    }
  }
  
  return null;
}
```

---

## 📦 Required Libraries

### 1. pdfjs-dist (Already included with @llamaindex/pdf-viewer)
```bash
# Should already be installed, but if needed:
npm install pdfjs-dist
```

### 2. react-pdf-highlighter (Optional - for advanced highlighting)
```bash
npm install react-pdf-highlighter
```

**OR** use built-in PDF.js text layer highlighting (simpler, recommended)

---

## 🎨 Implementation Phases

### Phase 1: Data → PDF Navigation ✅ (Start Here)

**Goal:** Click a field in data panel → Jump to that location in PDF

**Steps:**

#### Step 1.1: Create Text Locator Service
**File:** `frontend/src/services/pdfTextLocator.ts`

```typescript
import * as pdfjs from 'pdfjs-dist';

interface TextLocation {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export class PDFTextLocator {
  private pdfDoc: pdfjs.PDFDocumentProxy | null = null;
  private textLocationCache: Map<string, TextLocation> = new Map();

  async loadPDF(pdfUrl: string) {
    this.pdfDoc = await pdfjs.getDocument(pdfUrl).promise;
  }

  async findText(searchText: string): Promise<TextLocation | null> {
    if (!this.pdfDoc) return null;
    
    // Check cache first
    if (this.textLocationCache.has(searchText)) {
      return this.textLocationCache.get(searchText)!;
    }

    // Search all pages
    for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
      const page = await this.pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      for (let item of textContent.items as any[]) {
        if (item.str.includes(searchText)) {
          const location: TextLocation = {
            page: pageNum,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height,
            text: item.str
          };
          
          // Cache for future use
          this.textLocationCache.set(searchText, location);
          return location;
        }
      }
    }
    
    return null;
  }

  async findAllTextInstances(searchText: string): Promise<TextLocation[]> {
    if (!this.pdfDoc) return [];
    
    const locations: TextLocation[] = [];
    
    for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
      const page = await this.pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      for (let item of textContent.items as any[]) {
        if (item.str.includes(searchText)) {
          locations.push({
            page: pageNum,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height,
            text: item.str
          });
        }
      }
    }
    
    return locations;
  }
}
```

#### Step 1.2: Add Click Handlers to Data Fields
**File:** `frontend/src/components/ExtractedDataPanel.tsx`

```typescript
interface FieldProps {
  label: string;
  value: string;
  onFieldClick?: (fieldName: string, value: string) => void;
}

const ClickableField: React.FC<FieldProps> = ({ label, value, onFieldClick }) => {
  return (
    <div 
      className="field-row clickable"
      onClick={() => onFieldClick?.(label, value)}
      style={{ cursor: 'pointer' }}
      title="Click to highlight in PDF"
    >
      <label>{label}:</label>
      <span className="field-value">{value}</span>
      <span className="jump-icon">🔍</span>
    </div>
  );
};
```

#### Step 1.3: Integrate with PDF Viewer
**File:** `frontend/src/components/ReviewInterface.tsx`

```typescript
import { PDFTextLocator } from '../services/pdfTextLocator';

export const ReviewInterface: React.FC<ReviewInterfaceProps> = ({
  invoiceData,
  pdfUrl,
  onBack,
}) => {
  const [pdfLocator] = useState(() => new PDFTextLocator());
  const [highlightedLocation, setHighlightedLocation] = useState<TextLocation | null>(null);
  const pdfViewerRef = useRef<any>(null);

  useEffect(() => {
    // Load PDF when component mounts
    pdfLocator.loadPDF(pdfUrl);
  }, [pdfUrl]);

  const handleFieldClick = async (fieldName: string, value: string) => {
    console.log(`Searching for: ${value}`);
    
    // Find text in PDF
    const location = await pdfLocator.findText(value);
    
    if (location) {
      console.log(`Found at page ${location.page}:`, location);
      
      // Scroll PDF to page
      if (pdfViewerRef.current) {
        pdfViewerRef.current.scrollToPage(location.page);
      }
      
      // Store location for highlighting
      setHighlightedLocation(location);
    } else {
      console.warn(`Text "${value}" not found in PDF`);
      alert(`Could not find "${value}" in the PDF`);
    }
  };

  return (
    <PdfFocusProvider>
      <div className="review-container">
        <div className="pdf-panel">
          <PDFViewer 
            ref={pdfViewerRef}
            file={pdfFile}
            highlightedArea={highlightedLocation}
          />
        </div>

        <div className="data-panel">
          <ExtractedDataPanel 
            data={invoiceData}
            onFieldClick={handleFieldClick}
          />
        </div>
      </div>
    </PdfFocusProvider>
  );
};
```

---

### Phase 2: PDF Text Highlighting

**Goal:** Visually highlight the found text in the PDF

**Options:**

#### Option A: CSS Overlay (Simpler)
Create a yellow highlight box positioned over the text:

```typescript
const HighlightOverlay: React.FC<{ location: TextLocation }> = ({ location }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: location.x,
        top: location.y,
        width: location.width,
        height: location.height,
        backgroundColor: 'rgba(255, 255, 0, 0.4)',
        border: '2px solid #fbbf24',
        pointerEvents: 'none',
        zIndex: 1000
      }}
    />
  );
};
```

#### Option B: PDF.js Text Layer (Better)
Use PDF.js's built-in text layer to highlight:

```typescript
function highlightTextInPDFLayer(page: number, x: number, y: number) {
  const textLayer = document.querySelector(
    `.page[data-page-number="${page}"] .textLayer`
  );
  
  if (textLayer) {
    // Find and highlight the text span
    const textSpans = textLayer.querySelectorAll('span');
    textSpans.forEach(span => {
      const rect = span.getBoundingClientRect();
      if (Math.abs(rect.left - x) < 5 && Math.abs(rect.top - y) < 5) {
        span.style.backgroundColor = 'rgba(255, 255, 0, 0.4)';
        span.style.border = '2px solid #fbbf24';
      }
    });
  }
}
```

---

### Phase 3: PDF → Data Linking (Reverse Direction)

**Goal:** Select text in PDF → Highlight corresponding field in data panel

**Steps:**

#### Step 3.1: Capture PDF Text Selection
```typescript
const handlePDFTextSelection = () => {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();
  
  if (selectedText) {
    // Find which field contains this text
    const field = findFieldByValue(invoiceData, selectedText);
    
    if (field) {
      // Highlight in data panel
      scrollToAndHighlightField(field.name);
    }
  }
};
```

#### Step 3.2: Match Text to Fields
```typescript
function findFieldByValue(
  invoiceData: any,
  searchText: string
): { name: string; value: string } | null {
  
  // Check all fields
  const fields = [
    { name: 'Invoice Number', value: invoiceData.invoice_number },
    { name: 'Date', value: invoiceData.date },
    { name: 'Vendor', value: invoiceData.vendor_name },
    { name: 'Subtotal', value: String(invoiceData.subtotal) },
    { name: 'Total', value: String(invoiceData.total_amount) },
  ];
  
  for (const field of fields) {
    if (field.value && field.value.includes(searchText)) {
      return field;
    }
  }
  
  // Check line items
  for (let i = 0; i < invoiceData.line_items.length; i++) {
    const item = invoiceData.line_items[i];
    if (item.item?.includes(searchText)) {
      return { name: `Line Item ${i + 1}`, value: item.item };
    }
  }
  
  return null;
}
```

---

## 🎨 UI/UX Design

### Visual Indicators

#### In Data Panel:
```css
.field-row.clickable:hover {
  background-color: #f0f9ff;
  cursor: pointer;
  border-left: 3px solid #3b82f6;
}

.field-row .jump-icon {
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.2s;
}

.field-row:hover .jump-icon {
  opacity: 1;
}

.field-row.highlighted {
  background-color: #fef3c7;
  border: 2px solid #f59e0b;
  animation: pulse 1s ease-in-out;
}
```

#### In PDF:
```css
.pdf-highlight {
  background-color: rgba(255, 255, 0, 0.4);
  border: 2px solid #fbbf24;
  box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
  animation: fadeIn 0.3s ease-in;
}
```

---

## 📊 User Flow Examples

### Example 1: Verify Invoice Number
```
1. User sees "Invoice #: 36258" in data panel
2. User thinks: "Is this correct?"
3. User clicks the invoice number field
4. PDF scrolls to page 1, top-right
5. Text "Invoice #36258" highlighted in yellow
6. User confirms: "Yes, that's correct!" ✅
```

### Example 2: Check Line Item
```
1. User sees "Office Chair" with "Qty: 2, Rate: $150"
2. User thinks: "Was it really $150 each?"
3. User clicks the rate field
4. PDF scrolls to line items table
5. Text "$150.00" highlighted in yellow
6. User confirms: "Yes, $150 is correct!" ✅
```

### Example 3: Find Unknown Field
```
1. User selects "Aaron Bergman" in PDF
2. System identifies: "This is the Customer Name"
3. Data panel scrolls to Customer field
4. Field highlighted in yellow
5. User sees: "Customer: Aaron Bergman" ✅
```

---

## 🚀 Implementation Priority

### Must-Have (Phase 1):
- [x] Click field → Jump to PDF page
- [x] Highlight text in PDF
- [x] Visual feedback (🔍 icon on hover)

### Should-Have (Phase 2):
- [ ] Select PDF text → Highlight field
- [ ] Fuzzy matching (handle OCR errors)
- [ ] Smart scrolling (center highlighted text)

### Nice-to-Have (Phase 3):
- [ ] Click line item → Highlight entire table row in PDF
- [ ] Multi-match handling (if text appears multiple times)
- [ ] Persistent highlights (keep multiple highlights active)

---

## 🧪 Testing Checklist

- [ ] Click invoice number → PDF highlights correctly
- [ ] Click date → PDF shows date location
- [ ] Click vendor name → PDF highlights vendor
- [ ] Click line item → PDF highlights item row
- [ ] Click amount → PDF highlights dollar amount
- [ ] Multiple clicks work (highlights update)
- [ ] Highlight clears when clicking different field
- [ ] Works across different invoice formats
- [ ] Performance: Search completes in <500ms

---

## 💡 Advanced Features (Future)

### 1. Confidence Visualization in PDF
Show confidence score as highlight opacity:
- High confidence (>95%): Solid green border
- Medium (75-95%): Dashed yellow border
- Low (<75%): Dotted red border

### 2. Edit-in-Place with PDF Context
- Click field → Shows PDF context in popup
- Edit value right there
- See before/after comparison

### 3. Bulk Verification
- "Verify All" button
- Cycles through all fields
- Highlights each in PDF sequentially
- User confirms/corrects each one

---

## 📚 Resources

- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [LlamaIndex PDF Viewer API](https://github.com/run-llama/pdf-viewer)
- [Text Search in PDFs](https://github.com/mozilla/pdf.js/blob/master/examples/text-only/)

---

**Ready to implement?** We can start with Phase 1 (Data → PDF linking) right now!


