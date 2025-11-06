/**
 * ProcessingView.tsx - Processing Progress Component
 * 
 * DATA FLOW:
 * ==========
 * Displayed while backend is processing invoice files.
 * 
 * BACKEND BEHAVIOR:
 * -----------------
 * Backend uses asyncio.gather() to process all files concurrently.
 * This means all files are processed at once, and we receive the complete
 * result when ALL files are done (no incremental updates).
 * 
 * UI BEHAVIOR:
 * ------------
 * Since we don't get incremental updates, we:
 * 1. Show all files as "pending" initially
 * 2. Animate progress bar to 95% to show activity
 * 3. When backend response arrives (in App.tsx):
 *    - All files marked "complete"
 *    - Progress jumps to 100%
 *    - Transition to Dashboard after brief delay
 * 
 * FUTURE IMPROVEMENT:
 * -------------------
 * For real-time updates, implement Server-Sent Events (SSE) or WebSockets
 * to stream progress as each file completes.
 * 
 * PROPS:
 * ------
 * - files: Array of files being processed
 * - processingStatus: Status map (filename → "pending"|"complete"|"error")
 * 
 * RECEIVED FROM: App.tsx (while mode === "processing")
 */

import React, { useEffect, useState } from "react";
interface ProcessingViewProps {
  files: File[];
  processingStatus: { [key: string]: "pending" | "complete" | "error" };
}

const ProcessingView: React.FC<ProcessingViewProps> = ({
  files,
  processingStatus,
}) => {
  // Simulate progress animation since backend processes all at once
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const completedCount = Object.values(processingStatus).filter(
    (status) => status === "complete"
  ).length;
  const totalCount = files.length;

  useEffect(() => {
    // Animate progress bar to 95% while processing
    if (completedCount === 0) {
      const interval = setInterval(() => {
        setAnimatedProgress((prev) => {
          if (prev >= 95) return 95;
          return prev + 5;
        });
      }, 200);
      return () => clearInterval(interval);
    } else {
      setAnimatedProgress(100);
    }
  }, [completedCount]);

  return (
    <div style={{ textAlign: "center", padding: "2rem" }}>
      <h2>Processing Invoices...</h2>
      <div style={{ marginBottom: "1rem" }}>
        <div
          style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#007bff" }}
        >
          {completedCount > 0 ? `${completedCount} / ${totalCount}` : "Processing..."}
        </div>
        <div
          style={{
            width: "100%",
            backgroundColor: "#e9ecef",
            borderRadius: "4px",
            height: "8px",
            marginTop: "0.5rem",
          }}
        >
          <div
            style={{
              width: `${animatedProgress}%`,
              backgroundColor: "#007bff",
              height: "100%",
              borderRadius: "4px",
              transition: "width 0.3s ease-in-out",
            }}
          />
        </div>
      </div>
      <div
        style={{
          maxHeight: "200px",
          overflowY: "auto",
          border: "1px solid #e9ecef",
          borderRadius: "4px",
          padding: "1rem",
          textAlign: "left",
        }}
      >
        {files.map((file) => (
          <div
            key={file.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.5rem 0",
            }}
          >
            <span>{file.name}</span>
            <span
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: "12px",
                fontSize: "0.8rem",
                fontWeight: "bold",
                color: "white",
                backgroundColor:
                  processingStatus[file.name] === "pending"
                    ? "#ffc107"
                    : processingStatus[file.name] === "complete"
                    ? "#28a745"
                    : "#dc3545",
              }}
            >
              {processingStatus[file.name]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProcessingView;


