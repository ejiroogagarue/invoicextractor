/**
 * Dashboard.tsx - Results Dashboard Component
 */

import { useMemo, useState } from 'react'

import SummaryCards from './components/SummaryCards'
import InvoiceQueueTable, { type InvoiceQueueItem } from './components/InvoiceQueueTable'

interface DashboardProps {
  aggregatedData: {
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
  }
  onReviewInvoice?: (invoiceId: string, invoiceData: any) => void
}

type ViewFilter = 'all' | 'needs-review' | 'auto-approved'

const VIEW_FILTERS: Array<{ id: ViewFilter; label: string }> = [
  { id: 'all', label: 'All invoices' },
  { id: 'needs-review', label: 'Needs review' },
  { id: 'auto-approved', label: 'Auto approved' },
]

const needsReviewStatuses = new Set(['REQUIRES_REVIEW', 'FLAGGED'])
const autoApprovedStatuses = new Set(['AUTO_APPROVED', 'APPROVED_WITH_VERIFICATION'])

const Dashboard: React.FC<DashboardProps> = ({ aggregatedData, onReviewInvoice }) => {
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')

  const invoiceEntries = useMemo(() => Object.entries(aggregatedData.invoices ?? {}), [aggregatedData.invoices])

  const invoiceQueue: InvoiceQueueItem[] = useMemo(
    () =>
      invoiceEntries.map(([invoiceId, invoice]) => ({
        id: invoiceId,
        invoiceNumber: invoice.invoice_number ?? invoiceId,
        vendor: invoice.vendor,
        filename: invoice.filename,
        date: invoice.date,
        totalAmount:
          typeof invoice.total_amount === 'number' ? invoice.total_amount : Number(invoice.total_amount) || null,
        confidence: invoice?.confidence?.overall ?? null,
        reviewStatus: invoice.review_status,
        provider: invoice.provider,
        model: invoice?.performance?.model ?? invoice?.performance?.provider,
      })),
    [invoiceEntries],
  )

  const filteredInvoiceQueue = useMemo(() => {
    switch (viewFilter) {
      case 'needs-review':
        return invoiceQueue.filter((invoice) => needsReviewStatuses.has(invoice.reviewStatus ?? ''))
      case 'auto-approved':
        return invoiceQueue.filter((invoice) => autoApprovedStatuses.has(invoice.reviewStatus ?? ''))
      default:
        return invoiceQueue
    }
  }, [invoiceQueue, viewFilter])

  const handleReviewRequest = (invoiceId: string) => {
    const invoice = aggregatedData.invoices?.[invoiceId]
    if (!invoice) {
      return
    }

    onReviewInvoice?.(invoiceId, invoice)
  }

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Dashboard overview</h1>
        <p className="text-sm text-muted-foreground">
          Track the health of every invoice, then drill into the queue to review documents one at a time.
        </p>
      </section>

      <SummaryCards summary={aggregatedData.summary} />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {VIEW_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setViewFilter(filter.id)}
                className={
                  viewFilter === filter.id
                    ? 'rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-sm transition'
                    : 'rounded-full border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition'
                }
              >
                {filter.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              const headers = ['Invoice ID', 'Invoice Number', 'Vendor', 'Date', 'Total', 'Confidence', 'Provider', 'Model']
              const rows = filteredInvoiceQueue.map((item) => [
                item.id,
                item.invoiceNumber ?? '',
                item.vendor ?? '',
                item.date ?? '',
                item.totalAmount != null ? String(item.totalAmount) : '',
                item.confidence != null ? String(item.confidence) : '',
                item.provider ?? '',
                item.model ?? '',
              ])
              const csvLines = [headers, ...rows].map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
              const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const anchor = document.createElement('a')
              anchor.href = url
              anchor.download = `invoice-queue-${new Date().toISOString().split('T')[0]}.csv`
              anchor.click()
              URL.revokeObjectURL(url)
            }}
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            Export queue CSV
          </button>
        </div>

        <InvoiceQueueTable invoices={filteredInvoiceQueue} onReviewInvoice={handleReviewRequest} />
      </section>
    </div>
  )
}

export default Dashboard