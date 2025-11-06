# Quantity Bug Investigation & Fix

## Issue Reported

**User Report:** "We captured the individual prices but ignored the quantity so our cost breakdown is wrong"

## Investigation

### Current Logic (What Should Be Happening)

**Line Item Validation (`backend/services/validation.py`):**
```python
# Line 96-101: Parse line item values
quantity = float(item.get('quantity', 0))
rate = parse_currency(item.get('rate', '0'))
stated_amount = parse_currency(item.get('amount', '0'))

# Calculate expected amount
calculated_amount = quantity * rate  # ✅ Quantity IS being used
```

**Subtotal Calculation (`backend/services/validation.py`):**
```python
# Line 189-192: Sum line items for subtotal
if validation['stated_amount'] is not None:
    line_item_sum += validation['stated_amount']  # ✅ Uses the stated amount from invoice
```

### Possible Issues

#### 1. **DeepSeek Extraction Issue**
DeepSeek might be extracting the wrong values:
- Extracting unit price instead of total amount
- Not extracting quantity correctly
- Confusing rate vs. amount

#### 2. **String Conversion Issue**
Line items are converted to strings (line 387-389 in `ocr.py`):
```python
"quantity": str(item.get('quantity', '')),
"rate": str(item.get('rate', '')),
"amount": str(item.get('amount', '')),
```

But validation converts them back to float (should work fine).

#### 3. **Display Issue**
Frontend might be displaying the wrong values or not showing quantity.

## Debugging Steps Added

### 1. Enhanced Line Item Logging
Added debug logs to see exactly what DeepSeek extracts:
```python
print(f"DEBUG: Raw line item {idx}: {item}")
print(f"DEBUG: Normalized item {idx}: qty={normalized_item['quantity']}, rate={normalized_item['rate']}, amount={normalized_item['amount']}")
```

### 2. Math Validation Logging
Added logs to see validation results:
```python
print(f"DEBUG: Math validation - Overall valid: {validation_results['overall_valid']}")
print(f"DEBUG: Line items valid: {validation_results['line_items_valid']}")
print(f"DEBUG: Validation errors: {validation_results['errors']}")
```

## Expected Invoice Structure

For a typical invoice line item:
```
Item: Office Chair
Quantity: 2
Unit Price (Rate): $150.00
Total Amount: $300.00  (Quantity × Rate)
```

DeepSeek should extract:
```json
{
  "item_name": "Office Chair",
  "quantity": 2,
  "rate": 150.00,
  "amount": 300.00
}
```

## Testing Checklist

Run a test invoice and check these logs:

- [ ] What does DeepSeek extract for quantity?
- [ ] What does DeepSeek extract for rate (unit price)?
- [ ] What does DeepSeek extract for amount (total)?
- [ ] Does `quantity × rate = amount` validate correctly?
- [ ] Are there math validation errors?
- [ ] What's the calculated vs. stated subtotal?

## Potential Fixes

### Fix 1: Improve DeepSeek Prompt Clarity

Update the JSON schema to be more explicit:
```json
"line_items": [
  {
    "item_name": "string (product/service name)",
    "quantity": "number (how many units)",
    "rate": "number (price PER UNIT, not total)",
    "amount": "number (total: quantity × rate)"
  }
]
```

### Fix 2: Add Validation in Normalization

Add a check when normalizing:
```python
# Validate that quantity × rate ≈ amount
qty = float(item.get('quantity', 0))
rate = float(item.get('rate', 0))
amount = float(item.get('amount', 0))

calculated = qty * rate
if abs(calculated - amount) > 0.01:
    print(f"WARNING: Line item math doesn't add up: {qty} × {rate} = {calculated}, but invoice shows {amount}")
```

### Fix 3: Frontend Display

Ensure the frontend table shows:
- Quantity column
- Unit Price column (rate)
- Total column (amount)
- Calculated total for verification

## Next Steps

1. **Run a test** with an actual invoice
2. **Check the debug logs** to see what DeepSeek extracts
3. **Identify the root cause** (extraction, validation, or display)
4. **Apply the appropriate fix**

---

**Action Required:** Please run the backend with these debug logs and upload a test invoice. Share the console output so we can see exactly what's being extracted.


