import React from 'react'

interface HeaderProps {
  className?: string
}

export default function Header({ className = '' }: HeaderProps) {
  return (
    <header className={`px-6 py-6 ${className}`}>
      <div className="logoheader">
        <img 
          src="/OGAGALogoBlack.svg" 
          loading="lazy" 
          alt="OGAGA" 
          className="w-40 sm:w-48 md:w-56 h-auto"
        />
      </div>
    </header>
  )
}

