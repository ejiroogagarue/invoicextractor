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

  const { getRootProps, getInputProps, isDragActive: dropzoneDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  })

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

        {/* Footer Indication */}
        <p className="indicationparagraph text-sm md:text-base text-black/80 mt-6 md:mt-8">
          PDF only - up to 10MB
        </p>
      </div>
    </div>
  )
}

