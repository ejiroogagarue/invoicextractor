# services/entities.py
"""
Entity Extraction Service - Finds dates, amounts, emails, etc. in text

DATA FLOW:
==========
INPUT: Plain text or markdown from OCR
PROCESS: Apply regex patterns to find entities
OUTPUT: List of entities with positions and types

CALLED BY:
----------
- routers/ocr.py: _process_single_invoice() - To extract invoice dates
- routers/ocr.py: analyze_pdf() - For general entity extraction

RETURNS TO:
-----------
- List of entity dictionaries with type, text, and position
"""

import re 
from typing import List, Dict 


def extract_entities(text: str) -> List[Dict]:
    """
    Extract entities using regex patterns.
    
    DATA FLOW:
    ----------
    1. Apply regex patterns for each entity type
    2. Find all matches in text
    3. Record match position and text
    4. Return list of all entities found
    
    CALLED BY:
    - _process_single_invoice() in routers/ocr.py (to find dates)
    - analyze_pdf() in routers/ocr.py (general entity extraction)
    
    PARAMETERS:
    -----------
    text: Raw text or markdown to search
    
    RETURNS:
    --------
    [
        {
            "type": "DATE",           # DATE, MONEY, PERCENT, EMAIL, URL, CLAUSE
            "text": "2024-01-15",    # Actual matched text
            "offsetStart": 123,       # Start position in text
            "offsetEnd": 133          # End position in text
        },
        ...
    ]
    
    ENTITY TYPES:
    -------------
    - DATE: Various date formats (MM-DD-YYYY, Month DD YYYY, YYYY-MM-DD)
    - MONEY: Currency amounts ($1,234.56, 100.00 dollars)
    - PERCENT: Percentage values (10%, 5.5%)
    - EMAIL: Email addresses
    - URL: Web URLs
    - CLAUSE: Legal clauses (Clause 1, Section 2.3)
    """
    entities = []
    
    #Date patterns 
    date_patterns = [
        r'\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b',  # MM-DD-YYYY
        r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b',  # Month DD, YYYY
        r'\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b'  # YYYY-MM-DD
    ]
    
    # Money patterns
    money_patterns = [
        r'\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b',  # $1,000.00
        r'\b\d+(?:\.\d{2})?\s*(?:dollars|USD)\b'  # 100.00 dollars
    ]
    
    # Percent patterns
    percent_patterns = [r'\b\d+(?:\.\d+)?%']
    
    # Email patterns
    email_patterns = [r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b']
    
    # URL patterns
    url_patterns = [r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+[/\w\.-]*\??[/\w\.-=&%]*']
    
    # Clause patterns
    clause_patterns = [r'[Cc]lause\s+\d+(?:\.\d+)*', r'[Ss]ection\s+\d+(?:\.\d+)*']
    
    patterns = {
        "DATE": date_patterns,
        "MONEY": money_patterns,
        "PERCENT": percent_patterns,
        "EMAIL": email_patterns,
        "URL": url_patterns,
        "CLAUSE": clause_patterns
    }
    
    for entity_type, pattern_list in patterns.items():
        for pattern in pattern_list:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                entities.append({
                    "type": entity_type,
                    "offsetStart": match.start(),
                    "offsetEnd": match.end(),
                    "text": match.group()
                })
    
    return entities
    