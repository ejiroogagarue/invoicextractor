/**
 * PDF Text Locator Service
 * 
 * PURPOSE:
 * ========
 * Searches PDF documents for specific text and returns coordinates.
 * Enables "click data → highlight in PDF" functionality.
 * 
 * TRUST-FIRST DESIGN:
 * ===================
 * Users can verify extracted data by clicking it and seeing
 * the exact source location highlighted in the PDF.
 * 
 * USAGE:
 * ======
 * const locator = new PDFTextLocator();
 * await locator.loadPDF(pdfUrl);
 * const location = await locator.findText("36258");
 * // Returns: { page: 1, x: 450, y: 120, text: "Invoice #36258" }
 */

import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export interface TextLocation {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export class PDFTextLocator {
  private pdfDoc: pdfjs.PDFDocumentProxy | null = null;
  private textLocationCache: Map<string, TextLocation> = new Map();

  /**
   * Load a PDF document for searching
   */
  async loadPDF(pdfUrl: string): Promise<void> {
    try {
      console.log('PDFTextLocator: Loading PDF from', pdfUrl);
      this.pdfDoc = await pdfjs.getDocument(pdfUrl).promise;
      console.log(`PDFTextLocator: PDF loaded, ${this.pdfDoc.numPages} pages`);
      
      // Clear cache when loading new PDF
      this.textLocationCache.clear();
    } catch (error) {
      console.error('PDFTextLocator: Failed to load PDF:', error);
      throw error;
    }
  }

  /**
   * Find the first occurrence of text in the PDF
   * Returns coordinates for highlighting
   */
  async findText(searchText: string): Promise<TextLocation | null> {
    if (!this.pdfDoc) {
      console.warn('PDFTextLocator: PDF not loaded');
      return null;
    }

    // Normalize search text
    const normalizedSearch = searchText.trim().toLowerCase();
    
    // Check cache first
    if (this.textLocationCache.has(normalizedSearch)) {
      console.log('PDFTextLocator: Found in cache:', normalizedSearch);
      return this.textLocationCache.get(normalizedSearch)!;
    }

    console.log('PDFTextLocator: Searching for:', normalizedSearch);

    // Search all pages
    for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
      try {
        const page = await this.pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Search through text items
        for (let item of textContent.items as any[]) {
          const itemText = item.str.toLowerCase();
          
          // Check for exact match or substring
          if (itemText.includes(normalizedSearch) || normalizedSearch.includes(itemText.trim())) {
            const location: TextLocation = {
              page: pageNum,
              x: item.transform[4],
              y: item.transform[5],
              width: item.width,
              height: item.height,
              text: item.str
            };
            
            console.log(`PDFTextLocator: Found on page ${pageNum}:`, location);
            
            // Cache for future use
            this.textLocationCache.set(normalizedSearch, location);
            return location;
          }
        }
      } catch (error) {
        console.error(`PDFTextLocator: Error searching page ${pageNum}:`, error);
      }
    }
    
    console.warn('PDFTextLocator: Text not found:', searchText);
    return null;
  }

  /**
   * Find all occurrences of text in the PDF
   * Useful if text appears multiple times
   */
  async findAllTextInstances(searchText: string): Promise<TextLocation[]> {
    if (!this.pdfDoc) return [];
    
    const normalizedSearch = searchText.trim().toLowerCase();
    const locations: TextLocation[] = [];
    
    console.log('PDFTextLocator: Finding all instances of:', normalizedSearch);

    for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
      try {
        const page = await this.pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        for (let item of textContent.items as any[]) {
          const itemText = item.str.toLowerCase();
          
          if (itemText.includes(normalizedSearch)) {
            locations.push({
              page: pageNum,
              x: item.transform[4],
              y: item.transform[5],
              width: item.width,
              height: item.height,
              text: item.str
            });
          }
        }
      } catch (error) {
        console.error(`PDFTextLocator: Error searching page ${pageNum}:`, error);
      }
    }
    
    console.log(`PDFTextLocator: Found ${locations.length} instances`);
    return locations;
  }

  /**
   * Clear the cache (useful when switching PDFs)
   */
  clearCache(): void {
    this.textLocationCache.clear();
  }
}

