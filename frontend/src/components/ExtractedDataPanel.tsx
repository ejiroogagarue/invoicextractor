/**
 * ExtractedDataPanel Component
 * 
 * DATA FLOW:
 * ==========
 * Displays extracted invoice data in structured format
 * Shows confidence badges for each field
 * Displays line items in editable table
 * Shows financial summary with math validation
 * 
 * TRUST INDICATORS:
 * ✅ Green = High confidence (>95%)
 * ⚠️ Yellow = Medium confidence (70-95%)
 * ❌ Red = Low confidence (<70%) or math error
 */

import React from 'react';
import ConfidenceBadge from './ConfidenceBadge';
import './ExtractedDataPanel.css';

interface ExtractedDataPanelProps {
  data: any;
  onApprove: () => void;
  onReject: () => void;
  onFieldClick?: (fieldName: string, value: string) => void;
}

export const ExtractedDataPanel: React.FC<ExtractedDataPanelProps> = ({
  data,
  onApprove,
  onReject,
  onFieldClick,
}) => {
  const overallConfidence = data.confidence?.overall || 0;
  const mathValid = data.math_validation?.overall_valid !== false;

  return (
    <div className="extracted-data-panel">
      {/* Invoice Header Fields */}
      <section className="data-section header-fields">
        <h4>Invoice Information</h4>
        
        <div 
          className={`field-row ${onFieldClick ? 'clickable' : ''}`}
          onClick={() => onFieldClick?.('Invoice Number', data.invoice_number)}
          title={onFieldClick ? '🔍 Click to see this in the PDF' : ''}
        >
          <label>Invoice #:</label>
          <span className="field-value">{data.invoice_number || 'Unknown'}</span>
          <ConfidenceBadge 
            confidence={overallConfidence}
            mathValid={true}
          />
        </div>

        <div 
          className={`field-row ${onFieldClick ? 'clickable' : ''}`}
          onClick={() => onFieldClick?.('Date', data.date)}
          title={onFieldClick ? '🔍 Click to see this in the PDF' : ''}
        >
          <label>Date:</label>
          <span className="field-value">{data.date || 'Unknown'}</span>
          <ConfidenceBadge 
            confidence={overallConfidence}
            mathValid={true}
          />
        </div>

        <div 
          className={`field-row ${onFieldClick ? 'clickable' : ''}`}
          onClick={() => onFieldClick?.('Vendor', data.vendor_name)}
          title={onFieldClick ? '🔍 Click to see this in the PDF' : ''}
        >
          <label>Vendor:</label>
          <span className="field-value">{data.vendor_name || 'Unknown'}</span>
          <ConfidenceBadge 
            confidence={overallConfidence}
            mathValid={true}
          />
        </div>

        {data.customer && (
          <div className="field-row">
            <label>Customer:</label>
            <span className="field-value">
              {typeof data.customer === 'string' 
                ? data.customer 
                : data.customer.name || 'N/A'}
            </span>
            <ConfidenceBadge 
              confidence={overallConfidence * 0.9}
              mathValid={true}
            />
          </div>
        )}
      </section>

      {/* Line Items Table */}
      <section className="data-section line-items-section">
        <h4>Line Items ({data.line_items?.length || 0})</h4>
        
        <div className="table-container">
          <table className="line-items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Trust</th>
              </tr>
            </thead>
            <tbody>
              {data.line_items && data.line_items.length > 0 ? (
                data.line_items.map((item: any, idx: number) => {
                  const itemValidation = data.math_validation?.line_items?.[idx];
                  const itemValid = itemValidation?.valid !== false;
                  const itemConfidence = item.confidence || overallConfidence;

                  return (
                    <tr key={idx} className={!itemValid ? 'invalid-row' : ''}>
                      <td className="item-name">
                        {item.item || item.item_name || 'Unknown Item'}
                        {item.description && (
                          <span className="item-description">{item.description}</span>
                        )}
                      </td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">${parseFloat(item.rate || 0).toFixed(2)}</td>
                      <td className="text-right amount-cell">
                        ${parseFloat(item.amount || 0).toFixed(2)}
                        {itemValidation && !itemValid && (
                          <span className="math-error" title={`Expected: $${itemValidation.calculated_amount}`}>
                            ⚠️
                          </span>
                        )}
                        {itemValidation && itemValid && (
                          <span className="math-valid" title="Math verified">✓</span>
                        )}
                      </td>
                      <td className="text-center">
                        <ConfidenceBadge 
                          confidence={itemConfidence}
                          mathValid={itemValid}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="no-items">No line items found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Financial Summary */}
      <section className="data-section financial-summary">
        <h4>Financial Summary</h4>
        
        <div className="summary-rows">
          <div className="summary-row">
            <span className="label">Subtotal:</span>
            <span className="value">${parseFloat(data.subtotal || 0).toFixed(2)}</span>
            {data.math_validation?.subtotal_valid !== false ? (
              <span className="math-valid">✓</span>
            ) : (
              <span className="math-error" title="Subtotal doesn't match sum of line items">⚠️</span>
            )}
          </div>

          {data.shipping > 0 && (
            <div className="summary-row">
              <span className="label">Shipping:</span>
              <span className="value">${parseFloat(data.shipping || 0).toFixed(2)}</span>
            </div>
          )}

          {data.discount_amount > 0 && (
            <div className="summary-row discount">
              <span className="label">Discount:</span>
              <span className="value">-${parseFloat(data.discount_amount || 0).toFixed(2)}</span>
            </div>
          )}

          {data.tax > 0 && (
            <div className="summary-row">
              <span className="label">Tax:</span>
              <span className="value">${parseFloat(data.tax || 0).toFixed(2)}</span>
            </div>
          )}

          <div 
            className={`summary-row total ${onFieldClick ? 'clickable' : ''}`}
            onClick={() => onFieldClick?.('Total Amount', String(data.total_amount))}
            title={onFieldClick ? '🔍 Click to see this in the PDF' : ''}
          >
            <span className="label">Grand Total:</span>
            <span className="value">${parseFloat(data.total_amount || 0).toFixed(2)}</span>
            {data.math_validation?.total_valid !== false ? (
              <span className="math-valid">✓</span>
            ) : (
              <span className="math-error" title="Total doesn't match calculation">⚠️</span>
            )}
            <ConfidenceBadge 
              confidence={data.confidence?.validation || overallConfidence}
              mathValid={mathValid}
            />
          </div>
        </div>
      </section>

      {/* Validation Messages */}
      {data.math_validation?.errors && data.math_validation.errors.length > 0 && (
        <section className="data-section validation-errors">
          <h4>⚠️ Validation Issues</h4>
          {data.math_validation.errors.map((error: any, idx: number) => (
            <div key={idx} className="error-message">
              <strong>{error.type}:</strong> {error.message}
            </div>
          ))}
        </section>
      )}

      {/* Review Actions */}
      <section className="review-actions">
        <button 
          onClick={onApprove} 
          className="btn-approve"
          disabled={!mathValid}
        >
          {mathValid ? '✓ Approve Invoice' : '⚠️ Fix Errors First'}
        </button>
        <button 
          onClick={onReject} 
          className="btn-reject"
        >
          🔍 Needs Review
        </button>
      </section>

      {/* Metadata */}
      <section className="data-section metadata">
        <details>
          <summary>📊 Extraction Details</summary>
          <div className="metadata-content">
            <div className="meta-row">
              <span>Extraction Confidence:</span>
              <span>{(data.confidence?.extraction * 100).toFixed(0)}%</span>
            </div>
            <div className="meta-row">
              <span>Validation Confidence:</span>
              <span>{(data.confidence?.validation * 100).toFixed(0)}%</span>
            </div>
            <div className="meta-row">
              <span>Review Status:</span>
              <span>{data.review_status}</span>
            </div>
            <div className="meta-row">
              <span>Auto-Approve:</span>
              <span>{data.auto_approve ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
};

export default ExtractedDataPanel;

