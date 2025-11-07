/**
 * ExtractedDataPanel Component
 *
 * Presents editable invoice data with inline validation indicators.
 */

import { X, Plus, AlertTriangle, Check } from 'lucide-react'

interface ExtractedDataPanelProps {
  invoice: any
  financials: {
    parsedLineItems: Array<{
      id: string
      item: string
      description?: string
      quantity: number
      rate: number
      amount: number
      confidence?: number
      math_valid: boolean
      calculated_amount: number
    }>
    subtotal: number
    shipping: number
    tax: number
    discount: number
    total: number
    mathValidation: any
  }
  onInvoiceFieldChange: (field: string, value: string) => void
  onLineItemChange: (
    index: number,
    field: 'item' | 'description' | 'quantity' | 'rate' | 'amount',
    value: string,
  ) => void
  onLineItemAdd: () => void
  onLineItemRemove: (index: number) => void
  onApprove: () => void
  onReject: () => void
  onFieldClick?: (fieldName: string, value: string) => void
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)

const EditableLabel: React.FC<{ label: string; hint?: string; onClick?: () => void }> = ({ label, hint, onClick }) => (
  <span
    className={`text-xs font-medium uppercase tracking-wider text-slate-400 ${onClick ? 'cursor-pointer hover:text-slate-200' : ''}`}
    title={hint}
    onClick={onClick}
  >
    {label}
  </span>
)

const InputField: React.FC<{
  value: string | number
  placeholder?: string
  type?: string
  onChange: (value: string) => void
}> = ({ value, placeholder, type = 'text', onChange }) => (
  <input
    type={type}
    value={value ?? ''}
    placeholder={placeholder}
    onChange={(event) => onChange(event.target.value)}
    className="h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/40 focus:outline-none"
  />
)

const TextAreaField: React.FC<{
  value: string | number
  placeholder?: string
  onChange: (value: string) => void
}> = ({ value, placeholder, onChange }) => (
  <textarea
    value={value ?? ''}
    placeholder={placeholder}
    onChange={(event) => onChange(event.target.value)}
    className="max-h-24 min-h-[2.5rem] w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/40 focus:outline-none"
  />
)

const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <section className="space-y-3">
    <div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      {description && <p className="text-xs text-slate-400">{description}</p>}
    </div>
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-inner">
      {children}
    </div>
  </section>
)

export const ExtractedDataPanel: React.FC<ExtractedDataPanelProps> = ({
  invoice,
  financials,
  onInvoiceFieldChange,
  onLineItemChange,
  onLineItemAdd,
  onLineItemRemove,
  onApprove,
  onReject,
  onFieldClick,
}) => {
  const { parsedLineItems, subtotal, total, mathValidation } = financials
  const overallValid = mathValidation?.overall_valid !== false

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/5 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Editable data</h3>
            <p className="text-xs text-slate-400">Make corrections inline, changes sync instantly.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
        <Section title="Invoice information">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <EditableLabel
                label="Invoice number"
                hint="Click to locate in PDF"
                onClick={onFieldClick ? () => onFieldClick('Invoice Number', invoice.invoice_number) : undefined}
              />
              <InputField value={invoice.invoice_number ?? ''} onChange={(value) => onInvoiceFieldChange('invoice_number', value)} />
            </div>
            <div className="space-y-2">
              <EditableLabel
                label="Invoice date"
                onClick={onFieldClick ? () => onFieldClick('Date', invoice.date) : undefined}
              />
              <InputField type="date" value={invoice.date ?? ''} onChange={(value) => onInvoiceFieldChange('date', value)} />
            </div>
            <div className="space-y-2">
              <EditableLabel label="Vendor" onClick={onFieldClick ? () => onFieldClick('Vendor', invoice.vendor) : undefined} />
              <InputField value={invoice.vendor ?? invoice.vendor_name ?? ''} onChange={(value) => onInvoiceFieldChange('vendor', value)} />
            </div>
            <div className="space-y-2">
              <EditableLabel label="Customer" />
              <TextAreaField value={invoice.customer?.name ?? invoice.customer ?? ''} onChange={(value) => onInvoiceFieldChange('customer', value)} />
            </div>
          </div>
        </Section>

        <Section title="Line items" description="Adjust quantities, rates, or add new rows.">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm text-slate-100">
              <thead className="text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="w-[40%] text-left">Description</th>
                  <th className="w-[10%] text-right">Qty</th>
                  <th className="w-[15%] text-right">Rate</th>
                  <th className="w-[15%] text-right">Amount</th>
                  <th className="w-[10%] text-center">Valid</th>
                  <th className="w-[10%]" />
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.map((item: any, index: number) => {
                  const parsed = parsedLineItems[index]
                  return (
                    <tr key={item.id} className="rounded-xl border border-white/5 bg-white/[0.02] shadow-inner">
                      <td className="p-3 align-top">
                        <InputField
                          value={item.item}
                          placeholder="Item name"
                          onChange={(value) => onLineItemChange(index, 'item', value)}
                        />
                        <div className="mt-2">
                          <TextAreaField
                            value={item.description ?? ''}
                            placeholder="Description (optional)"
                            onChange={(value) => onLineItemChange(index, 'description', value)}
                          />
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <InputField
                          type="number"
                          value={item.quantity}
                          onChange={(value) => onLineItemChange(index, 'quantity', value)}
                        />
                      </td>
                      <td className="p-3 align-top">
                        <InputField
                          type="number"
                          value={item.rate}
                          onChange={(value) => onLineItemChange(index, 'rate', value)}
                        />
                      </td>
                      <td className="p-3 align-top">
                        <InputField
                          type="number"
                          value={item.amount}
                          onChange={(value) => onLineItemChange(index, 'amount', value)}
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Calculated: {formatCurrency(parsed?.calculated_amount ?? 0)}
                        </p>
                      </td>
                      <td className="p-3 text-center align-top">
                        {parsed?.math_valid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                            <Check className="h-3 w-3" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
                            <AlertTriangle className="h-3 w-3" /> Check
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right align-top">
                        <button
                          type="button"
                          onClick={() => onLineItemRemove(index)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/5 text-slate-300 transition hover:bg-white/10"
                          aria-label="Remove line item"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={onLineItemAdd}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
          >
            <Plus className="h-4 w-4" /> Add line item
          </button>
        </Section>

        <Section title="Financial summary">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <EditableLabel label="Subtotal" />
              <div className="text-lg font-semibold text-white">{formatCurrency(subtotal)}</div>
              {!mathValidation?.subtotal_valid && (
                <p className="text-xs text-amber-300">Subtotal does not match the sum of line items.</p>
              )}
            </div>
            <div className="space-y-2">
              <EditableLabel label="Shipping" />
              <InputField
                type="number"
                value={invoice.shipping ?? ''}
                onChange={(value) => onInvoiceFieldChange('shipping', value)}
              />
            </div>
            <div className="space-y-2">
              <EditableLabel label="Discount" />
              <InputField
                type="number"
                value={invoice.discount_amount ?? ''}
                onChange={(value) => onInvoiceFieldChange('discount_amount', value)}
              />
            </div>
            <div className="space-y-2">
              <EditableLabel label="Tax" />
              <InputField type="number" value={invoice.tax ?? ''} onChange={(value) => onInvoiceFieldChange('tax', value)} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
            <div>
              <EditableLabel
                label="Grand total"
                onClick={onFieldClick ? () => onFieldClick('Total Amount', String(total)) : undefined}
              />
              <div className="text-2xl font-semibold text-white">{formatCurrency(total)}</div>
            </div>
            {overallValid ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                <Check className="h-3 w-3" /> Math checks out
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                <AlertTriangle className="h-3 w-3" /> Review calculations
              </span>
            )}
          </div>
        </Section>

        {mathValidation?.errors && mathValidation.errors.length > 0 && (
          <Section title="Validation alerts">
            <div className="space-y-2">
              {mathValidation.errors.map((alert: any, index: number) => (
                <div key={`${alert.type}-${index}`} className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-semibold text-amber-200">{alert.type}</p>
                    <p>{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      <div className="border-t border-white/5 px-6 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={onReject}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
          >
            <AlertTriangle className="h-4 w-4" /> Flag for follow-up
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={!overallValid}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              overallValid
                ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
                : 'cursor-not-allowed border border-slate-600/40 bg-slate-700/20 text-slate-400'
            }`}
          >
            <Check className="h-4 w-4" /> Approve invoice
          </button>
        </div>
        {!overallValid && (
          <p className="mt-2 text-xs text-slate-400">Resolve validation warnings before approval.</p>
        )}
      </div>
    </div>
  )
}

export default ExtractedDataPanel

