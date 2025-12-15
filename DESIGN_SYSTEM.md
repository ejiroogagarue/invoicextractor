# OGAGA Design System
**Version:** 2.0  
**Last Updated:** December 6, 2025  
**Framework:** React 19 + Vite + TypeScript + Tailwind CSS

---

## Table of Contents
1. [Brand Identity](#brand-identity)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Library](#component-library)
6. [Neumorphic Design](#neumorphic-design)
7. [Icons & Assets](#icons--assets)
8. [Animations & Transitions](#animations--transitions)
9. [Responsive Design](#responsive-design)
10. [Accessibility](#accessibility)
11. [Code Patterns](#code-patterns)

---

## Brand Identity

### Brand Colors
The OGAGA brand is built around a vibrant yellow (#ffc300) that creates a warm, energetic, and professional aesthetic.

**Primary Brand Color:**
- **OGAGA Yellow:** `#ffc300` - The signature brand color used for backgrounds, accents, and primary UI elements

**Brand Philosophy:**
- Clean, modern, and professional
- Warm and approachable
- High contrast for accessibility
- Distinctive neumorphic depth effects

---

## Color System

### Primary Colors

```javascript
// Brand Colors (tailwind.config.js)
'ogaga-yellow': '#ffc300'           // Primary brand color
'ogaga-yellow-dark': '#DBA51C'       // Darker variant for hover states
'ogaga-yellow-light': '#FFC325'      // Lighter variant
'ogaga-black': '#000000'             // Text, borders, primary buttons
'ogaga-white': '#FFFFFF'             // Backgrounds, text on dark
```

### Status Colors

```javascript
// Invoice/Payment Status Indicators
'status-paid': '#3DAA48'             // Green - Completed/Paid/Validated
'status-pending': '#F3C742'          // Yellow - Pending/In Progress
'status-past-due': '#E64A3D'         // Red - Error/Failed/Past Due
```

### Neutral Colors

```css
/* Tailwind Default Grays */
text-black          /* #000000 - Primary text */
text-black/70       /* 70% opacity - Secondary text */
text-black/80       /* 80% opacity - Tertiary text */
bg-white            /* #FFFFFF - Card backgrounds */
bg-gray-50          /* Light backgrounds */
bg-gray-100         /* Subtle backgrounds */
bg-gray-200         /* Borders, dividers */
```

### Color Usage Examples

```tsx
// Primary Background
<div className="bg-ogaga-yellow">...</div>

// Status Badge - Paid
<span className="text-status-paid">Validated</span>

// Status Badge - Pending
<span className="text-status-pending">Review</span>

// Status Badge - Error
<span className="text-status-past-due">Failed</span>

// Text Hierarchy
<h1 className="text-black">Primary Text</h1>
<p className="text-black/70">Secondary Text</p>
<span className="text-black/50">Tertiary Text</span>
```

---

## Typography

### Font Family

**Primary Font:** Inter
```css
font-family: 'Inter', 'system-ui', 'sans-serif';
```

**Implementation:**
```html
<!-- Add to index.html -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Font Weights

```css
font-weight: 400  /* Regular - Body text, descriptions */
font-weight: 500  /* Medium - File names, labels */
font-weight: 600  /* Semi-Bold - Button text, emphasis */
font-weight: 700  /* Bold - Headings, titles */
```

### Type Scale

#### Headings

**Page Title (H1)**
```tsx
className="pagetitle text-3xl md:text-4xl lg:text-5xl text-black"
// Mobile: 30px (1.875rem)
// Tablet: 36px (2.25rem)  
// Desktop: 48px (3rem)
// Weight: 700, Letter-spacing: -0.02em
```

**Page Subtitle (H2)**
```tsx
className="pagesubtitle text-base md:text-[1.6rem] text-black/70"
// Mobile: 16px (1rem)
// Desktop: 25.6px (1.6rem)
// Weight: 400
```

**Component Header (H3)**
```tsx
className="heading-23 text-xl md:text-2xl lg:text-3xl text-black"
// Mobile: 20px (1.25rem)
// Tablet: 24px (1.5rem)
// Desktop: 30px (1.875rem)
// Weight: 700, Letter-spacing: -0.01em
```

**Processing Header**
```tsx
className="processingheader text-lg md:text-xl lg:text-2xl text-black"
// Mobile: 18px (1.125rem)
// Tablet: 20px (1.25rem)
// Desktop: 24px (1.5rem)
// Weight: 700
```

#### Body Text

```tsx
// Base Body
className="text-base"              // 16px

// Small Text
className="text-sm"                // 14px

// Extra Small
className="text-xs"                // 12px
```

#### Button Text

```tsx
className="addbuttontext text-base md:text-lg font-semibold"
// Mobile: 16px
// Desktop: 18px
// Weight: 600
```

### Typography Classes

**Custom CSS Classes (index.css):**
```css
.pagetitle {
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.pagesubtitle {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
}

.heading-23 {
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.processingheader {
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.indicationparagraph {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  letter-spacing: 0.01em;
}
```

---

## Spacing & Layout

### Spacing Scale

Uses Tailwind's default spacing scale:

```javascript
0.5  = 2px   (0.125rem)
1    = 4px   (0.25rem)
2    = 8px   (0.5rem)
3    = 12px  (0.75rem)
4    = 16px  (1rem)
5    = 20px  (1.25rem)
6    = 24px  (1.5rem)
8    = 32px  (2rem)
10   = 40px  (2.5rem)
12   = 48px  (3rem)
16   = 64px  (4rem)
```

### Common Spacing Patterns

**Page Padding:**
```tsx
className="px-4 md:px-6 lg:px-8"    // Horizontal padding
className="py-6 md:py-8 lg:py-12"    // Vertical padding
```

**Component Padding:**
```tsx
className="p-8 md:p-12 lg:p-16"     // Cards, containers
className="px-8 py-4"                // Buttons
className="p-4"                      // Small components
```

**Gaps:**
```tsx
className="gap-3"                    // 12px - Small gaps
className="gap-4"                    // 16px - Default gaps
className="gap-6"                    // 24px - Medium gaps
className="gap-8"                    // 32px - Large gaps
```

**Margins:**
```tsx
className="mb-3 md:mb-4"             // Section spacing
className="mb-6 md:mb-8"             // Large section spacing
className="mb-8 md:mb-12"            // Page section spacing
```

### Layout Patterns

**Full-Height Page:**
```tsx
<div className="min-h-screen bg-ogaga-yellow flex flex-col">
  <header className="pt-6 px-6 md:px-8 lg:px-12">...</header>
  <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
    {/* Content */}
  </main>
</div>
```

**Centered Container:**
```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>
```

**Responsive Width Containers:**
```tsx
// Small container
className="w-full max-w-[400px] md:max-w-[600px] lg:max-w-[800px]"

// Medium container
className="w-full max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]"

// Full width with constraints
className="max-w-7xl mx-auto"
```

**Grid Layouts:**
```tsx
// Responsive grid
className="grid grid-cols-2 md:grid-cols-4 gap-4"

// Auto-fit grid
className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6"
```

---

## Component Library

### 1. Neumorphic Box (Signature Component)

The signature OGAGA design element - creates subtle 3D depth on yellow backgrounds.

**Base Style:**
```tsx
<div className="neoboxout neoboxout-hover rounded-2xl md:rounded-3xl p-8 md:p-12 lg:p-16">
  {/* Content */}
</div>
```

**CSS Implementation:**
```css
.neoboxout {
  background: linear-gradient(135deg, #ffc300 0%, #ffc300 100%);
  box-shadow: 
    0 10px 25px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.1);
  transform-style: preserve-3d;
  perspective: 1000px;
}

.neoboxout-hover:hover {
  transform: translateY(-3px) scale(1.005);
  box-shadow: 
    0 14px 30px rgba(0, 0, 0, 0.25),
    inset 0 1px 2px rgba(255, 255, 255, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.08);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.neoboxout-active {
  transform: translateY(-2px) scale(1.002);
  box-shadow: 
    0 12px 28px rgba(0, 0, 0, 0.24),
    inset 0 1px 2px rgba(255, 255, 255, 0.12),
    0 0 0 4px rgba(0, 0, 0, 0.2);
}
```

**Usage Example:**
```tsx
<div
  className={`
    neoboxout neoboxout-hover 
    w-full max-w-[800px] 
    rounded-2xl md:rounded-3xl 
    p-8 md:p-12 lg:p-16 
    cursor-pointer 
    transition-all duration-300 ease-out 
    border border-black/10
    ${isActive ? 'neoboxout-active' : ''}
  `}
>
  {/* Content */}
</div>
```

### 2. Primary Buttons

**Black Primary Button (Call-to-Action):**
```tsx
<button className="
  addbutton
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
">
  <p className="addbuttontext text-base md:text-lg">Button Text</p>
  <div className="addbuttonicon">
    <img src="/icon.svg" className="w-5 h-5" alt="Icon" />
  </div>
</button>
```

**Neumorphic Button (On Yellow Background):**
```tsx
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

**Secondary Button:**
```tsx
<button className="
  bg-black/10 text-black 
  px-8 py-4 rounded-full 
  hover:bg-black/20 
  transition-all duration-200 
  hover:scale-[1.02] 
  shadow-[0_4px_12px_rgba(0,0,0,0.1)]
  border border-black/20
  font-semibold text-base md:text-lg
">
  Secondary Action
</button>
```

### 3. Summary Cards

**Stats Card:**
```tsx
<motion.div
  initial={{ opacity: 0, y: 15 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
  className="bg-white rounded-xl p-4 shadow-md"
>
  <p className="stats-label text-sm text-gray-600 mb-1">Label</p>
  <p className="stats-value text-2xl font-bold text-black">$12,345.67</p>
</motion.div>
```

**Grid Layout:**
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {/* Stats cards */}
</div>
```

### 4. Upload/Drop Zone

```tsx
<div
  {...getRootProps()}
  className={`
    neoboxout neoboxout-hover 
    w-full max-w-[400px] md:max-w-[600px] lg:max-w-[800px] 
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
    <img src="/addDocumentIcon.svg" className="w-12 h-12 md:w-14 md:h-14 mb-6 md:mb-8 opacity-90" alt="Upload" />
    <h1 className="heading-23 text-xl md:text-2xl lg:text-3xl text-black mb-2 md:mb-3">
      Drop your PDF here
    </h1>
    <h2 className="pagesubtitle text-sm md:text-base text-black/70">
      Or click to upload
    </h2>
  </div>
</div>
```

### 5. Data Table

**Table Container:**
```tsx
<div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6">
  {/* Table content */}
</div>
```

**Table Row:**
```tsx
<motion.tr
  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
  whileHover={{ y: -2, transition: { duration: 0.15, ease: "easeOut" } }}
>
  <td className="py-4 px-4">
    <div className="flex items-center gap-2">
      <ChevronDown className="w-4 h-4 text-gray-400" />
      <span className="text-black">Content</span>
    </div>
  </td>
</motion.tr>
```

**Processing Row:**
```tsx
<motion.tr className="border-b border-gray-100 bg-gray-50/60">
  <td colSpan={5} className="py-5 px-4">
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-black transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-black">{progress}%</span>
    </div>
  </td>
</motion.tr>
```

### 6. Status Badges

**Review Badge - Validated:**
```tsx
<span className="flex items-center gap-1 text-status-paid text-sm font-medium">
  <CheckCircle2 className="w-4 h-4" />
  Validated
</span>
```

**Review Badge - Needs Review:**
```tsx
<span className="flex items-center gap-1 text-ogaga-yellow text-sm font-medium">
  <AlertTriangle className="w-4 h-4" />
  Review
</span>
```

### 7. Banners/Notifications

**Success Banner:**
```tsx
<motion.div
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  className="bg-status-paid border-2 border-black rounded-2xl p-4 shadow-lg"
>
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <CheckCircle2 className="w-6 h-6 text-white" />
      <span className="text-white font-semibold">Success message</span>
    </div>
    <button className="text-white hover:text-gray-200">×</button>
  </div>
</motion.div>
```

**Error Banner:**
```tsx
<motion.div className="bg-status-past-due border-2 border-black rounded-2xl p-4 shadow-lg">
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <AlertTriangle className="w-6 h-6 text-white" />
      <span className="text-white font-semibold">Error message</span>
    </div>
    <button className="text-white hover:text-gray-200">×</button>
  </div>
</motion.div>
```

### 8. Form Elements

**Search Input:**
```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
  <input
    type="text"
    placeholder="Search..."
    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ogaga-yellow"
  />
</div>
```

**File Input (Hidden):**
```tsx
<input
  ref={fileInputRef}
  type="file"
  accept="application/pdf"
  multiple
  onChange={handleFileChange}
  className="hidden"
/>
```

---

## Neumorphic Design

### Core Principles

Neumorphism (soft UI) creates depth through:
1. **Layered Shadows:** Multiple shadow layers for 3D effect
2. **Inset Highlights:** Light inner shadows for embossed look
3. **Subtle Borders:** Thin borders for definition
4. **Transform Effects:** Slight lift on hover/active states

### Shadow System

**Base Shadow (Level 1):**
```css
box-shadow: 
  0 10px 25px rgba(0, 0, 0, 0.22),        /* Outer shadow */
  inset 0 1px 0 rgba(255, 255, 255, 0.1),  /* Top highlight */
  0 0 0 1px rgba(0, 0, 0, 0.05);          /* Border shadow */
```

**Hover Shadow (Level 2):**
```css
box-shadow: 
  0 14px 30px rgba(0, 0, 0, 0.25),         /* Deeper outer */
  inset 0 1px 2px rgba(255, 255, 255, 0.15), /* Stronger highlight */
  0 0 0 1px rgba(0, 0, 0, 0.08);          /* Stronger border */
```

**Active Shadow (Level 3):**
```css
box-shadow: 
  0 12px 28px rgba(0, 0, 0, 0.24),
  inset 0 1px 2px rgba(255, 255, 255, 0.12),
  0 0 0 4px rgba(0, 0, 0, 0.2);            /* Focus ring */
```

**Press Shadow (Level 4):**
```css
box-shadow: 
  0 8px 20px rgba(0, 0, 0, 0.18),          /* Reduced depth */
  inset 0 1px 0 rgba(255, 255, 255, 0.1),
  0 0 0 1px rgba(0, 0, 0, 0.05);
```

### Transform States

```tsx
// Hover
transform: translateY(-3px) scale(1.005)

// Active/Drag
transform: translateY(-2px) scale(1.002)

// Press
transform: translateY(-1px) scale(0.998)

// Default
transform: translateY(0) scale(1)
```

---

## Icons & Assets

### Icon Library: Lucide React

**Installation:**
```bash
npm install lucide-react
```

**Common Icons:**
```tsx
import { 
  Search, 
  Download, 
  ChevronDown, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpDown, 
  Plus, 
  X 
} from 'lucide-react'
```

**Usage:**
```tsx
<Search className="w-5 h-5 text-gray-400" />
<CheckCircle2 className="w-4 h-4 text-status-paid" />
<X className="w-4 h-4 text-black" />
```

### Custom SVG Icons

All custom icons are located in `/public/`:

**Navigation Icons:**
- `BackButtonIcon.svg` - Back navigation
- `NextIcon.svg` / `PreviousIcon.svg` - Pagination
- `ExpansionButtonUp.svg` / `ExpansionButtonDown.svg` - Expand/collapse

**Action Icons:**
- `addButtonIcon.svg` - Add action
- `addDocumentIcon.svg` - Upload document
- `ExportIcon.svg` - Export data
- `PrintIcon.svg` - Print action
- `ZoomInIcon.svg` / `ZoomOutIcon.svg` - PDF zoom

**Status Icons:**
- `approvedIcon.svg` - Approved state
- `reviewIcon.svg` / `reviewIconBlack.svg` - Review required
- `completedIcon.svg` - Completed state
- `alertIcon.svg` - Alert/warning
- `ConfidenceIndicator.svg` - Confidence level

**Brand:**
- `OGAGALogoBlack.svg` - OGAGA brand logo

### Icon Sizing Standards

```tsx
className="w-4 h-4"   // 16px - Small (close, inline)
className="w-5 h-5"   // 20px - Medium (buttons, list items)
className="w-6 h-6"   // 24px - Large (primary actions)
className="w-8 h-8"   // 32px - XL (feature icons)
className="w-12 h-12" // 48px - 2XL (hero icons)
```

---

## Animations & Transitions

### Framer Motion

**Installation:**
```bash
npm install framer-motion
```

### Common Animation Patterns

**Fade In:**
```tsx
<motion.div
  initial={{ opacity: 0, y: 15 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
>
  {/* Content */}
</motion.div>
```

**Staggered List:**
```tsx
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ 
      duration: 0.4, 
      ease: [0.25, 0.1, 0.25, 1],
      delay: index * 0.03  // Stagger effect
    }}
  >
    {/* Item */}
  </motion.div>
))}
```

**Hover Effects:**
```tsx
<motion.div
  whileHover={{ 
    y: -2, 
    transition: { duration: 0.15, ease: "easeOut" } 
  }}
>
  {/* Content */}
</motion.div>
```

### Transition Durations

```css
/* Quick */
transition: all 0.15s ease-out;

/* Standard */
transition: all 0.2s ease-in-out;

/* Smooth */
transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

/* Slow */
transition: all 0.3s ease-out;
```

### Easing Functions

```javascript
// Ease Out (default)
ease: "easeOut"

// Custom Cubic Bezier
ease: [0.25, 0.1, 0.25, 1]  // Smooth, natural motion

// Ease In Out
ease: "easeInOut"
```

---

## Responsive Design

### Breakpoint System

```javascript
// Tailwind Default Breakpoints
sm:  '640px'   // Small tablets (portrait)
md:  '768px'   // Tablets (landscape)
lg:  '1024px'  // Laptops
xl:  '1280px'  // Desktops
2xl: '1536px'  // Large desktops
```

### Mobile-First Approach

**Pattern:**
```tsx
// Mobile first, then scale up
className="
  text-base        // Mobile: 16px
  md:text-lg       // Tablet: 18px
  lg:text-xl       // Desktop: 20px
"
```

**Common Responsive Patterns:**

```tsx
// Spacing
className="px-4 md:px-6 lg:px-8"
className="py-6 md:py-8 lg:py-12"
className="mb-4 md:mb-6 lg:mb-8"

// Typography
className="text-3xl md:text-4xl lg:text-5xl"
className="text-base md:text-lg lg:text-xl"

// Width
className="w-full max-w-[400px] md:max-w-[600px] lg:max-w-[800px]"

// Layout
className="flex-col md:flex-row"
className="grid-cols-1 md:grid-cols-2 lg:grid-cols-4"

// Visibility
className="hidden md:block"
className="block md:hidden"
```

### Container Max-Widths

```tsx
// Small (Cards, modals)
max-w-[400px] md:max-w-[600px] lg:max-w-[800px]

// Medium (Forms, panels)
max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]

// Large (Full content)
max-w-7xl mx-auto  // 1280px with auto margins
```

---

## Accessibility

### ARIA Labels

**Required Patterns:**
```tsx
// Buttons
<button aria-label="Close panel">×</button>
<button aria-label="Browse and select PDF files">Browse</button>

// Interactive Elements
<div role="button" aria-label="Upload area" tabIndex={0}>...</div>

// Progress Indicators
<div 
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`Processing: ${progress}%`}
>
```

### Keyboard Navigation

**Focus States:**
```tsx
className="
  focus:outline-none 
  focus:ring-2 
  focus:ring-black/20 
  focus:ring-offset-2 
  focus:ring-offset-ogaga-yellow
"
```

**Keyboard Handlers:**
```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    handleClick()
  }
}}
```

### Color Contrast

**WCAG AA Compliance:**
- ✅ Black (#000000) on Yellow (#ffc300) = 19.56:1 (AAA)
- ✅ White (#FFFFFF) on Black (#000000) = 21:1 (AAA)
- ✅ Status colors meet contrast requirements

**Text Opacity:**
```tsx
text-black        // 100% - Primary text
text-black/70     // 70% - Secondary text (meets AA for large text)
text-black/50     // 50% - Tertiary (use sparingly)
```

---

## Code Patterns

### Utility Function: `cn()`

**Location:** `src/lib/utils.ts`

```typescript
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
  "base-classes",
  isActive && "active-classes",
  className  // Allow override
)} />
```

### Path Aliases

**Configuration:** `vite.config.ts`
```typescript
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  },
}
```

**Usage:**
```tsx
import Header from '@/components/Header'
import { cn } from '@/lib/utils'
```

### Component Structure

**Standard Component Template:**
```tsx
import { cn } from '@/lib/utils'

interface ComponentProps {
  className?: string
  // ... other props
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

## Best Practices

### ✅ Do's

1. **Use Design Tokens:** Always use Tailwind classes, not inline colors
2. **Mobile-First:** Start with mobile styles, then add breakpoints
3. **Semantic HTML:** Use proper heading hierarchy (h1, h2, h3)
4. **ARIA Labels:** Include labels for all interactive elements
5. **Consistent Spacing:** Use Tailwind spacing scale
6. **Neumorphic on Yellow:** Use neumorphic style only on yellow backgrounds
7. **Smooth Transitions:** Always include transition classes
8. **Focus States:** Include focus:ring for keyboard navigation
9. **Icon Sizing:** Use standard sizes (w-4, w-5, w-6)
10. **Responsive Typography:** Use responsive text classes

### ❌ Don'ts

1. **Don't Hardcode Colors:** Use Tailwind color classes
2. **Don't Skip Breakpoints:** Always consider mobile, tablet, desktop
3. **Don't Forget Focus States:** Critical for accessibility
4. **Don't Mix Styles:** Avoid inline styles except for neumorphic
5. **Don't Ignore Contrast:** Ensure text is readable
6. **Don't Use Arbitrary Sizes:** Follow the type scale
7. **Don't Skip Transitions:** Smooth interactions are key
8. **Don't Overuse Neumorphic:** Only on yellow backgrounds
9. **Don't Forget Loading States:** Show feedback during async operations
10. **Don't Skip Error Handling:** Always handle edge cases

---

## Quick Reference

### Color Classes
```tsx
bg-ogaga-yellow
text-black
text-status-paid
bg-status-pending
```

### Typography Classes
```tsx
pagetitle
pagesubtitle
heading-23
processingheader
addbuttontext
```

### Component Classes
```tsx
neoboxout
neoboxout-hover
neoboxout-active
addbutton
stats-label
stats-value
```

### Spacing
```tsx
p-8 md:p-12 lg:p-16
gap-4 md:gap-6
mb-8 md:mb-12
```

---

## Version History

- **v2.0** (Dec 6, 2025) - Updated with actual implementation patterns
- **v1.0** (Dec 3, 2025) - Initial design system documentation

---

**Maintained by:** OGAGA Development Team  
**Framework:** React 19 + Vite + TypeScript + Tailwind CSS



