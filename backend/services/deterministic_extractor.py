"""
Deterministic Extractor
=======================
Regex-based extraction for obvious line items (quantity × rate = amount).

This extractor processes structured tables WITHOUT using the LLM, dramatically
reducing cost and improving speed for clear, well-formatted data.

Strategy:
1. Identify tables with clear qty/rate/amount columns
2. Parse numeric values using regex
3. Validate: quantity × rate ≈ amount (within tolerance)
4. Return high-confidence items + ambiguous rows for LLM processing
"""

import re
from typing import Dict, Any, List, Optional, Tuple


class DeterministicExtractor:
    """
    Extract line items from structured tables using regex and math validation.
    """
    
    def __init__(self):
        # Regex patterns
        self.money_pattern = re.compile(r'-?\$?\s*([\d,]+\.?\d*)')
        self.number_pattern = re.compile(r'([\d,]+\.?\d*)')
        
        # Validation tolerance (1% or 1 cent)
        self.amount_tolerance = 0.01
        self.percentage_tolerance = 0.01
    
    def extract_line_items(
        self,
        tables: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
        """
        Extract line items from tables.
        
        Args:
            tables: List of table dictionaries with headers and rows
        
        Returns:
            Tuple of:
            - deterministic_items: High-confidence items (no LLM needed)
            - ambiguous_rows: Rows that need LLM processing
            - stats: Extraction statistics
        """
        deterministic_items: List[Dict[str, Any]] = []
        ambiguous_rows: List[Dict[str, Any]] = []
        
        stats = {
            "tables_processed": 0,
            "rows_scanned": 0,
            "deterministic_count": 0,
            "ambiguous_count": 0,
            "skipped_count": 0,
            "row_types": {},
        }
        
        for table in tables or []:
            stats["tables_processed"] += 1
            
            headers = [str(h or "").strip().lower() for h in table.get("headers", [])]
            rows = table.get("all_rows", []) or []
            annotations = table.get("row_annotations", []) or []
            
            if not headers or not rows:
                continue
            
            # Find column indices
            item_idx = self._find_header_index(headers, ["item", "description", "product", "service", "name"])
            qty_idx = self._find_header_index(headers, ["qty", "quantity", "hours", "units"])
            rate_idx = self._find_header_index(headers, ["rate", "price", "unit", "cost"])
            amount_idx = self._find_header_index(headers, ["amount", "total", "line", "cost", "price"])
            
            # Skip tables without key columns
            if item_idx is None or amount_idx is None:
                stats["skipped_count"] += len(rows)
                continue
            
            for row_index, row in enumerate(rows):
                stats["rows_scanned"] += 1
                
                if not row or len(row) <= max(item_idx, amount_idx):
                    continue
                
                # Get annotation if available
                annotation = annotations[row_index] if row_index < len(annotations) else {}
                row_type = annotation.get("row_type", "line_item")
                stats["row_types"][row_type] = stats["row_types"].get(row_type, 0) + 1
                
                # Skip non-line-item rows (subtotals, etc.)
                if row_type != "line_item":
                    continue
                
                # Extract item name
                item_name = self._clean_cell(row[item_idx])
                if not item_name or len(item_name) < 2:
                    continue
                
                # Extract amount (required)
                amount = self._parse_money(row[amount_idx]) if amount_idx < len(row) else None
                if amount is None:
                    # Try annotation
                    amount = annotation.get("amount")
                
                if amount is None:
                    ambiguous_rows.append({
                        "table_id": table.get("table_id"),
                        "row_index": row_index,
                        "row": row,
                        "reason": "no_amount",
                    })
                    stats["ambiguous_count"] += 1
                    continue
                
                # Extract quantity and rate (optional but helpful for validation)
                quantity = None
                if qty_idx is not None and qty_idx < len(row):
                    quantity = self._parse_number(row[qty_idx])
                
                rate = None
                if rate_idx is not None and rate_idx < len(row):
                    rate = self._parse_money(row[rate_idx])
                
                # Validate math if we have all three values
                is_confident = True
                if quantity is not None and rate is not None and amount is not None:
                    expected_amount = quantity * rate
                    diff = abs(expected_amount - amount)
                    
                    # Check if math is correct (within tolerance)
                    if diff > self.amount_tolerance and diff / max(amount, 0.01) > self.percentage_tolerance:
                        # Math doesn't match - send to LLM
                        ambiguous_rows.append({
                            "table_id": table.get("table_id"),
                            "row_index": row_index,
                            "row": row,
                            "reason": "math_mismatch",
                            "expected": expected_amount,
                            "actual": amount,
                        })
                        stats["ambiguous_count"] += 1
                        is_confident = False
                
                if is_confident:
                    # High confidence - add to deterministic items
                    deterministic_items.append({
                        "item_name": item_name,
                        "description": None,
                        "product_code": None,
                        "quantity": quantity if quantity is not None else 1,
                        "rate": rate if rate is not None else amount,
                        "amount": amount,
                        "_source": "deterministic",
                        "_source_table_id": table.get("table_id"),
                        "_source_row_index": row_index,
                        "_source_section": table.get("section_label"),
                        "_source_page": table.get("page"),
                        "_source_snippet": " | ".join(str(cell) for cell in row),
                        "_row_type": row_type,
                        "_confidence": "high",
                    })
                    stats["deterministic_count"] += 1
        
        return deterministic_items, ambiguous_rows, stats
    
    def _find_header_index(self, headers: List[str], keywords: List[str]) -> Optional[int]:
        """Find index of header containing any keyword."""
        for idx, header in enumerate(headers):
            cleaned = header.lower().replace(" ", "")
            for keyword in keywords:
                if keyword in cleaned:
                    return idx
        return None
    
    def _clean_cell(self, value: Any) -> str:
        """Clean and normalize cell value."""
        if value is None:
            return ""
        text = str(value).strip()
        # Remove common noise
        text = text.replace("*", "").replace("†", "").strip()
        return text
    
    def _parse_money(self, value: Any) -> Optional[float]:
        """Parse money value from cell."""
        if value is None:
            return None
        
        text = str(value).strip()
        if not text:
            return None
        
        # Remove currency symbols and commas
        text = text.replace("$", "").replace("USD", "").replace(",", "").strip()
        
        # Handle parentheses as negative
        if text.startswith("(") and text.endswith(")"):
            text = "-" + text[1:-1]
        
        try:
            return float(text)
        except (ValueError, TypeError):
            return None
    
    def _parse_number(self, value: Any) -> Optional[float]:
        """Parse numeric value from cell."""
        if value is None:
            return None
        
        text = str(value).strip()
        if not text:
            return None
        
        # Remove commas
        text = text.replace(",", "").strip()
        
        try:
            return float(text)
        except (ValueError, TypeError):
            return None
    
    def is_confident(self, item: Dict[str, Any]) -> bool:
        """
        Check if an item is high-confidence (math validates).
        
        Args:
            item: Line item dictionary
        
        Returns:
            True if quantity × rate ≈ amount
        """
        qty = item.get("quantity")
        rate = item.get("rate")
        amount = item.get("amount")
        
        if qty is None or rate is None or amount is None:
            return False
        
        expected = qty * rate
        diff = abs(expected - amount)
        
        return diff <= self.amount_tolerance or diff / max(amount, 0.01) <= self.percentage_tolerance





