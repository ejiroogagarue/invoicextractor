"""
Table Extraction Service (pdfplumber-based)
===========================================
Extracts tables from PDF invoices with multi-page support.

Performance tracking included for measuring extraction time.
"""

import pdfplumber
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from io import BytesIO


@dataclass
class ExtractedTable:
    """Represents a table extracted from PDF"""
    page: int  # Starting page (0-indexed)
    headers: List[str]
    rows: List[List[str]]
    is_multi_page: bool = False
    page_range: str = ""  # e.g., "1-2" for multi-page tables


class TableExtractor:
    """
    Extract tables from PDF invoices using pdfplumber.
    
    Includes performance tracking for measuring extraction time.
    """
    
    def extract_tables(self, file_bytes: bytes) -> tuple[List[ExtractedTable], Dict[str, float]]:
        """
        Extract all tables from PDF with performance tracking.
        
        Args:
            file_bytes: PDF file content
        
        Returns:
            Tuple of (extracted_tables, performance_metrics)
        """
        perf_start = time.time()
        tables: List[ExtractedTable] = []
        
        try:
            with pdfplumber.open(BytesIO(file_bytes)) as pdf:
                total_pages = len(pdf.pages)
                page_extraction_times = []
                
                for page_num, page in enumerate(pdf.pages):
                    page_start = time.time()
                    
                    # Find tables on this page
                    page_tables = page.find_tables()
                    print(f"     Page {page_num + 1}: Found {len(page_tables)} table(s)")
                    
                    for table_idx, table in enumerate(page_tables):
                        extracted = self._extract_table(table, page_num)
                        if extracted:
                            print(f"       Table {table_idx + 1}: {len(extracted.rows)} rows")
                            print(f"         Headers: {', '.join(extracted.headers[:5])}")
                            if extracted.rows:
                                print(f"         First row sample: {extracted.rows[0][:3]}")
                            tables.append(extracted)
                    
                    page_time = (time.time() - page_start) * 1000  # ms
                    page_extraction_times.append(page_time)
                
                # Merge tables that continue across pages
                merge_start = time.time()
                merged = self._merge_multi_page_tables(tables)
                merge_time = (time.time() - merge_start) * 1000  # ms
                
                print(f"     ✓ Merged {len(tables)} tables into {len(merged)} tables")
                for i, table in enumerate(merged):
                    print(f"       Merged Table {i+1}: Page {table.page + 1}, {len(table.rows)} rows, multi-page: {table.is_multi_page}, range: {table.page_range}")
                
                total_time = (time.time() - perf_start) * 1000  # ms
                
                performance = {
                    "table_extraction_time": total_time,
                    "total_pages": total_pages,
                    "tables_detected": len(tables),
                    "tables_after_merge": len(merged),
                    "merge_time": merge_time,
                    "avg_time_per_page": sum(page_extraction_times) / len(page_extraction_times) if page_extraction_times else 0,
                    "page_times": page_extraction_times
                }
                
                return merged, performance
        
        except Exception as e:
            print(f"  ⚠️  Error in table extraction: {e}")
            total_time = (time.time() - perf_start) * 1000
            return [], {
                "table_extraction_time": total_time,
                "error": str(e),
                "tables_detected": 0
            }
    
    def _is_metadata_table(self, headers: List[str], rows: List[List[str]]) -> bool:
        """
        Filter out tables that are actually invoice metadata/headers.
        
        Heuristics:
        - Very few rows (< 3)
        - Headers contain metadata keywords (Invoice Number, Date, Bill To, etc.)
        - No numeric columns (quantity, rate, amount)
        """
        # Check row count
        if len(rows) < 3:
            return True
        
        # Check for metadata keywords in headers
        metadata_keywords = {
            'invoice', 'number', 'date', 'bill', 'ship', 'customer', 
            'vendor', 'due', 'terms', 'payment', 'order', 'po', 'address'
        }
        header_text = ' '.join(headers).lower()
        if any(kw in header_text for kw in metadata_keywords) and len(rows) < 5:
            return True
        
        # Check if table has numeric columns (real line item tables have qty/rate/amount)
        has_numbers = False
        for row in rows[:5]:  # Check first 5 rows
            for cell in row:
                cell_str = str(cell).strip()
                # Look for currency or numeric patterns
                if any(c.isdigit() for c in cell_str):
                    if '$' in cell_str or '.' in cell_str or ',' in cell_str:
                        has_numbers = True
                        break
            if has_numbers:
                break
        
        # If no numbers found in a table with few rows, likely metadata
        if not has_numbers and len(rows) < 8:
            return True
        
        return False
    
    def _extract_table(self, table, page_num: int) -> Optional[ExtractedTable]:
        """
        Extract a single table into our format.
        Tries multiple extraction strategies because some PDFs return blank cells.
        """
        try:
            rows = table.extract()
            
            def has_content(sample: List[List[Any]]) -> bool:
                for row in sample:
                    if row and any(str(cell).strip() for cell in row if cell):
                        return True
                return False
            
            if rows and not has_content(rows[:5]):
                try:
                    rows = table.extract(x_tolerance=2, y_tolerance=2)
                except Exception:
                    pass
            
            if (not rows) or (rows and not has_content(rows[:5])):
                try:
                    page = table.page
                    bbox = table.bbox
                    words = page.within_bbox(bbox).extract_words()
                    if words:
                        print(f"         ⚠️  Table cells empty, using bounding-box text (page {page_num + 1})")
                        text_content = " ".join(w["text"] for w in words)
                        if len(text_content.strip()) > 10:
                            return ExtractedTable(
                                page=page_num,
                                headers=["content"],
                                rows=[[text_content]],
                                is_multi_page=False,
                                page_range=str(page_num + 1),
                            )
                except Exception as fallback_error:
                    print(f"         ⚠️  Bounding-box fallback failed: {fallback_error}")
            
            if not rows or len(rows) < 2:
                return None
            
            headers = [str(cell).strip() if cell else "" for cell in rows[0]]
            data_start_index = 1
            
            if not any(headers):
                for i, row in enumerate(rows[1:], start=1):
                    if row and any(str(cell).strip() for cell in row if cell):
                        headers = [str(cell).strip() if cell else "" for cell in row]
                        data_start_index = i + 1
                        break
            
            data_rows: List[List[str]] = []
            for row in rows[data_start_index:]:
                if not row:
                    continue
                data_row = [str(cell).strip() if cell else "" for cell in row]
                if any(data_row):
                    data_rows.append(data_row)
            
            if not data_rows:
                return None
            
            # Filter out metadata tables
            if self._is_metadata_table(headers, data_rows):
                print(f"         ⚠️  Skipping metadata table (page {page_num + 1})")
                return None
            
            return ExtractedTable(
                page=page_num,
                headers=headers,
                rows=data_rows,
                is_multi_page=False,
                page_range=str(page_num + 1),
            )
        
        except Exception as e:
            print(f"  ⚠️  Error extracting table from page {page_num + 1}: {e}")
            return None
    
    def _merge_multi_page_tables(self, tables: List[ExtractedTable]) -> List[ExtractedTable]:
        """
        Merge tables that continue across pages.
        
        Heuristic: If a table ends near bottom of page and next table
        starts near top of next page with matching headers, merge them.
        """
        if not tables:
            return []
        
        merged: List[ExtractedTable] = []
        i = 0
        
        while i < len(tables):
            current = tables[i]
            
            # Check if next table is a continuation
            if i + 1 < len(tables):
                next_table = tables[i + 1]
                
                # Simple check: consecutive pages with similar headers
                if (next_table.page == current.page + 1 and
                    self._headers_match(current.headers, next_table.headers)):
                    # Merge: combine rows
                    current.rows.extend(next_table.rows)
                    current.is_multi_page = True
                    current.page_range = f"{current.page + 1}-{next_table.page + 1}"
                    i += 1  # Skip next table (already merged)
            
            merged.append(current)
            i += 1
        
        return merged
    
    def _headers_match(self, headers1: List[str], headers2: List[str]) -> bool:
        """Check if headers are similar (fuzzy match)."""
        if len(headers1) != len(headers2):
            return False
        
        # Normalize and compare
        norm1 = [h.lower().strip().replace(' ', '') for h in headers1 if h]
        norm2 = [h.lower().strip().replace(' ', '') for h in headers2 if h]
        
        if len(norm1) != len(norm2):
            return False
        
        # Check if at least 70% match
        matches = sum(1 for h1, h2 in zip(norm1, norm2) if h1 == h2 or h1 in h2 or h2 in h1)
        return matches / len(norm1) >= 0.7 if norm1 else False
    
    def to_llm_format(self, tables: List[ExtractedTable]) -> Dict[str, Any]:
        """
        Convert tables to format suitable for LLM processing.
        
        Returns structure that LLM can reason about.
        """
        return {
            "tables_detected": len(tables),
            "tables": [
                {
                    "page": table.page + 1,  # 1-indexed for display
                    "page_range": table.page_range,
                    "is_multi_page": table.is_multi_page,
                    "headers": table.headers,
                    "row_count": len(table.rows),
                    "sample_rows": table.rows[:5],  # First 5 rows for context
                    "all_rows": table.rows  # Full data for extraction
                }
                for table in tables
            ]
        }


