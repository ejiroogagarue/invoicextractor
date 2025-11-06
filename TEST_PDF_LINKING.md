# Test PDF ↔ Data Linking

## 🚀 Quick Start

### Already Running?
If your servers are still running from before, you're ready to test!

### Need to Start?
```bash
# Terminal 1: Backend
cd backend && source venv/bin/activate && uvicorn main:app --reload

# Terminal 2: Frontend  
cd frontend && npm start
```

---

## 📋 Testing Checklist

### ✅ Phase 1: Clickable Fields (What Works Now)

#### Test 1: Hover Interaction
1. Open review interface (click "📄 Review Invoice")
2. **Hover over "Invoice #: 36258"**
   - Should show blue left border
   - Should show light blue background
   - Value should underline
   - Cursor should change to pointer
3. **Hover away** → Styling resets

**Expected:** ✅ Clean visual feedback, no clutter

#### Test 2: Click to Search
1. **Click "Invoice #: 36258"**
2. **Watch top of data panel** → Shows "🔍 Searching PDF..."
3. **Check browser console** (F12) → Shows:
   ```
   ReviewInterface: Searching PDF for Invoice Number: "36258"
   PDFTextLocator: Searching for: 36258
   PDFTextLocator: Found on page 1: {page: 1, x: 450, y: 120, ...}
   ```
4. **Data panel shows** → "✓ Found on page 1"

**Expected:** ✅ Search completes, location found

#### Test 3: Try Other Fields
- **Click "Date"** → Should find date in PDF
- **Click "Vendor"** → Should find vendor name
- **Click "Grand Total"** → Should find dollar amount

**Expected:** ✅ All critical fields searchable

---

## 📊 What You Should See

### In Browser Console:
```
ReviewInterface: PDF loaded for text search
PDFTextLocator: PDF loaded, 1 pages

[User clicks "Invoice #"]
ReviewInterface: Searching PDF for Invoice Number: "36258"
PDFTextLocator: Searching for: 36258
PDFTextLocator: Found on page 1: {
  page: 1,
  x: 450.5,
  y: 120.3,
  width: 52.8,
  height: 12.0,
  text: "36258"
}
```

### In UI:
```
Top of data panel:
┌─────────────────────────┐
│ ✓ Found on page 1       │ ← Green success banner
└─────────────────────────┘

Fields:
┌─────────────────────────┐
│ Invoice #: 36258        │ ← Hover = blue border + underline
│ Date: Mar 06 2012       │ ← Hover = blue border + underline
│ Vendor: SuperStore      │ ← Hover = blue border + underline
└─────────────────────────┘

Financial Summary:
┌─────────────────────────┐
│ Grand Total: $50.10 ✅  │ ← Hover = green border + underline
└─────────────────────────┘
```

---

## ⏳ What Doesn't Work Yet (Phase 2)

### Expected Limitations:
- ⏳ **PDF doesn't scroll** - We find the location but don't navigate yet
- ⏳ **No yellow highlight** - We have coordinates but don't draw highlight yet
- ⏳ **Line item amounts** - Not clickable yet (can add if needed)

**These are Phase 2 features** - coming next!

---

## 🐛 Troubleshooting

### Issue 1: "Text not found in PDF"
**Console shows:**
```
PDFTextLocator: Text not found: SuperStore
```

**Possible causes:**
- Text spelled differently in PDF
- OCR extracted wrong text
- Text split across multiple elements

**Solution:** Search for partial match or numbers only

### Issue 2: No search indicator appears
**Possible causes:**
- JavaScript error (check console)
- Field value is "Unknown"
- onFieldClick prop not passed

**Solution:** Check console for errors

### Issue 3: Hover styling doesn't show
**Possible causes:**
- CSS not loaded
- Component re-rendering

**Solution:** Hard refresh (Ctrl+Shift+R)

---

## 🎯 Success Criteria

Phase 1 is successful if:

- [x] Hover shows subtle visual cue (border, underline)
- [x] Click triggers search
- [x] Console logs show text found
- [x] "Found on page X" indicator appears
- [x] No visual clutter in normal state
- [x] Only 4 critical fields clickable
- [x] Professional, clean design

---

## 📝 What to Share

After testing, report:

**If working:** ✅
```
✅ PDF LINKING WORKS!
- Hover styling: Clean and subtle
- Click search: Fast and accurate
- Found text on correct pages
- Console logs helpful
- Ready for Phase 2 (scroll & highlight)
```

**If issues:** ❌
```
❌ Issue: [describe what's not working]
Console errors: [paste errors]
Which field: [Invoice #, Date, Vendor, Total]
```

---

## 🚀 Phase 2 Preview (Next)

Once this is working, we'll add:

1. **PDF Page Navigation**
   - Click field → PDF scrolls to correct page
   - Smooth animation

2. **Yellow Highlight Overlay**
   - Draw yellow box over found text
   - 2px orange border for visibility
   - Semi-transparent (0.4 opacity)

3. **Zoom to Region**
   - Zoom PDF to show highlighted text clearly
   - Center the highlight in viewport

**Result:** Click → PDF jumps to location → Text highlights → User verifies!

---

**Test Phase 1 now and share results!** 🎉


