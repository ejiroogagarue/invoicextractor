# Quick Start: Test Quantity Extraction

## 🚀 One-Command Testing

### Terminal 1: Backend
```bash
cd /Users/ogaga/Desktop/OGAGA/bookkeeper/backend && source venv/bin/activate && uvicorn main:app --reload
```

### Terminal 2: Frontend
```bash
cd /Users/ogaga/Desktop/OGAGA/bookkeeper/frontend && npm start
```

### Browser
```
http://localhost:3000
```

---

## 👀 What to Watch For

**In Terminal 1 (Backend), you should see:**

### ✅ Good Signs:
```
DEBUG: Raw line item 0: {'item_name': 'Chair', 'quantity': 2, 'rate': 150.0, 'amount': 300.0}
                                                   ^^^^^^^^^^ ^^^^^^^^ ^^^^^^^^^^
                                                   Qty > 1    Unit $   Total = Qty × Rate

DEBUG: Normalized item 0: qty=2, rate=150.0, amount=300.0

DEBUG: Math validation - Overall valid: True
DEBUG: Line items valid: True
```

### ❌ Bad Signs:
```
DEBUG: Raw line item 0: {'quantity': 1, 'rate': 300.0, 'amount': 300.0}
                                      ^    ^^^^^^^^
                                      Should be 2!  Should be 150!

DEBUG: Math validation - Overall valid: False
DEBUG: Validation errors: [{'type': 'LINE_ITEM_MATH_ERROR', ...}]
```

---

## 📋 Quick Test Checklist

Upload **one invoice** and check:

- [ ] Backend terminal shows `DEBUG: Raw line item 0: {...}`
- [ ] `quantity` matches what's on the invoice
- [ ] `rate` is the UNIT price (not total)
- [ ] `amount` equals `quantity × rate`
- [ ] Math validation shows `Overall valid: True`
- [ ] Frontend shows the extracted data
- [ ] Confidence score is reasonable (> 0.7)

---

## 📊 Share Results

**If it works:** ✅ 
Copy and paste this into chat:
```
✅ QUANTITY EXTRACTION WORKING!

Invoice: [filename]
Line items extracted: [count]
Math validation: PASSED
Sample item:
  - Name: [item name]
  - Quantity: [qty]
  - Unit Price: $[rate]
  - Total: $[amount]
  - Math check: [qty] × $[rate] = $[amount] ✅
```

**If it doesn't work:** ❌
Copy the debug logs from Terminal 1 and paste into chat:
```
❌ ISSUE FOUND

[Paste debug logs here showing the extraction]
```

---

## ⏱️ Expected Timeline

- **Setup:** 2 minutes (start servers)
- **Upload:** 30 seconds (select and upload invoice)
- **Processing:** 5-15 seconds (DeepSeek extraction)
- **Verification:** 1 minute (check logs and results)

**Total:** ~5 minutes for first test

---

## 🎯 Decision Point

After testing, we'll either:

**A) Tests Pass ✅**
→ Move to PDF Viewer implementation

**B) Tests Fail ❌**
→ Refine extraction and re-test

---

**Ready when you are!** 🚀


