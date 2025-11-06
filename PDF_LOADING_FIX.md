# PDF Loading Issue - Diagnosis & Fix

## 🐛 Problem

**Symptom:** "Failed to load PDF file" in the PDF viewer panel

**Cause:** Filename mismatch between what's stored in invoice data and what's saved in the uploads folder

---

## 🔍 Investigation

### Files in uploads folder:
```
invoice_Aaron Bergman_36258.pdf
invoice_Aaron Bergman_36259.pdf
invoice_Aaron Hawkins_6817.pdf
... etc
```

### What's probably happening:
1. The original filenames from user upload are like: `invoice1.pdf`, `sample.pdf`, etc.
2. Backend saves them with original name: `file.filename`
3. But old files were saved with different naming scheme: `invoice_{customer}_{number}.pdf`
4. Frontend tries to load using `invoiceData.filename` which doesn't match

---

## 🔧 Quick Fixes Applied

### 1. Enhanced File Endpoint Logging
**File:** `backend/routers/files.py`

**Changes:**
- Added debug logging to show which file is requested
- Lists available files when file not found
- Added explicit CORS headers

### 2. Debug Logging in ReviewInterface
**File:** `frontend/src/components/ReviewInterface.tsx`

**Changes:**
- Logs invoice data and PDF URL to console
- Helps identify filename mismatch

---

## 🧪 Testing Steps

### Step 1: Check Backend Logs
When you click "Review Invoice", check the backend terminal for:
```
ERROR: File not found: invoice1.pdf
DEBUG: Available files: ['invoice_Aaron Bergman_36258.pdf', ...]
```

This tells us:
- What filename the frontend is requesting
- What files actually exist

### Step 2: Check Browser Console
Open browser console (F12) and look for:
```
ReviewInterface - Invoice Data: {filename: "invoice1.pdf", ...}
ReviewInterface - PDF URL: http://localhost:8000/files/invoice1.pdf
ReviewInterface - Filename: invoice1.pdf
```

Compare the filename to what's in the uploads folder.

---

## ✅ Permanent Solution Options

### Option 1: Store Correct Filename (RECOMMENDED)
Make sure we save the filename in invoice data matches the saved file:

**In `backend/routers/ocr.py`:**
```python
# Build invoice data
invoice_data = {
    "filename": file.filename,  # ← This should match saved filename
    "invoice_number": inv_number,
    ...
}
```

### Option 2: Use Consistent Naming
Always save with original filename (current approach):

**Current code (line 368):**
```python
file_path = upload_dir / file.filename  # ✅ Saves with original name
```

### Option 3: Generate Unique Filenames
Create unique filenames and store them:

```python
import uuid
unique_filename = f"{uuid.uuid4()}_{file.filename}"
file_path = upload_dir / unique_filename

# Then store unique_filename in invoice_data
invoice_data = {
    "filename": unique_filename,  # ← Use this
    ...
}
```

---

## 🚀 Immediate Workaround

If you want to test with existing files, you can:

### Option A: Rename Files
Rename the PDFs in uploads folder to match upload names:
```bash
cd backend/uploads
# Rename to match original upload names
mv "invoice_Aaron Bergman_36258.pdf" "invoice1.pdf"
```

### Option B: Re-upload Fresh Files
1. Delete old files in `backend/uploads/`
2. Upload invoices again
3. The new files will be saved with original names
4. PDF viewer should work

---

## 📊 Next Run: What to Check

1. **Upload fresh invoices** (to ensure clean filenames)
2. **Check backend logs** when clicking Review Invoice
3. **Check browser console** for filename being requested
4. **Compare:** Does the requested filename exist in uploads folder?

---

## 🎯 Expected Fix

Once filenames match, you should see:
```
DEBUG: Serving file: uploads/invoice1.pdf
```

And the PDF viewer will load successfully!

---

**Try re-uploading invoices and testing again. Share the backend/console logs if still having issues!**


