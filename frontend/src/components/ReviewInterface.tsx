/**
 * ReviewInterface Component
 * 
 * DATA FLOW:
 * ==========
 * Receives invoice data from Dashboard → Displays side-by-side view
 * Left: PDF viewer (original document)
 * Right: Extracted data (with confidence indicators)
 * 
 * TRUST-FIRST DESIGN:
 * Users can visually verify extracted data against the original PDF
 * Confidence badges show trust level for each field
 * Click to edit incorrect values (Phase 3)
 * Click field to jump to location in PDF (Phase 2)
 */

import React, { useState, useEffect, useRef } from 'react';
import { PDFViewer, PdfFocusProvider } from '@llamaindex/pdf-viewer';
import '@llamaindex/pdf-viewer/index.css';
import { ExtractedDataPanel } from './ExtractedDataPanel';
import { PDFTextLocator } from '../services/pdfTextLocator';
import type { TextLocation } from '../services/pdfTextLocator';
import './ReviewInterface.css';

interface ReviewInterfaceProps {
  invoiceData: any;
  pdfUrl: string;
  onBack: () => void;
  onApprove?: (invoiceId: string) => void;
  onReject?: (invoiceId: string) => void;
}

export const ReviewInterface: React.FC<ReviewInterfaceProps> = ({
  invoiceData,
  pdfUrl,
  onBack,
  onApprove,
  onReject,
}) => {
  // Debug logging
  console.log("ReviewInterface - Invoice Data:", invoiceData);
  console.log("ReviewInterface - PDF URL:", pdfUrl);
  console.log("ReviewInterface - Filename:", invoiceData.filename);
  
  // PDF text locator for finding text coordinates
  const [pdfLocator] = useState(() => new PDFTextLocator());
  const [highlightedLocation, setHighlightedLocation] = useState<TextLocation | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Load PDF when component mounts
  useEffect(() => {
    const loadPDF = async () => {
      try {
        await pdfLocator.loadPDF(pdfUrl);
        console.log('ReviewInterface: PDF loaded for text search');
      } catch (error) {
        console.error('ReviewInterface: Failed to load PDF for search:', error);
      }
    };
    loadPDF();
  }, [pdfUrl, pdfLocator]);
  
  /**
   * Handle field click - Search PDF and highlight text
   * 
   * TRUST-FIRST UX:
   * 1. User clicks data field
   * 2. PDF scrolls to that page
   * 3. Text highlights in yellow
   * 4. Zooms to show clearly
   */
  const handleFieldClick = async (fieldName: string, value: string) => {
    if (!value || value === 'Unknown' || value === 'Unknown Date') {
      return;
    }
    
    console.log(`Searching PDF for ${fieldName}: "${value}"`);
    setIsSearching(true);
    
    try {
      // Search for the text in PDF
      let location = await pdfLocator.findText(value);
      
      // Fallback: Search for just numbers if full text not found
      if (!location) {
        const numberMatch = value.match(/[\d,]+\.?\d*/);
        if (numberMatch) {
          location = await pdfLocator.findText(numberMatch[0]);
        }
      }
      
      if (location) {
        console.log(`Found "${value}" on page ${location.page}`, location);
        setHighlightedLocation(location);
        
        // Scroll PDF to the page with the text
        scrollToPDFPage(location.page);
        
        // Highlight will be rendered by PDFHighlight component
      } else {
        console.warn(`Text "${value}" not found in PDF`);
      }
    } catch (error) {
      console.error('Error searching PDF:', error);
    } finally {
      setIsSearching(false);
    }
  };
  
  /**
   * Scroll PDF viewer to specific page
   * Uses DOM manipulation to find and scroll to the page
   */
  const scrollToPDFPage = (pageNumber: number) => {
    // Find the PDF page element
    const pageElement = document.querySelector(
      `.react-pdf__Page[data-page-number="${pageNumber}"]`
    );
    
    if (pageElement) {
      // Smooth scroll to the page
      pageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
      console.log(`Scrolled to page ${pageNumber}`);
    } else {
      console.warn(`Could not find page ${pageNumber} element`);
    }
  };
  
  const pdfFile = {
    id: invoiceData.invoice_number || 'invoice',
    url: pdfUrl,
  };

  const handleApprove = () => {
    if (onApprove) {
      onApprove(invoiceData.invoice_number);
    }
    onBack();
  };

  const handleReject = () => {
    if (onReject) {
      onReject(invoiceData.invoice_number);
    }
    onBack();
  };

  return (
    <div className="review-interface">
      {/* Header */}
      <div className="review-header">
        <button onClick={onBack} className="back-button">
          ← Back to Dashboard
        </button>
        <h2>Invoice Review: {invoiceData.invoice_number}</h2>
        <div className="review-status">
          {invoiceData.review_status === 'AUTO_APPROVED' ? (
            <span className="status-badge approved">Auto-Approved</span>
          ) : (
            <span className="status-badge review">Needs Review</span>
          )}
        </div>
      </div>

      {/* Side-by-Side Content */}
      <PdfFocusProvider>
        <div className="review-container">
          {/* Left Panel: PDF Viewer */}
          <div className="pdf-panel">
            <div className="panel-header">
              <h3>📄 Original Document</h3>
              <span className="filename">{invoiceData.filename}</span>
            </div>
            <div className="pdf-viewer-wrapper">
              <PDFViewer 
                file={pdfFile}
                containerClassName="invoice-pdf-viewer"
              />
              
              {/* Yellow highlight overlay when text is found */}
              {highlightedLocation && (
                <div
                  className="pdf-highlight-overlay"
                  style={{
                    position: 'absolute',
                    left: `${highlightedLocation.x}px`,
                    top: `${highlightedLocation.y + (highlightedLocation.page - 1) * 800}px`, // Approximate page offset
                    width: `${highlightedLocation.width}px`,
                    height: `${highlightedLocation.height}px`,
                    backgroundColor: 'rgba(255, 255, 0, 0.35)',
                    border: '2px solid #fbbf24',
                    boxShadow: '0 0 12px rgba(251, 191, 36, 0.7)',
                    pointerEvents: 'none',
                    zIndex: 1000,
                    animation: 'highlightPulse 0.5s ease-in-out',
                    borderRadius: '3px'
                  }}
                />
              )}
            </div>
          </div>

          {/* Right Panel: Extracted Data */}
          <div className="data-panel">
            <div className="panel-header">
              <h3>📊 Extracted Data</h3>
              <span className="confidence-indicator">
                Overall Confidence: {(invoiceData.confidence?.overall * 100).toFixed(0)}%
              </span>
            </div>
            
            <ExtractedDataPanel 
              data={invoiceData}
              onApprove={handleApprove}
              onReject={handleReject}
              onFieldClick={handleFieldClick}
            />
          </div>
        </div>
      </PdfFocusProvider>
    </div>
  );
};

export default ReviewInterface;

