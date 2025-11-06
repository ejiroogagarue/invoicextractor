/**
 * UploadArea.tsx - File Upload Component
 * 
 * DATA FLOW:
 * ==========
 * 1. User drops files or clicks to select
 * 2. react-dropzone handles file validation
 * 3. onDrop callback triggered with File[] array
 * 4. Files sent to parent (App.tsx) via onFileSelected callback
 * 5. Files stored in App state
 * 6. User clicks "Process Invoices" button
 * 7. onProcess callback triggered → starts backend processing
 * 
 * PROPS:
 * ------
 * - onFileSelected: Callback to parent with selected files
 * - onProcess: Callback to parent to start processing
 * - disabled: Disable interaction during processing
 * - files: Current files (for display/button visibility)
 * 
 * ACCEPTS:
 * --------
 * - PDF files only (application/pdf)
 * - Multiple files at once
 * - Drag & drop or click to browse
 * 
 * CALLS:
 * ------
 * → App.tsx: handleFilesSelected() - Stores files
 * → App.tsx: handleProcessInvoices() - Starts processing
 */

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface UploadAreaProps {
    onFileSelected: (files: File[]) => void;  // Callback when files selected
    onProcess: () => void;                     // Callback to start processing
    disabled: boolean;                         // Disable during processing
    files: File[];                             // Currently selected files
}

const UploadArea: React.FC<UploadAreaProps> = ({ onFileSelected, onProcess, disabled, files}) => {
    /**
     * Handle file drop/selection
     * 
     * DATA FLOW:
     * ----------
     * 1. react-dropzone detects file drop/selection
     * 2. Validates files are PDFs
     * 3. Calls this handler with accepted files
     * 4. We call parent's onFileSelected callback
     * 5. Parent stores files in state
     */
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if(disabled) return;  // Don't accept files during processing
        onFileSelected(acceptedFiles);  // Pass files to parent component
    }, [onFileSelected, disabled]);

    // Configure dropzone behavior
    const { getRootProps, getInputProps, isDragActive} = useDropzone({
        onDrop,                            // Callback when files dropped
        accept: {'application/pdf': []},   // Only accept PDF files
        multiple: true,                    // Allow multiple files at once
    });

    return (
        <div>
            {/* Dropzone area - separate from button */}
            <div
                {...getRootProps()}
                className={`upload-area ${isDragActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
            >
                <input {...getInputProps()}/>
                <div className="upload-content">
                    {isDragActive ? (
                        <p>Drop the files here ...</p>
                    ):(
                        <p>Drag & drop your invoice files here, or click to select</p>
                    )}
                </div>
            </div>
            
            {/* Process button - outside dropzone to prevent double trigger */}
            {files.length > 0 && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <p style={{ marginBottom: '0.5rem', color: '#6c757d' }}>
                        {files.length} file{files.length !== 1 ? 's' : ''} selected
                    </p>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();  // Prevent any event bubbling
                            onProcess();
                        }} 
                        disabled={disabled}
                        style={{
                            padding: '0.75rem 2rem',
                            backgroundColor: disabled ? '#6c757d' : '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                        }}
                    >
                        {disabled ? 'Processing...' : 'Process Invoices'}
                    </button>
                </div>
            )}
        </div>
    )
}

export default UploadArea