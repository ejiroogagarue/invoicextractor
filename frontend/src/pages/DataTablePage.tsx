/**
 * DataTablePage.tsx - Invoice Overview Table (v2 Redesign)
 * 
 * Displays all processed invoices in a sortable, searchable table
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Download, ChevronDown, CheckCircle2, AlertTriangle, ArrowUpDown, Plus, X, Grid3x3, List } from 'lucide-react'
import { motion } from 'framer-motion'
import axios from 'axios'
import Header from '../components/Header'
import SidePanel from '../components/SidePanel'

type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

interface Invoice {
  id: string
  vendor: string
  invoiceCount: number
  date: string
  total: number
  status: 'paid' | 'pending' | 'past_due'
  review: 'validated' | 'review'
  filename?: string
  confidence?: number
  invoiceNumber?: string
  jobStatus?: JobStatus
  jobError?: string | null
  jobProgress?: number
}

interface BatchProgressJob {
  job_id: string
  filename: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  started_at?: number | null
  completed_at?: number | null
  duration_ms?: number | null
  error?: string | null
}

interface BatchProgressSnapshot {
  jobs: BatchProgressJob[]
  summary?: {
    total_jobs: number
    completed: number
    failed: number
    avg_duration_ms?: number
  }
}

interface AggregatedData {
  summary: {
    total_amount: string
    total_invoices_processed: number
    vendors: string[]
    average_confidence?: number
  }
  invoices: Record<string, any>
  progress?: BatchProgressSnapshot
}

type SortField = 'vendor' | 'invoiceCount' | 'date' | 'total' | 'status'
type SortDirection = 'asc' | 'desc'
type ViewMode = 'table' | 'grid'
type RowState = {
  status: 'processing' | 'completed' | 'failed'
  progress: number
  error?: string | null
}

// Hook for counting animation (optimized)
function useCountUp(end: number, duration: number = 400, start: number = 0): number {
  const [count, setCount] = useState(start)

  useEffect(() => {
    if (end === start) {
      setCount(end)
      return
    }

    let rafId: number
    let startTime: number | null = null
    
    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)
      
      // Easing function for smooth animation
      const easeOutQuad = 1 - (1 - progress) * (1 - progress)
      setCount(Math.floor(start + (end - start) * easeOutQuad))

      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      } else {
        setCount(end)
      }
    }
    
    rafId = requestAnimationFrame(animate)
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [end, duration, start])

  return count
}

export default function DataTablePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('vendor')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchProgressSnapshot | null>(null)
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedCount, setProcessedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [showSuccessBanner, setShowSuccessBanner] = useState(true)
  const [showErrorBanner, setShowErrorBanner] = useState(true)
  
  // File input ref for direct file upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Side panel state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const overallPercent = totalCount > 0
    ? Math.min(99, Math.max(0, Math.round((processedCount / totalCount) * 100)))
    : isProcessing ? 15 : 100

  const displayInvoices = useMemo(() => {
    if (!batchProgress?.jobs?.length) {
      return invoices
    }

    const existing = new Set(invoices.map(inv => inv.filename ?? inv.id))
    const failedRows: Invoice[] = batchProgress.jobs
      .filter(job => job.status === 'failed' && !existing.has(job.filename))
      .map(job => ({
        id: `failed-${job.job_id}`,
        vendor: job.filename,
        invoiceCount: 1,
        date: '—',
        total: 0,
        status: 'pending',
        review: 'review',
        filename: job.filename,
        confidence: 0,
        invoiceNumber: undefined,
        jobStatus: 'failed' as JobStatus,
        jobError: job.error || 'Processing failed. Please retry.',
      }))

    return [...invoices, ...failedRows]
  }, [invoices, batchProgress])

  // Handle processing or load existing data
  useEffect(() => {
    const files = location.state?.files
    const shouldProcess = location.state?.shouldStartProcessing
    
    if (files && shouldProcess) {
      // Start processing immediately
      startProcessing(files)
    } else {
      // Load existing aggregated data
      loadAggregatedData()
    }
  }, [location.state])
  
  // Load aggregated data from sessionStorage or location state
  const loadAggregatedData = () => {
    let data: AggregatedData | null = null

    if (location.state?.aggregatedData) {
      data = location.state.aggregatedData
      setAggregatedData(data)
      sessionStorage.setItem('aggregatedData', JSON.stringify(data))
    } else {
      const stored = sessionStorage.getItem('aggregatedData')
      if (stored) {
        data = JSON.parse(stored)
        setAggregatedData(data)
      }
    }

    const jobStatusMap = new Map<string, BatchProgressJob>()
    data?.progress?.jobs?.forEach(job => {
      jobStatusMap.set(job.filename, job)
    })

    if (data && data.invoices) {
      // Transform backend invoice data to table format
      const invoiceList: Invoice[] = Object.entries(data.invoices).map(([id, invoice]: [string, any]) => {
        const parseNumber = (value: unknown): number => {
          if (typeof value === 'number' && Number.isFinite(value)) return value
          if (value === null || value === undefined) return 0
          const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
          return Number.isFinite(parsed) ? parsed : 0
        }

        const total = parseNumber(invoice.total_amount)
        const confidence = typeof invoice.confidence === 'object' 
          ? invoice.confidence.overall 
          : invoice.confidence || 0

        // Determine status based on review_status
        let status: 'paid' | 'pending' | 'past_due' = 'pending'
        if (invoice.review_status === 'AUTO_APPROVED' || invoice.review_status === 'APPROVED_WITH_VERIFICATION') {
          status = 'paid'
        } else if (invoice.review_status === 'FLAGGED') {
          status = 'past_due'
        }

        // Determine review status
        const review: 'validated' | 'review' = 
          (invoice.review_status === 'AUTO_APPROVED' || invoice.review_status === 'APPROVED_WITH_VERIFICATION')
            ? 'validated' 
            : 'review'

        const normalizedFilename = invoice.filename || invoice.file_name || id
        const jobInfo = normalizedFilename ? jobStatusMap.get(normalizedFilename) : undefined

        return {
          id,
          vendor: invoice.vendor || invoice.vendor_name || 'Unknown Vendor',
          invoiceCount: 1, // Each row is one invoice
          date: invoice.date || 'N/A',
          total,
          status,
          review,
          filename: normalizedFilename,
          confidence: confidence <= 1 ? confidence * 100 : confidence,
          invoiceNumber: invoice.invoice_number,
          jobStatus: (jobInfo?.status as JobStatus) ?? 'completed',
          jobError: jobInfo?.error ?? null,
        }
      })

      setInvoices(invoiceList)
    }
    if (data?.progress) {
      setBatchProgress(data.progress)
    } else {
      setBatchProgress(null)
    }
    // Trigger animation after data loads
    setIsLoaded(true)
  }
  
  // File upload handlers
  const handleAddFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Validate files are PDFs
    const fileArray = Array.from(files)
    const invalidFiles = fileArray.filter(file => file.type !== 'application/pdf')
    
    if (invalidFiles.length > 0) {
      setProcessingError(`Invalid file type. Only PDF files are allowed. Found: ${invalidFiles.map(f => f.name).join(', ')}`)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    // Start processing immediately (no navigation)
    startProcessing(fileArray)
  }
  
  // Start processing invoices in background
  const startProcessing = async (files: File[]) => {
    setIsProcessing(true)
    setTotalCount(prev => prev + files.length)
    setProcessingError(null)
    setShowSuccessBanner(true) // Reset success banner visibility
    setShowErrorBanner(true) // Reset error banner visibility
    
    // ✅ APPEND to existing invoices instead of replacing
    const skeletonRows: Invoice[] = files.map((file, idx) => ({
      id: `processing-${Date.now()}-${idx}`, // Unique ID
      vendor: file.name || 'Processing...',
      invoiceCount: 1,
      date: 'Processing',
      total: 0,
      status: 'pending' as const,
      review: 'review' as const,
      filename: file.name,
      confidence: 0,
      jobStatus: 'queued' as JobStatus,
      jobError: null,
      jobProgress: 0,
    }))
    
    // ✅ Prepend new processing rows at the top (newest first)
    setInvoices(prev => [...skeletonRows, ...prev])
    setIsLoaded(true) // Show table immediately
    
    // Update batch progress
    const newJobs = files.map((file, idx) => ({
      job_id: `local-${Date.now()}-${idx}`,
      filename: file.name,
      status: 'queued' as const,
    }))
    
    setBatchProgress(prev => ({
      jobs: [...(prev?.jobs || []), ...newJobs],
      summary: {
        total_jobs: (prev?.summary?.total_jobs || 0) + files.length,
        completed: prev?.summary?.completed || 0,
        failed: prev?.summary?.failed || 0,
        avg_duration_ms: prev?.summary?.avg_duration_ms || 0,
      },
    }))
    
    try {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      
      console.log(`🚀 Starting processing of ${files.length} invoices...`)
      
      const response = await axios.post(
        'http://localhost:8000/ocr/invoice/extract-batch',
        formData,
        {
          // ✅ Don't set Content-Type - let axios set it automatically with boundary
          // Setting it manually prevents axios from adding the boundary parameter
          timeout: 600_000,  // 10 minutes (increased from 5 for complex invoices)
          // ✅ REMOVED: onUploadProgress handler - it was misleading
          // Upload progress ≠ processing progress. We now show real backend status.
        }
      )
      
      console.log('✅ Processing complete!')
      console.log('📊 Response data:', response.data)
      
      // ✅ MERGE aggregated data with existing data
      setAggregatedData(prev => {
        const merged = {
          ...response.data,
          invoices: {
            ...(prev?.invoices || {}),
            ...(response.data?.invoices || {}),
          },
          summary: {
            ...response.data?.summary,
            total_invoices_processed: (prev?.summary?.total_invoices_processed || 0) + (response.data?.summary?.total_invoices_processed || 0),
            vendors: [...new Set([...(prev?.summary?.vendors || []), ...(response.data?.summary?.vendors || [])])],
          },
        }
        sessionStorage.setItem('aggregatedData', JSON.stringify(merged))
        return merged
      })
      
      // Merge batch progress
      setBatchProgress(prev => {
        const newProgress = response.data?.progress || null
        if (!newProgress) return prev
        
        return {
          jobs: [...(prev?.jobs || []), ...(newProgress.jobs || [])],
          summary: {
            total_jobs: (prev?.summary?.total_jobs || 0) + (newProgress.summary?.total_jobs || 0),
            completed: (prev?.summary?.completed || 0) + (newProgress.summary?.completed || 0),
            failed: (prev?.summary?.failed || 0) + (newProgress.summary?.failed || 0),
            avg_duration_ms: prev?.summary?.avg_duration_ms || newProgress.summary?.avg_duration_ms || 0,
          },
        }
      })
      
      // Transform and display the data immediately
      const responseJobs: BatchProgressJob[] = response.data?.progress?.jobs || []
      const responseJobMap = new Map<string, BatchProgressJob>()
      responseJobs.forEach(job => responseJobMap.set(job.filename, job))

      if (response.data && response.data.invoices) {
        const invoiceList: Invoice[] = Object.entries(response.data.invoices).map(([id, invoice]: [string, any]) => {
          const parseNumber = (value: unknown): number => {
            if (typeof value === 'number' && Number.isFinite(value)) return value
            if (value === null || value === undefined) return 0
            const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
            return Number.isFinite(parsed) ? parsed : 0
          }

          const total = parseNumber(invoice.total_amount)
          const confidence = typeof invoice.confidence === 'object' 
            ? invoice.confidence.overall 
            : invoice.confidence || 0

          let status: 'paid' | 'pending' | 'past_due' = 'pending'
          if (invoice.review_status === 'AUTO_APPROVED' || invoice.review_status === 'APPROVED_WITH_VERIFICATION') {
            status = 'paid'
          } else if (invoice.review_status === 'FLAGGED') {
            status = 'past_due'
          }

          const review: 'validated' | 'review' = 
            (invoice.review_status === 'AUTO_APPROVED' || invoice.review_status === 'APPROVED_WITH_VERIFICATION')
              ? 'validated' 
              : 'review'

          const normalizedFilename = invoice.filename || invoice.file_name || id
          const jobInfo = normalizedFilename ? responseJobMap.get(normalizedFilename) : undefined

          return {
            id,
            vendor: invoice.vendor || invoice.vendor_name || 'Unknown Vendor',
            invoiceCount: 1,
            date: invoice.date || 'N/A',
            total,
            status,
            review,
            filename: normalizedFilename,
            confidence: confidence <= 1 ? confidence * 100 : confidence,
            invoiceNumber: invoice.invoice_number,
            jobStatus: (jobInfo?.status as JobStatus) ?? 'completed',
            jobError: jobInfo?.error ?? null,
          }
        })

        console.log('📋 Transformed invoices:', invoiceList.length)
        
        // ✅ MERGE: Remove skeleton rows and add completed invoices at the very top
        setInvoices(prev => {
          // Get filenames of newly completed invoices
          const filenames = new Set(invoiceList.map(inv => inv.filename))
          
          // Separate existing invoices (not from this batch) from skeletons
          const existingInvoices = prev.filter(inv => {
            // Keep invoices that:
            // 1. Have a filename
            // 2. Are NOT in the newly completed list
            // 3. Are NOT queued/processing skeletons
            return inv.filename && !filenames.has(inv.filename) && inv.jobStatus !== 'queued'
          })
          
          // Put newly completed invoices at the very top, then existing invoices below
          return [...invoiceList, ...existingInvoices]
        })
        setIsLoaded(true)
        
        // ✅ ONLY set processedCount after data is actually rendered
        // Use setTimeout to ensure React has rendered the data
        setTimeout(() => {
          setProcessedCount(prev => prev + files.length)
          console.log('✅ Table updated with real data')
        }, 100) // Small delay to ensure render is complete
      } else {
        // No invoice data in response, but still mark as processed
        setTimeout(() => {
          setProcessedCount(prev => prev + files.length)
        }, 100)
      }
      
      // Show success message briefly
      setTimeout(() => {
        setIsProcessing(false)
      }, 2000)
      
    } catch (error: any) {
      console.error('❌ Processing error:', error)
      
      // Extract detailed error message
      let errorMessage = 'Processing failed'
      if (error.response) {
        // Server responded with error status
        const status = error.response.status
        const data = error.response.data
        
        if (status === 422) {
          errorMessage = `Validation error: ${data?.detail || data?.message || 'Invalid file format or missing required fields'}`
        } else if (status === 400) {
          errorMessage = `Bad request: ${data?.detail || data?.message || 'Invalid request'}`
        } else {
          errorMessage = `Server error (${status}): ${data?.detail || data?.message || error.message}`
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.'
      } else {
        errorMessage = error.message || 'Processing failed'
      }
      
      setProcessingError(errorMessage)
      setShowErrorBanner(true) // Show error banner when error occurs
      setIsProcessing(false)
      
      // Still try to load any partial data
      const stored = sessionStorage.getItem('aggregatedData')
      if (stored) {
        loadAggregatedData()
      }
      setBatchProgress(null)
    }
  }

  // Auto-scroll to top when new files are added
  useEffect(() => {
    if (isProcessing && invoices.some(inv => inv.jobStatus === 'queued' || inv.jobStatus === 'processing')) {
      // Smooth scroll to top when new processing starts
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [isProcessing, invoices.length])

  // ✅ REMOVED: Fake progress timer that incremented every 2 seconds
  // Progress is now based on actual backend status, not artificial timers

  // Calculate aggregate stats with animation-ready values
  const stats = useMemo(() => {
    if (aggregatedData?.summary) {
      const parseNumber = (value: unknown): number => {
        if (typeof value === 'number' && Number.isFinite(value)) return value
        if (value === null || value === undefined) return 0
        const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
        return Number.isFinite(parsed) ? parsed : 0
      }

      return {
        totalAmount: parseNumber(aggregatedData.summary.total_amount),
        totalInvoices: aggregatedData.summary.total_invoices_processed || invoices.length,
        uniqueVendors: aggregatedData.summary.vendors?.length || new Set(invoices.map(inv => inv.vendor)).size,
        avgConfidence: aggregatedData.summary.average_confidence || 
          (invoices.length > 0 
            ? Math.round(invoices.reduce((sum, inv) => sum + (inv.confidence || 0), 0) / invoices.length)
            : 0),
      }
    }

    // Fallback to calculated values
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0)
    const totalInvoices = invoices.length
    const uniqueVendors = new Set(invoices.map(inv => inv.vendor)).size
    const avgConfidence = invoices.length > 0
      ? Math.round(invoices.reduce((sum, inv) => sum + (inv.confidence || 0), 0) / invoices.length)
      : 0

    return {
      totalAmount,
      totalInvoices,
      uniqueVendors,
      avgConfidence,
    }
  }, [invoices, aggregatedData])

  // Animated counts for stats (must be after stats is defined)
  const animatedTotalAmount = useCountUp(stats.totalAmount, 400, 0)
  const animatedTotalInvoices = useCountUp(stats.totalInvoices, 400, 0)
  const animatedUniqueVendors = useCountUp(stats.uniqueVendors, 400, 0)
  const animatedAvgConfidence = useCountUp(stats.avgConfidence, 400, 0)

  // Filter and sort invoices
  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = displayInvoices

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = displayInvoices.filter(inv =>
        inv.vendor.toLowerCase().includes(query) ||
        inv.date.toLowerCase().includes(query) ||
        inv.total.toString().includes(query) ||
        inv.status.toLowerCase().includes(query)
      )
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]

      if (sortField === 'total' || sortField === 'invoiceCount') {
        aVal = Number(aVal)
        bVal = Number(bVal)
      } else {
        aVal = String(aVal).toLowerCase()
        bVal = String(bVal).toLowerCase()
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    return sorted
  }, [displayInvoices, searchQuery, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleExportCSV = () => {
    const headers = ['Invoice ID', 'Vendor', 'Invoice Number', 'Date', 'Total', 'Status', 'Review', 'Confidence']
    const rows = filteredAndSortedInvoices.map(inv => [
      inv.id,
      inv.vendor,
      inv.invoiceNumber || 'N/A',
      inv.date,
      `$${inv.total.toFixed(2)}`,
      inv.status,
      inv.review,
      inv.confidence ? `${inv.confidence}%` : 'N/A',
    ])
    const csvLines = [headers, ...rows].map(line =>
      line.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }


  // Side panel handlers
  const handleRowClick = (invoice: Invoice) => {
    // Check if invoice is completed
    const invoiceState = getRowState(invoice, filteredAndSortedInvoices.findIndex(inv => inv.id === invoice.id))
    if (invoiceState.status !== 'completed') return // Only allow clicking completed invoices
    
    // If panel is already open, just update the invoice (scroll will reset automatically in SidePanel)
    if (isPanelOpen) {
      setSelectedInvoice(invoice)
    } else {
      setSelectedInvoice(invoice)
      setIsPanelOpen(true)
    }
  }

  const handlePanelClose = () => {
    setIsPanelOpen(false)
    // Delay clearing selected invoice to allow animation
    setTimeout(() => setSelectedInvoice(null), 300)
  }

  const handleViewFullDetails = (invoice: Invoice) => {
    // Get full invoice data from aggregatedData
    const fullInvoiceData = aggregatedData?.invoices?.[invoice.id] || invoice
    
    // Find current index in sorted/filtered list
    const currentIndex = filteredAndSortedInvoices.findIndex(inv => inv.id === invoice.id)
    
    // Get sorted invoice IDs array
    const sortedInvoiceIds = filteredAndSortedInvoices.map(inv => inv.id)
    
    // Close panel first
    handlePanelClose()
    
    // Navigate after a brief delay to allow panel to close
    setTimeout(() => {
      navigate('/review', { 
        state: { 
          invoice: fullInvoiceData,
          invoiceId: invoice.id,
          aggregatedData,
          sortedInvoiceIds,
          currentIndex: currentIndex >= 0 ? currentIndex : 0
        } 
      })
    }, 300)
  }

  // Status badge helper (currently unused but kept for future use)
  // const getStatusBadge = (status: Invoice['status']) => {
  //   const styles = {
  //     paid: 'bg-status-paid text-white',
  //     pending: 'bg-status-pending text-black',
  //     past_due: 'bg-status-past-due text-white',
  //   }
  //   return (
  //     <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
  //       {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
  //     </span>
  //   )
  // }

  const getReviewBadge = (review: Invoice['review']) => {
    if (review === 'validated') {
      return (
        <span className="flex items-center gap-1 text-status-paid text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Validated
        </span>
      )
    } else {
      return (
        <span className="flex items-center gap-1 text-ogaga-yellow text-sm font-medium">
          <AlertTriangle className="w-4 h-4" />
          Review
        </span>
      )
    }
  }

  const getRowState = (invoice: Invoice, index: number): RowState => {
    // ✅ TRUST-BASED PROGRESS: Only show 100% when backend confirms completion
    
    // Failed state - highest priority
    if (invoice.jobStatus === 'failed') {
      return { status: 'failed', progress: 0, error: invoice.jobError }
    }

    // Processing state - only show progress if we have actual backend status
    if (invoice.jobStatus === 'processing' || invoice.jobStatus === 'queued') {
      // Use actual jobProgress from backend if available, otherwise show conservative estimate
      const progress = invoice.jobProgress ?? Math.min(50, overallPercent)
      return {
        status: 'processing',
        progress: Math.min(95, progress), // Cap at 95% until truly completed
      }
    }

    // Completed state - only show 100% if backend confirms completion
    if (invoice.jobStatus === 'completed') {
      return { status: 'completed', progress: 100 }
    }

    // Default: If we're still processing the batch and this row hasn't been assigned a status yet
    if (isProcessing && invoice.id.startsWith('processing-')) {
      // Show conservative progress for skeleton rows
      const estimatedProgress = Math.min(30, Math.floor((index / totalCount) * 30))
      return { status: 'processing', progress: estimatedProgress }
    }

    // Fallback: completed (for old data loaded from session)
    return { status: 'completed', progress: 100 }
  }

  return (
    <div className="min-h-screen bg-ogaga-yellow flex flex-col font-sans">
      <Header />
      
      <main className="flex-1 px-4 pb-8">
        {/* Success Banner */}
        {!isProcessing && processedCount > 0 && processedCount === totalCount && showSuccessBanner && (
          <div className="max-w-7xl mx-auto mt-4 mb-4">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-status-paid border-2 border-black rounded-2xl p-4 shadow-lg"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                  <span className="text-white font-semibold">
                    ✅ All {totalCount} invoices processed successfully
                  </span>
                </div>
                <button
                  onClick={() => setShowSuccessBanner(false)}
                  className="text-white hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-white/20"
                  aria-label="Close success message"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
        
        {/* Error Banner */}
        {processingError && showErrorBanner && (
          <div className="max-w-7xl mx-auto mt-4 mb-4">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-status-past-due border-2 border-black rounded-2xl p-4 shadow-lg"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-white" />
                  <span className="text-white font-semibold">
                    ⚠️ Processing error: {processingError}
                  </span>
                </div>
                <button
                  onClick={() => setShowErrorBanner(false)}
                  className="text-white hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-white/20"
                  aria-label="Close error message"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
        
        {/* Aggregate Stats Section */}
        <div className="max-w-7xl mx-auto mt-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={isLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white rounded-xl p-4 shadow-md"
            >
              <p className="stats-label">Total Amount</p>
              <p className="stats-value text-black">${animatedTotalAmount.toLocaleString()}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={isLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.3, delay: 0.05, ease: "easeOut" }}
              className="bg-white rounded-xl p-4 shadow-md"
            >
              <p className="stats-label">Invoices Processed</p>
              <p className="stats-value text-black">{animatedTotalInvoices}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={isLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
              className="bg-white rounded-xl p-4 shadow-md"
            >
              <p className="stats-label">Unique Vendors</p>
              <p className="stats-value text-black">{animatedUniqueVendors}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={isLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
              className="bg-white rounded-xl p-4 shadow-md"
            >
              <p className="stats-label">Avg. Confidence</p>
              <p className="stats-value text-status-paid">{animatedAvgConfidence}%</p>
            </motion.div>
          </div>
        </div>

        {/* Table Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
          className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6"
        >
          {/* Action Bar */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search Invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ogaga-yellow"
              />
            </div>
            <div className="flex gap-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              
              <button
                onClick={handleAddFile}
                disabled={isProcessing}
                className="flex items-center gap-2 bg-ogaga-yellow text-black px-4 py-2 rounded-lg hover:bg-ogaga-yellow-light transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                Add File
              </button>
              
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-ogaga-yellow text-black px-4 py-2 rounded-lg hover:bg-ogaga-yellow-light transition-colors font-semibold"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('vendor')}
                      className="flex items-center gap-1 hover:text-black transition-colors"
                    >
                      VENDOR
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('invoiceCount')}
                      className="flex items-center gap-1 hover:text-black transition-colors"
                    >
                      INVOICES
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-1 hover:text-black transition-colors"
                    >
                      DATE
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('total')}
                      className="flex items-center gap-1 hover:text-black transition-colors"
                    >
                      TOTAL
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider">
                    REVIEW
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedInvoices.map((invoice, index) => {
                  const rowState = getRowState(invoice, index)

                  if (rowState.status === 'processing') {
                    return (
                      <motion.tr
                        key={invoice.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ 
                          duration: 0.4, 
                          ease: [0.25, 0.1, 0.25, 1],
                          delay: index * 0.03 // Stagger effect
                        }}
                        className="border-b border-gray-100 bg-gray-50/60"
                      >
                        <td colSpan={5} className="py-5 px-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-black font-semibold truncate">
                                {invoice.filename || invoice.vendor}
                              </p>
                              <p className="text-sm text-gray-600">
                                {rowState.progress >= 95 
                                  ? 'Finalizing...' 
                                  : rowState.progress >= 50 
                                    ? `Processing... ${rowState.progress}%` 
                                    : `Queued... ${rowState.progress}%`
                                }
                              </p>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-80">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-black transition-all duration-300 ease-out"
                                  style={{ width: `${rowState.progress}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-black w-12 text-right">
                                {rowState.progress}%
                              </span>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  }

                  if (rowState.status === 'failed') {
                    return (
                      <motion.tr
                        key={invoice.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ 
                          duration: 0.4, 
                          ease: [0.25, 0.1, 0.25, 1],
                          delay: index * 0.03 // Stagger effect
                        }}
                        className="border-b border-gray-100 bg-red-50/80"
                      >
                        <td colSpan={5} className="py-4 px-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <p className="text-black font-semibold truncate">
                                {invoice.filename || invoice.vendor}
                              </p>
                              <p className="text-sm text-red-600">
                                {rowState.error || 'Processing failed. Please retry.'}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-red-600">Failed</span>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  }

                  const canNavigate = rowState.status === 'completed'
                  const isSelected = selectedInvoice?.id === invoice.id

                  return (
                    <motion.tr
                      key={invoice.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ 
                        duration: 0.4, 
                        ease: [0.25, 0.1, 0.25, 1],
                        delay: index * 0.03 // Stagger effect
                      }}
                      whileHover={
                        canNavigate
                          ? {
                              y: -2,
                              transition: { duration: 0.15, ease: "easeOut" }
                            }
                          : undefined
                      }
                      onClick={canNavigate ? () => handleRowClick(invoice) : undefined}
                      className={`border-b border-gray-100 relative ${
                        canNavigate ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
                      } ${isSelected ? 'bg-yellow-50' : ''}`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                          <span className="text-black">{invoice.vendor}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-700">{invoice.invoiceCount}</td>
                      <td className="py-4 px-4 text-gray-700">{invoice.date}</td>
                      <td className="py-4 px-4 text-black">${invoice.total.toLocaleString()}</td>
                      <td className="py-4 px-4">{getReviewBadge(invoice.review)}</td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredAndSortedInvoices.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No invoices found matching your search.
            </div>
          )}
        </motion.div>

        {/* Side Panel - Verification Dashboard */}
        <SidePanel
          invoice={selectedInvoice}
          isOpen={isPanelOpen}
          onClose={handlePanelClose}
          onViewDetails={handleViewFullDetails}
          fullInvoiceData={selectedInvoice ? aggregatedData?.invoices?.[selectedInvoice.id] : null}
        />
      </main>
    </div>
  )
}


