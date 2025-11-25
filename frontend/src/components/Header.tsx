interface HeaderProps {
  className?: string
}

export default function Header({ className = '' }: HeaderProps) {
  return (
    <header className={`pt-6 ml-6 md:ml-8 lg:ml-12 ${className}`}>
      <div className="logoheader">
        <img 
          src="/OGAGALogoBlack.svg" 
          loading="lazy" 
          alt="OGAGA" 
          className="w-40 sm:w-48 md:w-56 lg:w-[18rem] h-auto"
        />
      </div>
    </header>
  )
}

