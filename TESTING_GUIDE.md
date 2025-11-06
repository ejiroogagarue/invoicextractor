# Testing Guide: Quantity Extraction Verification

## 🎯 Goal
Verify that DeepSeek correctly extracts quantity, unit price (rate), and total amount for each line item.

---

## 📋 Pre-Test Checklist

- [x] Enhanced DeepSeek prompt with quantity/rate/amount instructions
- [x] Added debug logging to show raw extraction and normalized values
- [x] Added math validation logging
- [x] No linter errors

---

## 🚀 Step 1: Start the Backend

### Terminal 1: Backend Server

```bash
cd /Users/ogaga/Desktop/OGAGA/bookkeeper/backend

# Activate virtual environment
source venv/bin/activate

# Start server with debug logging
uvicorn main:app --reload
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

---

## 🚀 Step 2: Start the Frontend

### Terminal 2: Frontend Dev Server

```bash
cd /Users/ogaga/Desktop/OGAGA/bookkeeper/frontend

# Start React app
npm start
```

**Expected output:**
```
Compiled successfully!

You can now view bookkeeper in the browser.

  Local:            http://localhost:3000
```

---

## 🧪 Step 3: Upload Test Invoice

1. Open browser to `http://localhost:3000`
2. Upload one of your test invoices (the ones with multiple items)
3. Click "Process Invoices"
4. **Watch Terminal 1** for debug logs

---

## 📊 Step 4: Analyze Debug Output

### What to Look For

#### A. Line Item Extraction Logs

Look for output like this:

```
DEBUG: Raw line item 0: {
  'item_name': 'Office Chair', 
  'quantity': 2, 
  'rate': 150.00, 
  'amount': 300.00
}
DEBUG: Normalized item 0: qty=2, rate=150.0, amount=300.0
```

#### B. Math Validation Logs

```
DEBUG: Math validation - Overall valid: True
DEBUG: Line items valid: True
DEBUG: Subtotal valid: True
DEBUG: Total valid: True
```

#### C. Financial Summary

```
DEBUG: Financial summary - Subtotal: 48.71, Shipping: 11.13, Discount: 9.74, Tax: 0.0, Total: 50.10
```

---

## ✅ Success Criteria

### For Each Line Item, Verify:

1. **Quantity is correct**
   - Example: Invoice shows "2 chairs" → `quantity: 2` ✅
   - NOT: `quantity: 1` ❌

2. **Rate is UNIT price**
   - Example: Invoice shows "$150 each" → `rate: 150.00` ✅
   - NOT: `rate: 300.00` (total) ❌

3. **Amount is TOTAL**
   - Example: 2 × $150 = → `amount: 300.00` ✅
   - Matches invoice total for that line ✅

4. **Math validates**
   - `quantity × rate = amount` (within $0.01 tolerance)
   - Example: `2 × 150.00 = 300.00` ✅

5. **Subtotal is correct**
   - Sum of all line item amounts
   - Example: `$48.71 = $48.71` ✅

6. **Grand total is correct**
   - Subtotal + Shipping - Discount + Tax
   - Example: `$48.71 + $11.13 - $9.74 + $0 = $50.10` ✅

---

## 🐛 Common Issues & Solutions

### Issue 1: Quantity Always 1

**Symptom:**
```
DEBUG: Raw line item 0: {'quantity': 1, 'rate': 300.00, 'amount': 300.00}
```
But invoice actually shows "Qty: 2"

**Cause:** DeepSeek is extracting total price as rate instead of unit price

**Solution:** Invoice text might be confusing. Check the exact format and we can refine the prompt.

---

### Issue 2: Math Validation Fails

**Symptom:**
```
DEBUG: Math validation - Overall valid: False
DEBUG: Validation errors: [{'type': 'LINE_ITEM_MATH_ERROR', ...}]
```

**Causes:**
- DeepSeek extracted wrong values
- Invoice has actual math errors
- Rounding differences

**Solution:** Look at the specific error message to identify which line item failed.

---

### Issue 3: Missing Shipping/Discount

**Symptom:**
```
DEBUG: Financial summary - Subtotal: 48.71, Shipping: 0.0, Discount: 0.0, Tax: 0.0, Total: 48.71
```
But invoice shows shipping = $11.13

**Cause:** DeepSeek couldn't find shipping in the PDF text

**Solution:** Check if PyMuPDF extracted the text correctly. The shipping field might be in an unusual location.

---

## 📝 Step 5: Document Results

### Copy Debug Output

From Terminal 1, copy these sections:
1. JSON extraction for at least one invoice
2. Line item logs (raw + normalized)
3. Financial summary
4. Math validation results

### Example Test Results Template

```
INVOICE FILE: invoice_36258.pdf

RAW EXTRACTION:
DEBUG: Raw line item 0: {...}

NORMALIZED:
DEBUG: Normalized item 0: qty=1, rate=48.71, amount=48.71

FINANCIAL:
DEBUG: Financial summary - Subtotal: 48.71, Shipping: 11.13, Discount: 9.74, Tax: 0.0, Total: 50.10

VALIDATION:
DEBUG: Math validation - Overall valid: True
DEBUG: Line items valid: True
DEBUG: Subtotal valid: True
DEBUG: Total valid: True

RESULT: ✅ PASS / ❌ FAIL
```

---

## 🔄 Step 6: Test Multiple Invoices

Test at least **3 different invoices** to ensure consistency:

1. **Invoice with 1 item** (simple case)
2. **Invoice with multiple items** (quantity > 1 for some items)
3. **Invoice with shipping + discount** (complex calculation)

Record results for each:

| Invoice | Line Items | Quantity Correct? | Math Valid? | Shipping Captured? | Result |
|---------|------------|-------------------|-------------|-------------------|--------|
| #36258  | 1          | ✅                | ✅          | ✅                | PASS   |
| #6817   | 3          | ?                 | ?           | ?                 | ?      |
| #...    | ?          | ?                 | ?           | ?                 | ?      |

---

## 🎯 What to Share

After testing, share:

1. **Test Results Summary** - Which invoices passed/failed
2. **Debug Logs** - For at least one successful and one failed invoice (if any)
3. **Screenshots** - Frontend showing the extracted data
4. **Questions** - Any unexpected behavior

---

## 🚦 Next Steps Based on Results

### If All Tests Pass ✅
- Move to **Option 2: PDF Viewer**
- Quantity extraction is working correctly
- Trust layer is validated

### If Some Tests Fail ⚠️
- Share debug logs
- We'll refine the DeepSeek prompt
- Might need to adjust PDF text extraction
- Re-test after fixes

### If All Tests Fail ❌
- Fundamental issue with extraction
- Check if PyMuPDF is extracting text correctly
- Might need to try different OCR approach
- Share sample invoice (if comfortable)

---

## 💡 Tips for Testing

1. **Start simple** - Test with one invoice first
2. **Keep terminal visible** - Watch logs in real-time
3. **Compare side-by-side** - Open PDF and compare with extracted data
4. **Test edge cases** - Invoices with unusual formats
5. **Note patterns** - If multiple invoices fail the same way, there's a pattern

---

## 🆘 If You Get Stuck

Common issues:

**Backend won't start:**
```bash
# Check if virtual environment is activated
which python  # Should show venv path

# Re-install dependencies if needed
pip install -r requirements.txt
```

**Frontend won't start:**
```bash
# Re-install dependencies
npm install

# Clear cache
rm -rf node_modules package-lock.json
npm install
```

**No debug logs showing:**
- Make sure you're watching Terminal 1 (backend)
- Logs appear when you click "Process Invoices"
- Check that uvicorn is running with `--reload`

---

**Ready to test!** 🚀

Start the servers and upload an invoice. Share the debug output and we'll analyze it together.


