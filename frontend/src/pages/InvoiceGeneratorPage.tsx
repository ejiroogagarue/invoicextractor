import { useState } from 'react'

export default function InvoiceGeneratorPage() {
  const [invoice, setInvoice] = useState({
    invoiceNumber: '',
    date: '',
    dueDate: '',
    vendorName: '',
    vendorEmail: '',
    vendorAddress: '',
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    items: [{ description: '', quantity: '', price: '', total: '' }],
    tax: '',
    discount: '',
    notes: '',
  })

  const handleChange = (e: any) => {
    setInvoice({ ...invoice, [e.target.name]: e.target.value })
  }

  const addItem = () => {
    setInvoice({
      ...invoice,
      items: [...invoice.items, { description: '', quantity: '', price: '', total: '' }],
    })
  }

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...invoice.items]
    newItems[index] = { ...newItems[index], [field]: value }
    if (field === 'quantity' || field === 'price') {
      const qty = parseFloat(newItems[index].quantity) || 0
      const prc = parseFloat(newItems[index].price) || 0
      newItems[index].total = (qty * prc).toFixed(2)
    }
    setInvoice({ ...invoice, items: newItems })
  }

  const calculateTotal = () => {
    const subtotal = invoice.items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0)
    const taxAmount = (subtotal * (parseFloat(invoice.tax) || 0)) / 100
    const discountAmount = (subtotal * (parseFloat(invoice.discount) || 0)) / 100
    return subtotal + taxAmount - discountAmount
  }

  const handleSubmit = () => {
    console.log('Invoice:', invoice)
    alert('Invoice generated!')
  }

  return (
    <div className="upload-page min-h-screen bg-ogaga-yellow" style={{ padding: '20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 className="pagetitle" style={{ marginBottom: '10px', fontSize: '24px' }}>
          Invoice Generator
        </h1>
        <p style={{ color: '#666', marginBottom: '20px', fontSize: '13px' }}>
          Fill out the form below to create an invoice
        </p>

        <div className="neoboxout" style={{ padding: '15px', marginBottom: '15px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input
              type="text"
              name="invoiceNumber"
              placeholder="Invoice #"
              value={invoice.invoiceNumber}
              onChange={handleChange}
              style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '3px' }}
            />
            <input
              type="date"
              name="date"
              value={invoice.date}
              onChange={handleChange}
              style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '3px' }}
            />
            <input
              type="date"
              name="dueDate"
              placeholder="Due Date"
              value={invoice.dueDate}
              onChange={handleChange}
              style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '3px' }}
            />
          </div>
        </div>

        <div className="neoboxout" style={{ padding: '15px', marginBottom: '15px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>Vendor Info</h3>
          <input
            type="text"
            name="vendorName"
            placeholder="Vendor Name"
            value={invoice.vendorName}
            onChange={handleChange}
            style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '3px', width: '100%', marginBottom: '5px' }}
          />
          <input
            type="email"
            name="vendorEmail"
            placeholder="Email"
            value={invoice.vendorEmail}
            onChange={handleChange}
            style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '3px', width: '100%', marginBottom: '5px' }}
          />
          <input
            type="text"
            name="vendorAddress"
            placeholder="Address"
            value={invoice.vendorAddress}
            onChange={handleChange}
            style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '3px', width: '100%' }}
          />
        </div>

        <div className="neoboxout" style={{ padding: '15px', marginBottom: '15px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>Client Info</h3>
          <input
            type="text"
            name="clientName"
            placeholder="Client Name"
            value={invoice.clientName}
            onChange={handleChange}
            style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '3px', width: '100%', marginBottom: '5px' }}
          />
          <input
            type="email"
            name="clientEmail"
            placeholder="Email"
            value={invoice.clientEmail}
            onChange={handleChange}
            style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '3px', width: '100%', marginBottom: '5px' }}
          />
          <input
            type="text"
            name="clientAddress"
            placeholder="Address"
            value={invoice.clientAddress}
            onChange={handleChange}
            style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '3px', width: '100%' }}
          />
        </div>

        <div className="neoboxout" style={{ padding: '15px', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Line Items</h3>
            <button
              onClick={addItem}
              style={{
                padding: '4px 8px',
                backgroundColor: '#4a90e2',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              + Add
            </button>
          </div>
          {invoice.items.map((item, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '5px', marginBottom: '5px' }}>
              <input
                type="text"
                placeholder="Description"
                value={item.description}
                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }}
              />
              <input
                type="number"
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }}
              />
              <input
                type="number"
                placeholder="Price"
                value={item.price}
                onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }}
              />
              <input
                type="text"
                placeholder="Total"
                value={item.total}
                readOnly
                style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', backgroundColor: '#f5f5f5' }}
              />
            </div>
          ))}
        </div>

        <div className="neoboxout" style={{ padding: '15px', marginBottom: '15px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#888' }}>Tax %</label>
              <input
                type="number"
                name="tax"
                value={invoice.tax}
                onChange={handleChange}
                style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '3px', width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#888' }}>Discount %</label>
              <input
                type="number"
                name="discount"
                value={invoice.discount}
                onChange={handleChange}
                style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '3px', width: '100%' }}
              />
            </div>
          </div>
          <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Total:</span>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>${calculateTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="neoboxout" style={{ padding: '15px', marginBottom: '15px' }}>
          <textarea
            name="notes"
            placeholder="Notes (optional)"
            value={invoice.notes}
            onChange={handleChange}
            style={{
              padding: '5px',
              border: '1px solid #ddd',
              borderRadius: '3px',
              width: '100%',
              minHeight: '60px',
              fontSize: '12px',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setInvoice({
              invoiceNumber: '',
              date: '',
              dueDate: '',
              vendorName: '',
              vendorEmail: '',
              vendorAddress: '',
              clientName: '',
              clientEmail: '',
              clientAddress: '',
              items: [{ description: '', quantity: '', price: '', total: '' }],
              tax: '',
              discount: '',
              notes: '',
            })}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4a90e2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4a90e2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Generate Invoice
          </button>
        </div>

        <p style={{ marginTop: '15px', fontSize: '10px', color: '#aaa', textAlign: 'center' }}>
          By using this form you agree to our terms and conditions
        </p>
      </div>
    </div>
  )
}































