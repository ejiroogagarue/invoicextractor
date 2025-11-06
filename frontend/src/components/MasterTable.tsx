/**
 * MasterTable.tsx - Line Items Table Component
 * 
 * DATA FLOW:
 * ==========
 * Displays all line items from all processed invoices in a table.
 * 
 * RECEIVES FROM:
 * --------------
 * Dashboard → lineItems prop (filtered based on search/vendor)
 * 
 * LINE ITEM STRUCTURE:
 * --------------------
 * Each line item contains:
 * - id: Unique UUID for the line item
 * - item: Product/service name
 * - quantity: Number of units
 * - rate: Price per unit
 * - amount: Total cost (quantity × rate)
 * - vendor: Vendor name
 * - date: Invoice date
 * - source_invoice_number: Original invoice number
 * - source_invoice_id: Internal invoice ID
 * - confidence: OCR confidence level ("high"|"medium"|"low")
 * 
 * FEATURES:
 * ---------
 * - Responsive table with alternating row colors
 * - Confidence badges with color coding
 * - Empty state when no items match filters
 * - Item count display
 * 
 * STYLING:
 * --------
 * - Striped rows for better readability
 * - Fixed header styling
 * - Confidence badges: green (high), yellow (medium), red (low)
 */

import React from "react";
import ConfidenceBadge from "./ConfidenceBadge";

interface LineItem {
  id: string;                        // Unique identifier (UUID)
  item: string;                      // Product/service name
  quantity: string;                  // Number of units
  rate: string;                      // Price per unit
  amount: string;                    // Total cost
  vendor: string;                    // Vendor name
  date: string;                      // Invoice date
  source_invoice_number: string;     // Original invoice number
  source_invoice_id: string;         // Internal ID (e.g., "inv-12345")
  confidence: number | string;       // Numeric confidence (0-1) or "high"|"medium"|"low"
  math_valid?: boolean;              // Math validation passed
  calculated_amount?: number;        // Calculated amount for verification
}

interface MasterTableProps {
  lineItems: LineItem[];  // Filtered line items from Dashboard
}

const MasterTable: React.FC<MasterTableProps> = ({ lineItems }) => {
  // Helper to convert confidence to number
  const getConfidenceValue = (conf: number | string): number => {
    if (typeof conf === 'number') return conf;
    if (conf === 'high') return 0.95;
    if (conf === 'medium') return 0.80;
    if (conf === 'low') return 0.60;
    return 0.85; // default
  };
  
  if (lineItems.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#6c757d" }}>
        <p>No line items found. Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          backgroundColor: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#f8f9fa" }}>
            <th style={headerStyle}>Item</th>
            <th style={headerStyle}>Quantity</th>
            <th style={headerStyle}>Rate</th>
            <th style={headerStyle}>Amount</th>
            <th style={headerStyle}>Vendor</th>
            <th style={headerStyle}>Date</th>
            <th style={headerStyle}>Invoice #</th>
            <th style={headerStyle}>Trust</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => {
            const confidenceValue = getConfidenceValue(item.confidence);
            const mathValid = item.math_valid !== false; // default to true if not specified
            
            return (
            <tr
              key={item.id}
              style={{
                backgroundColor: index % 2 === 0 ? "white" : "#f8f9fa",
                borderBottom: "1px solid #dee2e6",
              }}
            >
              <td style={cellStyle}>{item.item}</td>
              <td style={cellStyle}>{item.quantity}</td>
              <td style={cellStyle}>{item.rate}</td>
              <td style={cellStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{item.amount}</span>
                  {/* Show math check if calculated amount is available */}
                  {item.calculated_amount && (
                    <span 
                      style={{ 
                        fontSize: '0.7rem', 
                        color: mathValid ? '#28a745' : '#dc3545' 
                      }}
                      title={mathValid 
                        ? `✓ Math verified: ${item.quantity} × ${item.rate} = ${item.amount}`
                        : `⚠️ Math error: Expected ${item.calculated_amount}`
                      }
                    >
                      {mathValid ? '✓' : '⚠️'}
                    </span>
                  )}
                </div>
              </td>
              <td style={cellStyle}>{item.vendor}</td>
              <td style={cellStyle}>{item.date}</td>
              <td style={cellStyle}>
                <span
                  style={{
                    fontSize: "0.85rem",
                    color: "#6c757d",
                    fontFamily: "monospace",
                  }}
                >
                  {item.source_invoice_number}
                </span>
              </td>
              <td style={cellStyle}>
                <ConfidenceBadge 
                  confidence={confidenceValue}
                  mathValid={mathValid}
                  size="small"
                />
              </td>
            </tr>
          );
          })}
        </tbody>
      </table>
      <div
        style={{
          marginTop: "1rem",
          padding: "0.5rem",
          textAlign: "right",
          color: "#6c757d",
          fontSize: "0.9rem",
        }}
      >
        Showing {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
};

const headerStyle: React.CSSProperties = {
  padding: "0.75rem",
  textAlign: "left",
  fontWeight: "bold",
  borderBottom: "2px solid #dee2e6",
  color: "#495057",
};

const cellStyle: React.CSSProperties = {
  padding: "0.75rem",
  textAlign: "left",
};

export default MasterTable;

