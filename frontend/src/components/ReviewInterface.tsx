/**
 * ReviewInterface Component
 *
 * Presents the invoice PDF alongside editable extracted data for verification.
 */

import { useEffect, useMemo, useState } from 'react'
import { PDFViewer, PdfFocusProvider } from '@llamaindex/pdf-viewer'
import '@llamaindex/pdf-viewer/index.css'
import { ArrowLeft, X } from 'lucide-react'

import { ExtractedDataPanel } from './ExtractedDataPanel'
import { PDFTextLocator } from '../services/pdfTextLocator'
import type { TextLocation } from '../services/pdfTextLocator'

interface ReviewInterfaceProps {
  invoiceData: any
  lineItems: any[]
  pdfUrl: string
  onBack: () => void
  onInvoiceChange?: (invoiceId: string, updatedInvoice: any, updatedLineItems: any[]) => void
}

interface DraftLineItem {
  id: string
  item: string
  description?: string
  quantity: string
  rate: string
  amount: string
  confidence?: number
  math_valid?: boolean
  calculated_amount?: number
}

type EditableLineItemField = 'item' | 'description' | 'quantity' | 'rate' | 'amount'

interface DraftInvoice {
  invoice_uid?: string
  invoice_number?: string
  filename?: string
  vendor?: string
  vendor_name?: string
  date?: string
  customer?: any
  shipping?: string
  discount_amount?: string
  tax?: string
  subtotal?: string
  total_amount?: string
  auto_approve?: boolean
  review_status?: string
  confidence?: any
  math_validation?: any
  performance?: any
  provider?: string
  line_items: DraftLineItem[]
  [key: string]: any
}

interface CalculatedLineItem {
  id: string
  item: string
  description?: string
  quantity: number
  rate: number
  amount: number
  confidence?: number
  math_valid: boolean
  calculated_amount: number
}

interface FinancialSnapshot {
  parsedLineItems: CalculatedLineItem[]
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
  mathValidation: any
}

const STATUS_META: Record<string, { label: string; badge: string }> = {
  AUTO_APPROVED: {
    label: 'Auto approved',
    badge: 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-300',
  },
  APPROVED_WITH_VERIFICATION: {
    label: 'Verified',
    badge: 'bg-sky-500/10 border border-sky-500/40 text-sky-300',
  },
  REQUIRES_REVIEW: {
    label: 'Needs review',
    badge: 'bg-amber-500/10 border border-amber-500/40 text-amber-300',
  },
  FLAGGED: {
    label: 'Flagged',
    badge: 'bg-rose-500/10 border border-rose-500/40 text-rose-300',
  },
  DEFAULT: {
    label: 'Pending review',
    badge: 'bg-slate-500/10 border border-slate-500/40 text-slate-200',
  },
}

const generateId = (seed: number) => `${Date.now()}-${seed}-${Math.round(Math.random() * 1_000_000)}`

const toStringValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value % 1 === 0 ? value.toString() : value.toFixed(2)
  }
  return String(value)
}

const parseNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  const trimmed = String(value).replace(/[^0-9.-]/g, '')
  if (trimmed.trim() === '') return 0
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : 0
}

const initializeDraft = (invoiceData: any, aggregatedLineItems: any[]): DraftInvoice => {
  const clone: DraftInvoice = {
    ...JSON.parse(JSON.stringify(invoiceData ?? {})),
  }

  clone.shipping = toStringValue(clone.shipping ?? '')
  clone.discount_amount = toStringValue(clone.discount_amount ?? '')
  clone.tax = toStringValue(clone.tax ?? '')
  clone.line_items = (clone.line_items ?? []).map((item: any, index: number) => {
    const aggregate = aggregatedLineItems[index]
    return {
      id: aggregate?.id ?? item.id ?? generateId(index),
      item: toStringValue(item.item ?? item.item_name ?? ''),
      description: toStringValue(item.description ?? ''),
      quantity: toStringValue(item.quantity ?? ''),
      rate: toStringValue(item.rate ?? ''),
      amount: toStringValue(item.amount ?? ''),
      confidence: aggregate?.confidence ?? item.confidence ?? invoiceData?.confidence?.overall ?? 0.85,
      math_valid: aggregate?.math_valid ?? item.math_valid ?? true,
      calculated_amount: aggregate?.calculated_amount ?? item.calculated_amount,
    }
  })

  return clone
}

const calculateFinancials = (draft: DraftInvoice): FinancialSnapshot => {
  const parsedLineItems: CalculatedLineItem[] = draft.line_items.map((item) => {
    const quantity = parseNumber(item.quantity)
    const rate = parseNumber(item.rate)
    const amountInput = item.amount === '' ? NaN : parseNumber(item.amount)
    const calculatedAmount = quantity * rate
    const amount = Number.isNaN(amountInput) ? calculatedAmount : amountInput
    const mathValid = Math.abs(amount - calculatedAmount) < 0.01

    return {
      id: item.id,
      item: item.item,
      description: item.description,
      quantity,
      rate,
      amount,
      confidence: item.confidence,
      math_valid: mathValid,
      calculated_amount: calculatedAmount,
    }
  })

  const subtotal = parsedLineItems.reduce((sum, item) => sum + item.amount, 0)
  const shipping = parseNumber(draft.shipping)
  const discount = parseNumber(draft.discount_amount)
  const tax = parseNumber(draft.tax)
  const total = subtotal + shipping + tax - discount

  const lineItemValidations = parsedLineItems.map((item) => ({
    valid: item.math_valid,
    calculated_amount: item.calculated_amount,
  }))

  const subtotalValid = parsedLineItems.every((item) => item.math_valid)
  const totalValid = Math.abs(total - (subtotal + shipping + tax - discount)) < 0.01
  const overallValid = subtotalValid && totalValid

  const mathValidation = {
    ...(draft.math_validation ?? {}),
    line_items: lineItemValidations,
    subtotal_valid: subtotalValid,
    total_valid: totalValid,
    overall_valid: overallValid,
  }

  return {
    parsedLineItems,
    subtotal,
    shipping,
    tax,
    discount,
    total,
    mathValidation,
  }
}

const buildInvoicePayload = (
  draft: DraftInvoice,
  financials: FinancialSnapshot,
  invoiceId: string,
): { invoice: any; lineItems: CalculatedLineItem[] } => {
  const invoicePayload = {
    ...draft,
    shipping: financials.shipping,
    discount_amount: financials.discount,
    tax: financials.tax,
    subtotal: financials.subtotal,
    total_amount: financials.total,
    math_validation: financials.mathValidation,
    line_items: financials.parsedLineItems.map((item, index) => ({
      id: item.id,
      item: draft.line_items[index]?.item ?? '',
      description: draft.line_items[index]?.description ?? '',
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
      confidence: draft.line_items[index]?.confidence ?? item.confidence,
      math_valid: item.math_valid,
      calculated_amount: item.calculated_amount,
    })),
  }

  const lineItemsPayload = invoicePayload.line_items.map((item: any) => ({
    ...item,
    source_invoice_id: invoiceId,
    source_invoice_number: invoicePayload.invoice_number,
    vendor: invoicePayload.vendor ?? invoicePayload.vendor_name,
    date: invoicePayload.date,
  }))

  return { invoice: invoicePayload, lineItems: lineItemsPayload }
}

export const ReviewInterface: React.FC<ReviewInterfaceProps> = ({
  invoiceData,
  lineItems,
  pdfUrl,
  onBack,
  onInvoiceChange,
}) => {
  const invoiceId = invoiceData.invoice_uid ?? invoiceData.invoice_number ?? 'invoice'

  const [draftInvoice, setDraftInvoice] = useState<DraftInvoice>(() => initializeDraft(invoiceData, lineItems))
  const financials = useMemo(() => calculateFinancials(draftInvoice), [draftInvoice])

  useEffect(() => {
    setDraftInvoice(initializeDraft(invoiceData, lineItems))
  }, [invoiceData.invoice_uid])

  const [pdfLocator] = useState(() => new PDFTextLocator())
  const [highlightedLocation, setHighlightedLocation] = useState<TextLocation | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const loadPDF = async () => {
      try {
        await pdfLocator.loadPDF(pdfUrl)
      } catch (error) {
        console.error('ReviewInterface: Failed to load PDF for search:', error)
      }
    }
    loadPDF()
  }, [pdfLocator, pdfUrl])

  const notifyChange = (nextDraft: DraftInvoice) => {
    if (!onInvoiceChange) return
    const nextFinancials = calculateFinancials(nextDraft)
    const payload = buildInvoicePayload(nextDraft, nextFinancials, invoiceId)
    onInvoiceChange(invoiceId, payload.invoice, payload.lineItems)
  }

  const updateInvoice = (mutator: (draft: DraftInvoice) => void) => {
    setDraftInvoice((current) => {
      const next = JSON.parse(JSON.stringify(current)) as DraftInvoice
      mutator(next)
      notifyChange(next)
      return next
    })
  }

  const handleFieldClick = async (_fieldName: string, value: string) => {
    if (!value || value === 'Unknown' || value === 'Unknown Date') {
      return
    }

    setIsSearching(true)

    try {
      let location = await pdfLocator.findText(value)
      if (!location) {
        const numberMatch = value.match(/[\d,]+\.?\d*/)
        if (numberMatch) {
          location = await pdfLocator.findText(numberMatch[0])
        }
      }

      if (location) {
        setHighlightedLocation(location)
        scrollToPDFPage(location.page)
      }
    } catch (error) {
      console.error('Error searching PDF:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const scrollToPDFPage = (pageNumber: number) => {
    const pageElement = document.querySelector(
      `.react-pdf__Page[data-page-number="${pageNumber}"]`
    )

    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleInvoiceFieldChange = (field: string, value: string) => {
    updateInvoice((draft) => {
      draft[field] = value
    })
  }

  const handleLineItemChange = (index: number, field: EditableLineItemField, value: string) => {
    updateInvoice((draft) => {
      const item = draft.line_items[index]
      if (!item) return
      item[field] = value
    })
  }

  const handleAddLineItem = () => {
    updateInvoice((draft) => {
      draft.line_items.push({
        id: generateId(draft.line_items.length),
        item: '',
        description: '',
        quantity: '0',
        rate: '0',
        amount: '0',
        confidence: draft.confidence?.overall ?? 0.85,
        math_valid: true,
      })
    })
  }

  const handleRemoveLineItem = (index: number) => {
    updateInvoice((draft) => {
      draft.line_items.splice(index, 1)
    })
  }

  const handleApprove = () => {
    updateInvoice((draft) => {
      draft.review_status = 'APPROVED_WITH_VERIFICATION'
      draft.auto_approve = true
    })
    onBack()
  }

  const handleReject = () => {
    updateInvoice((draft) => {
      draft.review_status = 'FLAGGED'
      draft.auto_approve = false
    })
    onBack()
  }

  const statusMeta = STATUS_META[draftInvoice.review_status ?? ''] ?? STATUS_META.DEFAULT
  const overallConfidence = draftInvoice.confidence?.overall ?? 0

  const pdfFile = {
    id: draftInvoice.invoice_number || 'invoice',
    url: pdfUrl,
  }

  return (
    <PdfFocusProvider>
      <div className="flex h-full flex-col gap-6 text-slate-100">
        <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/70 px-6 py-4 shadow-2xl backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4 md:items-center">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.5rem] text-slate-400">Invoice</p>
              <h2 className="text-lg font-semibold text-white">
                {draftInvoice.invoice_number || draftInvoice.filename || 'Untitled invoice'}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {draftInvoice.vendor && <span>{draftInvoice.vendor}</span>}
                {draftInvoice.date && <span>• {draftInvoice.date}</span>}
                {draftInvoice.provider && <span>• {draftInvoice.provider}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusMeta.badge}`}>
              {statusMeta.label}
            </span>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-[1.8fr_1.2fr]">
          <section className="flex h-[55vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-xl backdrop-blur lg:h-full">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-white">Original document</h3>
                <p className="text-xs text-slate-400">{draftInvoice.filename}</p>
              </div>
              <div className="text-right text-xs text-slate-300">
                Confidence:{' '}
                <span className="font-semibold text-white">{Math.round(overallConfidence * 100)}%</span>
                <div className="text-[11px] text-slate-500">Total: ${financials.total.toFixed(2)}</div>
              </div>
            </div>
            <div className="relative flex-1 overflow-auto bg-slate-900">
              <PDFViewer file={pdfFile} containerClassName="h-full w-full" />
              {highlightedLocation && (
                <div
                  className="pointer-events-none absolute z-40 rounded-md border-2 border-amber-300 bg-amber-200/30 shadow-lg transition"
                  style={{
                    left: `${highlightedLocation.x}px`,
                    top: `${highlightedLocation.y + (highlightedLocation.page - 1) * 820}px`,
                    width: `${highlightedLocation.width}px`,
                    height: `${highlightedLocation.height}px`,
                  }}
                />
              )}
              {isSearching && (
                <div className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">
                  Searching document…
                </div>
              )}
            </div>
          </section>

          <section className="flex h-[45vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-xl backdrop-blur lg:h-full">
            <ExtractedDataPanel
              invoice={draftInvoice}
              financials={financials}
              onInvoiceFieldChange={handleInvoiceFieldChange}
              onLineItemChange={handleLineItemChange}
              onLineItemAdd={handleAddLineItem}
              onLineItemRemove={handleRemoveLineItem}
              onApprove={handleApprove}
              onReject={handleReject}
              onFieldClick={handleFieldClick}
            />
          </section>
        </div>
      </div>
    </PdfFocusProvider>
  )
}

export default ReviewInterface

