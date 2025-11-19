import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function CompletedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [totalInvoices, setTotalInvoices] = useState(12)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (location.state?.totalInvoices) {
      setTotalInvoices(location.state.totalInvoices)
    } else {
      const stored = sessionStorage.getItem('uploadedFiles')
      if (stored) {
        const files = JSON.parse(stored)
        setTotalInvoices(files.length || 12)
      }
    }
    // Fade in animation
    setIsVisible(true)
  }, [location.state])

  const handleReviewInvoices = () => {
    navigate('/datatable')
  }

  return (
    <div className="upload-page min-h-screen bg-ogaga-yellow flex flex-col">
      {/* Header Section */}
      <section className="header px-6 pt-6">
        <div className="logoheader">
          <img 
            src="/OGAGALogoBlack.svg" 
            loading="lazy" 
            alt="OGAGA Logo" 
            className="logoimage w-40 sm:w-48 md:w-56 h-auto"
          />
        </div>
      </section>

      {/* Page Wrapper */}
      <div className="page-wrapper flex flex-col items-center justify-center flex-1 px-4 pb-8">
        {/* Title Wrapper */}
        <div 
          className={`titlewrapper text-center mb-8 md:mb-12 transition-opacity duration-400 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Alert Icon Wrapper */}
          <div className="alerticonwrapper mb-6 md:mb-8 flex justify-center">
            <img 
              src="/SuccessImageYellow.svg" 
              loading="lazy" 
              alt="Success" 
              className="alerticon w-16 h-16 md:w-20 md:h-20"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
          
          {/* Main Title */}
          <h1 className="pagetitle text-3xl md:text-4xl lg:text-5xl text-black">
            All Invoices processed.
          </h1>
        </div>

        {/* Neumorphic Box */}
        <div className="neoboxout w-full max-w-[400px] md:max-w-[600px] lg:max-w-[800px] rounded-2xl md:rounded-3xl p-8 md:p-12 lg:p-16 flex flex-col items-center gap-6 md:gap-8">
          {/* PDF Count Message */}
          <h1 className="processingheader text-lg md:text-xl lg:text-2xl text-black text-center">
            {totalInvoices} {totalInvoices === 1 ? 'PDF' : 'PDFs'} ready for review.
          </h1>

          {/* Review Button */}
          <button
            onClick={handleReviewInvoices}
            className="addbutton bg-black text-white px-8 py-4 rounded-full flex items-center justify-center gap-3 hover:bg-neutral-900 transition-all duration-200 hover:scale-[1.02] shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
          >
            <p className="addbuttontext text-base md:text-lg">
              Review Invoices
            </p>
            <div className="addbuttonicon">
              <img 
                src="/arrowIcon.svg" 
                loading="lazy" 
                alt="Arrow" 
                className="addbuttoniconimage w-5 h-5"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

