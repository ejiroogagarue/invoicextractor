# services/validation.py
"""
Validation Service - Mathematical integrity and trust validation for accounting

CORE PRINCIPLE:
===============
In accounting, numbers must reconcile. This module ensures:
1. Line items calculate correctly (quantity × rate = amount)
2. Subtotals sum correctly
3. Grand totals include all fees/discounts
4. Any discrepancy is flagged for human review

DATA FLOW:
==========
INPUT: Extracted invoice data (from OCR)
PROCESS: Validate all mathematical relationships
OUTPUT: Validation results with pass/fail status

CALLED BY:
----------
- routers/ocr.py: _process_single_invoice() - After extraction
"""

import re
from typing import Dict, List, Any
from decimal import Decimal, InvalidOperation


def parse_currency(value: str) -> float:
    """
    Parse currency string to float, handling various formats.
    
    Examples:
    - "$1,234.56" → 1234.56
    - "1234.56" → 1234.56
    - "$1.234,56" → 1234.56 (European format)
    - "(123.45)" → -123.45 (negative/credit)
    """
    if not value:
        return 0.0
    
    # Convert to string if not already
    value = str(value)
    
    # Handle negative values in parentheses
    is_negative = value.strip().startswith('(') and value.strip().endswith(')')
    if is_negative:
        value = value.strip('()')
    
    # Remove currency symbols and spaces
    value = re.sub(r'[$€£¥\s]', '', value)
    
    # Handle different decimal separators
    # If comma is decimal separator (European): 1.234,56
    if ',' in value and '.' in value:
        if value.rindex(',') > value.rindex('.'):
            # European format: 1.234,56
            value = value.replace('.', '').replace(',', '.')
        else:
            # US format: 1,234.56
            value = value.replace(',', '')
    elif ',' in value:
        # Could be either 1,234 (US thousands) or 1,23 (European decimal)
        # Heuristic: if last comma is 3 digits from end, it's thousands
        last_comma_pos = value.rindex(',')
        if len(value) - last_comma_pos - 1 == 3:
            value = value.replace(',', '')  # US thousands
        else:
            value = value.replace(',', '.')  # European decimal
    
    try:
        result = float(value)
        return -result if is_negative else result
    except ValueError:
        print(f"WARNING: Could not parse currency value: {value}")
        return 0.0


def validate_line_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate a single line item: quantity × rate = amount
    
    Returns:
    {
        'valid': bool,
        'quantity': float,
        'rate': float,
        'calculated_amount': float,
        'stated_amount': float,
        'difference': float,
        'confidence': float
    }
    """
    try:
        # Parse values
        quantity = float(item.get('quantity', 0))
        rate = parse_currency(item.get('rate', '0'))
        stated_amount = parse_currency(item.get('amount', '0'))
        
        # Calculate expected amount
        calculated_amount = quantity * rate
        
        # Calculate difference (accounting for floating point)
        difference = abs(calculated_amount - stated_amount)
        
        # Validate (allow 1 cent tolerance for rounding, including exactly 1 cent)
        is_valid = difference <= 0.01
        
        # Calculate confidence based on difference
        if is_valid:
            confidence = 0.99
        elif difference < 0.10:
            confidence = 0.90  # Close, might be rounding
        elif difference < 1.00:
            confidence = 0.70  # Small discrepancy
        else:
            confidence = 0.30  # Large discrepancy
        
        return {
            'valid': is_valid,
            'quantity': quantity,
            'rate': rate,
            'calculated_amount': round(calculated_amount, 2),
            'stated_amount': stated_amount,
            'difference': round(difference, 2),
            'confidence': confidence,
            'error': None
        }
    
    except (ValueError, TypeError, InvalidOperation) as e:
        return {
            'valid': False,
            'quantity': None,
            'rate': None,
            'calculated_amount': None,
            'stated_amount': None,
            'difference': None,
            'confidence': 0.0,
            'error': f"Parse error: {str(e)}"
        }


def validate_invoice_math(invoice_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Comprehensive mathematical validation of entire invoice.
    
    Validates:
    1. Each line item (quantity × rate = amount)
    2. Subtotal = sum of line items
    3. Total = subtotal + shipping - discount + tax
    
    Returns validation results with detailed breakdown.
    """
    results = {
        'line_items_valid': True,
        'subtotal_valid': True,
        'total_valid': True,
        'overall_valid': True,
        'line_items': [],
        'errors': [],
        'warnings': []
    }
    
    # Validate each line item
    line_items = invoice_data.get('line_items', [])
    if not line_items:
        results['warnings'].append({
            'severity': 'MEDIUM',
            'field': 'line_items',
            'message': 'No line items found in invoice'
        })
    
    line_item_sum = 0.0
    for i, item in enumerate(line_items):
        validation = validate_line_item(item)
        results['line_items'].append(validation)
        
        if not validation['valid']:
            results['line_items_valid'] = False
            results['errors'].append({
                'severity': 'CRITICAL',
                'field': f'line_item_{i}',
                'item_name': item.get('item', 'Unknown'),
                'message': f"Line item calculation error: {validation['quantity']} × {validation['rate']} = {validation['calculated_amount']}, but invoice shows {validation['stated_amount']}",
                'difference': validation['difference'],
                'action_required': 'VERIFY_WITH_PDF'
            })
        
        # Add to sum (use stated amount for subtotal validation)
        if validation['stated_amount'] is not None:
            line_item_sum += validation['stated_amount']
    
    # Validate subtotal
    stated_subtotal = parse_currency(invoice_data.get('subtotal', '0'))
    if stated_subtotal > 0:
        subtotal_difference = abs(line_item_sum - stated_subtotal)
        
        if subtotal_difference >= 0.01:
            results['subtotal_valid'] = False
            results['errors'].append({
                'severity': 'CRITICAL',
                'field': 'subtotal',
                'message': f"Subtotal mismatch: Line items sum to ${line_item_sum:.2f}, but invoice shows ${stated_subtotal:.2f}",
                'calculated': round(line_item_sum, 2),
                'stated': stated_subtotal,
                'difference': round(subtotal_difference, 2),
                'action_required': 'VERIFY_WITH_PDF'
            })
        
        results['calculated_subtotal'] = round(line_item_sum, 2)
        results['stated_subtotal'] = stated_subtotal
    else:
        # No subtotal provided, use calculated
        results['calculated_subtotal'] = round(line_item_sum, 2)
        results['stated_subtotal'] = None
    
    # Validate grand total
    stated_total = parse_currency(invoice_data.get('total_amount', '0'))
    
    if stated_total > 0:
        # Calculate expected total
        subtotal_for_calc = stated_subtotal if stated_subtotal > 0 else line_item_sum
        shipping = parse_currency(invoice_data.get('shipping', '0'))
        discount = parse_currency(invoice_data.get('discount_amount', '0'))
        tax = parse_currency(invoice_data.get('tax', '0'))
        
        calculated_total = subtotal_for_calc + shipping - discount + tax
        total_difference = abs(calculated_total - stated_total)
        
        if total_difference >= 0.01:
            results['total_valid'] = False
            results['errors'].append({
                'severity': 'CRITICAL',
                'field': 'total',
                'message': f"Total mismatch: Calculated ${calculated_total:.2f}, but invoice shows ${stated_total:.2f}",
                'calculation_breakdown': {
                    'subtotal': subtotal_for_calc,
                    'shipping': shipping,
                    'discount': discount,
                    'tax': tax,
                    'calculated_total': round(calculated_total, 2),
                    'stated_total': stated_total
                },
                'difference': round(total_difference, 2),
                'action_required': 'VERIFY_WITH_PDF'
            })
        
        results['calculated_total'] = round(calculated_total, 2)
        results['stated_total'] = stated_total
        results['total_difference'] = round(total_difference, 2)
    
    # Set overall validity
    results['overall_valid'] = (
        results['line_items_valid'] and 
        results['subtotal_valid'] and 
        results['total_valid']
    )
    
    return results


def calculate_validation_confidence(validation_results: Dict[str, Any]) -> float:
    """
    Calculate confidence score based on validation results.
    
    For accounting: Math validation is paramount.
    - All valid: 1.0
    - Minor discrepancies: 0.7-0.9
    - Major discrepancies: 0.3-0.6
    - Critical errors: 0.0-0.2
    """
    if validation_results['overall_valid']:
        return 1.0
    
    # Count error severity
    critical_errors = len([e for e in validation_results['errors'] if e['severity'] == 'CRITICAL'])
    
    if critical_errors == 0:
        return 0.95  # Valid but has warnings
    elif critical_errors == 1:
        return 0.60  # One critical issue
    elif critical_errors == 2:
        return 0.40  # Two critical issues
    else:
        return 0.20  # Multiple critical issues


def determine_review_status(confidence: float, validation_results: Dict[str, Any], 
                           has_critical_fields: bool) -> Dict[str, Any]:
    """
    Determine if invoice can be auto-approved or needs review.
    
    ACCOUNTING RULES:
    1. Math errors = ALWAYS review (even if 99% confidence)
    2. Missing critical fields = ALWAYS review
    3. High confidence + valid math = Auto-approve
    4. Medium confidence + valid math = Approve with note
    5. Everything else = Review required
    """
    # Rule 1: Math errors = ALWAYS review
    if not validation_results['overall_valid']:
        return {
            'status': 'REQUIRES_REVIEW',
            'reason': 'MATH_VALIDATION_FAILED',
            'severity': 'CRITICAL',
            'auto_approve': False,
            'message': 'Mathematical discrepancies detected. Manual verification required.'
        }
    
    # Rule 2: Missing critical fields = ALWAYS review
    if not has_critical_fields:
        return {
            'status': 'REQUIRES_REVIEW',
            'reason': 'MISSING_CRITICAL_FIELDS',
            'severity': 'CRITICAL',
            'auto_approve': False,
            'message': 'Required fields missing. Manual entry required.'
        }
    
    # Rule 3: High confidence + valid math = Auto-approve
    if confidence >= 0.95:
        return {
            'status': 'AUTO_APPROVED',
            'reason': 'HIGH_CONFIDENCE_AND_VALIDATED',
            'severity': 'NONE',
            'auto_approve': True,
            'message': 'All validations passed. Approved automatically.'
        }
    
    # Rule 4: Good confidence + valid math = Approved with verification
    if confidence >= 0.85:
        return {
            'status': 'APPROVED_WITH_VERIFICATION',
            'reason': 'MATH_VALIDATED_MEDIUM_CONFIDENCE',
            'severity': 'LOW',
            'auto_approve': True,
            'message': 'Math validated but some fields have medium confidence. Review recommended but not required.'
        }
    
    # Rule 5: Everything else = Review required
    return {
        'status': 'REQUIRES_REVIEW',
        'reason': 'BELOW_CONFIDENCE_THRESHOLD',
        'severity': 'MEDIUM',
        'auto_approve': False,
        'message': 'Confidence below threshold. Manual review required.'
    }

