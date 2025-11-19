import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'

export default function LoadingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [processed, setProcessed] = useState(0)
  const [total, setTotal] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  // Load files and start processing
  useEffect(() => {
    let finalInterval: NodeJS.Timeout | null = null

    const processFiles = async () => {
      const stored = sessionStorage.getItem('uploadedFiles')
      if (!stored) {
        navigate('/')
        return
      }

      const fileInfos = JSON.parse(stored)
      setTotal(fileInfos.length)

      // Get actual File objects from location state if available
      const files = location.state?.files || []
      if (files.length === 0) {
        navigate('/')
        return
      }

      setIsProcessing(true)

      try {
        const formData = new FormData()
        files.forEach((file: File) => {
          formData.append('files', file)
        })

        // Start processing
        const response = await axios.post('http://localhost:8000/ocr/invoice/extract-batch', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 300_000,
          onUploadProgress: (progressEvent) => {
            const loaded = progressEvent.loaded || 0
            const totalSize = progressEvent.total || 1
            const uploadProgress = Math.min(Math.floor((loaded / totalSize) * 70), 70) // Upload phase: 0-70%
            setProgress(uploadProgress)
            
            // Calculate processed count: map 0-70% to 0-total files
            const processedCount = Math.floor((uploadProgress / 70) * fileInfos.length)
            setProcessed(Math.min(processedCount, fileInfos.length))
          },
        })

        // Store aggregated data for DataTable page
        sessionStorage.setItem('aggregatedData', JSON.stringify(response.data))
        
        // Simulate final processing phase (70-100%)
        setProgress(70)
        setProcessed(fileInfos.length) // All files uploaded, now processing
        
        let finalProgress = 70
        finalInterval = setInterval(() => {
          finalProgress += 5
          if (finalProgress >= 100) {
            setProgress(100)
            setProcessed(fileInfos.length)
            if (finalInterval) clearInterval(finalInterval)
            
            // Navigate after showing 100%
            setTimeout(() => {
              navigate('/completed', { 
                state: { 
                  totalInvoices: fileInfos.length,
                  aggregatedData: response.data
                } 
              })
            }, 500)
          } else {
            setProgress(finalProgress)
            // Keep processed at total during final phase
            setProcessed(fileInfos.length)
          }
        }, 150)
      } catch (error: any) {
        console.error('Processing error:', error)
        if (finalInterval) clearInterval(finalInterval)
        // On error, still navigate but with error state
        navigate('/completed', { 
          state: { 
            totalInvoices: fileInfos.length,
            error: error.message || 'Processing failed'
          } 
        })
      } finally {
        setIsProcessing(false)
      }
    }

    processFiles()

    // Cleanup interval on unmount
    return () => {
      if (finalInterval) {
        clearInterval(finalInterval)
      }
    }
  }, [navigate, location.state])

  const statusMessages = [
    'Extracting vendor names, totals, and payment dates',
    'Validating invoice data',
    'Processing line items',
    'Calculating confidence scores',
  ]
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)

  // Rotate status messages
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex(prev => (prev + 1) % statusMessages.length)
    }, 3000)
    return () => clearInterval(messageInterval)
  }, [])

  return (
    <div className="upload-page min-h-screen bg-ogaga-yellow-dark flex flex-col">
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
        {/* Neumorphic Box */}
        <div className="neoboxout w-full max-w-[400px] md:max-w-[600px] lg:max-w-[800px] rounded-2xl md:rounded-3xl p-8 md:p-12 lg:p-16">
          {/* Loading Title */}
          <div className="loadingtitle text-center mb-8 md:mb-12">
            <h1 className="processingheader loadingheader text-2xl md:text-3xl lg:text-4xl text-black mb-3 md:mb-4">
              {processed} of {total} Invoices processed.
            </h1>
            <h2 className="files loadingfiles text-base md:text-lg text-black/70">
              {statusMessages[currentMessageIndex]}
            </h2>
          </div>

          {/* Loading Meter - Progress Bar */}
          <div className="loadingmeter w-full h-8 md:h-10 rounded-full overflow-hidden relative">
            {/* Background/Empty Portion */}
            <div className="loadingbody absolute inset-0 bg-white rounded-full"></div>
            {/* Filled Portion with Percentage */}
            <div 
              className="loadingbody loadingmeter h-full bg-black text-white text-sm md:text-base font-bold flex items-center justify-center transition-all duration-500 ease-out rounded-full relative z-10"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="loadingvalue">{progress}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

