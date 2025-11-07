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

import React, { useMemo } from "react";

type FileProcessingStage = "queued" | "uploading" | "processing" | "complete" | "error";

interface FileProcessingState {
  stage: FileProcessingStage;
  progress: number;
  message?: string;
}

interface ProcessingViewProps {
  files: File[];
  processingStatus: Record<string, FileProcessingState>;
}

const stageLabels: Record<FileProcessingStage, string> = {
  queued: "Queued",
  uploading: "Uploading",
  processing: "Processing",
  complete: "Complete",
  error: "Error",
};

const stageColor: Record<FileProcessingStage, string> = {
  queued: "#6c757d",
  uploading: "#1f78ff",
  processing: "#ffa000",
  complete: "#28a745",
  error: "#dc3545",
};

const ProcessingView: React.FC<ProcessingViewProps> = ({ files, processingStatus }) => {
  const overallProgress = useMemo(() => {
    if (files.length === 0) return 0;
    const total = files.reduce((acc, file) => {
      const state = processingStatus[file.name];
      return acc + (state?.progress ?? 0);
    }, 0);
    return Math.round(total / files.length);
  }, [files, processingStatus]);

  return (
    <div style={{ textAlign: "center", padding: "2rem" }}>
      <h2>Processing Invoices...</h2>

      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Overall progress: {overallProgress}%
        </div>
        <div
          style={{
            width: "100%",
            backgroundColor: "#e9ecef",
            borderRadius: "6px",
            height: "10px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${overallProgress}%`,
              backgroundColor: "#1f78ff",
              height: "100%",
              transition: "width 0.3s ease-in-out",
            }}
          />
        </div>
      </div>

      <div
        style={{
          maxHeight: "260px",
          overflowY: "auto",
          border: "1px solid #e9ecef",
          borderRadius: "6px",
          padding: "1rem",
          textAlign: "left",
        }}
      >
        {files.map((file) => {
          const state = processingStatus[file.name] ?? { stage: "queued", progress: 0 };
          const color = stageColor[state.stage];
          return (
            <div key={file.name} style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.35rem",
                }}
              >
                <span style={{ fontWeight: 600 }}>{file.name}</span>
                <span style={{ color }}>{stageLabels[state.stage]}</span>
              </div>
              <div
                style={{
                  width: "100%",
                  backgroundColor: "#f1f3f5",
                  borderRadius: "6px",
                  height: "8px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, state.progress))}%`,
                    backgroundColor: color,
                    height: "100%",
                    transition: "width 0.3s ease-out",
                  }}
                />
              </div>
              <div style={{ fontSize: "0.8rem", color: "#6c757d", marginTop: "0.25rem" }}>
                {Math.round(state.progress)}%
                {state.message ? ` — ${state.message}` : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProcessingView;


