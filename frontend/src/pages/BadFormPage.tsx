import { useState } from 'react'

function BadFormPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Form submitted!')
  }

  return (
    <div style={{ padding: '5px', backgroundColor: '#f0f0f0' }}>
      <h1 style={{ fontSize: '14px', color: '#ccc', marginBottom: '5px' }}>
        form
      </h1>
      
      <form onSubmit={handleSubmit} style={{ maxWidth: '900px' }}>
        {/* Tiny, unclear labels with poor spacing */}
        <div style={{ marginBottom: '3px' }}>
          <span style={{ fontSize: '8px', color: '#bbb' }}>n</span>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            style={{
              width: '150px',
              padding: '2px',
              fontSize: '10px',
              border: '1px solid #ddd',
              marginLeft: '50px',
            }}
          />
        </div>

        {/* No label at all */}
        <div style={{ marginBottom: '3px' }}>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            style={{
              width: '200px',
              padding: '1px',
              fontSize: '9px',
              border: '1px solid #eee',
              backgroundColor: '#fafafa',
            }}
          />
        </div>

        {/* Poor contrast, tiny text */}
        <div style={{ marginBottom: '2px' }}>
          <label style={{ fontSize: '7px', color: '#d0d0d0' }}>pass</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            style={{
              width: '100px',
              padding: '1px',
              fontSize: '8px',
              border: '1px dotted #f0f0f0',
              color: '#ccc',
            }}
          />
        </div>

        {/* Label on the right (bad practice) */}
        <div style={{ marginBottom: '3px', display: 'flex' }}>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            style={{
              width: '180px',
              padding: '2px',
              fontSize: '10px',
              border: 'none',
              backgroundColor: '#e0e0e0',
            }}
          />
          <span style={{ fontSize: '9px', color: '#aaa', marginLeft: '20px' }}>
            telephone number maybe
          </span>
        </div>

        {/* Huge textarea with no context */}
        <div style={{ marginBottom: '2px' }}>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            style={{
              width: '800px',
              height: '300px',
              padding: '1px',
              fontSize: '11px',
              border: '3px solid #999',
              resize: 'none',
            }}
          />
        </div>

        {/* Multiple buttons with unclear purposes, poor styling */}
        <div style={{ marginTop: '5px', display: 'flex', gap: '2px' }}>
          <button
            type="button"
            style={{
              padding: '1px 3px',
              fontSize: '7px',
              backgroundColor: '#ddd',
              border: 'none',
              color: '#888',
            }}
          >
            clk
          </button>
          
          <button
            type="submit"
            style={{
              padding: '2px 4px',
              fontSize: '8px',
              backgroundColor: '#e8e8e8',
              border: '1px solid #ccc',
              color: '#999',
            }}
          >
            submit maybe
          </button>
          
          <button
            type="button"
            style={{
              padding: '1px 3px',
              fontSize: '6px',
              backgroundColor: '#f0f0f0',
              border: 'none',
              color: '#aaa',
            }}
          >
            ?
          </button>
          
          <button
            type="button"
            style={{
              padding: '2px 5px',
              fontSize: '9px',
              backgroundColor: '#dcdcdc',
              border: '1px dotted #bbb',
              color: '#777',
            }}
          >
            cancel or reset idk
          </button>
        </div>

        {/* Confusing help text */}
        <div style={{ marginTop: '5px' }}>
          <p style={{ fontSize: '6px', color: '#d5d5d5', lineHeight: '1.1' }}>
            fill out the form above with your details and then click one of the buttons
            to do something with the information you entered but we're not sure what
            will happen exactly
          </p>
        </div>
      </form>
    </div>
  )
}

export default BadFormPage


























