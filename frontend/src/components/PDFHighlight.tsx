/**
 * PDFHighlight Component
 * 
 * PURPOSE:
 * ========
 * Renders a yellow highlight overlay on the PDF at specific coordinates.
 * Used to visually indicate where extracted data came from.
 * 
 * TRUST-FIRST:
 * User clicks data → PDF highlights source → User verifies accuracy
 */

import React from 'react';

interface PDFHighlightProps {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scale?: number;
}

export const PDFHighlight: React.FC<PDFHighlightProps> = ({
  x,
  y,
  width,
  height,
  scale = 1,
}) => {
  return (
    <div
      className="pdf-highlight-overlay"
      style={{
        position: 'absolute',
        left: `${x * scale}px`,
        top: `${y * scale}px`,
        width: `${width * scale}px`,
        height: `${height * scale}px`,
        backgroundColor: 'rgba(255, 255, 0, 0.3)',
        border: '2px solid #fbbf24',
        boxShadow: '0 0 10px rgba(251, 191, 36, 0.6)',
        pointerEvents: 'none',
        zIndex: 1000,
        animation: 'highlightPulse 0.5s ease-in-out',
      }}
    />
  );
};

export default PDFHighlight;


