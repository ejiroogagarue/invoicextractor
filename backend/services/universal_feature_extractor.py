"""
Universal Feature Extractor
============================
Extracts HINTS from raw OCR text, not answers.

Philosophy:
- Don't try to understand invoice structure
- Extract universal tokens that might be relevant
- Let the LLM do the intelligent mapping

Performance:
- Processing time: ~10-20ms (simple pattern matching)
- Input: Raw OCR text
- Output: Dictionary of hints/tokens for LLM

This replaces the brittle invoice_preprocessor.py with a more adaptive approach.
"""

import re
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass


@dataclass
class InvoiceHints:
    """Hints extracted from invoice text for LLM processing"""
    currency_amounts: List[str]
    dates: List[str]
    companies: List[str]
    tables: List[List[str]]
    labeled_fields: Dict[str, str]
    numbers: List[str]
    potential_invoice_numbers: List[str]
    raw_text_sample: str


class UniversalFeatureExtractor:
    """
    Extract universal features from invoice text.
    
    Strategy:
    - Find all tokens that MIGHT be relevant
    - Don't try to understand what they mean
    - Let GPT-4o Mini map tokens to schema
    
    Example:
        Raw text: "Invoice #12345 Total: $100.00"
        Hints: {
            "currency_amounts": ["100.00"],
            "labeled_fields": {"Invoice": "12345", "Total": "100.00"},
            "potential_invoice_numbers": ["12345"]
        }
    """
    
    def extract(self, raw_text: str) -> Dict[str, Any]:
        """
        Extract universal hints from raw OCR text.
        
        Args:
            raw_text: Raw text extracted by PaddleOCR/PyMuPDF
        
        Returns:
            Dictionary with extracted hints for LLM
        """
        # Defensive check
        if raw_text is None:
            raw_text = ""
        if not isinstance(raw_text, str):
            raw_text = str(raw_text)
        
        # Extract all hint categories
        currency_amounts = self._find_all_money(raw_text)
        dates = self._find_all_dates(raw_text)
        companies = self._find_all_companies(raw_text)
        tables = self._find_table_structures(raw_text)
        labeled_fields = self._find_key_value_pairs(raw_text)
        numbers = self._find_all_numbers(raw_text)
        invoice_numbers = self._find_potential_invoice_numbers(raw_text)
        
        # Log extraction results
        print(f"     Universal hints extracted:")
        print(f"       • Currency amounts: {len(currency_amounts)}")
        print(f"       • Dates found: {len(dates)}")
        print(f"       • Companies: {len(companies)}")
        print(f"       • Tables: {len(tables)} rows")
        print(f"       • Labeled fields: {len(labeled_fields)}")
        print(f"       • Potential invoice #s: {invoice_numbers[:3] if invoice_numbers else []}")
        
        return {
            "currency_amounts": currency_amounts,
            "dates": dates,
            "companies": companies,
            "tables": tables,
            "labeled_fields": labeled_fields,
            "numbers": numbers,
            "potential_invoice_numbers": invoice_numbers,
            "raw_text_sample": raw_text[:1000]  # First 1000 chars for context
        }
    
    def _find_all_money(self, text: str) -> List[str]:
        """
        Find all currency amounts in text.
        
        Patterns:
        - $123.45
        - 123.45 (with 2 decimals)
        - $1,234.56
        """
        amounts: Set[str] = set()
        
        # Pattern 1: With dollar sign
        pattern1 = r'\$\s*([\d,]+\.\d{2})'
        for match in re.finditer(pattern1, text):
            amounts.add(match.group(1).replace(',', ''))
        
        # Pattern 2: Number with exactly 2 decimals (likely currency)
        pattern2 = r'\b(\d{1,10}\.\d{2})\b'
        for match in re.finditer(pattern2, text):
            amount = match.group(1)
            # Filter out dates (like 2025.07) and IDs
            if not any(date_pattern in match.group(0) for date_pattern in ['20', '19']):
                amounts.add(amount)
        
        # Return sorted for consistency
        return sorted(list(amounts), key=lambda x: float(x), reverse=True)
    
    def _find_all_dates(self, text: str) -> List[str]:
        """
        Find all dates in text (any format).
        
        Formats:
        - 2025/07/08
        - 2025-07-08
        - 07/08/2025
        - July 8, 2025
        - Jul 8, 2025
        """
        dates: Set[str] = set()
        
        patterns = [
            r'\d{4}[-/]\d{2}[-/]\d{2}',  # YYYY-MM-DD or YYYY/MM/DD
            r'\d{2}[-/]\d{2}[-/]\d{4}',  # MM-DD-YYYY or DD-MM-YYYY
            r'\d{2}[-/]\d{2}[-/]\d{2}',  # MM-DD-YY
            r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}',  # Month DD, YYYY
        ]
        
        for pattern in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                dates.add(match.group(0))
        
        return list(dates)
    
    def _find_all_companies(self, text: str) -> List[str]:
        """
        Find all company names (entities with legal suffixes).
        
        Patterns:
        - XYZ Inc.
        - ABC LLC
        - Company Corp
        - Studio Ltd
        """
        companies: Set[str] = set()
        
        # Pattern: Words followed by legal entity suffix
        pattern = r'\b([A-Z][A-Za-z\s&\.]+?(?:Inc|LLC|Corp|Ltd|Limited|Co|Studios|Studio)\.?)\b'
        
        for match in re.finditer(pattern, text, re.MULTILINE):
            company = match.group(1).strip()
            if len(company) > 3:  # Filter out false positives
                companies.add(company)
        
        return list(companies)
    
    def _find_table_structures(self, text: str) -> List[List[str]]:
        """
        Find table-like structures (rows with multiple columns).
        
        A row is likely a table row if it has:
        - 3+ numeric values OR
        - Clear column-like spacing
        """
        table_rows: List[List[str]] = []
        
        lines = text.split('\n')
        for line in lines:
            # Skip very short lines
            if len(line.strip()) < 10:
                continue
            
            # Extract all "tokens" (words/numbers) from the line
            tokens = line.split()
            
            # If line has 4+ tokens with at least 2 numbers, it's likely a table row
            numbers_in_line = sum(1 for token in tokens if re.match(r'[\d,]+\.?\d*', token))
            
            if len(tokens) >= 4 and numbers_in_line >= 2:
                table_rows.append(tokens)
        
        return table_rows
    
    def _find_key_value_pairs(self, text: str) -> Dict[str, str]:
        """
        Find labeled fields (Key: Value or Key Value patterns).
        
        Examples:
        - Invoice Number: 12345
        - Total $100.00
        - Date: 2025/07/08
        """
        labeled_fields: Dict[str, str] = {}
        
        # Pattern 1: "Label: Value" (with colon)
        pattern1 = r'([A-Za-z\s]+?):\s*([^\n]+)'
        for match in re.finditer(pattern1, text):
            label = match.group(1).strip()
            value = match.group(2).strip()
            if len(label) <= 30 and len(value) <= 100:  # Reasonable lengths
                labeled_fields[label] = value
        
        # Pattern 2: Common invoice labels without colon
        common_labels = [
            'Invoice Number', 'Invoice', 'Total', 'Subtotal', 'Tax', 
            'Date', 'Due Date', 'Amount', 'Balance'
        ]
        
        for label in common_labels:
            pattern = rf'{label}\s+([^\n]+)'
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                labeled_fields[label] = match.group(1).strip()
        
        return labeled_fields
    
    def _find_all_numbers(self, text: str) -> List[str]:
        """
        Find all standalone numbers (quantities, percentages, counts).
        
        Excludes:
        - Currency amounts (handled separately)
        - Dates (handled separately)
        """
        numbers: Set[str] = set()
        
        # Pattern: Standalone numbers (not part of dates or currency)
        pattern = r'\b(\d+(?:\.\d+)?)\b'
        
        for match in re.finditer(pattern, text):
            number = match.group(1)
            # Filter out years and very long numbers (like IDs)
            if len(number) <= 6 and not (len(number) == 4 and number.startswith('20')):
                numbers.add(number)
        
        return list(numbers)
    
    def _find_potential_invoice_numbers(self, text: str) -> List[str]:
        """
        Find potential invoice numbers.
        
        Patterns:
        - IR-0001425
        - INV-12345
        - #12345
        - Invoice Number: XYZ123
        """
        invoice_numbers: Set[str] = set()
        
        patterns = [
            r'\b([A-Z]{2,3}-\d{5,})\b',  # IR-0001425, INV-12345
            r'\b(INV\d{4,})\b',  # INV12345
            r'#\s*([A-Z0-9-]{5,})\b',  # #12345 or #ABC-123
            r'Invoice\s+(?:Number|#)\s*:?\s*([A-Z0-9-]+)',  # Invoice Number: XYZ
        ]
        
        for pattern in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                invoice_num = match.group(1)
                # Filter out common false positives
                if invoice_num.upper() not in ['INVOICE', 'NUMBER', 'TOTAL']:
                    invoice_numbers.add(invoice_num)
        
        return list(invoice_numbers)


