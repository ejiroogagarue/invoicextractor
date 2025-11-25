/**
 * SidePanel.tsx - Verification Dashboard Panel (Read-Only)
 * 
 * Shows verification status for invoice fields
 * Highlights what needs to be verified before approval
 */

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, AlertTriangle, FileText, ChevronRight } from 'lucide-react'

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
  jobStatus?: 'queued' | 'processing' | 'completed' | 'failed'
  jobError?: string | null
}

interface VerificationStatus {
  field: string
  label: string
  value: any
  confidence: number
  verified: boolean
  issues?: string[]
}

interface SidePanelProps {
  invoice: Invoice | null
  isOpen: boolean
  onClose: () => void
  onViewDetails?: (invoice: Invoice) => void
  fullInvoiceData?: any // Full invoice data from aggregatedData
}

export default function SidePanel({
  invoice,
  isOpen,
  onClose,
  onViewDetails,
  fullInvoiceData,
}: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Reset scroll position when invoice changes
  useEffect(() => {
    if (scrollContainerRef.current && invoice) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [invoice?.id]) // Reset when invoice ID changes

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY
      const scrollX = window.scrollX
      
      // Lock body scroll
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = `-${scrollX}px`
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
      
      return () => {
        // Restore scroll position
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.width = ''
        document.body.style.overflow = ''
        window.scrollTo(scrollX, scrollY)
      }
    }
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Delay to avoid immediate close on open
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!invoice || !fullInvoiceData) return null

  // Calculate verification status for each field
  const getVerificationStatus = (): VerificationStatus[] => {
    const confidence = invoice.confidence || 0
    const confidenceObj = fullInvoiceData.confidence || {}
    const overallConfidence = typeof confidenceObj === 'object'
      ? (confidenceObj.overall || confidenceObj.extraction || confidence)
      : (confidenceObj || confidence)

    const mathValidation = fullInvoiceData.math_validation || {}
    const hasMathIssues = !mathValidation.pass || (mathValidation.errors && mathValidation.errors.length > 0)

    // Field-level confidence (if available - may not exist, so fallback to overall)
    const extractionDetails = confidenceObj.extraction_details || {}
    const fieldConfidences = extractionDetails.field_confidences || {}

    const statuses: VerificationStatus[] = []

    // Helper to normalize confidence (0-1 to 0-100)
    const normalizeConfidence = (conf: number): number => {
      return conf <= 1 ? conf * 100 : conf
    }

    // Vendor
    const vendorConfidence = normalizeConfidence(fieldConfidences.vendor || overallConfidence)
    statuses.push({
      field: 'vendor',
      label: 'Vendor',
      value: invoice.vendor || fullInvoiceData.vendor || fullInvoiceData.vendor_name || 'N/A',
      confidence: vendorConfidence,
      verified: vendorConfidence >= 80,
      issues: vendorConfidence < 80 ? ['Low confidence'] : undefined,
    })

    // Date
    const dateConfidence = normalizeConfidence(fieldConfidences.date || overallConfidence)
    statuses.push({
      field: 'date',
      label: 'Date',
      value: invoice.date || fullInvoiceData.date || 'N/A',
      confidence: dateConfidence,
      verified: dateConfidence >= 80,
      issues: dateConfidence < 80 ? ['Low confidence'] : undefined,
    })

    // Total
    const totalConfidence = normalizeConfidence(fieldConfidences.total || overallConfidence)
    const totalIssues: string[] = []
    if (totalConfidence < 80) totalIssues.push('Low confidence')
    if (hasMathIssues) totalIssues.push('Math mismatch detected')
    
    statuses.push({
      field: 'total',
      label: 'Total',
      value: invoice.total || fullInvoiceData.total_amount || 0,
      confidence: totalConfidence,
      verified: totalConfidence >= 80 && !hasMathIssues,
      issues: totalIssues.length > 0 ? totalIssues : undefined,
    })

    // Invoice Number
    const invoiceNumberConfidence = normalizeConfidence(fieldConfidences.invoice_number || overallConfidence)
    statuses.push({
      field: 'invoiceNumber',
      label: 'Invoice Number',
      value: invoice.invoiceNumber || fullInvoiceData.invoice_number || 'N/A',
      confidence: invoiceNumberConfidence,
      verified: invoiceNumberConfidence >= 80,
      issues: invoiceNumberConfidence < 80 ? ['Low confidence'] : undefined,
    })

    return statuses
  }

  const verificationStatuses = getVerificationStatus()
  const needsVerificationCount = verificationStatuses.filter(s => !s.verified).length
  const lineItems = fullInvoiceData?.line_items || []
  
  // Check line items for issues
  const lineItemIssues: string[] = []
  if (lineItems.length > 0) {
    const mathValidation = fullInvoiceData.math_validation || {}
    
    // Check both line_item_errors and errors arrays
    const allErrors = [
      ...(mathValidation.line_item_errors || []),
      ...(mathValidation.errors || []).filter((e: any) => 
        e && (e.field?.startsWith('line_item_') || e.item_name)
      )
    ]
    
    allErrors.forEach((error: any, idx: number) => {
      if (error) {
        // Handle error object - extract message or format it
        let errorMessage = 'Validation error'
        if (typeof error === 'string') {
          errorMessage = error
        } else if (error.message) {
          errorMessage = String(error.message)
        } else if (error.item_name) {
          errorMessage = `${error.item_name}: ${error.message || error.action_required || 'Validation error'}`
        } else if (error.field) {
          errorMessage = `${error.field}: ${error.message || error.action_required || 'Validation error'}`
        }
        
        // Extract item index from field name if available
        const itemMatch = error.field?.match(/line_item_(\d+)/)
        const itemIndex = itemMatch ? parseInt(itemMatch[1]) + 1 : idx + 1
        lineItemIssues.push(`Item #${itemIndex}: ${errorMessage}`)
      }
    })

    // Check for missing quantities or amounts
    lineItems.forEach((item: any, idx: number) => {
      if (!item.quantity || item.quantity === 0) {
        lineItemIssues.push(`Item #${idx + 1}: Missing quantity`)
      }
      if (!item.amount && item.amount !== 0) {
        lineItemIssues.push(`Item #${idx + 1}: Missing amount`)
      }
    })
  }

  const lineItemsNeedVerification = lineItemIssues.length > 0
  const overallNeedsVerification = needsVerificationCount > 0 || lineItemsNeedVerification

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />
          
          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <h2 className="text-lg font-bold text-black">
                      {invoice.invoiceNumber || 'Invoice'}
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600">{invoice.vendor}</p>
                  <p className="text-xs text-gray-500 mt-1">{invoice.date}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Close panel"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              {/* Verification Summary */}
              {overallNeedsVerification ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-semibold text-yellow-800">
                      {needsVerificationCount + (lineItemsNeedVerification ? 1 : 0)} item{needsVerificationCount + (lineItemsNeedVerification ? 1 : 0) !== 1 ? 's' : ''} need verification
                    </span>
                  </div>
                  <p className="text-xs text-yellow-700">
                    Review highlighted fields before approval
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-800">
                      All fields verified
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable content */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {/* Verification Status */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Verification Status
                </h3>
                
                {verificationStatuses.map((status) => (
                  <div
                    key={status.field}
                    className={`border rounded-lg p-3 ${
                      status.verified
                        ? 'border-green-200 bg-green-50/50'
                        : 'border-yellow-200 bg-yellow-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2 flex-1">
                        {status.verified ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">
                              {status.label}:
                            </span>
                            <span className="text-sm text-gray-900 truncate">
                              {status.field === 'total' 
                                ? formatCurrency(status.value)
                                : status.value}
                            </span>
                          </div>
                          {status.verified ? (
                            <span className="text-xs text-green-700 mt-1 block">
                              Verified ({status.confidence}%)
                            </span>
                          ) : (
                            <div className="mt-1">
                              <span className="text-xs text-yellow-700 block">
                                Needs verification ({status.confidence}%)
                              </span>
                              {status.issues && status.issues.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {status.issues.map((issue, idx) => (
                                    <li key={idx} className="text-xs text-yellow-600">
                                      • {issue}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Line Items Summary */}
              {lineItems.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Line Items
                  </h3>
                  
                  <div className={`border rounded-lg p-3 ${
                    lineItemsNeedVerification
                      ? 'border-yellow-200 bg-yellow-50/50'
                      : 'border-green-200 bg-green-50/50'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {lineItemsNeedVerification ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                      <span className="text-sm font-semibold text-gray-700">
                        {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} total
                        {lineItemsNeedVerification && `, ${lineItemIssues.length} need verification`}
                      </span>
                    </div>
                    
                    {lineItemsNeedVerification && lineItemIssues.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {lineItemIssues.slice(0, 3).map((issue, idx) => (
                          <p key={idx} className="text-xs text-yellow-600">
                            • {issue}
                          </p>
                        ))}
                        {lineItemIssues.length > 3 && (
                          <p className="text-xs text-yellow-600">
                            +{lineItemIssues.length - 3} more issue{lineItemIssues.length - 3 !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {!lineItemsNeedVerification && (
                      <p className="text-xs text-green-700 mt-1">
                        All line items verified
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Math Validation Summary */}
              {fullInvoiceData.math_validation && (
                <div className="border-t border-gray-200 pt-4">
                  <div className={`border rounded-lg p-3 ${
                    fullInvoiceData.math_validation.pass || fullInvoiceData.math_validation.overall_valid
                      ? 'border-green-200 bg-green-50/50'
                      : 'border-red-200 bg-red-50/50'
                  }`}>
                    <div className="flex items-center gap-2">
                      {(fullInvoiceData.math_validation.pass || fullInvoiceData.math_validation.overall_valid) ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-semibold text-green-800">
                            Math validated
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-semibold text-red-800">
                            Math validation failed
                          </span>
                        </>
                      )}
                    </div>
                    {!(fullInvoiceData.math_validation.pass || fullInvoiceData.math_validation.overall_valid) && fullInvoiceData.math_validation.errors && (
                      <div className="mt-1">
                        {Array.isArray(fullInvoiceData.math_validation.errors) && fullInvoiceData.math_validation.errors.length > 0 ? (
                          <p className="text-xs text-red-600">
                            {typeof fullInvoiceData.math_validation.errors[0] === 'string' 
                              ? fullInvoiceData.math_validation.errors[0]
                              : fullInvoiceData.math_validation.errors[0].message || 'Calculation mismatch detected'}
                          </p>
                        ) : (
                          <p className="text-xs text-red-600">
                            Calculation mismatch detected
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Button (sticky bottom) */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              {onViewDetails && (
                <button
                  onClick={() => invoice && onViewDetails(invoice)}
                  className="w-full flex items-center justify-center gap-2 bg-ogaga-yellow text-black px-4 py-3 rounded-lg font-semibold hover:bg-ogaga-yellow-light transition-colors shadow-sm"
                >
                  <FileText className="w-5 h-5" />
                  Review Details
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              
              {/* Keyboard hint */}
              <p className="text-xs text-gray-400 text-center mt-2">
                Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd> to close
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
