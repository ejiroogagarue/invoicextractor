/**
 * DataTablePage.tsx - Invoice Overview Table (v2 Redesign)
 * 
 * Displays all processed invoices in a sortable, searchable table
 */

import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Printer, Download, ChevronDown, CheckCircle2, AlertTriangle, ArrowUpDown } from 'lucide-react'
import { motion } from 'framer-motion'
import Header from '../components/Header'

interface Invoice {
  id: string
  vendor: string
  invoiceCount: number
  date: string
  total: number
  status: 'paid' | 'pending' | 'past_due'
  review: 'approved' | 'review'
  filename?: string
  confidence?: number
  invoiceNumber?: string
}

interface AggregatedData {
  summary: {
    total_amount: string
    total_invoices_processed: number
    vendors: string[]
    average_confidence?: number
  }
  invoices: Record<string, any>
}

type SortField = 'vendor' | 'invoiceCount' | 'date' | 'total' | 'status'
type SortDirection = 'asc' | 'desc'

// Hook for counting animation
function useCountUp(end: number, duration: number = 600, start: number = 0): number {
  const [count, setCount] = useState(start)

  useEffect(() => {
    if (end === start) return

    let startTime: number | null = null
    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)
      
      // Easing function for smooth animation
      const easeOutCubic = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(start + (end - start) * easeOutCubic))

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCount(end)
      }
    }
    requestAnimationFrame(animate)
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

  // Load aggregated data from sessionStorage or location state
  useEffect(() => {
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
        const review: 'approved' | 'review' = 
          (invoice.review_status === 'AUTO_APPROVED' || invoice.review_status === 'APPROVED_WITH_VERIFICATION')
            ? 'approved' 
            : 'review'

        return {
          id,
          vendor: invoice.vendor || invoice.vendor_name || 'Unknown Vendor',
          invoiceCount: 1, // Each row is one invoice
          date: invoice.date || 'N/A',
          total,
          status,
          review,
          filename: invoice.filename,
          confidence: confidence <= 1 ? confidence * 100 : confidence,
          invoiceNumber: invoice.invoice_number,
        }
      })

      setInvoices(invoiceList)
    }
    // Trigger animation after component mounts or data loads
    const timer = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [location.state])

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
  const animatedTotalAmount = useCountUp(stats.totalAmount, 600, 0)
  const animatedTotalInvoices = useCountUp(stats.totalInvoices, 600, 0)
  const animatedUniqueVendors = useCountUp(stats.uniqueVendors, 600, 0)
  const animatedAvgConfidence = useCountUp(stats.avgConfidence, 600, 0)

  // Filter and sort invoices
  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoices

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = invoices.filter(inv =>
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
  }, [invoices, searchQuery, sortField, sortDirection])

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

  const handlePrint = () => {
    window.print()
  }

  const handleRowClick = (invoice: Invoice) => {
    // Get full invoice data from aggregatedData
    const fullInvoiceData = aggregatedData?.invoices?.[invoice.id] || invoice
    navigate('/review', { 
      state: { 
        invoice: fullInvoiceData,
        invoiceId: invoice.id,
        aggregatedData 
      } 
    })
  }

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      paid: 'bg-status-paid text-white',
      pending: 'bg-status-pending text-black',
      past_due: 'bg-status-past-due text-white',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    )
  }

  const getReviewBadge = (review: Invoice['review']) => {
    if (review === 'approved') {
      return (
        <span className="flex items-center gap-1 text-status-paid text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Approved
        </span>
      )
    } else {
      return (
        <span className="flex items-center gap-1 text-status-pending text-sm font-medium">
          <AlertTriangle className="w-4 h-4" />
          Review
        </span>
      )
    }
  }

  return (
    <div className="min-h-screen bg-ogaga-yellow flex flex-col font-sans">
      <Header />
      
      <main className="flex-1 px-4 pb-8">
        {/* Aggregate Stats Section */}
        <div className="max-w-7xl mx-auto mt-8 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={isLoaded ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
              className="bg-white rounded-xl p-4 shadow-md"
            >
              <p className="text-xs text-gray-600 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-black">${animatedTotalAmount.toLocaleString()}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={isLoaded ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
              className="bg-white rounded-xl p-4 shadow-md"
            >
              <p className="text-xs text-gray-600 mb-1">Invoices Processed</p>
              <p className="text-2xl font-bold text-black">{animatedTotalInvoices}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={isLoaded ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
              className="bg-white rounded-xl p-4 shadow-md"
            >
              <p className="text-xs text-gray-600 mb-1">Unique Vendors</p>
              <p className="text-2xl font-bold text-black">{animatedUniqueVendors}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={isLoaded ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
              className="bg-white rounded-xl p-4 shadow-md"
            >
              <p className="text-xs text-gray-600 mb-1">Avg. Confidence</p>
              <p className="text-2xl font-bold text-status-paid">{animatedAvgConfidence}%</p>
            </motion.div>
          </div>
        </div>

        {/* Table Container */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isLoaded ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
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
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-ogaga-yellow text-black px-4 py-2 rounded-lg hover:bg-ogaga-yellow-light transition-colors font-semibold"
              >
                <Printer className="w-4 h-4" />
                Print
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
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('vendor')}
                      className="flex items-center gap-1 hover:text-black transition-colors"
                    >
                      VENDOR
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('invoiceCount')}
                      className="flex items-center gap-1 hover:text-black transition-colors"
                    >
                      INVOICES
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-1 hover:text-black transition-colors"
                    >
                      DATE
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('total')}
                      className="flex items-center gap-1 hover:text-black transition-colors"
                    >
                      TOTAL
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1 hover:text-black transition-colors"
                    >
                      STATUS
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    REVIEW
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedInvoices.map((invoice, index) => (
                  <motion.tr
                    key={invoice.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={isLoaded ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 + (index * 0.05) }}
                    onClick={() => handleRowClick(invoice)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all duration-150 hover:scale-[1.01]"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-black">{invoice.vendor}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700">{invoice.invoiceCount}</td>
                    <td className="py-4 px-4 text-gray-700">{invoice.date}</td>
                    <td className="py-4 px-4 font-semibold text-black">${invoice.total.toLocaleString()}</td>
                    <td className="py-4 px-4">{getStatusBadge(invoice.status)}</td>
                    <td className="py-4 px-4">{getReviewBadge(invoice.review)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedInvoices.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No invoices found matching your search.
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}

