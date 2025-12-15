import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'

export default function IndexPage() {
  const navigate = useNavigate()
  const [isDragActive, setIsDragActive] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const fileData = acceptedFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
      }))
      sessionStorage.setItem('uploadedFiles', JSON.stringify(fileData))
      
      navigate('/processing', { 
        state: { files: acceptedFiles } 
      })
    }
  }, [navigate])

  const { getRootProps, getInputProps, isDragActive: dropzoneDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    noClick: false,
    noKeyboard: false,
  })

  const handleBrowseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    open()
  }, [open])

  return (
    <div className="upload-page min-h-screen bg-ogaga-yellow flex flex-col">
      {/* Header Section */}
      <section className="header px-6 pt-6">
        <div className="logoheader">
          <img 
            src="/OGAGALogoBlack.svg" 
            loading="lazy" 
            alt="OGAGA Logo" 
            className="logoimage w-40 sm:w-48 md:w-[24rem] h-auto"
          />
        </div>
      </section>

      {/* Page Wrapper */}
      <div className="page-wrapper flex flex-col items-center justify-center flex-1 px-4 pb-8">
        {/* Title Wrapper */}
        <div className="titlewrapper text-center mb-8 md:mb-12 max-w-2xl">
          <h1 className="pagetitle text-3xl md:text-4xl lg:text-5xl text-black mb-3 md:mb-4">
            Lets start with one invoice
          </h1>
          <h2 className="pagesubtitle text-base md:text-[1.6rem] text-black/70">
            Upload PDF so layra can read it for you
          </h2>
        </div>

        {/* Neumorphic Box - Upload Zone */}
        <div
          {...getRootProps()}
          className={`
            neoboxout neoboxout-hover w-full max-w-[400px] md:max-w-[600px] lg:max-w-[800px] 
            rounded-2xl md:rounded-3xl p-8 md:p-12 lg:p-16 cursor-pointer 
            transition-all duration-300 ease-out border border-black/10
            ${isDragActive || dropzoneDragActive 
              ? 'border-black border-2 scale-[1.02] shadow-[0_0_0_4px_rgba(0,0,0,0.2)] neoboxout-active' 
              : ''
            }
          `}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center pointer-events-none">
            {/* Icon Container */}
            <div className="div-block-12 mb-6 md:mb-8">
              <img 
                src="/addDocumentIcon.svg" 
                loading="lazy" 
                alt="Upload Icon" 
                className="addbuttoniconimage w-12 h-12 md:w-14 md:h-14 opacity-90"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>

            {/* Primary Heading */}
            <h1 className="heading-23 text-xl md:text-2xl lg:text-3xl text-black mb-2 md:mb-3">
              Drop your PDF here
            </h1>

            {/* Secondary Subtitle */}
            <h2 className="pagesubtitle text-sm md:text-base text-black/70">
              Or click to upload
            </h2>
          </div>
        </div>

        {/* Neumorphic Browse Files Button */}
        <button
          onClick={handleBrowseClick}
          className="
            neoboxout neoboxout-hover
            mt-6 md:mt-8 px-8 md:px-12 py-3 md:py-4
            rounded-xl md:rounded-2xl
            cursor-pointer border border-black/10
            transition-all duration-300 ease-out
            focus:outline-none focus:ring-2 focus:ring-black/20 focus:ring-offset-2 focus:ring-offset-ogaga-yellow
          "
          style={{
            boxShadow: `
              0 10px 25px rgba(0, 0, 0, 0.22),
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              0 0 0 1px rgba(0, 0, 0, 0.05)
            `,
            background: 'linear-gradient(135deg, #ffc300 0%, #ffc300 100%)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px) scale(1.005)'
            e.currentTarget.style.boxShadow = `
              0 14px 30px rgba(0, 0, 0, 0.25),
              inset 0 1px 2px rgba(255, 255, 255, 0.15),
              0 0 0 1px rgba(0, 0, 0, 0.08)
            `
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)'
            e.currentTarget.style.boxShadow = `
              0 10px 25px rgba(0, 0, 0, 0.22),
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              0 0 0 1px rgba(0, 0, 0, 0.05)
            `
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px) scale(0.998)'
            e.currentTarget.style.boxShadow = `
              0 8px 20px rgba(0, 0, 0, 0.18),
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              0 0 0 1px rgba(0, 0, 0, 0.05)
            `
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px) scale(1.005)'
            e.currentTarget.style.boxShadow = `
              0 14px 30px rgba(0, 0, 0, 0.25),
              inset 0 1px 2px rgba(255, 255, 255, 0.15),
              0 0 0 1px rgba(0, 0, 0, 0.08)
            `
          }}
          aria-label="Browse and select PDF files"
        >
          <span className="font-semibold text-base md:text-lg text-black">
            Browse Files
          </span>
        </button>

        {/* Footer Indication */}
        <p className="indicationparagraph text-sm md:text-base text-black/80 mt-4 md:mt-6">
          PDF only - up to 10MB
        </p>
      </div>
    </div>
  )
}

