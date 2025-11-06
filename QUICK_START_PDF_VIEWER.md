# Quick Start: Test PDF Viewer

## 🚀 Start the App (2 Terminals)

### Terminal 1: Backend
```bash
cd /Users/ogaga/Desktop/OGAGA/bookkeeper/backend
source venv/bin/activate
uvicorn main:app --reload
```

### Terminal 2: Frontend
```bash
cd /Users/ogaga/Desktop/OGAGA/bookkeeper/frontend
npm start
```

---

## 📝 Testing Steps (5 Minutes)

### 1. Upload & Process (1 min)
- Go to `http://localhost:3000`
- Upload 2-3 invoice PDFs
- Click "Process Invoices"
- Wait for completion

### 2. View Dashboard (30 sec)
- See summary cards
- See invoice cards with status badges
- Note: Some might say "✓ Auto-Approved", others "⚠️ Needs Review"

### 3. Review an Invoice (2 min)
- Click "📄 Review Invoice" on any invoice card
- **Left side:** PDF should display
- **Right side:** Extracted data should show

### 4. Verify Trust Features (1 min)
Check the right panel for:
- ✅ **Green checkmarks** - Math validated
- ⚠️ **Yellow warnings** - Math errors (if any)
- **Confidence badges** - Green/Yellow/Red based on score
- **Line items table** - Qty, Rate, Amount columns
- **Financial summary** - Subtotal, Shipping, Discount, Tax, Total

### 5. Test Navigation (30 sec)
- Click "← Back to Dashboard"
- Should return to invoice list
- Click different invoice
- Should load new PDF and data

---

## ✅ What Should Work

| Feature | Expected Result |
|---------|----------------|
| PDF displays | ✅ See original invoice on left |
| Data displays | ✅ See extracted fields on right |
| Confidence shown | ✅ Percentage and color badges |
| Math validation | ✅ Checkmarks or warnings |
| Line items | ✅ Table with all items |
| Totals correct | ✅ Match invoice totals |
| Approve button | ✅ Green, clickable (if math valid) |
| Reject button | ✅ Yellow, always clickable |
| Back button | ✅ Returns to dashboard |

---

## 🐛 If Something Doesn't Work

### PDF Not Showing
**Check:**
- Backend running? (`http://localhost:8000`)
- Files in `backend/uploads/` folder?
- Console errors? (F12 → Console tab)

**Fix:**
- Restart backend
- Re-upload invoices

### Data Not Showing
**Check:**
- Frontend console for errors (F12)
- Backend terminal for "DEBUG:" logs

**Fix:**
- Check if extraction worked in dashboard first
- Try different invoice

### Layout Broken
**Check:**
- Browser window size (needs ~1024px width minimum)
- CSS files loaded? (check Network tab)

**Fix:**
- Maximize browser window
- Clear cache and refresh (Ctrl+Shift+R)

---

## 📸 What Success Looks Like

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Dashboard    Invoice Review: inv-6817       │
│                                                  ⚠️ Needs│
│                                                   Review │
├──────────────────────┬──────────────────────────────────┤
│ 📄 Original Document │ 📊 Extracted Data                │
│                      │ Overall Confidence: 85%          │
│ [PDF displaying]     │                                  │
│ - Pages visible      │ Invoice #: inv-6817         ✅  │
│ - Can scroll         │ Date: Oct 23 2012           ✅  │
│ - Can zoom           │ Vendor: SuperStore          ✅  │
│                      │                                  │
│                      │ Line Items (3)                   │
│                      │ Item    │Qty│Rate │Amount│Trust│
│                      │ Chair   │ 2 │150  │300  │✅   │
│                      │ Desk    │ 1 │200  │200  │✅   │
│                      │                                  │
│                      │ Subtotal: $500.00           ✅  │
│                      │ Shipping: $50.00                 │
│                      │ Total: $550.00              ✅  │
│                      │                                  │
│                      │ [✓ Approve Invoice] [🔍 Review]  │
└──────────────────────┴──────────────────────────────────┘
```

---

## 🎯 Quick Checklist

Before reporting success, verify:
- [ ] PDF loads and is readable
- [ ] All invoice fields shown (number, date, vendor)
- [ ] Line items table populated
- [ ] Quantity column shows correct values
- [ ] Math validation checkmarks present
- [ ] Totals match the PDF
- [ ] Confidence scores displayed
- [ ] Approve/Reject buttons work
- [ ] Back button returns to dashboard
- [ ] Can review multiple invoices

---

**If all ✅ above, Phase 1 is working!** 🎉

Report back with:
- ✅ "All working!" or
- ❌ "Issue: [describe what's not working]"


