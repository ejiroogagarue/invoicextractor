"""
Test Script for OpenAI Invoice Extractor
=========================================
Verify that the OpenAI + PaddleOCR system works correctly.

Usage:
    python test_openai_extractor.py

Prerequisites:
    1. Install dependencies: pip install openai paddleocr paddlepaddle
    2. Set OPENAI_API_KEY in .env file
    3. Have at least one PDF in uploads/ directory
"""

import argparse
import asyncio
import os
import time
from pathlib import Path

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv not installed, using system environment only")

# Add parent directory to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent))

from services.openai_invoice_extractor import OpenAIInvoiceExtractor


async def test_extraction():
    """Test OpenAI extractor with a single sample invoice."""

    print("═" * 60)
    print("🧪 OpenAI Invoice Extractor Test")
    print("═" * 60)

    print("\n📋 Step 1: Checking environment...")
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY not set in environment")
        print("   Add it to your .env file and try again.")
        return
    print("✅ OPENAI_API_KEY found")

    print("\n📋 Step 2: Initializing OpenAI extractor...")
    try:
        extractor = OpenAIInvoiceExtractor()
        print(f"✅ Extractor ready: {extractor.name} ({extractor.model})")
    except Exception as e:
        print(f"❌ Failed to initialize extractor: {e}")
        return

    print("\n📋 Step 3: Finding test invoice...")
    upload_dir = Path("uploads")
    if not upload_dir.exists():
        print("❌ No uploads directory found")
        print("   Create uploads/ and add a test PDF.")
        return

    pdf_files = list(upload_dir.glob("*.pdf"))
    if not pdf_files:
        print("❌ No PDF files found in uploads/")
        print("   Add a test invoice PDF to uploads/ directory.")
        return

    test_file = pdf_files[0]
    print(f"✅ Found test file: {test_file.name}")

    print("\n📋 Step 4: Reading file...")
    try:
        with open(test_file, "rb") as f:
            file_bytes = f.read()
        print(f"✅ Read {len(file_bytes):,} bytes")
    except Exception as e:
        print(f"❌ Failed to read file: {e}")
        return

    print("\n📋 Step 5: Extracting invoice data...")
    print("═" * 60)
    start = time.time()

    try:
        result = await extractor.extract_invoice(
            file_bytes=file_bytes,
            filename=test_file.name,
            mime_type="application/pdf"
        )

        duration = time.time() - start

        print("═" * 60)
        print(f"\n✅ Extraction complete in {duration:.2f}s")
        print(f"📊 Pages processed: {result['pages']}")

        perf = result.get('performance', {}).get('provider_breakdown', {})
        print(f"\n⏱️  Performance Breakdown:")
        print(f"  Text Extraction: {perf.get('text_extraction_time', 0):.0f}ms")
        print(f"  API Call (GPT):  {perf.get('api_call_time', 0):.0f}ms")
        print(f"  JSON Parse:      {perf.get('json_parse_time', 0):.0f}ms")
        print(f"  Total:           {duration * 1000:.0f}ms")

        invoice = result['result_json']
        print(f"\n📋 Extracted Data:")
        print(f"  Vendor:       {invoice.get('vendor', {}).get('name', 'N/A')}")
        print(f"  Invoice #:    {invoice.get('invoice_number', 'N/A')}")
        print(f"  Date:         {invoice.get('date', 'N/A')}")

        financial = invoice.get('financial_summary', {})
        print(f"  Subtotal:     ${financial.get('subtotal', 0)}")
        print(f"  Tax:          ${financial.get('tax', 0)}")
        print(f"  Total:        ${financial.get('total', 0)}")

        line_items = invoice.get('line_items', [])
        print(f"  Line Items:   {len(line_items)}")
        if line_items:
            print(f"\n  First item:")
            first_item = line_items[0]
            print(f"    Name:     {first_item.get('item_name', 'N/A')}")
            print(f"    Qty:      {first_item.get('quantity', 0)}")
            print(f"    Rate:     ${first_item.get('rate', 0)}")
            print(f"    Amount:   ${first_item.get('amount', 0)}")

        print(f"\n🚀 Performance Comparison:")
        print(f"  OpenAI (this run):  {duration:.2f}s")
        print(f"  Gemini (typical):   ~10s")
        print(f"  Speedup:            {10 / duration:.1f}x faster")

        print("\n" + "═" * 60)
        print("✅ Test completed successfully!")
        print("═" * 60)

    except Exception as e:
        print("═" * 60)
        print(f"\n❌ Error during extraction:")
        print(f"   {e}")
        print("\n🔍 Troubleshooting:")
        print("   1. Check OPENAI_API_KEY is valid")
        print("   2. Ensure dependencies are installed:")
        print("      pip install openai paddleocr paddlepaddle")
        print("   3. Check PDF is not corrupted")
        print("   4. Review error details above")
        print("\n" + "═" * 60)
        import traceback
        traceback.print_exc()


async def benchmark_directory(directory: Path, limit: int = 10, max_workers: int = 3):
    """Benchmark multiple invoices to validate batch throughput."""
    if not directory.exists():
        print(f"❌ Directory does not exist: {directory}")
        return

    pdf_files = sorted(directory.glob("*.pdf"))[:limit]
    if not pdf_files:
        print(f"❌ No PDF files found in {directory}")
        return

    if not os.getenv("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY not set in environment")
        return

    print("═" * 60)
    print(f"🧪 Batch Benchmark: {len(pdf_files)} file(s), max workers={max_workers}")
    print("═" * 60)

    extractor = OpenAIInvoiceExtractor()
    semaphore = asyncio.Semaphore(max(1, max_workers))
    durations: List[float] = []

    async def _process(path: Path):
        async with semaphore:
            with path.open("rb") as f:
                file_bytes = f.read()
            start = time.time()
            await extractor.extract_invoice(
                file_bytes=file_bytes,
                filename=path.name,
                mime_type="application/pdf",
            )
            elapsed = time.time() - start
            print(f"  ✓ {path.name} processed in {elapsed:.2f}s")
            return elapsed

    batch_start = time.time()
    tasks = [asyncio.create_task(_process(path)) for path in pdf_files]
    for task in asyncio.as_completed(tasks):
        try:
            durations.append(await task)
        except Exception as exc:
            durations.append(0)
            print(f"  ⚠️  Error processing file: {exc}")
    total_time = time.time() - batch_start

    print("\n📊 Batch Summary")
    print(f"  Files:            {len(pdf_files)}")
    print(f"  Max Workers:      {max_workers}")
    print(f"  Total Time:       {total_time:.2f}s")
    if durations:
        avg = sum(durations) / len([d for d in durations if d])
        fastest = min([d for d in durations if d])
        slowest = max([d for d in durations if d])
        print(f"  Avg Duration:     {avg:.2f}s")
        print(f"  Fastest Invoice:  {fastest:.2f}s")
        print(f"  Slowest Invoice:  {slowest:.2f}s")
    print("═" * 60)


async def main():
    parser = argparse.ArgumentParser(description="OpenAI invoice extractor diagnostics")
    parser.add_argument("--dir", type=str, help="Directory with PDFs to benchmark")
    parser.add_argument("--limit", type=int, default=10, help="Number of PDFs to benchmark")
    parser.add_argument("--workers", type=int, default=3, help="Max concurrent invoices during benchmark")
    args = parser.parse_args()

    if args.dir:
        await benchmark_directory(Path(args.dir), limit=args.limit, max_workers=args.workers)
    else:
        await test_extraction()


if __name__ == "__main__":
    asyncio.run(main())

