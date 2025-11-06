# Test: Quantity Extraction Fix

## Changes Made

### 1. Enhanced DeepSeek Prompt (`backend/services/deepseek_ocr.py`)

**Updated JSON Schema:**
```json
"line_items": [
  {
    "quantity": number (required - HOW MANY units, e.g., 2, 5, 1),
    "rate": number (required - UNIT PRICE, price PER ITEM, NOT total),
    "amount": number (required - TOTAL for this line: quantity × rate)
  }
]
```

**Added Explicit Instructions:**
```
CRITICAL INSTRUCTIONS FOR LINE ITEMS:
- quantity = HOW MANY items (e.g., if invoice says "2 chairs", quantity = 2)
- rate = UNIT PRICE (price for ONE item, e.g., $50.00 per chair)
- amount = TOTAL PRICE for that line (quantity × rate, e.g., 2 × $50 = $100)
- EXAMPLE: "3 Office Desks @ $200 each = $600"
  → quantity: 3, rate: 200, amount: 600
```

### 2. Enhanced Debug Logging (`backend/routers/ocr.py`)

**Line Item Extraction Logs:**
- Shows raw JSON from DeepSeek
- Shows normalized values (quantity, rate, amount)
- Shows each line item as it's processed

**Math Validation Logs:**
- Shows if line items validate correctly
- Shows if subtotal matches
- Shows any validation errors

## How to Test

### Step 1: Start the Backend
```bash
cd backend
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
uvicorn main:app --reload
```

### Step 2: Upload a Test Invoice

Use one of your sample invoices (the ones you showed earlier). Look for console output like:

```
DEBUG: Raw line item 0: {'item_name': 'Office Chair', 'quantity': 2, 'rate': 150.00, 'amount': 300.00}
DEBUG: Normalized item 0: qty=2, rate=150.0, amount=300.0
```

### Step 3: Check the Math Validation

Look for:
```
DEBUG: Math validation - Overall valid: True
DEBUG: Line items valid: True
DEBUG: Subtotal valid: True
DEBUG: Total valid: True
```

Or if there are errors:
```
DEBUG: Validation errors: [{'type': 'LINE_ITEM_MATH_ERROR', 'message': '...'}]
```

## Expected Results

For an invoice like this:
```
INVOICE #36258
Date: Mar 06 2012

Line Items:
1. Global Push Button Manager's Chair, Indigo
   Furniture, Chairs
   FUR-CH-4421
   Quantity: 1
   Unit Price: $48.71
   Amount: $48.71

Subtotal: $48.71
Discount (20%): -$9.74
Shipping: $11.13
Tax: $0.00
Total: $50.10
```

**DeepSeek Should Extract:**
```json
{
  "invoice_number": "36258",
  "date": "Mar 06 2012",
  "line_items": [
    {
      "item_name": "Global Push Button Manager's Chair, Indigo",
      "description": "Furniture, Chairs",
      "product_code": "FUR-CH-4421",
      "quantity": 1,
      "rate": 48.71,
      "amount": 48.71
    }
  ],
  "financial_summary": {
    "subtotal": 48.71,
    "discount": {
      "percent": 20,
      "amount": 9.74
    },
    "shipping": 11.13,
    "tax": 0.00,
    "total": 50.10
  }
}
```

**Math Validation Should Pass:**
- Line item: 1 × $48.71 = $48.71 ✅
- Subtotal: $48.71 ✅
- Total: $48.71 - $9.74 + $11.13 + $0.00 = $50.10 ✅

## What to Look For

### ✅ Good Signs:
- `quantity` is an integer (1, 2, 3, etc.)
- `rate` is the unit price
- `amount` equals `quantity × rate`
- Math validation shows "valid: True"
- No math errors in logs

### ❌ Bad Signs:
- `quantity` is always 1 (might be ignoring real quantity)
- `rate` equals `amount` (might be extracting total instead of unit price)
- Math validation errors
- Subtotal doesn't match sum of line items

## If Issues Persist

### Possible Causes:

1. **DeepSeek Confusion:**
   - Invoice format is ambiguous
   - Multiple price columns confusing the model
   - Need to provide more examples in prompt

2. **PDF Text Extraction Issues:**
   - Text not extracted in correct order
   - Numbers misaligned with labels
   - Need better text preprocessing

3. **Invoice Format Variations:**
   - Some invoices have different structures
   - Need adaptive parsing logic

### Next Steps:

1. Share the debug logs from a test run
2. Share a sample invoice PDF (if comfortable)
3. We can refine the prompt based on actual extraction results
4. Consider adding post-processing validation

---

**Action Required:** Run a test with your invoices and share the console output!


