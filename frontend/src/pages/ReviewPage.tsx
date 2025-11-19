import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { PDFViewer, PdfFocusProvider } from '@llamaindex/pdf-viewer'
import '@llamaindex/pdf-viewer/index.css'

interface InvoiceData {
  id?: string
  vendor?: string
  vendor_name?: string
  invoiceCount?: number
  date?: string
  total_amount?: number | string
  status?: 'paid' | 'pending' | 'past_due'
  review_status?: string
  confidence?: number | { overall?: number }
  filename?: string
  invoice_number?: string
  [key: string]: any
}

interface AggregatedData {
  invoices: Record<string, any>
  line_items?: any[]
}

export default function ReviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null)
  const [currentInvoiceIndex, setCurrentInvoiceIndex] = useState(1)
  const [totalInvoices, setTotalInvoices] = useState(1)
  const [expandedSection, setExpandedSection] = useState<string | null>('overview')

  useEffect(() => {
    if (location.state?.invoice && location.state?.aggregatedData) {
      setInvoice(location.state.invoice)
      setAggregatedData(location.state.aggregatedData)
      
      // Calculate invoice index and total
      const invoiceId = location.state.invoiceId || location.state.invoice.id
      const invoiceEntries = Object.entries(location.state.aggregatedData.invoices || {})
      const currentIndex = invoiceEntries.findIndex(([id]) => id === invoiceId)
      setCurrentInvoiceIndex(currentIndex >= 0 ? currentIndex + 1 : 1)
      setTotalInvoices(invoiceEntries.length)
    } else {
      // Try to load from sessionStorage
      const stored = sessionStorage.getItem('aggregatedData')
      if (stored) {
        const data = JSON.parse(stored)
        setAggregatedData(data)
        const invoiceId = location.state?.invoiceId
        if (invoiceId && data.invoices?.[invoiceId]) {
          setInvoice(data.invoices[invoiceId])
          const invoiceEntries = Object.entries(data.invoices || {})
          const currentIndex = invoiceEntries.findIndex(([id]) => id === invoiceId)
          setCurrentInvoiceIndex(currentIndex >= 0 ? currentIndex + 1 : 1)
          setTotalInvoices(invoiceEntries.length)
        }
      }
    }
  }, [location.state])

  // Get PDF URL
  const pdfUrl = useMemo(() => {
    if (!invoice?.filename) return null
    const encodedName = encodeURIComponent(invoice.filename)
    return `http://localhost:8000/files/${encodedName}`
  }, [invoice])

  // Extract data for display
  const extractedData = useMemo(() => {
    if (!invoice) return null

    const parseNumber = (value: unknown): string => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
      }
      if (value === null || value === undefined) return '$0.00'
      return String(value)
    }

    return {
      vendorInfo: {
        name: invoice.vendor || invoice.vendor_name || 'Unknown Vendor',
        address: invoice.shipping_info?.address || invoice.customer?.address || 'N/A',
      },
      overview: {
        invoiceDate: invoice.date || 'N/A',
        invoiceNumber: invoice.invoice_number || 'N/A',
        dueDate: invoice.due_date || 'N/A',
        totalAmount: parseNumber(invoice.total_amount),
        taxAmount: parseNumber(invoice.tax || invoice.financial_summary?.tax),
      },
      breakdown: {
        subtotal: parseNumber(invoice.subtotal || invoice.financial_summary?.subtotal),
        shipping: parseNumber(invoice.shipping || invoice.financial_summary?.shipping),
        discount: parseNumber(invoice.discount_amount || invoice.financial_summary?.discount),
      },
      verify: {
        lineItems: invoice.line_items?.length ? `${invoice.line_items.length} items` : 'N/A',
        paymentTerms: invoice.payment_terms || 'N/A',
      },
    }
  }, [invoice])

  const handleBack = () => {
    navigate('/datatable')
  }

  const handlePrevious = () => {
    if (!aggregatedData || currentInvoiceIndex <= 1) return
    
    const invoiceEntries = Object.entries(aggregatedData.invoices || {})
    const prevIndex = currentInvoiceIndex - 2
    if (prevIndex >= 0) {
      const [invoiceId, invoiceData] = invoiceEntries[prevIndex]
      setInvoice(invoiceData)
      setCurrentInvoiceIndex(prevIndex + 1)
    }
  }

  const handleNext = () => {
    if (!aggregatedData || currentInvoiceIndex >= totalInvoices) return
    
    const invoiceEntries = Object.entries(aggregatedData.invoices || {})
    const nextIndex = currentInvoiceIndex
    if (nextIndex < invoiceEntries.length) {
      const [invoiceId, invoiceData] = invoiceEntries[nextIndex]
      setInvoice(invoiceData)
      setCurrentInvoiceIndex(nextIndex + 1)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  // Get confidence value
  const confidence = useMemo(() => {
    if (!invoice?.confidence) return 0
    if (typeof invoice.confidence === 'number') {
      return invoice.confidence <= 1 ? invoice.confidence * 100 : invoice.confidence
    }
    return invoice.confidence.overall 
      ? (invoice.confidence.overall <= 1 ? invoice.confidence.overall * 100 : invoice.confidence.overall)
      : 0
  }, [invoice])

  // Get status
  const status = useMemo(() => {
    if (!invoice?.review_status) return 'pending'
    if (invoice.review_status === 'AUTO_APPROVED' || invoice.review_status === 'APPROVED_WITH_VERIFICATION') {
      return 'paid'
    }
    if (invoice.review_status === 'FLAGGED') {
      return 'past_due'
    }
    return 'pending'
  }, [invoice])

  // Get review status
  const reviewStatus = useMemo(() => {
    if (!invoice?.review_status) return 'review'
    return (invoice.review_status === 'AUTO_APPROVED' || invoice.review_status === 'APPROVED_WITH_VERIFICATION')
      ? 'approved'
      : 'review'
  }, [invoice])

  if (!invoice || !extractedData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p>Loading invoice...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Context Bar - Sticky Top */}
      <div className="sticky top-0 z-10 bg-ogaga-yellow border-b border-black/10 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-black">{extractedData.vendorInfo.name}</span>
            <span className="text-black/70">{totalInvoices}</span>
            <span className="text-black/70">{extractedData.overview.invoiceDate}</span>
            <span className="font-semibold text-black">{extractedData.overview.totalAmount}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              status === 'paid' ? 'bg-status-paid text-white' :
              status === 'pending' ? 'bg-status-pending text-black' :
              'bg-status-past-due text-white'
            }`}>
              {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
            </span>
            {reviewStatus === 'approved' ? (
              <CheckCircle2 className="w-5 h-5 text-status-paid" />
            ) : (
              <span className="flex items-center gap-1 text-status-pending">
                <AlertTriangle className="w-4 h-4" />
                Needs Review
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Row */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-black hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Dashboard</span>
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevious}
              disabled={currentInvoiceIndex <= 1}
              className="flex items-center gap-1 px-3 py-1 rounded-md border border-gray-300 text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="font-semibold text-black">Invoice {currentInvoiceIndex} Of {totalInvoices}</span>
            <button
              onClick={handleNext}
              disabled={currentInvoiceIndex >= totalInvoices}
              className="flex items-center gap-1 px-3 py-1 rounded-md border border-gray-300 text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full">
        {/* PDF Viewer Column */}
        <div className="lg:w-[65%] border-r border-gray-200 p-6 overflow-auto">
          {pdfUrl ? (
            <PdfFocusProvider>
              <div className="bg-gray-100 rounded-lg p-4 min-h-[600px]">
                <PDFViewer 
                  file={{
                    id: invoice.id || 'invoice',
                    url: pdfUrl,
                  }}
                  containerClassName="w-full h-full"
                />
              </div>
            </PdfFocusProvider>
          ) : (
            <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[600px]">
              <p className="text-gray-500">PDF not available</p>
            </div>
          )}
        </div>

        {/* Extracted Data Column */}
        <div className="lg:w-[35%] p-6 overflow-auto">
          {/* Vendor Header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-black mb-2">{extractedData.vendorInfo.name}</h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-600">{Math.round(confidence)}% Confidence</span>
              <div className={`w-2 h-2 rounded-full ${
                confidence >= 80 ? 'bg-status-paid' : 
                confidence >= 50 ? 'bg-status-pending' : 
                'bg-status-past-due'
              }`} />
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              reviewStatus === 'approved' 
                ? 'bg-status-paid text-white' 
                : 'bg-status-pending text-black'
            }`}>
              {reviewStatus === 'approved' ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <AlertTriangle className="w-3 h-3" />
              )}
              {reviewStatus === 'approved' ? 'Approved' : 'Needs Review'}
            </span>
          </div>

          {/* Accordion Sections */}
          <div className="space-y-4">
            {/* Overview Section */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('overview')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-semibold text-black">Overview</span>
                <ChevronDown className={`w-5 h-5 transition-transform duration-150 ${expandedSection === 'overview' ? 'rotate-180' : ''}`} />
              </button>
              {expandedSection === 'overview' && extractedData && (
                <div className="p-4 space-y-3 animate-fadeIn">
                  {Object.entries(extractedData.overview).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-600 uppercase tracking-wide">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                      <input
                        type="text"
                        value={value}
                        readOnly
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ogaga-yellow"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Breakdown Section */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('breakdown')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-semibold text-black">Breakdown</span>
                <ChevronDown className={`w-5 h-5 transition-transform duration-150 ${expandedSection === 'breakdown' ? 'rotate-180' : ''}`} />
              </button>
              {expandedSection === 'breakdown' && extractedData && (
                <div className="p-4 space-y-3 animate-fadeIn">
                  {Object.entries(extractedData.breakdown).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-600 uppercase tracking-wide">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                      <input
                        type="text"
                        value={value}
                        readOnly
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ogaga-yellow"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Verify Section */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('verify')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-semibold text-black">Verify</span>
                <ChevronDown className={`w-5 h-5 transition-transform duration-150 ${expandedSection === 'verify' ? 'rotate-180' : ''}`} />
              </button>
              {expandedSection === 'verify' && extractedData && (
                <div className="p-4 space-y-3 animate-fadeIn">
                  {Object.entries(extractedData.verify).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-600 uppercase tracking-wide">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                      <input
                        type="text"
                        value={value}
                        readOnly
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ogaga-yellow"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

