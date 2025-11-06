# services/structure.py
"""
Document Structure Parser - Extracts document structure from markdown

DATA FLOW:
==========
INPUT: Markdown text from Mistral OCR
PROCESS: Find headings and create section hierarchy
OUTPUT: List of sections with offsets

CALLED BY:
----------
- routers/ocr.py: analyze_pdf() - For document structure analysis

RETURNS TO:
-----------
- List of section dictionaries used for document navigation
"""

import re
from typing import List, Dict


def parse_sections(markdown: str) -> List[Dict]:
    """
    Parse markdown into sections with headings and content ranges.
    
    DATA FLOW:
    ----------
    1. Split markdown into lines
    2. Find lines that match heading pattern (# Heading)
    3. Track start/end offsets for each section
    4. Return structured section data
    
    CALLED BY: analyze_pdf() in routers/ocr.py
    
    PARAMETERS:
    -----------
    markdown: Full markdown text from OCR
    
    RETURNS:
    --------
    [
        {
            "id": "s-1",
            "title": "Section Title",
            "level": 1,              # 1-6 (# to ######)
            "startOffset": 0,        # Character position in markdown
            "endOffset": 234
        },
        ...
    ]
    
    NOTE: Used for document navigation in frontend (not currently used in invoice flow)
    """
    sections = []
    lines = markdown.split('\n')
    current_section = None 
    content_start = 0
    
    for i, line in enumerate(lines):
        heading_match = re.match(r'^(#{1,6})\s+(.+)$', line.strip())
        
        if heading_match:
            #Save previous section if exists 
            if current_section:
                current_section['endoffset'] = content_start
                sections.append(current_section)
                
            # Start new section 
            level = len(heading_match.group(1))
            title = heading_match.group(2).strip()
            section_id = f"s-{len(sections) + 1}"
            
            current_section = {
                "id": section_id,
                "title": title,
                "level": level,
                "startOffset": content_start,
                "endOffset": len(markdown) # Default to end, will update later
            }
        
        content_start += len(line) + 1 # +1 for newline
    
    #Add the last section 
    if current_section:
        current_section["endOffset"] = len(markdown)
        sections.append(current_section)
        
    # If no sections found, create one big section 
    if not sections:
        sections = [{
            "id": "s-1",
            "title": "Document",
            "level": 1,
            "startOffset": 0,
            "endOffset": len(markdown)
        }]
    
    return sections

def create_abstract(text: str, sentence_count: int = 2) -> str:
    """Create abstract from first few sentences (heuristic-based)"""
    sentences = re.split(r'[.!?]+', text)
    abstract = ' '.join(sentences[:sentence_count]).strip()
    if abstract and not abstract.endswith('.'):
        abstract += '.'
    return abstract
