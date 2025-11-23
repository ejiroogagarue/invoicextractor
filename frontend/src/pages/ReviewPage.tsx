import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react'
import { PDFViewer, PdfFocusProvider } from '@llamaindex/pdf-viewer'
import '@llamaindex/pdf-viewer/index.css'
import { PDFTextLocator } from '../services/pdfTextLocator'

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
  due_date?: string
  subtotal?: number | string
  shipping?: number | string
  discount_amount?: number | string
  tax?: number | string
  financial_summary?: {
    subtotal?: number
    shipping?: number
    discount?: { amount?: number; percent?: number }
    tax?: number
    total?: number
  }
  line_items?: Array<{
    item_name?: string
    item?: string
    description?: string
    quantity?: number | string
    rate?: number | string
    amount?: number | string
    _source?: 'deterministic' | 'llm'
    _source_page?: number
    _source_section?: string
    _source_snippet?: string
    _row_type?: string
  }>
  payment_terms?: string
  order_id?: string
  shipping_info?: {
    address?: string
  }
  customer?: {
    address?: string
  }
  [key: string]: any
}

interface AggregatedData {
  invoices: Record<string, any>
  line_items?: any[]
}

type TabType = 'overview' | 'breakdown' | 'verify'

interface CalculationResult {
  item: string
  quantity: number
  rate: number
  extractedAmount: number
  calculatedAmount: number
  isValid: boolean
  status: 'pass' | 'fail'
}

export default function ReviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null)
  const [sortedInvoiceIds, setSortedInvoiceIds] = useState<string[]>([])
  const [currentInvoiceIndex, setCurrentInvoiceIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const pdfLocatorRef = useRef<PDFTextLocator | null>(null)
  const lastHighlightedSnippet = useRef<string | null>(null)

  // Load invoice data and sorted order
  useEffect(() => {
    if (location.state?.invoice && location.state?.aggregatedData) {
      setInvoice(location.state.invoice)
      setAggregatedData(location.state.aggregatedData)
      
      // Use sorted invoice IDs if provided, otherwise fallback to object keys
      const sortedIds = location.state.sortedInvoiceIds || Object.keys(location.state.aggregatedData.invoices || {})
      setSortedInvoiceIds(sortedIds)
      
      // Use provided index or find it
      const invoiceId = location.state.invoiceId || location.state.invoice.id
      const index = location.state.currentIndex !== undefined 
        ? location.state.currentIndex 
        : sortedIds.findIndex((id: string) => id === invoiceId)
      setCurrentInvoiceIndex(index >= 0 ? index : 0)
    } else {
      // Try to load from sessionStorage
      const stored = sessionStorage.getItem('aggregatedData')
      if (stored) {
        const data = JSON.parse(stored)
        setAggregatedData(data)
        const invoiceId = location.state?.invoiceId
        if (invoiceId && data.invoices?.[invoiceId]) {
          setInvoice(data.invoices[invoiceId])
          const allIds = Object.keys(data.invoices || {})
          setSortedInvoiceIds(allIds)
          const index = allIds.findIndex(id => id === invoiceId)
          setCurrentInvoiceIndex(index >= 0 ? index : 0)
        }
      }
    }
  }, [location.state])

  useEffect(() => {
    pdfLocatorRef.current = new PDFTextLocator()
    return () => {
      pdfLocatorRef.current?.clearHighlights()
    }
  }, [])

  // Get PDF URL
  const pdfUrl = useMemo(() => {
    if (!invoice?.filename) return null
    const encodedName = encodeURIComponent(invoice.filename)
    return `http://localhost:8000/files/${encodedName}`
  }, [invoice])

  useEffect(() => {
    if (!pdfUrl || !pdfLocatorRef.current) return
    pdfLocatorRef.current.loadPDF(pdfUrl).catch(() => null)
  }, [pdfUrl])

  const handleLineItemHighlight = useCallback((snippet?: string) => {
    if (!snippet || !pdfLocatorRef.current) return
    if (lastHighlightedSnippet.current === snippet) return
    lastHighlightedSnippet.current = snippet
    void pdfLocatorRef.current.highlightTextInPDF(snippet)
  }, [])

  const clearLineItemHighlight = useCallback(() => {
    lastHighlightedSnippet.current = null
    pdfLocatorRef.current?.clearHighlights()
  }, [])


  // Calculate invoice count for current vendor
  const vendorInvoiceCount = useMemo(() => {
    if (!aggregatedData || !invoice) return 0
    const vendorName = invoice.vendor || invoice.vendor_name
    if (!vendorName) return 0
    
    return Object.values(aggregatedData.invoices || {}).filter((inv: any) => 
      (inv.vendor || inv.vendor_name) === vendorName
    ).length
  }, [aggregatedData, invoice])

  // Extract data for display
  const extractedData = useMemo(() => {
    if (!invoice) return null

    const parseNumber = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (value === null || value === undefined) return 0
      const str = String(value).replace(/[^0-9.-]/g, '')
      const parsed = parseFloat(str)
      return Number.isFinite(parsed) ? parsed : 0
    }

    const formatCurrency = (value: unknown): string => {
      const num = parseNumber(value)
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
    }

    return {
      vendorInfo: {
        name: invoice.vendor || invoice.vendor_name || 'Unknown Vendor',
        address: invoice.shipping_info?.address || invoice.customer?.address || 'N/A',
      },
      overview: {
        invoiceNumber: invoice.invoice_number || 'N/A',
        invoiceDate: invoice.date || 'N/A',
        dueDate: invoice.due_date || 'N/A',
        vendorName: invoice.vendor || invoice.vendor_name || 'Unknown Vendor',
        vendorAddress: invoice.shipping_info?.address || invoice.customer?.address || 'N/A',
        orderId: invoice.order_id || 'N/A',
        paymentTerms: invoice.payment_terms || 'N/A',
      },
      breakdown: {
        subtotal: formatCurrency(invoice.subtotal || invoice.financial_summary?.subtotal),
        shipping: formatCurrency(invoice.shipping || invoice.financial_summary?.shipping),
        discount: formatCurrency(invoice.discount_amount || invoice.financial_summary?.discount?.amount),
        tax: formatCurrency(invoice.tax || invoice.financial_summary?.tax),
        total: formatCurrency(invoice.total_amount || invoice.financial_summary?.total),
      },
      lineItems: invoice.line_items || [],
    }
  }, [invoice])

  // Calculate verification results
  const calculationResults = useMemo(() => {
    if (!invoice || !invoice.line_items) return null

    const parseNumber = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (value === null || value === undefined) return 0
      const str = String(value).replace(/[^0-9.-]/g, '')
      const parsed = parseFloat(str)
      return Number.isFinite(parsed) ? parsed : 0
    }

    const lineItemResults: CalculationResult[] = invoice.line_items.map((item) => {
      const quantity = parseNumber(item.quantity)
      const rate = parseNumber(item.rate)
      const extractedAmount = parseNumber(item.amount)
      const calculatedAmount = quantity * rate
      const isValid = Math.abs(extractedAmount - calculatedAmount) < 0.01

      return {
        item: item.item_name || item.item || 'Unknown Item',
        quantity,
        rate,
        extractedAmount,
        calculatedAmount,
        isValid,
        status: isValid ? 'pass' : 'fail',
      }
    })

    // Calculate financial summary
    const subtotalCalculated = lineItemResults.reduce((sum, item) => sum + item.calculatedAmount, 0)
    const subtotalExtracted = parseNumber(invoice.subtotal || invoice.financial_summary?.subtotal)
    const shipping = parseNumber(invoice.shipping || invoice.financial_summary?.shipping)
    const discount = parseNumber(invoice.discount_amount || invoice.financial_summary?.discount?.amount)
    const tax = parseNumber(invoice.tax || invoice.financial_summary?.tax)
    const totalCalculated = subtotalCalculated + shipping - discount + tax
    const totalExtracted = parseNumber(invoice.total_amount || invoice.financial_summary?.total)

    const hasLineItemErrors = lineItemResults.some(item => !item.isValid)
    const subtotalValid = Math.abs(subtotalCalculated - subtotalExtracted) < 0.01
    const totalValid = Math.abs(totalCalculated - totalExtracted) < 0.01

    return {
      lineItems: lineItemResults,
      financialSummary: {
        subtotal: {
          calculated: subtotalCalculated,
          extracted: subtotalExtracted,
          isValid: subtotalValid,
          status: subtotalValid ? 'pass' : 'fail' as 'pass' | 'fail',
        },
        shipping: { amount: shipping },
        discount: { amount: discount },
        tax: { amount: tax },
        total: {
          calculated: totalCalculated,
          extracted: totalExtracted,
          isValid: totalValid,
          status: totalValid ? 'pass' : 'fail' as 'pass' | 'fail',
        },
      },
      overallStatus: hasLineItemErrors || !subtotalValid || !totalValid ? 'warning' : 'pass',
    }
  }, [invoice])

  const groupedLineItems = useMemo(() => {
    if (!invoice?.line_items || invoice.line_items.length === 0) return []
    const groups = new Map<string, { key: string; label: string; page?: number; items: Array<{ item: any; index: number }> }>()
    invoice.line_items.forEach((item, index) => {
      const section = item._source_section || 'Other line items'
      const page = item._source_page
      const key = `${section}-${page ?? 'na'}`
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: section || 'Other line items',
          page,
          items: [],
        })
      }
      groups.get(key)!.items.push({ item, index })
    })
    return Array.from(groups.values()).sort((a, b) => {
      const pageDiff = (a.page ?? 999) - (b.page ?? 999)
      if (pageDiff !== 0) return pageDiff
      return a.label.localeCompare(b.label)
    })
  }, [invoice])

  const lineValidationMap = useMemo(() => {
    if (!calculationResults) return {}
    return calculationResults.lineItems.reduce((acc, result, index) => {
      acc[index] = result
      return acc
    }, {} as Record<number, CalculationResult>)
  }, [calculationResults])

  const flaggedLineItemsCount = calculationResults
    ? calculationResults.lineItems.filter((item) => !item.isValid).length
    : 0


  const handleBack = () => {
    navigate('/datatable')
  }

  const handlePrevious = () => {
    if (currentInvoiceIndex <= 0 || sortedInvoiceIds.length === 0) return
    
    const prevIndex = currentInvoiceIndex - 1
    const prevInvoiceId = sortedInvoiceIds[prevIndex]
    
    if (aggregatedData?.invoices?.[prevInvoiceId]) {
      setInvoice(aggregatedData.invoices[prevInvoiceId])
      setCurrentInvoiceIndex(prevIndex)
      setActiveTab('overview')
    }
  }

  const handleNext = () => {
    if (currentInvoiceIndex >= sortedInvoiceIds.length - 1) return
    
    const nextIndex = currentInvoiceIndex + 1
    const nextInvoiceId = sortedInvoiceIds[nextIndex]
    
    if (aggregatedData?.invoices?.[nextInvoiceId]) {
      setInvoice(aggregatedData.invoices[nextInvoiceId])
      setCurrentInvoiceIndex(nextIndex)
      setActiveTab('overview')
    }
  }

  // Get status (currently unused but kept for future use)
  // const _status = useMemo(() => {
  //   if (!invoice?.review_status) return 'pending'
  //   if (invoice.review_status === 'AUTO_APPROVED' || invoice.review_status === 'APPROVED_WITH_VERIFICATION') {
  //     return 'paid'
  //   }
  //   if (invoice.review_status === 'FLAGGED') {
  //     return 'past_due'
  //   }
  //   return 'pending'
  // }, [invoice])

  // Get review status (binary: validated or needs review)
  const reviewStatus = useMemo(() => {
    if (!invoice?.review_status) return 'review'
    return (invoice.review_status === 'AUTO_APPROVED' || invoice.review_status === 'APPROVED_WITH_VERIFICATION')
      ? 'validated'
      : 'review'
  }, [invoice])

  // Calculate progress percentage
  const progressPercentage = sortedInvoiceIds.length > 0
    ? Math.round(((currentInvoiceIndex + 1) / sortedInvoiceIds.length) * 100)
    : 0

  if (!invoice || !extractedData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p>Loading invoice...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Context Bar - Sticky */}
      <div className="sticky top-0 z-10 bg-ogaga-yellow border-b border-black/10 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[auto_1fr] gap-3 items-center">
          {/* Left: Back to Dashboard Button */}
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black rounded-lg text-black font-semibold hover:bg-gray-50 transition-colors shadow-sm w-full sm:w-auto justify-center sm:justify-start"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          
          {/* Right: Context Info - Centered on desktop, left-aligned on mobile */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center md:justify-self-center">
            <span className="font-semibold text-black text-lg sm:text-xl md:text-2xl">
              {extractedData.vendorInfo.name}
            </span>
            <span className="text-black/70 text-sm sm:text-base">
              {vendorInvoiceCount} {vendorInvoiceCount === 1 ? 'invoice' : 'invoices'}
            </span>
            <span className="text-black/70 text-sm sm:text-base">
              {extractedData.overview.invoiceDate}
            </span>
            <span className="font-semibold text-black text-sm sm:text-base">
              {extractedData.breakdown.total}
            </span>
            {reviewStatus === 'validated' ? (
              <div className="flex items-center gap-1 text-status-paid">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm font-medium">Validated</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-ogaga-yellow">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm font-medium">Needs Review</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full">
        {/* PDF Viewer Column */}
        <div className="lg:w-[60%] border-r border-gray-200 p-6 overflow-auto relative">
          {pdfUrl ? (
            <PdfFocusProvider>
              <div className="bg-gray-100 rounded-lg p-4 min-h-[600px] relative">
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

        {/* Extracted Data Column - 40% for better data visibility without scrolling */}
        <div className="lg:w-[40%] p-6 overflow-auto">
          {/* Vendor Header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-black mb-2">{extractedData.vendorInfo.name}</h2>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              reviewStatus === 'validated' 
                ? 'bg-status-paid text-white' 
                : 'bg-status-pending text-black'
            }`}>
              {reviewStatus === 'validated' ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <AlertTriangle className="w-3 h-3" />
              )}
              {reviewStatus === 'validated' ? 'Validated' : 'Needs Review'}
            </span>
          </div>

          {/* iOS-Style Segmented Control - Accessible with Subtle Animation */}
          <div className="relative">
            {/* Tab Container - Gray background, border */}
            <div 
              className="flex gap-0 mb-4 relative bg-gray-100 border border-gray-300 rounded-lg p-1"
              role="tablist"
            >
              {(['overview', 'breakdown', 'verify'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls={`tabpanel-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    flex-1 px-6 py-2.5 text-sm font-medium
                    rounded-md
                    transition-all duration-300 ease-out
                    ${activeTab === tab
                      ? 'bg-ogaga-yellow text-black shadow-sm'
                      : 'bg-transparent text-gray-800 hover:bg-gray-200 hover:text-gray-900'
                    }
                  `}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Content Area - Unified with tabs, changes with tab selection */}
            <div 
              className="bg-white border border-gray-200 rounded-lg p-4 relative overflow-hidden"
              role="tabpanel"
              id={`tabpanel-${activeTab}`}
              style={{
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                minHeight: '400px'
              }}
            >
              {/* Animated content wrapper - key change triggers animation */}
              <div
                key={activeTab}
                className="animate-fadeIn"
              >
                {/* Overview Content */}
                {activeTab === 'overview' && (
                  <div className="space-y-3">
                  {Object.entries(extractedData.overview).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-600 uppercase tracking-wide block mb-1">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <div className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white ${
                        value === 'N/A' ? 'opacity-50' : ''
                      }`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

                {/* Breakdown Content */}
                {activeTab === 'breakdown' && (
                  <div className="space-y-4">
                  {/* Financial Summary */}
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <h3 className="text-sm font-semibold text-black mb-3">Financial Summary</h3>
                    <div className="space-y-2">
                      {Object.entries(extractedData.breakdown).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <span className={`text-sm font-semibold text-black ${
                            value === '$0.00' ? 'opacity-50' : ''
                          }`}>
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Line Items Table - grouped by section + provenance badges */}
                  {groupedLineItems.length > 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-black">Line Items</h3>
                        {flaggedLineItemsCount > 0 ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                            <AlertTriangle className="w-3 h-3" />
                            {flaggedLineItemsCount} need review
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" />
                            Auto-verified
                          </span>
                        )}
                      </div>
                      <div className="w-full">
                        <table className="w-full text-sm table-fixed">
                          <colgroup>
                            <col className="w-auto" />
                            <col className="w-16" />
                            <col className="w-20" />
                            <col className="w-20" />
                          </colgroup>
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left py-2 px-3 text-xs font-bold text-gray-600 uppercase">Description</th>
                              <th className="text-right py-2 px-2 text-xs font-bold text-gray-600 uppercase">Qty</th>
                              <th className="text-right py-2 px-2 text-xs font-bold text-gray-600 uppercase">Rate</th>
                              <th className="text-right py-2 px-2 text-xs font-bold text-gray-600 uppercase">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedLineItems.map((group) => (
                              <Fragment key={group.key}>
                                <tr className="bg-gray-100/70">
                                  <td colSpan={4} className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide px-3 py-1.5">
                                    <div className="flex items-center justify-between">
                                      <span>{group.label}</span>
                                      {group.page && <span className="text-gray-500">Page {group.page}</span>}
                                    </div>
                                  </td>
                                </tr>
                                {group.items.map(({ item, index }) => {
                                  const itemName = item.item_name || item.item || 'Unknown Item'
                                  const quantity = item.quantity || '0'
                                  const rate = item.rate ? `$${parseFloat(String(item.rate)).toFixed(2)}` : '$0.00'
                                  const amount = item.amount ? `$${parseFloat(String(item.amount)).toFixed(2)}` : '$0.00'
                                  const isDeterministic = item._source === 'deterministic'
                                  const sourceBadge = isDeterministic ? 'Rule-based' : 'LLM'
                                  const badgeClass = isDeterministic
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-indigo-100 text-indigo-700'
                                  const validation = lineValidationMap[index]
                                  const isFlagged = Boolean(validation && !validation.isValid)
                                  
                                  return (
                                    <tr
                                      key={`${group.key}-${index}`}
                                      className={`border-b border-gray-100 transition-colors ${
                                        isFlagged ? 'bg-red-50/30' : 'hover:bg-ogaga-yellow/10'
                                      }`}
                                      onMouseEnter={() => handleLineItemHighlight(item._source_snippet)}
                                      onMouseLeave={clearLineItemHighlight}
                                    >
                                      <td className="py-2 px-3 text-black truncate" title={itemName}>
                                        <div>{itemName}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-600">
                                          <span className={`px-2 py-0.5 rounded-full font-semibold ${badgeClass}`}>
                                            {sourceBadge}
                                          </span>
                                          {item._source_section && (
                                            <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                                              {item._source_section}
                                            </span>
                                          )}
                                          {item._source_page && (
                                            <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                                              Pg {item._source_page}
                                            </span>
                                          )}
                                          {isFlagged && (
                                            <span className="flex items-center gap-1 text-red-600 font-semibold">
                                              <AlertTriangle className="w-3 h-3" />
                                              Math mismatch
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-2 px-2 text-right text-gray-700">{quantity}</td>
                                      <td className="py-2 px-2 text-right text-gray-700">{rate}</td>
                                      <td className="py-2 px-2 text-right font-semibold text-black">{amount}</td>
                                    </tr>
                                  )
                                })}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

                {/* Verify Content */}
                {activeTab === 'verify' && (
                  <div className="space-y-4">
                  {/* Review Status */}
                  <div className="border border-gray-200 rounded-lg p-3">
                    <h3 className="text-sm font-semibold text-black mb-2">Review Status</h3>
                    <div className="flex items-center gap-2">
                      {reviewStatus === 'validated' ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-status-paid" />
                          <span className="text-sm font-medium text-status-paid">Validated</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 text-ogaga-yellow" />
                          <span className="text-sm font-medium text-ogaga-yellow">Needs Review</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Line Items Count */}
                  <div className="border border-gray-200 rounded-lg p-3">
                    <h3 className="text-sm font-semibold text-black mb-2">Line Items</h3>
                    <p className="text-sm text-gray-700">
                      {extractedData.lineItems.length} {extractedData.lineItems.length === 1 ? 'item' : 'items'} extracted
                    </p>
                  </div>

                  {/* Payment Terms */}
                  {extractedData.overview.paymentTerms !== 'N/A' && (
                    <div className="border border-gray-200 rounded-lg p-3">
                      <h3 className="text-sm font-semibold text-black mb-2">Payment Terms</h3>
                      <p className="text-sm text-gray-700">{extractedData.overview.paymentTerms}</p>
                    </div>
                  )}

                  {/* Calculation Verification */}
                  {calculationResults && (
                    <div className="border border-gray-200 rounded-lg p-3">
                      <h3 className="text-sm font-semibold text-black mb-3">Calculation Verification</h3>
                      
                      {/* Line Items Calculations */}
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-gray-600 mb-2">Line Items</h4>
                        <div className="space-y-1">
                          {calculationResults.lineItems.map((result, index) => (
                            <div
                              key={index}
                              className={`text-xs p-2 rounded ${
                                result.status === 'pass' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                              }`}
                            >
                              {result.status === 'pass' ? '✓' : '✗'} {result.item}: {result.quantity} × ${result.rate.toFixed(2)} = ${result.calculatedAmount.toFixed(2)}
                              {result.status === 'fail' && (
                                <span className="block text-red-600 mt-1">
                                  Extracted: ${result.extractedAmount.toFixed(2)} (Mismatch!)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Financial Summary */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-600 mb-2">Financial Summary</h4>
                        <div className="space-y-1 text-xs">
                          <div className={`p-2 rounded ${
                            calculationResults.financialSummary.subtotal.status === 'pass'
                              ? 'bg-green-50 text-green-800'
                              : 'bg-red-50 text-red-800'
                          }`}>
                            {calculationResults.financialSummary.subtotal.status === 'pass' ? '✓' : '✗'} Subtotal: ${calculationResults.financialSummary.subtotal.calculated.toFixed(2)}
                            {calculationResults.financialSummary.subtotal.status === 'fail' && (
                              <span className="block text-red-600 mt-1">
                                Extracted: ${calculationResults.financialSummary.subtotal.extracted.toFixed(2)} (Mismatch!)
                              </span>
                            )}
                          </div>
                          <div className="p-2 rounded bg-gray-50 text-gray-700">
                            Shipping: ${calculationResults.financialSummary.shipping.amount.toFixed(2)}
                          </div>
                          <div className="p-2 rounded bg-gray-50 text-gray-700">
                            Discount: -${calculationResults.financialSummary.discount.amount.toFixed(2)}
                          </div>
                          <div className="p-2 rounded bg-gray-50 text-gray-700">
                            Tax: ${calculationResults.financialSummary.tax.amount.toFixed(2)}
                          </div>
                          <div className={`p-2 rounded font-semibold ${
                            calculationResults.financialSummary.total.status === 'pass'
                              ? 'bg-green-50 text-green-800'
                              : 'bg-red-50 text-red-800'
                          }`}>
                            {calculationResults.financialSummary.total.status === 'pass' ? '✓' : '✗'} Total: ${calculationResults.financialSummary.total.calculated.toFixed(2)}
                            {calculationResults.financialSummary.total.status === 'fail' && (
                              <span className="block text-red-600 mt-1">
                                Extracted: ${calculationResults.financialSummary.total.extracted.toFixed(2)} (Mismatch!)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Overall Status */}
                      <div className={`mt-4 p-3 rounded-lg ${
                        calculationResults.overallStatus === 'pass'
                          ? 'bg-green-100 border border-green-300'
                          : 'bg-yellow-100 border border-yellow-300'
                      }`}>
                        <div className="flex items-center gap-2">
                          {calculationResults.overallStatus === 'pass' ? (
                            <>
                              <CheckCircle2 className="w-5 h-5 text-green-700" />
                              <span className="text-sm font-semibold text-green-700">All calculations verified</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-5 h-5 text-yellow-700" />
                              <span className="text-sm font-semibold text-yellow-700">Some calculations need review</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Center - Sticky */}
      <div className="sticky bottom-0 z-10 bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <button
            onClick={handlePrevious}
            disabled={currentInvoiceIndex <= 0}
            className="flex items-center gap-1 px-4 py-2 rounded-md border border-gray-300 text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex-1 flex flex-col items-center gap-2 max-w-md">
            <span className="font-semibold text-black text-sm">
              Invoice {currentInvoiceIndex + 1} of {sortedInvoiceIds.length}
            </span>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-ogaga-yellow transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleNext}
            disabled={currentInvoiceIndex >= sortedInvoiceIds.length - 1}
            className="flex items-center gap-1 px-4 py-2 rounded-md border border-gray-300 text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
