/**
 * Dashboard.tsx - Results Dashboard Component
 * 
 * DATA FLOW:
 * ==========
 * Displays aggregated results from all processed invoices.
 * 
 * RECEIVES FROM:
 * --------------
 * App.tsx → aggregatedData prop (from backend /ocr/invoice/extract-batch)
 * 
 * DATA STRUCTURE:
 * ---------------
 * aggregatedData = {
 *   summary: {
 *     total_amount: "1,234.56",           // Grand total across all invoices
 *     total_invoices_processed: 5,        // Number of successful invoices
 *     vendors: ["Vendor A", "Vendor B"],  // Unique vendor list
 *     processing_errors: []                // Error messages if any
 *   },
 *   line_items: [{                         // All line items from all invoices
 *     id: "uuid",
 *     item: "Product Name",
 *     quantity: "10",
 *     rate: "$5.00",
 *     amount: "$50.00",
 *     vendor: "Vendor A",
 *     date: "2024-01-15",
 *     source_invoice_number: "INV-001",
 *     confidence: "high"
 *   }],
 *   invoices: { ... }                     // Individual invoice summaries
 * }
 * 
 * FEATURES:
 * ---------
 * 1. Summary Cards: Total $, invoice count, vendor count, errors
 * 2. Search: Filter line items by name
 * 3. Vendor Filter: Show items from specific vendor or all
 * 4. Master Table: Displays all filtered line items
 * 5. CSV Export: Download filtered data as CSV file
 * 
 * CHILD COMPONENTS:
 * -----------------
 * → SummaryCards: Displays summary metrics
 * → MasterTable: Displays line items table
 */

import { useMemo, useState } from "react";
import SummaryCards from "./components/SummaryCards";
import MasterTable from "./components/MasterTable";

interface DashboardProps {
    aggregatedData: {
        summary: {
            total_amount: string;
            total_invoices_processed: number;
            vendors: string[];
            processing_errors: string[];
        };
        line_items: any[];
        invoices: any;
    };
    onReviewInvoice?: (invoiceId: string, invoiceData: any) => void;
}

const Dashboard: React.FC<DashboardProps> = ({aggregatedData, onReviewInvoice}) => {
    // Debug logging
    console.log("Dashboard received aggregatedData:", aggregatedData);
    console.log("Line items count:", aggregatedData.line_items?.length || 0);
    console.log("Invoices:", Object.keys(aggregatedData.invoices || {}));
    
    // State for user filters
    const [searchTerm, setSearchTerm] = useState('');       // Search by item name
    const [vendorFilter, setVendorFilter] = useState('all'); // Filter by vendor
    const [viewMode, setViewMode] = useState<'all' | 'approved' | 'review'>('all'); // NEW: Filter by review status

    // Get a unique list of vendors for the filter dropdown 
    const vendors = useMemo(() => {
        const vendorSet = new Set(aggregatedData.line_items.map(item => item.vendor));
        return ['all', ...Array.from(vendorSet).sort()];
    }, [aggregatedData.line_items]);
    
    // Get invoices by status for filtering
    const invoicesByStatus = useMemo(() => {
        const invoices = Object.entries(aggregatedData.invoices);
        return {
            all: invoices,
            approved: invoices.filter(([_, inv]: [string, any]) => 
                inv.review_status === 'AUTO_APPROVED' || inv.review_status === 'APPROVED_WITH_VERIFICATION'
            ),
            review: invoices.filter(([_, inv]: [string, any]) => 
                inv.review_status === 'REQUIRES_REVIEW'
            )
        };
    }, [aggregatedData.invoices]);

    // Filter items based on search term, vendor filter, and review status
    const filteredItems = useMemo(() => {
        console.log("Filtering items. View mode:", viewMode);
        console.log("Total line items:", aggregatedData.line_items.length);
        
        // Get invoice IDs for current view mode
        const relevantInvoiceIds = new Set(
            invoicesByStatus[viewMode].map(([invoiceId, _]) => invoiceId)
        );
        
        console.log("Relevant invoice IDs for view mode:", Array.from(relevantInvoiceIds));
        
        const filtered = aggregatedData.line_items.filter(item => {
            const matchesSearch = item.item.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesVendor = vendorFilter === 'all' || item.vendor === vendorFilter;
            const matchesViewMode = viewMode === 'all' || relevantInvoiceIds.has(item.source_invoice_id);
            return matchesSearch && matchesVendor && matchesViewMode;
        });
        
        console.log("Filtered items count:", filtered.length);
        return filtered;
    }, [searchTerm, vendorFilter, viewMode, aggregatedData.line_items, invoicesByStatus]);

    const handleExport = () => {
        // Create CSV content
        const headers = ['Item', 'Quantity', 'Rate', 'Amount', 'Vendor', 'Date', 'Invoice Number'];
        const csvRows = [
            headers.join(','),
            ...filteredItems.map(item => [
                `"${item.item}"`,
                item.quantity,
                item.rate,
                item.amount,
                `"${item.vendor}"`,
                item.date,
                item.source_invoice_number
            ].join(','))
        ];
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-data-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div>
            <h2>Dashboard</h2>
        <p>Review your aggregated data. Use the controls below to filter and search.</p>
        <SummaryCards summary={aggregatedData.summary} />
            
            {/* NEW: View Mode Tabs */}
            <div style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                marginBottom: '1.5rem',
                borderBottom: '2px solid #dee2e6'
            }}>
                <button
                    onClick={() => setViewMode('all')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        borderBottom: viewMode === 'all' ? '3px solid #007bff' : '3px solid transparent',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        fontWeight: viewMode === 'all' ? 'bold' : 'normal',
                        color: viewMode === 'all' ? '#007bff' : '#6c757d'
                    }}
                >
                    All Invoices ({invoicesByStatus.all.length})
                </button>
                <button
                    onClick={() => setViewMode('approved')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        borderBottom: viewMode === 'approved' ? '3px solid #28a745' : '3px solid transparent',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        fontWeight: viewMode === 'approved' ? 'bold' : 'normal',
                        color: viewMode === 'approved' ? '#28a745' : '#6c757d'
                    }}
                >
                    ✓ Auto-Approved ({invoicesByStatus.approved.length})
                </button>
                <button
                    onClick={() => setViewMode('review')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        borderBottom: viewMode === 'review' ? '3px solid #ffc107' : '3px solid transparent',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        fontWeight: viewMode === 'review' ? 'bold' : 'normal',
                        color: viewMode === 'review' ? '#ffc107' : '#6c757d'
                    }}
                >
                    ⚠️ Needs Review ({invoicesByStatus.review.length})
                </button>
            </div>
            
            {/* Invoice List with Review Buttons */}
            {onReviewInvoice && (
                <div style={{ marginBottom: '2rem' }}>
                    <h3>Invoices</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                        {invoicesByStatus[viewMode].map(([invoiceId, invoice]: [string, any]) => (
                            <div 
                                key={invoiceId}
                                style={{
                                    padding: '1rem',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '8px',
                                    backgroundColor: 'white',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <strong>{invoiceId}</strong>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        backgroundColor: invoice.review_status === 'AUTO_APPROVED' ? '#d1fae5' : '#fef3c7',
                                        color: invoice.review_status === 'AUTO_APPROVED' ? '#065f46' : '#92400e'
                                    }}>
                                        {invoice.review_status === 'AUTO_APPROVED' ? '✓' : '⚠️'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                                    <div>Vendor: {invoice.vendor}</div>
                                    <div>Date: {invoice.date}</div>
                                    <div>Total: ${invoice.total_amount?.toFixed(2) || '0.00'}</div>
                                    <div>Confidence: {(invoice.confidence?.overall * 100).toFixed(0)}%</div>
                                </div>
                                <button
                                    onClick={() => onReviewInvoice(invoiceId, invoice)}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    📄 Review Invoice
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <h3>Line Items</h3>

        {/* ADD FILTERING CONTROLS  */}
        <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center'}}>
            <input
             type="text"
             placeholder="Search by item name..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             style={{
                flex: 1,
                padding: '0.5rem 1rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
             }}
            />
            <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
            }}
            > 
                    {vendors.map(vendor => <option key={vendor} value={vendor}>{vendor}</option>)}
                </select>
      </div>
      {/* --- END FILTERING CONTROLS --- */}
      
            <MasterTable lineItems={filteredItems} />
      
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button 
                    onClick={handleExport}
                    style={{
                        padding: '0.75rem 2rem',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                    }}
                >
                    Export as CSV
                </button>
            </div>
      </div>
    )
}

export default Dashboard;