/**
 * App.tsx - Main Application Component
 * 
 * DATA FLOW OVERVIEW:
 * ===================
 * This is the orchestrator for the entire invoice processing flow.
 * 
 * FLOW STAGES:
 * ------------
 * 1. UPLOAD MODE: User selects invoice files
 *    → UploadArea component handles file selection
 *    → Files stored in state
 * 
 * 2. PROCESSING MODE: Files sent to backend
 *    → handleProcessInvoices() sends FormData to backend
 *    → Backend: POST /ocr/invoice/extract-batch
 *    → ProcessingView shows animated progress
 * 
 * 3. DASHBOARD MODE: Display results
 *    → Backend returns aggregated data
 *    → Dashboard component displays summary + line items
 *    → User can filter, search, and export CSV
 * 
 * STATE MANAGEMENT:
 * -----------------
 * - mode: Current view (upload | processing | dashboard)
 * - files: Array of File objects selected by user
 * - aggregatedData: Complete response from backend
 * - processingStatus: Status of each file (pending | complete | error)
 * - error: Error message if processing fails
 * 
 * BACKEND CONNECTION:
 * -------------------
 * API Endpoint: POST http://localhost:8000/ocr/invoice/extract-batch
 * Request: FormData with multiple files
 * Response: AggregatedData (see interface below)
 */

import { useState } from "react";
import "./App.css";
import UploadArea from "./components/UploadArea";
import ProcessingView from "./components/ProcessingView";
import Dashboard from "./Dashboard";
import ReviewInterface from "./components/ReviewInterface";
import axios from "axios";

// Define the different views of our application
type AppMode = "upload" | "processing" | "dashboard" | "review";

/**
 * Structure of aggregated data from backend
 * Matches the response from /ocr/invoice/extract-batch endpoint
 */
interface AggregatedData {
  summary: {
    total_amount: string;              // Formatted: "1,234.56"
    total_invoices_processed: number;  // Count of successful invoices
    vendors: string[];                 // Unique vendor list
    processing_errors: string[];       // Error messages for failed files
    // NEW: Trust & validation statistics
    auto_approved_count?: number;      // Auto-approved invoices
    needs_review_count?: number;       // Invoices needing review
    math_errors_count?: number;        // Invoices with math errors
    average_confidence?: number;       // Average confidence (0-1)
  };
  line_items: any[];  // All line items from all invoices (see MasterTable for structure)
  invoices: any;      // Individual invoice summaries keyed by invoice ID
}

function App() {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================
  
  // Current view mode (controls which component is rendered)
  const [mode, setMode] = useState<AppMode>("upload");
  
  // Files selected by user (set by UploadArea component)
  const [files, setFiles] = useState<File[]>([]);
  
  // Complete response from backend after processing
  const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(
    null
  );
  
  // Processing status for each file (for ProcessingView)
  const [processingStatus, setProcessingStatus] = useState<{
    [key: string]: "pending" | "complete" | "error";
  }>({});
  
  // Error message if backend call fails
  const [error, setError] = useState<string | null>(null);
  
  // Review interface state
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================
  
  /**
   * Handle file selection from UploadArea component
   * 
   * DATA FLOW:
   * ----------
   * 1. User drops/selects files in UploadArea
   * 2. UploadArea calls this handler with File[] array
   * 3. Files stored in state
   * 4. Reset any previous errors/data
   * 
   * CALLED BY: UploadArea component via onFileSelected prop
   */
  const handleFilesSelected = (files: File[]) => {
    setFiles(files);
    setError(null);
    setAggregatedData(null);
  };

  /**
   * Process invoices by sending to backend
   * 
   * DATA FLOW:
   * ----------
   * 1. Validate files exist
   * 2. Switch to processing view
   * 3. Set all files to "pending" status
   * 4. Create FormData with all files
   * 5. POST to backend /ocr/invoice/extract-batch
   * 6. On success:
   *    - Mark all files as "complete"
   *    - Store aggregated data
   *    - Switch to dashboard view
   * 7. On error:
   *    - Show error message
   *    - Return to upload view
   * 
   * BACKEND CONNECTION:
   * -------------------
   * Endpoint: POST /ocr/invoice/extract-batch
   * Headers: Content-Type: multipart/form-data
   * Body: FormData with 'files' key (multiple files)
   * 
   * NEXT: Backend processes → returns AggregatedData → displays in Dashboard
   */
  const handleProcessInvoices = async () => {
    console.log("handleProcessInvoices called!");
    
    // ═══════════════════════════════════════════════════════════
    // PERFORMANCE TRACKING START
    // ═══════════════════════════════════════════════════════════
    const perfStart = performance.now();
    const perfTimings: { [key: string]: number } = {};
    
    if(files.length === 0) {
      setError("Please select at least one invoice file.");
      return;
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log("🚀 LAYRA PERFORMANCE TRACKING");
    console.log(`${"═".repeat(60)}`);
    console.log(`Files to process: ${files.length}`);
    console.log(`Total file size: ${(files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB\n`);
    
    // Stage 1: Frontend Preparation
    const prepStart = performance.now();
    setMode('processing');
    setError(null);
    setAggregatedData(null);

    // Set initial processing status for all files 
    const initialStatus = files.reduce((acc, file) => {
      acc[file.name] = 'pending';
      return acc;
    }, {} as { [key: string]: "pending" | "complete" | "error" });
    setProcessingStatus(initialStatus);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    perfTimings['1_frontend_prep'] = performance.now() - prepStart;
    console.log(`✓ Stage 1: Frontend Preparation - ${perfTimings['1_frontend_prep'].toFixed(2)}ms`);

    try {
      // Stage 2: Network Upload
      const uploadStart = performance.now();
      console.log(`\n⬆️  Stage 2: Uploading to backend...`);
      
      const response = await axios.post('http://localhost:8000/ocr/invoice/extract-batch', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 minute timeout for large files
      });
      
      perfTimings['2_network_upload'] = performance.now() - uploadStart;
      
      // Stage 3: Backend Processing (measured on backend, extracted from response)
      const backendData = response.data;
      if (backendData.performance_metrics) {
        perfTimings['3_backend_total'] = backendData.performance_metrics.total_time;
        perfTimings['3a_file_save'] = backendData.performance_metrics.file_save_time;
        perfTimings['3b_ocr_extraction'] = backendData.performance_metrics.ocr_time;
        perfTimings['3c_validation'] = backendData.performance_metrics.validation_time;
        perfTimings['3d_aggregation'] = backendData.performance_metrics.aggregation_time;
      }
      
      console.log(`✓ Stage 2: Network Upload - ${perfTimings['2_network_upload'].toFixed(2)}ms`);
      console.log(`✓ Stage 3: Backend Processing - ${perfTimings['3_backend_total']?.toFixed(2) || 'N/A'}ms`);
      
      // Stage 4: Frontend Rendering
      const renderStart = performance.now();
      
      // Mark all files as complete when response arrives
      const completedStatus = files.reduce((acc, file) => {
        acc[file.name] = 'complete';
        return acc;
      }, {} as { [key: string]: "pending" | "complete" | "error" });
      setProcessingStatus(completedStatus);
      
      setAggregatedData(response.data);
      
      perfTimings['4_frontend_render'] = performance.now() - renderStart;
      perfTimings['total_time'] = performance.now() - perfStart;
      
      // ═══════════════════════════════════════════════════════════
      // PERFORMANCE SUMMARY
      // ═══════════════════════════════════════════════════════════
      console.log(`\n${"═".repeat(60)}`);
      console.log("📊 LAYRA PERFORMANCE BREAKDOWN");
      console.log(`${"═".repeat(60)}\n`);
      
      const totalTime = perfTimings['total_time'];
      const backendTime = perfTimings['3_backend_total'] || 0;
      
      console.log("FRONTEND STAGES:");
      console.log(`  1. Preparation:     ${perfTimings['1_frontend_prep'].toFixed(2)}ms (${(perfTimings['1_frontend_prep'] / totalTime * 100).toFixed(1)}%)`);
      console.log(`  2. Network Upload:  ${perfTimings['2_network_upload'].toFixed(2)}ms (${(perfTimings['2_network_upload'] / totalTime * 100).toFixed(1)}%)`);
      console.log(`  4. Rendering:       ${perfTimings['4_frontend_render'].toFixed(2)}ms (${(perfTimings['4_frontend_render'] / totalTime * 100).toFixed(1)}%)`);
      
      if (backendData.performance_metrics) {
        console.log(`\nBACKEND STAGES (from server):`);
        console.log(`  3a. File Save:      ${backendData.performance_metrics.file_save_time.toFixed(2)}ms (${(backendData.performance_metrics.file_save_time / totalTime * 100).toFixed(1)}%)`);
        console.log(`  3b. OCR Extraction: ${backendData.performance_metrics.ocr_time.toFixed(2)}ms (${(backendData.performance_metrics.ocr_time / totalTime * 100).toFixed(1)}%) ⚠️ BOTTLENECK`);
        console.log(`  3c. Validation:     ${backendData.performance_metrics.validation_time.toFixed(2)}ms (${(backendData.performance_metrics.validation_time / totalTime * 100).toFixed(1)}%)`);
        console.log(`  3d. Aggregation:    ${backendData.performance_metrics.aggregation_time.toFixed(2)}ms (${(backendData.performance_metrics.aggregation_time / totalTime * 100).toFixed(1)}%)`);
        
        if (backendData.performance_metrics.deepseek_breakdown) {
          console.log(`\n  OCR BREAKDOWN:`);
          console.log(`    - PDF Text Extract: ${backendData.performance_metrics.deepseek_breakdown.text_extraction_time.toFixed(2)}ms`);
          console.log(`    - DeepSeek API Call: ${backendData.performance_metrics.deepseek_breakdown.api_call_time.toFixed(2)}ms ⚠️`);
          console.log(`    - JSON Parsing:     ${backendData.performance_metrics.deepseek_breakdown.json_parse_time.toFixed(2)}ms`);
        }
      }
      
      console.log(`\n${"─".repeat(60)}`);
      console.log(`TOTAL TIME: ${totalTime.toFixed(2)}ms (${(totalTime / 1000).toFixed(2)}s)`);
      console.log(`Per Invoice: ${(totalTime / files.length).toFixed(2)}ms`);
      console.log(`${"═".repeat(60)}\n`);
      
      // Small delay to show completion before transitioning to dashboard
      setTimeout(() => {
        setMode('dashboard');
      }, 800);

    } catch (err: any) {
      console.error("Error details:", err);
      console.error("Error response:", err.response);
      
      let errorMessage = 'An unknown error occurred during processing.';
      
      if (err.response) {
        // Server responded with error
        errorMessage = err.response.data?.detail || err.response.data?.error || `Server error: ${err.response.status}`;
      } else if (err.request) {
        // Request made but no response
        errorMessage = 'No response from server. Is the backend running on http://localhost:8000?';
      } else {
        // Something else happened
        errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
      setMode('upload'); // Go back to upload on error
      
      // Reset processing status
      setProcessingStatus({});
    }
  };
  
  /**
   * Handle invoice review navigation
   * 
   * DATA FLOW:
   * ----------
   * 1. User clicks "Review Invoice" on Dashboard
   * 2. Sets selected invoice data and switches to review mode
   * 3. ReviewInterface displays PDF + extracted data side-by-side
   */
  const handleReviewInvoice = (_invoiceId: string, invoiceData: any) => {
    console.log("Reviewing invoice:", _invoiceId, invoiceData);
    setSelectedInvoice(invoiceData);
    setMode("review");
  };
  
  /**
   * Handle back to dashboard from review
   */
  const handleBackToDashboard = () => {
    setMode("dashboard");
    setSelectedInvoice(null);
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <>
      <div className="container">
        <h1>Aggregate Invoice Processor</h1>
        <p>Upload your invoices to get started.</p>

        {/* 
          CONDITIONAL RENDERING based on mode state
          ===========================================
          Three views, only one shown at a time based on processing stage
        */}
        
        {/* 
          VIEW 1: UPLOAD MODE
          -------------------
          Shows drag-and-drop area for file selection
          User can select multiple invoice PDFs
          "Process Invoices" button triggers handleProcessInvoices()
        */}
        {mode === "upload" && (
          <UploadArea
            onFileSelected={handleFilesSelected}  // Callback: stores files in state
            onProcess={handleProcessInvoices}      // Callback: starts backend processing
            disabled={mode !== "upload"}            // Disable during other modes
            files={files}                           // Current files for display
          />
        )}

        {/* 
          VIEW 2: PROCESSING MODE
          -----------------------
          Shows progress bar and file status list
          Backend is processing files concurrently
          Animated progress bar provides visual feedback
        */}
        {mode === "processing" && (
         <ProcessingView
          files={files}                         // Files being processed
          processingStatus={processingStatus}   // Status of each file (pending/complete/error)
         />
        )}

        {/* 
          VIEW 3: DASHBOARD MODE
          ----------------------
          Shows aggregated results from all invoices:
          - Summary cards (total $, invoice count, vendors)
          - Searchable & filterable line items table
          - CSV export functionality
          - Invoice cards with "Review Invoice" buttons
        */}
        {mode === "dashboard" && aggregatedData && (
          <Dashboard 
            aggregatedData={aggregatedData} 
            onReviewInvoice={handleReviewInvoice}
          />
        )}
        
        {/* 
          VIEW 4: REVIEW MODE
          -------------------
          Side-by-side PDF viewer and extracted data:
          - Left: PDF viewer (original document)
          - Right: Extracted data with confidence indicators
          - Edit fields, approve/reject invoice
        */}
        {mode === "review" && selectedInvoice && (
          <ReviewInterface
            invoiceData={selectedInvoice}
            pdfUrl={`http://localhost:8000/files/${selectedInvoice.filename}`}
            onBack={handleBackToDashboard}
          />
        )}
        
        {/* Error Display (shown in any mode if error exists) */}
        {error && <div className="error-message">{error}</div>}
      </div>
    </>
  );
}

export default App;
