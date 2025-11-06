/**
 * SummaryCards.tsx - Summary Metrics Display Component
 * 
 * DATA FLOW:
 * ==========
 * Displays high-level summary metrics from all processed invoices.
 * 
 * RECEIVES FROM:
 * --------------
 * Dashboard → summary prop (from aggregatedData.summary)
 * 
 * DISPLAYS:
 * ---------
 * 1. Total Amount: Sum of all invoices (formatted with $ sign)
 * 2. Invoices Processed: Count of successfully processed invoices
 * 3. Unique Vendors: Number of different vendors
 * 4. Errors: Number of processing errors (if any)
 * 
 * LAYOUT:
 * -------
 * Responsive grid that adapts to screen size:
 * - Desktop: 4 cards in a row
 * - Tablet: 2 cards in a row
 * - Mobile: 1 card per row
 * 
 * ERROR CARD:
 * -----------
 * Only displayed if there are processing errors (conditional rendering)
 */

interface SummaryCardsProps {
  summary: {
    total_amount: string;              // Formatted: "$1,234.56"
    total_invoices_processed: number;  // Count of successful invoices
    vendors: string[];                 // Array of unique vendor names
    processing_errors: string[];       // Array of error messages
    // NEW: Validation statistics
    auto_approved_count?: number;      // Auto-approved invoices
    needs_review_count?: number;       // Invoices needing review
    math_errors_count?: number;        // Invoices with math errors
    average_confidence?: number;       // Average confidence (0-1)
  };
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  // Calculate approval rate
  const approvalRate = summary.auto_approved_count && summary.total_invoices_processed
    ? Math.round((summary.auto_approved_count / summary.total_invoices_processed) * 100)
    : 0;
  
  // Format average confidence
  const avgConfidence = summary.average_confidence 
    ? Math.round(summary.average_confidence * 100)
    : 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "1.5rem",
        marginBottom: "2rem",
      }}
    >
      {/* Total Amount Card */}
      <div className="summary-card">
        <h3>Total Amount</h3>
        <p className="summary-value">${summary.total_amount}</p>
      </div>
      
      {/* Invoices Processed Card */}
      <div className="summary-card">
        <h3>Invoices Processed</h3>
        <p className="summary-value">{summary.total_invoices_processed}</p>
        <p style={{ fontSize: '0.8rem', color: '#6c757d', marginTop: '0.25rem' }}>
          {summary.auto_approved_count || 0} auto-approved
        </p>
      </div>
      
      {/* Unique Vendors Card */}
      <div className="summary-card">
        <h3>Unique Vendors</h3>
        <p className="summary-value">{summary.vendors.length}</p>
      </div>
      
      {/* NEW: Average Confidence Card */}
      <div 
        className="summary-card" 
        style={{
          borderLeft: `4px solid ${
            avgConfidence >= 95 ? '#28a745' : 
            avgConfidence >= 75 ? '#ffc107' : '#dc3545'
          }`
        }}
      >
        <h3>Avg Confidence</h3>
        <p className="summary-value">
          {avgConfidence}%
        </p>
        <p style={{ fontSize: '0.8rem', color: '#6c757d', marginTop: '0.25rem' }}>
          {approvalRate}% auto-approved
        </p>
      </div>
      
      {/* NEW: Review Status Card (if any need review) */}
      {(summary.needs_review_count && summary.needs_review_count > 0) && (
        <div 
          className="summary-card" 
          style={{ 
            borderLeft: '4px solid #ffc107',
            backgroundColor: '#fffbf0'
          }}
        >
          <h3>⚠️ Needs Review</h3>
          <p className="summary-value">{summary.needs_review_count}</p>
          <p style={{ fontSize: '0.8rem', color: '#856404', marginTop: '0.25rem' }}>
            Review recommended
          </p>
        </div>
      )}
      
      {/* Math Errors Card (critical) */}
      {(summary.math_errors_count && summary.math_errors_count > 0) && (
        <div 
          className="summary-card error-card" 
          style={{ 
            borderLeft: '4px solid #dc3545',
            backgroundColor: '#f8d7da'
          }}
        >
          <h3>🚨 Math Errors</h3>
          <p className="summary-value">{summary.math_errors_count}</p>
          <p style={{ fontSize: '0.8rem', color: '#721c24', marginTop: '0.25rem' }}>
            Requires verification
          </p>
        </div>
      )}
      
      {/* Processing Errors Card */}
      {summary.processing_errors.length > 0 && (
        <div className="summary-card error-card">
          <h3>Processing Errors</h3>
          <p className="summary-value">{summary.processing_errors.length}</p>
        </div>
      )}
    </div>
  );
};


export default SummaryCards;