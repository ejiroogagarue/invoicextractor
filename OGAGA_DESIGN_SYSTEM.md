# OGAGA Design System

> A comprehensive design system for building consistent, accessible, and beautiful applications with the OGAGA brand identity.

**Version:** 1.0  
**Last Updated:** December 3, 2025  
**Framework:** React + Vite + TypeScript + Tailwind CSS

---

## 📦 Tech Stack

### Core Dependencies
```json
{
  "react": "^19.1.1",
  "react-dom": "^19.1.1",
  "react-router-dom": "^7.9.6",
  "vite": "^7.1.7",
  "typescript": "~5.9.3"
}
```

### Styling
```json
{
  "tailwindcss": "^3.4.17",
  "autoprefixer": "^10.4.21",
  "postcss": "^8.5.6",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.3.1"
}
```

### UI Enhancement
```json
{
  "framer-motion": "^12.23.24",
  "lucide-react": "^0.553.0",
  "next-themes": "^0.4.6",
  "react-dropzone": "^14.3.8"
}
```

---

## 🎨 Color System

### Brand Colors
```javascript
// Primary Brand Color (OGAGA Yellow)
'ogaga-yellow': '#ffc300'         // Main brand color
'ogaga-yellow-dark': '#DBA51C'    // Darker variant
'ogaga-yellow-light': '#FFC325'   // Lighter variant

// Neutral Colors
'ogaga-black': '#000000'          // Text, borders, accents
'ogaga-white': '#FFFFFF'          // Backgrounds, text on dark
```

### Status Colors
```javascript
// Invoice/Payment Status
'status-paid': '#3DAA48'          // Green - Completed/Paid
'status-pending': '#F3C742'       // Yellow - Pending
'status-past-due': '#E64A3D'      // Red - Overdue/Error

// Semantic Colors
'success': '#28a745'              // Success states
'warning': '#ffc107'              // Warning states  
'error': '#dc3545'                // Error states
'info': '#17a2b8'                 // Info states
```

### Background Colors
```javascript
// Page Backgrounds
'slate-50': Default body background
'slate-900': Dark text color

// Component Backgrounds
'#f8f9fa': Card backgrounds (light gray)
'#f5f5f5': Alternate backgrounds
'#ffffff': Pure white containers
```

### Usage Examples
```tsx
// Primary Button
className="bg-ogaga-yellow text-black hover:bg-ogaga-yellow-dark"

// Status Badge - Paid
className="bg-status-paid text-white"

// Status Badge - Pending
className="bg-status-pending text-black"

// Status Badge - Past Due
className="bg-status-past-due text-white"
```

---

## ✍️ Typography

### Font Family
```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Note:** Import Inter from Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Font Weights
```javascript
400 - Regular    // Body text, paragraphs
500 - Medium     // File names, subtle emphasis
600 - Semi-Bold  // Button text, form labels
700 - Bold       // Headings, titles, emphasis
```

### Type Scale

#### Headings
```css
/* Page Title (h1) */
.pagetitle {
  font-size: 3rem;           /* 48px - Desktop */
  font-weight: 700;
  letter-spacing: -0.02em;   /* Tight tracking */
  line-height: 1.2;
}

/* Section Header (h2) */
.pagesubtitle {
  font-size: 1.6rem;         /* 25.6px - Desktop */
  font-weight: 400;
  line-height: 1.5;
}

/* Component Header (h3) */
.heading-23 {
  font-size: 1.5rem;         /* 24px */
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

/* Processing Header */
.processingheader {
  font-size: 1.25rem;        /* 20px */
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
}
```

#### Body Text
```css
/* Body Text */
font-size: 1rem;             /* 16px - Base */
font-weight: 400;
line-height: 1.5;

/* Small Text */
font-size: 0.875rem;         /* 14px */
font-weight: 400;

/* Micro Text */
font-size: 0.8rem;           /* 12.8px */
color: #6c757d;              /* Muted */
```

#### Button Text
```css
.addbuttontext {
  font-size: 1rem;           /* 16px - Desktop: 18px */
  font-weight: 600;
  letter-spacing: 0.01em;
}
```

### Responsive Typography
```css
/* Mobile First Approach */
@media (min-width: 640px) {  /* sm */
  .pagetitle { font-size: 2rem; }
}

@media (min-width: 768px) {  /* md */
  .pagetitle { font-size: 2.5rem; }
  .pagesubtitle { font-size: 1.6rem; }
}

@media (min-width: 1024px) { /* lg */
  .pagetitle { font-size: 3rem; }
}
```

---

## 🔲 Spacing System

### Tailwind Spacing Scale
```javascript
// Use Tailwind's default scale
0.5  = 0.125rem  // 2px
1    = 0.25rem   // 4px
2    = 0.5rem    // 8px
3    = 0.75rem   // 12px
4    = 1rem      // 16px
5    = 1.25rem   // 20px
6    = 1.5rem    // 24px
8    = 2rem      // 32px
10   = 2.5rem    // 40px
12   = 3rem      // 48px
16   = 4rem      // 64px
20   = 5rem      // 80px
```

### Common Spacing Patterns
```tsx
// Page Padding
className="px-4 md:px-6 lg:px-8"    // Horizontal
className="py-6 md:py-8 lg:py-12"   // Vertical

// Section Gaps
className="space-y-4"   // 16px vertical gap
className="space-y-6"   // 24px vertical gap
className="space-y-8"   // 32px vertical gap

// Component Padding
className="p-8 md:p-12 lg:p-16"     // Cards/Containers

// Button Padding
className="px-8 py-4"               // Large buttons
className="px-6 py-3"               // Medium buttons
className="px-4 py-2"               // Small buttons
```

---

## 🧩 Component Patterns

### 1. Neumorphic Boxes (Signature Component)

The signature OGAGA design element - subtle 3D depth on yellow background.

```css
/* Base Neumorphic Style */
.neoboxout {
  background: linear-gradient(135deg, #ffc300 0%, #ffc300 100%);
  box-shadow: 
    0 10px 25px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  transform-style: preserve-3d;
  perspective: 1000px;
  border-radius: 1rem;  /* Adjust as needed */
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* Hover State */
.neoboxout-hover:hover {
  transform: translateY(-3px) scale(1.005);
  box-shadow: 
    0 14px 30px rgba(0, 0, 0, 0.25),
    inset 0 1px 2px rgba(255, 255, 255, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.08);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Active/Drag State */
.neoboxout-active {
  transform: translateY(-2px) scale(1.002);
  box-shadow: 
    0 12px 28px rgba(0, 0, 0, 0.24),
    inset 0 1px 2px rgba(255, 255, 255, 0.12),
    0 0 0 4px rgba(0, 0, 0, 0.2);
}

/* Press State */
.neoboxout:active {
  transform: translateY(-1px) scale(0.998);
  box-shadow: 
    0 8px 20px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  transition: all 0.15s ease-out;
}
```

**Usage:**
```tsx
<div className="neoboxout neoboxout-hover w-full max-w-2xl rounded-2xl p-12">
  {/* Content */}
</div>
```

### 2. Primary Buttons

```tsx
// Black Primary Button (Call-to-Action)
<button className="
  bg-black text-white 
  px-8 py-4 rounded-full 
  flex items-center justify-center gap-3 
  hover:bg-neutral-900 
  transition-all duration-200 
  hover:scale-[1.02] 
  shadow-[0_4px_12px_rgba(0,0,0,0.2)]
  disabled:opacity-50 
  disabled:cursor-not-allowed 
  disabled:hover:scale-100
  font-semibold text-base md:text-lg
">
  Process Invoices
</button>

// Secondary Button (Add/Less Important Action)
<button className="
  bg-black/10 text-black 
  px-8 py-4 rounded-full 
  flex items-center justify-center gap-3 
  hover:bg-black/20 
  transition-all duration-200 
  hover:scale-[1.02] 
  shadow-[0_4px_12px_rgba(0,0,0,0.1)]
  border border-black/20
  font-semibold text-base md:text-lg
">
  <img src="/addIcon.svg" className="w-5 h-5" />
  Add more files
</button>

// Neumorphic Button (On yellow background)
<button className="
  neoboxout neoboxout-hover
  px-8 md:px-12 py-3 md:py-4
  rounded-xl md:rounded-2xl
  cursor-pointer border border-black/10
  transition-all duration-300 ease-out
  focus:outline-none 
  focus:ring-2 focus:ring-black/20 
  focus:ring-offset-2 focus:ring-offset-ogaga-yellow
  font-semibold text-base md:text-lg text-black
">
  Browse Files
</button>
```

### 3. Summary Cards

```tsx
<div className="summary-card">
  <h3>Total Amount</h3>
  <p className="summary-value">$12,345.67</p>
</div>
```

```css
.summary-card {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  transition: box-shadow 0.2s ease-in-out;
}

.summary-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.summary-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #495057;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.summary-value {
  font-size: 2rem;
  font-weight: 700;
  color: #212529;
  margin: 0;
}

/* Status Variants */
.summary-card.success {
  border-left: 4px solid #28a745;
}

.summary-card.warning {
  border-left: 4px solid #ffc107;
  background-color: #fffbf0;
}

.summary-card.error {
  border-left: 4px solid #dc3545;
  background-color: #f8d7da;
}
```

### 4. Upload/Drop Zone

```tsx
<div
  {...getRootProps()}
  className={`
    neoboxout neoboxout-hover 
    w-full max-w-[800px] 
    rounded-2xl md:rounded-3xl 
    p-8 md:p-12 lg:p-16 
    cursor-pointer 
    transition-all duration-300 ease-out 
    border border-black/10
    ${isDragActive 
      ? 'border-black border-2 scale-[1.02] shadow-[0_0_0_4px_rgba(0,0,0,0.2)] neoboxout-active' 
      : ''
    }
  `}
>
  <input {...getInputProps()} />
  <div className="flex flex-col items-center pointer-events-none">
    <img src="/addDocumentIcon.svg" className="w-12 h-12 mb-6" />
    <h1 className="heading-23 text-2xl mb-2">Drop your PDF here</h1>
    <h2 className="pagesubtitle text-base text-black/70">Or click to upload</h2>
  </div>
</div>
```

### 5. File List Item

```tsx
<div className="uploadedfile flex items-center justify-between gap-3 py-2">
  <div className="flex items-center gap-3 flex-1 min-w-0">
    <img src="/CheckCircleIcon.svg" className="w-5 h-5 flex-shrink-0" />
    <h2 className="files text-base md:text-lg text-black font-medium truncate">
      {fileName}
    </h2>
  </div>
  <button
    onClick={handleRemove}
    className="flex-shrink-0 p-1.5 rounded-full hover:bg-black/10 active:bg-black/20 transition-colors"
  >
    <X className="w-4 h-4 text-black" />
  </button>
</div>
```

### 6. Icon Button (Small Actions)

```tsx
<button className="
  p-1.5 rounded-full 
  hover:bg-black/10 
  active:bg-black/20 
  transition-colors
  focus:outline-none 
  focus:ring-2 focus:ring-black/20
">
  <X className="w-4 h-4 text-black" />
</button>
```

---

## 🎭 Shadows & Depth

### Shadow System
```javascript
// Tailwind Custom Shadows (tailwind.config.js)
boxShadow: {
  'neumorphic': '0 12px 32px rgba(0,0,0,0.18)',
  'neumorphic-lg': '0 20px 40px rgba(0,0,0,0.25)',
}

// Inline Shadows
'0 4px 12px rgba(0, 0, 0, 0.1)'    // Card hover
'0 10px 25px rgba(0, 0, 0, 0.22)'  // Neumorphic base
'0 14px 30px rgba(0, 0, 0, 0.25)'  // Neumorphic hover
```

### Elevation Levels
```css
/* Level 1 - Subtle */
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

/* Level 2 - Cards */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

/* Level 3 - Neumorphic */
box-shadow: 0 10px 25px rgba(0, 0, 0, 0.22);

/* Level 4 - Elevated */
box-shadow: 0 14px 30px rgba(0, 0, 0, 0.25);

/* Level 5 - Modal/Overlay */
box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
```

---

## 🎬 Animations & Transitions

### Standard Transitions
```css
/* Default Transition */
transition: all 0.2s ease-in-out;

/* Smooth Transition */
transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

/* Quick Transition */
transition: all 0.15s ease-out;

/* Slow Transition */
transition: all 0.3s ease-out;
```

### Keyframe Animations
```css
/* Fade In (used for tooltips, modals) */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.15s ease-out;
}
```

### Hover Effects
```tsx
// Scale Up (buttons, cards)
hover:scale-[1.02]

// Scale Down (pressed state)
active:scale-[0.98]

// Lift (neumorphic)
hover:translateY(-3px)

// Background Change
hover:bg-black/20

// Opacity Change
hover:opacity-80
```

### Transform Patterns
```tsx
// Rotation (dropdowns)
className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}

// Translate (sliding)
transform: translateY(-3px) scale(1.005);

// Combined (neumorphic press)
transform: translateY(-1px) scale(0.998);
```

---

## 📱 Responsive Breakpoints

### Tailwind Breakpoints
```javascript
// Default Tailwind breakpoints
sm: '640px'    // Tablets (portrait)
md: '768px'    // Tablets (landscape)
lg: '1024px'   // Laptops
xl: '1280px'   // Desktops
2xl: '1536px'  // Large desktops
```

### Responsive Patterns
```tsx
// Mobile-first spacing
className="px-4 md:px-6 lg:px-8"

// Responsive text sizing
className="text-3xl md:text-4xl lg:text-5xl"

// Responsive width
className="w-full max-w-[400px] md:max-w-[600px] lg:max-w-[800px]"

// Responsive padding
className="p-8 md:p-12 lg:p-16"

// Responsive borders
className="rounded-2xl md:rounded-3xl"

// Conditional layout
className="flex-col sm:flex-row"
```

### Max-Width Containers
```tsx
// Small: 400px mobile, 600px tablet, 800px desktop
className="w-full max-w-[400px] md:max-w-[600px] lg:max-w-[800px]"

// Medium: 600px mobile, 800px tablet, 1000px desktop
className="w-full max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]"

// Large: Full width with constraints
className="max-w-7xl mx-auto"
```

---

## 🖼️ Icons & Assets

### Icon Library: Lucide React
```bash
npm install lucide-react
```

```tsx
import { X, ChevronDown, FileText, Upload } from 'lucide-react'

// Usage
<X className="w-4 h-4 text-black" />
<ChevronDown className="w-5 h-5" />
```

### Custom SVG Icons (Public Folder)
```
/public/
  - OGAGALogoBlack.svg          // Brand logo
  - addDocumentIcon.svg         // Upload icon
  - addIcon.svg                 // Add files icon
  - CheckCircleIcon.svg         // Success checkmark
  - ExpansionButton.svg         // Dropdown toggle
  - completedIcon.svg           // Success state
  - alertIcon.svg               // Warning state
  - approvedIcon.svg            // Approved badge
  - reviewIcon.svg              // Review required
  - SortIcon.svg                // Table sorting
  - ExportIcon.svg              // Export action
  - PrintIcon.svg               // Print action
  - ZoomInIcon.svg              // PDF zoom in
  - ZoomOutIcon.svg             // PDF zoom out
  - ConfidenceIndicator.svg     // Confidence badge
```

### Icon Sizing
```tsx
className="w-4 h-4"   // 16px - Small (close buttons, inline)
className="w-5 h-5"   // 20px - Medium (list items, buttons)
className="w-6 h-6"   // 24px - Large (primary actions)
className="w-8 h-8"   // 32px - XL (feature icons)
className="w-12 h-12" // 48px - 2XL (hero icons)
```

---

## 🔧 Utility Functions

### Class Name Merger (`cn`)
```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Usage:**
```tsx
import { cn } from '@/lib/utils'

<div className={cn(
  "base-styles",
  isActive && "active-styles",
  "conditional-styles"
)} />
```

---

## 🎨 Tailwind Configuration

### tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'ogaga-yellow': '#ffc300',
        'ogaga-yellow-dark': '#DBA51C',
        'ogaga-yellow-light': '#FFC325',
        'ogaga-black': '#000000',
        'ogaga-white': '#FFFFFF',
        'status-paid': '#3DAA48',
        'status-pending': '#F3C742',
        'status-past-due': '#E64A3D',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neumorphic': '0 12px 32px rgba(0,0,0,0.18)',
        'neumorphic-lg': '0 20px 40px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}
```

### Global CSS (index.css)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  @apply bg-slate-50 text-slate-900 antialiased min-h-screen;
}

a {
  @apply text-blue-600 font-medium no-underline;
}

a:hover {
  @apply underline;
}
```

---

## 📐 Layout Patterns

### Full-Height Page
```tsx
<div className="min-h-screen bg-ogaga-yellow flex flex-col">
  {/* Header */}
  <header className="pt-6 px-6">
    {/* Logo */}
  </header>
  
  {/* Main Content - Centered */}
  <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
    {/* Page content */}
  </div>
</div>
```

### Centered Container
```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>
```

### Grid Layout (Responsive Cards)
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {/* Cards */}
</div>

// Or with auto-fit
<div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6">
  {/* Cards */}
</div>
```

### Flex Layouts
```tsx
// Center Everything
className="flex items-center justify-center"

// Space Between
className="flex items-center justify-between"

// Vertical Stack with Gap
className="flex flex-col gap-4"

// Horizontal Row with Gap
className="flex flex-row gap-3"
```

---

## 🎯 Accessibility

### Focus States
```tsx
// Button Focus
focus:outline-none 
focus:ring-2 focus:ring-black/20 
focus:ring-offset-2 focus:ring-offset-ogaga-yellow

// Input Focus
focus:outline-none 
focus:ring-2 focus:ring-ogaga-yellow
focus:border-ogaga-yellow-dark
```

### Semantic HTML
```tsx
// Use proper button elements
<button type="button" aria-label="Close">
  <X className="w-4 h-4" />
</button>

// Use proper headings hierarchy
<h1>Page Title</h1>
<h2>Section Title</h2>
<h3>Subsection Title</h3>

// Use semantic tags
<header>, <main>, <section>, <article>, <nav>, <footer>
```

### Color Contrast
- Ensure 4.5:1 contrast ratio for text
- OGAGA Yellow (#ffc300) + Black (#000000) = Excellent contrast
- Use muted colors (#6c757d) only for secondary text

---

## 🛠️ Vite Configuration

### vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

**Usage:**
```tsx
// Instead of: import Header from '../components/Header'
import Header from '@/components/Header'

// Instead of: import { cn } from '../lib/utils'
import { cn } from '@/lib/utils'
```

---

## 📋 Component Checklist

When building a new component, ensure:

- [ ] Uses Inter font family
- [ ] Follows color system (OGAGA brand colors)
- [ ] Implements proper spacing (Tailwind scale)
- [ ] Has responsive breakpoints (mobile-first)
- [ ] Includes hover/active states
- [ ] Has focus states for accessibility
- [ ] Uses semantic HTML
- [ ] Includes proper ARIA labels
- [ ] Uses `cn()` utility for conditional classes
- [ ] Follows neumorphic design on yellow backgrounds
- [ ] Uses proper shadow elevation
- [ ] Has smooth transitions (0.2s default)
- [ ] Optimized for dark/light mode (if applicable)

---

## 🚀 Quick Start Template

### New Page Template
```tsx
import { useNavigate } from 'react-router-dom'

export default function NewPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-ogaga-yellow flex flex-col">
      {/* Header */}
      <header className="pt-6 px-6 md:px-8 lg:px-12">
        <img 
          src="/OGAGALogoBlack.svg" 
          alt="OGAGA Logo" 
          className="w-40 sm:w-48 md:w-56 h-auto"
        />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        {/* Title */}
        <div className="text-center mb-8 md:mb-12 max-w-2xl">
          <h1 className="pagetitle text-3xl md:text-4xl lg:text-5xl text-black mb-3">
            Page Title
          </h1>
          <h2 className="pagesubtitle text-base md:text-lg text-black/70">
            Page subtitle or description
          </h2>
        </div>

        {/* Neumorphic Container */}
        <div className="neoboxout neoboxout-hover w-full max-w-[800px] rounded-2xl p-8 md:p-12">
          {/* Your content here */}
        </div>
      </main>
    </div>
  )
}
```

### New Component Template
```tsx
import { cn } from '@/lib/utils'

interface ComponentProps {
  className?: string
  // Add your props
}

export default function Component({ className, ...props }: ComponentProps) {
  return (
    <div className={cn("base-styles", className)}>
      {/* Component content */}
    </div>
  )
}
```

---

## 📦 Installation Guide

### 1. Create New Vite + React + TypeScript Project
```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
```

### 2. Install Core Dependencies
```bash
npm install react-router-dom axios
```

### 3. Install Styling Dependencies
```bash
npm install -D tailwindcss autoprefixer postcss
npm install clsx tailwind-merge
```

### 4. Install UI Enhancement Libraries
```bash
npm install framer-motion lucide-react react-dropzone next-themes
```

### 5. Initialize Tailwind
```bash
npx tailwindcss init -p
```

### 6. Copy Configuration Files
- Copy `tailwind.config.js` (from above)
- Copy `src/index.css` (from above)
- Copy `src/lib/utils.ts` (from above)

### 7. Add Google Fonts
Add to `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 8. Copy Assets
Copy `/public/` folder icons and logo

---

## 🎓 Best Practices

### Do's ✅
- Use `cn()` utility for conditional classes
- Follow mobile-first responsive design
- Use semantic HTML elements
- Include ARIA labels for accessibility
- Use proper color contrast
- Implement smooth transitions
- Use Inter font family consistently
- Follow the neumorphic pattern on yellow backgrounds
- Use Lucide icons when possible
- Keep button padding consistent (`px-8 py-4` for large)

### Don'ts ❌
- Don't hardcode colors (use Tailwind classes)
- Don't mix inline styles with Tailwind (except neumorphic)
- Don't forget focus states
- Don't use arbitrary font sizes (follow type scale)
- Don't skip responsive breakpoints
- Don't ignore accessibility
- Don't use non-Inter fonts without reason
- Don't create overly complex shadows

---

## 📞 Support & Resources

### Official Documentation
- **Tailwind CSS:** https://tailwindcss.com/docs
- **React:** https://react.dev
- **Vite:** https://vitejs.dev
- **Lucide Icons:** https://lucide.dev
- **Framer Motion:** https://www.framer.com/motion

### Tools
- **Color Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **Google Fonts:** https://fonts.google.com
- **SVG Optimizer:** https://jakearchibald.github.io/svgomg/

---

**Version:** 1.0  
**Maintained by:** OGAGA Team  
**Last Updated:** December 3, 2025

























