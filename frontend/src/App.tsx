/**
 * App.tsx - Main Application Component
 *
 * DATA FLOW OVERVIEW:
 * ===================
 * This is the orchestrator for the entire invoice processing flow.
 */

import { useMemo, useState } from 'react'
import axios from 'axios'

import './App.css'

import UploadArea from './components/UploadArea'
import ProcessingView from './components/ProcessingView'
import Dashboard from './Dashboard'
import ReviewInterface from './components/ReviewInterface'

// Define the different views of our application
// Dashboard remains the default canvas; review uses an overlay instead of a separate mode.
type AppMode = 'upload' | 'processing' | 'dashboard'

type FileProcessingStage = 'queued' | 'uploading' | 'processing' | 'complete' | 'error'

interface FileProcessingState {
  stage: FileProcessingStage
  progress: number // 0 - 100
  message?: string
}

interface AggregatedData {
  summary: {
    total_amount: string
    total_invoices_processed: number
    vendors: string[]
    processing_errors: string[]
    auto_approved_count?: number
    needs_review_count?: number
    math_errors_count?: number
    average_confidence?: number
  }
  line_items: any[]
  invoices: Record<string, any>
  performance_metrics?: Record<string, any>
}

function App() {
  const [mode, setMode] = useState<AppMode>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null)
  const [processingStatus, setProcessingStatus] = useState<Record<string, FileProcessingState>>({})
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

  const isProcessing = mode === 'processing'

  const selectedInvoice = useMemo(() => {
    if (!aggregatedData || !selectedInvoiceId) return null
    return aggregatedData.invoices?.[selectedInvoiceId] ?? null
  }, [aggregatedData, selectedInvoiceId])

  const selectedInvoiceLineItems = useMemo(() => {
    if (!aggregatedData || !selectedInvoiceId) return []
    return aggregatedData.line_items?.filter((item: any) => item.source_invoice_id === selectedInvoiceId) ?? []
  }, [aggregatedData, selectedInvoiceId])

  const selectedInvoicePdfUrl = useMemo(() => {
    if (!selectedInvoice?.filename) return null
    const encodedName = encodeURIComponent(selectedInvoice.filename)
    return `http://localhost:8000/files/${encodedName}`
  }, [selectedInvoice])

  const handleFilesSelected = (files: File[]) => {
    setFiles(files)
    setError(null)
    setAggregatedData(null)
    setSelectedInvoiceId(null)
    const initialStatus = files.reduce((acc, file) => {
      acc[file.name] = { stage: 'queued', progress: 0 }
      return acc
    }, {} as Record<string, FileProcessingState>)
    setProcessingStatus(initialStatus)
  }

  const handleProcessInvoices = async () => {
    if (files.length === 0) {
      setError('Please select at least one invoice file.')
      return
    }

    setMode('processing')
    setError(null)
    setAggregatedData(null)
    setSelectedInvoiceId(null)

    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })

    const fileBoundaries = files.reduce((acc, file) => {
      const previousEnd = acc.length > 0 ? acc[acc.length - 1].end : 0
      acc.push({ name: file.name, start: previousEnd, end: previousEnd + file.size })
      return acc
    }, [] as Array<{ name: string; start: number; end: number }>)

    setProcessingStatus(
      files.reduce((acc, file) => {
        acc[file.name] = { stage: 'uploading', progress: 0 }
        return acc
      }, {} as Record<string, FileProcessingState>),
    )

    try {
      const response = await axios.post('http://localhost:8000/ocr/invoice/extract-batch', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300_000,
        onUploadProgress: (progressEvent) => {
          const loaded = progressEvent.loaded || 0
          setProcessingStatus((previous) => {
            const updated = { ...previous }
            fileBoundaries.forEach(({ name, start, end }) => {
              const fileSpan = Math.max(end - start, 1)
              const loadedForFile = Math.min(Math.max(loaded - start, 0), fileSpan)
              const ratio = loadedForFile / fileSpan
              const existing = updated[name] ?? { stage: 'queued', progress: 0 }
              let stage: FileProcessingStage = ratio >= 1 ? 'processing' : 'uploading'
              let computedProgress =
                ratio >= 1 ? Math.max(existing.progress, 90) : Math.max(existing.progress, Math.floor(ratio * 80))
              if (existing.stage === 'complete') {
                stage = existing.stage
                computedProgress = existing.progress
              }
              updated[name] = {
                ...existing,
                stage,
                progress: Math.min(Math.max(0, computedProgress), 99),
              }
            })
            return updated
          })
        },
      })

      setProcessingStatus((previous) => {
        const updated = { ...previous }
        files.forEach((file) => {
          const existing = updated[file.name] ?? { stage: 'processing', progress: 95 }
          updated[file.name] = {
            ...existing,
            stage: 'complete',
            progress: 100,
          }
        })
        return updated
      })

      setAggregatedData(response.data)

      setTimeout(() => {
        setMode('dashboard')
      }, 600)
    } catch (err: any) {
      let errorMessage = 'An unknown error occurred during processing.'

      if (err.response) {
        errorMessage = err.response.data?.detail || err.response.data?.error || `Server error: ${err.response.status}`
      } else if (err.request) {
        errorMessage = 'No response from server. Is the backend running on http://localhost:8000?'
      } else {
        errorMessage = err.message || errorMessage
      }

      setError(errorMessage)
      setMode('upload')
      setSelectedInvoiceId(null)

      setProcessingStatus((previous) => {
        const updated = { ...previous }
        files.forEach((file) => {
          const existing = updated[file.name] ?? { stage: 'processing', progress: 90 }
          updated[file.name] = {
            ...existing,
            stage: 'error',
            progress: 100,
            message: errorMessage,
          }
        })
        return updated
      })
    }
  }

  const handleReviewInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId)
  }

  const handleCloseReview = () => {
    setSelectedInvoiceId(null)
  }

  const handleInvoiceChange = (invoiceId: string, updatedInvoice: any, updatedLineItems: any[]) => {
    setAggregatedData((previous) => {
      if (!previous) return previous

      const invoices = {
        ...previous.invoices,
        [invoiceId]: {
          ...(previous.invoices?.[invoiceId] ?? {}),
          ...updatedInvoice,
        },
      }

      const otherLineItems = previous.line_items.filter((item: any) => item.source_invoice_id !== invoiceId)
      const lineItems = [...otherLineItems, ...updatedLineItems]

      const parseNumber = (value: unknown): number => {
        if (typeof value === 'number' && Number.isFinite(value)) return value
        if (value === null || value === undefined) return 0
        const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
        return Number.isFinite(parsed) ? parsed : 0
      }

      const formatCurrency = (value: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value)

      const vendors = Array.from(new Set(Object.values(invoices).map((invoice: any) => invoice.vendor).filter(Boolean)))
      const totalAmountNumeric = Object.values(invoices).reduce((sum, invoice: any) => sum + parseNumber(invoice.total_amount), 0)
      const autoApprovedCount = Object.values(invoices).filter((invoice: any) =>
        invoice.review_status === 'AUTO_APPROVED' || invoice.review_status === 'APPROVED_WITH_VERIFICATION'
      ).length
      const needsReviewCount = Object.values(invoices).length - autoApprovedCount
      const mathErrorsCount = Object.values(invoices).filter((invoice: any) => invoice.math_validation?.overall_valid === false).length
      const confidenceValues = Object.values(invoices)
        .map((invoice: any) => parseNumber(invoice.confidence?.overall))
        .filter((value) => value > 0)
      const averageConfidence = confidenceValues.length
        ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(2))
        : previous.summary.average_confidence ?? 0

      const summary = {
        ...previous.summary,
        vendors,
        total_amount: formatCurrency(totalAmountNumeric).replace('$', ''),
        auto_approved_count: autoApprovedCount,
        needs_review_count: needsReviewCount,
        math_errors_count: mathErrorsCount,
        average_confidence: averageConfidence,
      }

      return {
        ...previous,
        invoices,
        line_items: lineItems,
        summary,
      }
    })
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 lg:px-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.6rem] text-slate-400">Layra</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Invoice intelligence workspace</h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Upload invoices, monitor processing, and review extracted data with confidence.
          </p>
        </header>

        {mode === 'upload' && (
          <UploadArea
            onFileSelected={handleFilesSelected}
            onProcess={handleProcessInvoices}
            disabled={isProcessing}
            files={files}
          />
        )}

        {mode === 'processing' && (
          <ProcessingView files={files} processingStatus={processingStatus} />
        )}

        {mode === 'dashboard' && aggregatedData && (
          <Dashboard aggregatedData={aggregatedData} onReviewInvoice={(id) => handleReviewInvoice(id)} />
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}
      </main>

      {selectedInvoice && selectedInvoicePdfUrl && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/80 backdrop-blur">
          <div className="relative h-full w-full max-w-7xl overflow-y-auto px-4 py-8 lg:px-6">
            <ReviewInterface
              invoiceData={selectedInvoice}
              lineItems={selectedInvoiceLineItems}
              pdfUrl={selectedInvoicePdfUrl}
              onBack={handleCloseReview}
              onInvoiceChange={handleInvoiceChange}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
