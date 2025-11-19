import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { X } from 'lucide-react'

interface FileInfo {
  name: string
  size: number
  type: string
}

export default function ProcessingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [files, setFiles] = useState<FileInfo[]>([])
  const [isExpanded, setIsExpanded] = useState(true)

  // Load files from location state or sessionStorage
  useEffect(() => {
    if (location.state?.files) {
      const fileInfos: FileInfo[] = location.state.files.map((file: File) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      }))
      setFiles(fileInfos)
      sessionStorage.setItem('uploadedFiles', JSON.stringify(fileInfos))
    } else {
      const stored = sessionStorage.getItem('uploadedFiles')
      if (stored) {
        setFiles(JSON.parse(stored))
      } else {
        // No files, redirect to index
        navigate('/')
      }
    }
  }, [location.state, navigate])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileInfo[] = acceptedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }))
    const updatedFiles = [...files, ...newFiles]
    setFiles(updatedFiles)
    sessionStorage.setItem('uploadedFiles', JSON.stringify(updatedFiles))
    
    // Update location state files if available
    if (location.state?.files) {
      const updatedLocationFiles = [...location.state.files, ...acceptedFiles]
      navigate('/processing', { 
        state: { files: updatedLocationFiles },
        replace: true 
      })
    }
  }, [files, location.state, navigate])

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
    noClick: true,
    noKeyboard: true,
  })

  const handleRemoveFile = useCallback((indexToRemove: number) => {
    const updatedFiles = files.filter((_, index) => index !== indexToRemove)
    setFiles(updatedFiles)
    sessionStorage.setItem('uploadedFiles', JSON.stringify(updatedFiles))
    
    // If no files left, redirect to index
    if (updatedFiles.length === 0) {
      navigate('/')
      return
    }
    
    // Update location state files if available
    if (location.state?.files) {
      const updatedLocationFiles = location.state.files.filter((_: File, index: number) => index !== indexToRemove)
      navigate('/processing', { 
        state: { files: updatedLocationFiles },
        replace: true 
      })
    }
  }, [files, location.state, navigate])

  const handleProcess = useCallback(() => {
    // Get actual File objects from location state
    const actualFiles = location.state?.files || []
    if (actualFiles.length === 0) {
      navigate('/loading', { state: { files: actualFiles } })
      return
    }
    navigate('/loading', { state: { files: actualFiles } })
  }, [location.state, navigate])

  return (
    <div {...getRootProps()} className="upload-page min-h-screen bg-ogaga-yellow flex flex-col">
      <input {...getInputProps()} />
      
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
        <div className="titlewrapper text-center mb-8 md:mb-12">
          <h1 className="pagetitle text-3xl md:text-4xl lg:text-5xl text-black mb-3 md:mb-4">
            {files.length} {files.length === 1 ? 'file' : 'files'} received
          </h1>
          <h2 className="pagesubtitle text-base md:text-lg text-black/70">
            Review your files before processing
          </h2>
        </div>

        {/* Neumorphic Box - Fixed height to show exactly 6 files before scrolling */}
        <div className="neoboxout w-full max-w-[400px] md:max-w-[600px] lg:max-w-[800px] rounded-2xl md:rounded-3xl p-8 md:p-12 lg:p-16 max-h-[380px] md:max-h-[420px] flex flex-col">
          {/* Dropdown Wrapper */}
          <div 
            className="dropdownwrapper flex items-center gap-3 cursor-pointer mb-6 flex-shrink-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="dropdownicon">
              <img 
                src="/ExpansionButton.svg" 
                loading="lazy" 
                alt="Expand" 
                className={`addbuttoniconimage w-5 h-5 transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
            <h1 className="processingheader text-lg md:text-xl font-bold text-black">
              View uploaded files ({files.length})
            </h1>
          </div>

          {/* Files Uploaded List - Scrollable within fixed container */}
          {isExpanded && (
            <div className="filesuploaded flex-1 overflow-y-auto space-y-4 pr-2 min-h-0">
              {files.map((file, index) => (
                <div key={index} className="uploadedfile flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="fileicon flex-shrink-0">
                      <img 
                        src="/CheckCircleIcon.svg" 
                        loading="lazy" 
                        alt="Check" 
                        className="addbuttoniconimage w-5 h-5"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                    <h2 className="files text-base md:text-lg text-black font-medium truncate" title={file.name}>
                      {file.name}
                    </h2>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveFile(index)
                    }}
                    className="flex-shrink-0 p-1.5 rounded-full hover:bg-black/10 active:bg-black/20 transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-4 h-4 text-black" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-6 md:mt-8">
          <button
            onClick={open}
            className="addbutton bg-black/10 text-black px-8 py-4 rounded-full flex items-center justify-center gap-3 hover:bg-black/20 transition-all duration-200 hover:scale-[1.02] shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-black/20"
          >
            <div className="addbuttonicon">
              <img 
                src="/addIcon.svg" 
                loading="lazy" 
                alt="Add" 
                className="addbuttoniconimage w-5 h-5"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
            <p className="addbuttontext text-base md:text-lg font-semibold">
              Add more files
            </p>
          </button>
          
          <button
            onClick={handleProcess}
            disabled={files.length === 0}
            className="addbutton bg-black text-white px-8 py-4 rounded-full flex items-center justify-center gap-3 hover:bg-neutral-900 transition-all duration-200 hover:scale-[1.02] shadow-[0_4px_12px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <p className="addbuttontext text-base md:text-lg font-semibold">
              Process Invoices
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}

