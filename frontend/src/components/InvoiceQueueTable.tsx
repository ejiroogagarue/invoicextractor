"use client";

import { useMemo } from 'react'
import { ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'

export type InvoiceReviewStatus = 'AUTO_APPROVED' | 'APPROVED_WITH_VERIFICATION' | 'REQUIRES_REVIEW' | 'FLAGGED'

export interface InvoiceQueueItem {
  id: string
  invoiceNumber?: string | null
  vendor?: string | null
  filename?: string | null
  date?: string | null
  totalAmount?: number | null
  confidence?: number | null
  reviewStatus?: InvoiceReviewStatus | string | null
  provider?: string | null
  model?: string | null
  stage?: string | null
}

interface InvoiceQueueTableProps {
  title?: string
  invoices: InvoiceQueueItem[]
  onReviewInvoice?: (invoiceId: string) => void
  className?: string
}

function ConfidenceBadge({ value }: { value: number }) {
  let color = 'bg-slate-500/20 text-slate-200'
  if (value >= 90) color = 'bg-emerald-500/15 text-emerald-200'
  else if (value >= 70) color = 'bg-amber-500/15 text-amber-200'
  else color = 'bg-rose-500/15 text-rose-200'

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', color)}>
      {value}%
    </span>
  )
}

function formatCurrency(total?: number | null) {
  if (typeof total !== 'number') return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(total)
}

function formatConfidence(confidence?: number | null) {
  if (typeof confidence !== 'number') return 0
  if (confidence <= 1) {
    return Math.round(confidence * 100)
  }
  return Math.round(confidence)
}

export function InvoiceQueueTable({
  invoices,
  onReviewInvoice,
  title = 'Invoice queue',
  className,
}: InvoiceQueueTableProps) {
  const summary = useMemo(() => {
    const total = invoices.length
    const needsReview = invoices.filter(
      (invoice) => invoice.reviewStatus === 'REQUIRES_REVIEW' || invoice.reviewStatus === 'FLAGGED'
    ).length
    const autoApproved = invoices.filter((invoice) => invoice.reviewStatus === 'AUTO_APPROVED').length

    return {
      total,
      needsReview,
      autoApproved,
    }
  }, [invoices])

  return (
    <div className={cn('w-full', className)}>
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-2 border-b border-white/5 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4rem] text-slate-400">Queue</p>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-medium text-white">
              {summary.total} invoices
            </span>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
              {summary.autoApproved} auto-approved
            </span>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-300">
              {summary.needsReview} need review
            </span>
          </div>
        </div>

        <div className="hidden grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-slate-400 lg:grid">
          <div className="col-span-2">Invoice</div>
          <div className="col-span-3">Vendor</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Total</div>
          <div className="col-span-1">Confidence</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        <div className="divide-y divide-white/5">
          {invoices.map((invoice, index) => {
            const confidence = formatConfidence(invoice.confidence)
            return (
              <div
                key={invoice.id}
                className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-12"
              >
                <div className="flex items-start justify-between md:col-span-2">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {invoice.invoiceNumber || invoice.filename || 'Untitled'}
                    </div>
                    <p className="text-xs text-slate-400">#{String(index + 1).padStart(2, '0')}</p>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <p className="text-sm font-medium text-white">{invoice.vendor || 'Unknown vendor'}</p>
                  <p className="text-xs text-slate-400">{invoice.provider ?? '—'}</p>
                </div>

                <div className="md:col-span-2">
                  <p className="text-sm text-white">{invoice.date || '—'}</p>
                  <p className="text-xs text-slate-500">{invoice.model ?? ''}</p>
                </div>

                <div className="md:col-span-2">
                  <p className="text-sm font-semibold text-white">{formatCurrency(invoice.totalAmount)}</p>
                </div>

                <div className="md:col-span-1 flex items-center">
                  <ConfidenceBadge value={confidence} />
                </div>

                <div className="md:col-span-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onReviewInvoice?.(invoice.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
                  >
                    Review invoice
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}

          {invoices.length === 0 && (
            <div className="px-6 py-20 text-center text-sm text-slate-400">
              No invoices in queue yet. Upload a document to begin.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InvoiceQueueTable
