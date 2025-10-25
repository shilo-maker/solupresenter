# SoluFlow Design System Guide

**Version 1.0** | Complete Reference for Replicating SoluFlow's Design Language

This document provides a comprehensive guide to SoluFlow's design system, allowing you to recreate the same visual style and user experience in other applications with different color schemes.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Technical Foundation](#technical-foundation)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Component Library](#component-library)
7. [Interactions & Animations](#interactions--animations)
8. [Responsive Design](#responsive-design)
9. [Implementation Guide](#implementation-guide)

---

## Design Philosophy

### Core Principles

**Modern & Fresh**
- Clean, uncluttered interfaces with generous white space
- Soft, rounded corners throughout (never sharp edges)
- Gradient-based design language for depth and vibrancy
- Shadow layering for visual hierarchy

**Friendly & Approachable**
- Bright, optimistic color palette
- Smooth animations and transitions
- Subtle hover effects that invite interaction
- Clear visual feedback for all user actions

**Professional Yet Playful**
- Serious functionality with delightful details
- Consistent component behavior
- Accessibility-first approach
- Balance between form and function

### Visual Identity

**Logo Style**: Circular icon with flowing, organic wave symbol + italic sans-serif wordmark
- The wave represents flow and movement
- Turquoise (#4ECDC4) as primary brand color
- Clean, modern aesthetic

---

## Technical Foundation

### CSS Architecture

**Hybrid Approach**:
```
Bootstrap 5.3.8 (Foundation)
    ↓
Custom Design System (modern.css)
    ↓
Component-Specific Styles
```

**Why Bootstrap + Custom?**
- Bootstrap provides solid responsive grid and utility classes
- Custom system overrides Bootstrap with modern, opinionated styles
- Component CSS files for specific customizations
- No CSS-in-JS, no CSS Modules - just well-organized traditional CSS

### File Structure

```
styles/
  └── modern.css          ← Main design system (586 lines)
                            All CSS variables and component overrides

components/
  ├── ComponentName.jsx
  └── ComponentName.css   ← Component-specific styles when needed

pages/
  ├── PageName.jsx
  └── PageName.css        ← Page-specific layouts
```

### Loading Order (Critical)

```javascript
// 1. Bootstrap for foundation
import 'bootstrap/dist/css/bootstrap.min.css';

// 2. Design system overrides
import './styles/modern.css';

// 3. Global app styles
import './index.css';

// 4. Component CSS imported in component files
```

---

## Color System

### How to Adapt Colors for Your App

**SoluFlow uses a turquoise theme, but the structure works for any color:**

1. Choose your primary brand color
2. Create a darker variant (25-30% darker)
3. Select semantic colors (success, danger, warning, info)
4. Use the same neutral grays (universal)
5. Apply gradients consistently across all colors

### Color Variables Structure

```css
:root {
  /* ============================================
     PRIMARY BRAND COLOR (Change this for your app)
     ============================================ */
  --color-primary: #4ECDC4;           /* Your main brand color */
  --color-primary-dark: #2AA198;      /* 25-30% darker */
  --color-primary-rgb: 78, 205, 196;  /* For rgba() transparency */

  /* ============================================
     SEMANTIC COLORS (Standard across apps)
     ============================================ */
  --color-success: #1DD1A1;           /* Green for positive actions */
  --color-success-light: #10AC84;     /* 15% darker */
  --color-success-rgb: 29, 209, 161;

  --color-danger: #FF6B6B;            /* Red for destructive actions */
  --color-danger-light: #EE5A6F;
  --color-danger-rgb: 255, 107, 107;

  --color-warning: #FFA502;           /* Orange/yellow for caution */
  --color-warning-light: #FF7979;
  --color-warning-rgb: 255, 165, 2;

  --color-info: #54A0FF;              /* Blue for information */
  --color-info-light: #48DBFB;
  --color-info-rgb: 84, 160, 255;

  /* ============================================
     NEUTRALS (Keep these same across all apps)
     ============================================ */
  --color-dark: #2d3748;              /* Dark gray */
  --color-gray: #718096;              /* Medium gray */
  --color-light-gray: #e2e8f0;        /* Light gray */
  --color-background: #f7fafc;        /* Page background */
  --color-white: #ffffff;             /* Pure white */

  /* ============================================
     TEXT COLORS (Three-tier hierarchy)
     ============================================ */
  --color-text-dark: #1a202c;         /* Primary text - headings */
  --color-text-medium: #4a5568;       /* Secondary text - body */
  --color-text-light: #a0aec0;        /* Tertiary text - labels */

  /* ============================================
     SECONDARY/ACCENT (Optional, for variety)
     ============================================ */
  --color-secondary: #C9956E;         /* Bronze/gold accent */
  --color-secondary-dark: #b8844e;
  --color-secondary-rgb: 201, 149, 110;

  /* ============================================
     BORDERS
     ============================================ */
  --color-border-light: #e9ecef;
  --color-border-medium: #dee2e6;
  --color-border-dark: #333333;

  /* ============================================
     STATE COLORS (Keep consistent)
     ============================================ */
  --color-disabled: #e9ecef;
  --color-placeholder: #adb5bd;
  --color-hover-bg: #f8f9fa;
}
```

### Colored Shadows (Key Design Element)

**Important**: Shadows match button colors for cohesive look

```css
/* Create shadows for each semantic color */
--shadow-primary: 0 2px 8px rgba(78, 205, 196, 0.4);
--shadow-primary-hover: 0 4px 12px rgba(78, 205, 196, 0.6);

--shadow-success: 0 2px 8px rgba(29, 209, 161, 0.4);
--shadow-success-hover: 0 4px 12px rgba(29, 209, 161, 0.6);

--shadow-danger: 0 2px 8px rgba(255, 107, 107, 0.4);
--shadow-danger-hover: 0 4px 12px rgba(255, 107, 107, 0.6);

--shadow-warning: 0 2px 8px rgba(255, 165, 2, 0.4);
--shadow-warning-hover: 0 4px 12px rgba(255, 165, 2, 0.6);
```

**Formula**: Use color's RGB values at 40% opacity (0.4) for base, 60% opacity (0.6) for hover

### Badge/Label Colors

```css
/* Customize these based on your app's needs */
--color-badge-public: var(--color-success);      /* Green */
--color-badge-workspace: var(--color-info);      /* Blue */
--color-badge-shared: #9c27b0;                   /* Purple */
--color-badge-personal: #17a2b8;                 /* Teal */
```

---

## Typography

### Font Selection

**Primary Font**: Inter (sans-serif, modern, highly legible)

```html
<!-- In HTML head -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Font Stack** (with fallbacks):
```css
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Font Sizes (Fluid & Responsive)

**Use `clamp()` for automatic responsiveness**:

```css
/* Formula: clamp(min-size, preferred-size, max-size) */
--font-xs: clamp(0.75rem, 2vw, 0.875rem);      /* 12-14px */
--font-sm: clamp(0.875rem, 2vw, 1rem);         /* 14-16px */
--font-base: clamp(1rem, 2.5vw, 1.125rem);     /* 16-18px - Body text */
--font-lg: clamp(1.125rem, 3vw, 1.25rem);      /* 18-20px */
--font-xl: clamp(1.25rem, 3.5vw, 1.5rem);      /* 20-24px - H3 */
--font-2xl: clamp(1.5rem, 4vw, 2rem);          /* 24-32px - H2 */
--font-3xl: clamp(2rem, 5vw, 3rem);            /* 32-48px - H1 */
```

**Why clamp()?** Automatically scales between mobile and desktop without media queries

### Font Weights

```css
--font-normal: 400;      /* Body text */
--font-medium: 500;      /* Slightly emphasized */
--font-semibold: 600;    /* Headings, labels */
--font-bold: 700;        /* Strong emphasis */
```

**Usage Pattern**:
- Body text: `font-normal` (400)
- Form labels: `font-semibold` (600)
- Buttons: `font-semibold` (600)
- Headings: `font-semibold` (600) or `font-bold` (700)

### Typography Utilities

```css
/* Font weights */
.fw-normal { font-weight: var(--font-normal); }
.fw-medium { font-weight: var(--font-medium); }
.fw-semibold { font-weight: var(--font-semibold); }
.fw-bold { font-weight: var(--font-bold); }

/* Text colors */
.text-primary { color: var(--color-primary); }
.text-success { color: var(--color-success); }
.text-danger { color: var(--color-danger); }
.text-dark { color: var(--color-text-dark); }
.text-medium { color: var(--color-text-medium); }
.text-light { color: var(--color-text-light); }
```

### Typography Best Practices

1. **Hierarchy**: Use size AND weight to establish hierarchy
2. **Line Height**: 1.5 for body text, 1.2 for headings
3. **Text Color**: Three levels (dark, medium, light) for visual hierarchy
4. **Font Smoothing**: Always enable antialiasing
   ```css
   body {
     -webkit-font-smoothing: antialiased;
     -moz-osx-font-smoothing: grayscale;
   }
   ```

---

## Spacing & Layout

### Spacing System (4px Grid)

**All spacing is a multiple of 4px** for visual consistency:

```css
--spacing-xs: 0.25rem;   /* 4px  - Tight spacing */
--spacing-sm: 0.5rem;    /* 8px  - Compact elements */
--spacing-md: 1rem;      /* 16px - Standard spacing */
--spacing-lg: 1.5rem;    /* 24px - Generous spacing */
--spacing-xl: 2rem;      /* 32px - Section breaks */
--spacing-2xl: 3rem;     /* 48px - Major sections */
--spacing-3xl: 4rem;     /* 64px - Page sections */
```

**Usage Examples**:
```css
/* Button padding */
padding: var(--spacing-sm) var(--spacing-lg);  /* 8px 24px */

/* Card body */
padding: var(--spacing-lg);  /* 24px all sides */

/* Section margin */
margin-bottom: var(--spacing-2xl);  /* 48px */
```

### Border Radius (Rounded Corners)

**Never use sharp edges** - everything is rounded:

```css
--border-radius-sm: 0.25rem;   /* 4px  - Badges, tags */
--border-radius-md: 0.5rem;    /* 8px  - Buttons, inputs */
--border-radius-lg: 0.75rem;   /* 12px - Cards */
--border-radius-xl: 1rem;      /* 16px - Large cards, modals */
--border-radius-full: 9999px;  /* Fully rounded - Pills, avatars */
```

**Application Guide**:
- **Small UI elements** (badges): `border-radius-sm`
- **Interactive elements** (buttons, inputs): `border-radius-md`
- **Containers** (cards): `border-radius-lg`
- **Large containers** (modals): `border-radius-xl`
- **Circular elements** (avatars): `border-radius-full`

### Shadow System (5 Levels)

**Shadows create depth and hierarchy**:

```css
/* Neutral shadows (for all elements) */
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15), 0 10px 10px rgba(0, 0, 0, 0.04);
--shadow-inner: inset 0 2px 4px rgba(0, 0, 0, 0.06);
```

**Usage Pattern**:
- **Cards**: `shadow-md` (default), `shadow-lg` (hover)
- **Buttons**: Colored shadows (e.g., `shadow-primary`)
- **Modals**: `shadow-xl`
- **Dropdowns**: `shadow-lg`
- **Form inputs** (focus): Colored shadow matching type

### Layout Patterns

#### Page Container
```css
.page-container {
  /* Space for fixed header (60px) and bottom nav (60-70px) */
  padding: 80px 20px 80px 20px;

  /* Constrain content width */
  max-width: 800px;  /* Or 1200px for wider layouts */
  margin: 0 auto;

  /* Full height */
  min-height: 100vh;

  /* Light background */
  background: var(--color-background);
}
```

#### Fixed Header
```css
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;

  /* Glass morphism effect */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);

  /* Always on top */
  z-index: 1000;

  /* Subtle shadow */
  box-shadow: var(--shadow-sm);
}
```

#### Bottom Navigation (Mobile)
```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;  /* 70px on desktop */

  /* Glass morphism */
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);

  /* Flex for icon distribution */
  display: flex;
  justify-content: space-around;
  align-items: center;

  /* Elevated */
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}
```

#### Grid Layout
```css
/* Two-column form */
.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

/* Three columns with varied widths */
.form-row-three {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 15px;
}

/* Mobile: Always single column */
@media (max-width: 768px) {
  .form-row,
  .form-row-three {
    grid-template-columns: 1fr;
  }
}
```

---

## Component Library

### Buttons

**The Most Important Component** - Used everywhere

#### Button Anatomy
```
┌─────────────────────────────┐
│  [Icon]  Button Text  [Icon]│  ← Padding: 0.5rem 1.5rem
└─────────────────────────────┘
     ↓
Box-shadow: Colored, matches button
Border-radius: 8px (rounded-md)
Font: Semibold (600), 1rem
```

#### Primary Button (Full Implementation)
```css
.btn-primary {
  /* Gradient background */
  background: linear-gradient(135deg,
    var(--color-primary) 0%,
    var(--color-primary-dark) 100%) !important;

  /* Text */
  color: white !important;
  font-size: 1rem !important;
  font-weight: var(--font-semibold) !important;

  /* Shape */
  border: none !important;
  border-radius: var(--border-radius-md) !important;
  padding: 0.5rem 1.5rem !important;

  /* Shadow (matches color) */
  box-shadow: var(--shadow-primary) !important;

  /* Animation */
  transition: all var(--transition-base) !important;
  cursor: pointer !important;
}

/* Hover: Lift up */
.btn-primary:hover {
  transform: translateY(-2px) !important;
  box-shadow: var(--shadow-primary-hover) !important;
}

/* Active: Press down */
.btn-primary:active {
  transform: translateY(0) !important;
}
```

#### Button Variants

**Success, Danger, Warning** - Same structure, different colors:
```css
.btn-success {
  background: linear-gradient(135deg,
    var(--color-success) 0%,
    var(--color-success-light) 100%) !important;
  box-shadow: var(--shadow-success) !important;
  /* ... same properties as primary ... */
}

.btn-danger {
  background: linear-gradient(135deg,
    var(--color-danger) 0%,
    var(--color-danger-light) 100%) !important;
  box-shadow: var(--shadow-danger) !important;
  /* ... same properties as primary ... */
}
```

**Secondary/Outline** - Transparent with border:
```css
.btn-secondary,
.btn-outline-primary {
  background: transparent !important;
  color: var(--color-primary) !important;
  border: 2px solid var(--color-primary) !important;
  border-radius: var(--border-radius-md) !important;
  padding: 0.5rem 1.5rem !important;
  transition: all var(--transition-base) !important;
}

/* Hover: Fill with color */
.btn-secondary:hover,
.btn-outline-primary:hover {
  background: var(--color-primary) !important;
  color: white !important;
  transform: translateY(-2px) !important;
  box-shadow: var(--shadow-primary) !important;
}
```

#### Button Sizes
```css
/* Small */
.btn-sm {
  padding: 0.35rem 1rem !important;
  font-size: 0.875rem !important;
}

/* Large */
.btn-lg {
  padding: 0.75rem 2rem !important;
  font-size: 1.125rem !important;
}
```

### Cards

**Primary Container Component**

```css
.card {
  /* Shape */
  background: var(--color-white);
  border-radius: var(--border-radius-lg);
  border: none;

  /* Shadow */
  box-shadow: var(--shadow-md);

  /* Animation */
  transition: all var(--transition-base);
  animation: fadeIn 0.3s ease;

  /* Overflow control */
  overflow: hidden;
}

/* Hover: Enhance shadow */
.card:hover {
  box-shadow: var(--shadow-lg);
}

/* Card Header */
.card-header {
  background: var(--color-background);
  border-bottom: 2px solid var(--color-light-gray);
  padding: 1rem 1.5rem;
  font-weight: var(--font-semibold);
  border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
}

/* Card Body */
.card-body {
  padding: 1.5rem;
}

/* Fade-in animation for cards */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Forms

#### Input Fields
```css
.form-control {
  /* Shape */
  border: 2px solid var(--color-light-gray);
  border-radius: var(--border-radius-md);
  padding: 0.5rem 1rem;

  /* Text */
  font-size: 1rem;
  color: var(--color-text-dark);

  /* Transition */
  transition: all var(--transition-base);
}

/* Focus: Primary color border + glow */
.form-control:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
}

/* Labels */
.form-label {
  font-weight: var(--font-semibold);
  color: var(--color-text-dark);
  margin-bottom: 0.5rem;
  display: block;
}
```

#### Form Group
```css
.form-group {
  margin-bottom: var(--spacing-lg);
}
```

### Modals

```css
/* Backdrop */
.modal-backdrop {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);  /* Blur background */
}

/* Modal Content */
.modal-content {
  border: none;
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-xl);

  /* Center on screen */
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  /* Responsive sizing */
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

/* Desktop: Fixed width */
@media (min-width: 768px) {
  .modal-content {
    max-width: 900px;
  }
}

/* Modal Header */
.modal-header {
  border-bottom: 2px solid var(--color-light-gray);
  padding: 1.5rem;
}

/* Modal Body */
.modal-body {
  padding: 1.5rem;
}
```

### Badges

```css
.badge {
  /* Shape */
  padding: 0.35em 0.65em;
  border-radius: var(--border-radius-sm);
  font-size: 0.85rem;
  font-weight: var(--font-semibold);

  /* Gradient background */
  background: linear-gradient(135deg,
    var(--color-primary) 0%,
    var(--color-primary-dark) 100%);
  color: white;

  /* Subtle shadow matching color */
  box-shadow: 0 2px 4px rgba(var(--color-primary-rgb), 0.3);

  /* Display */
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

/* Minimal variant (subtle) */
.badge-minimal {
  background: rgba(var(--color-primary-rgb), 0.1);
  color: var(--color-primary);
  box-shadow: none;
}

/* Badge variants */
.badge-success {
  background: linear-gradient(135deg,
    var(--color-success) 0%,
    var(--color-success-light) 100%);
  box-shadow: 0 2px 4px rgba(var(--color-success-rgb), 0.3);
}
```

### Alerts

```css
.alert {
  border-radius: var(--border-radius-md);
  padding: 1rem 1.5rem;
  margin-bottom: 1rem;

  /* Left border accent */
  border-left: 4px solid;
}

/* Success Alert */
.alert-success {
  background: linear-gradient(135deg,
    rgba(var(--color-success-rgb), 0.1) 0%,
    rgba(var(--color-success-rgb), 0.05) 100%);
  border-left-color: var(--color-success);
  color: var(--color-success-light);
}

/* Danger Alert */
.alert-danger {
  background: linear-gradient(135deg,
    rgba(var(--color-danger-rgb), 0.1) 0%,
    rgba(var(--color-danger-rgb), 0.05) 100%);
  border-left-color: var(--color-danger);
  color: var(--color-danger-light);
}
```

### Tables

```css
/* Table Header */
.table thead th {
  background: linear-gradient(135deg,
    var(--color-primary) 0%,
    var(--color-primary-dark) 100%);
  color: white;
  font-weight: var(--font-semibold);
  border: none;
  padding: 1rem;
}

/* Table Row Hover */
.table tbody tr {
  transition: background-color var(--transition-base);
}

.table tbody tr:hover {
  background-color: var(--color-background);
}

/* Table Cells */
.table td {
  padding: 0.75rem 1rem;
  vertical-align: middle;
}
```

### Toast Notifications

```css
.toast {
  /* Position */
  position: fixed;
  top: 80px;  /* Below header */
  right: 20px;
  z-index: 9999;

  /* Size */
  min-width: 300px;
  max-width: 500px;

  /* Shape */
  background: white;
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-lg);
  padding: 1rem 1.5rem;

  /* Animation */
  animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fadeOut {
  to {
    opacity: 0;
    transform: translateY(-20px);
  }
}

/* Toast Variants */
.toast-success {
  border-left: 4px solid var(--color-success);
}

.toast-error {
  border-left: 4px solid var(--color-danger);
}

.toast-info {
  border-left: 4px solid var(--color-info);
}
```

### List Items (Interactive Rows)

```css
.list-item {
  /* Shape */
  padding: 12px 15px;
  background: var(--color-background);
  border-radius: var(--border-radius-md);
  margin-bottom: 0.5rem;

  /* Accent border */
  border-left: 4px solid var(--color-primary);

  /* Shadow */
  box-shadow: var(--shadow-sm);

  /* Transition */
  transition: all var(--transition-base);
  cursor: pointer;
}

/* Hover: Slide right + enhance shadow */
.list-item:hover {
  transform: translateX(4px);
  box-shadow: var(--shadow-md);
}

/* Active state */
.list-item:active {
  transform: translateX(2px);
}
```

### Custom Scrollbar

```css
/* Webkit browsers (Chrome, Safari, Edge) */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--color-background);
  border-radius: var(--border-radius-md);
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg,
    var(--color-primary) 0%,
    var(--color-primary-dark) 100%);
  border-radius: var(--border-radius-md);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary-dark);
}
```

---

## Interactions & Animations

### Core Animation Principles

1. **Subtle & Quick** - Never slow down the user
2. **Purposeful** - Every animation communicates state
3. **Consistent** - Same patterns throughout

### Transition Variables

```css
--transition-fast: 0.15s ease;   /* Quick interactions */
--transition-base: 0.2s ease;    /* Standard (most common) */
--transition-slow: 0.3s ease;    /* Entrance animations */
```

### Standard Interaction Pattern

**Hover → Lift, Active → Press**

```css
.interactive-element {
  transition: all var(--transition-base);
}

/* Hover: Lift up 2px */
.interactive-element:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);  /* Enhanced shadow */
}

/* Active: Return to ground */
.interactive-element:active {
  transform: translateY(0);
}
```

**Apply to**: Buttons, cards, list items, any clickable element

### Keyframe Animations

```css
/* Fade In (for cards, modals) */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Slide In from Right */
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Pulse (for attention) */
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
```

### Usage Examples

```css
/* Cards fade in on render */
.card {
  animation: fadeIn 0.3s ease;
}

/* List items slide in sequentially */
.list-item:nth-child(1) { animation: fadeIn 0.3s ease 0s; }
.list-item:nth-child(2) { animation: fadeIn 0.3s ease 0.1s; }
.list-item:nth-child(3) { animation: fadeIn 0.3s ease 0.2s; }

/* Attention-grabbing pulse */
.notification-badge {
  animation: pulse 2s infinite;
}
```

### Focus States

**Accessibility-first**:

```css
.interactive-element:focus {
  outline: none;  /* Remove default */
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.3);
}

/* For inputs */
.form-control:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
}
```

### Loading States

```css
/* Spinner */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinner {
  border: 3px solid var(--color-light-gray);
  border-top-color: var(--color-primary);
  border-radius: var(--border-radius-full);
  width: 40px;
  height: 40px;
  animation: spin 0.8s linear infinite;
}
```

### Glass Morphism (Modern Effect)

**Used in header and bottom nav**:

```css
.glass-element {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);  /* Safari support */
}
```

---

## Responsive Design

### Breakpoint Strategy

**Mobile-first with single breakpoint at 768px**:

```css
/* Mobile: Default styles (0-767px) */
.element {
  padding: 10px;
  font-size: 14px;
}

/* Tablet/Desktop: 768px and up */
@media (min-width: 768px) {
  .element {
    padding: 20px;
    font-size: 16px;
  }
}
```

### Why 768px?

- Natural split between phone and tablet/desktop
- iPad portrait width
- Most common breakpoint in modern web design

### Responsive Typography

**Use `clamp()` instead of media queries**:

```css
/* Automatically responsive - no media queries needed */
font-size: clamp(1rem, 2.5vw, 1.125rem);
/*             min    fluid    max      */
```

### Mobile-Specific Adjustments

```css
@media (max-width: 768px) {
  /* 1. Prevent iOS zoom on input focus */
  input[type="text"],
  input[type="email"],
  input[type="password"],
  textarea {
    font-size: 16px !important;  /* iOS zooms if < 16px */
  }

  /* 2. Touch-friendly tap targets (min 44px) */
  button,
  .clickable {
    min-height: 44px;
    min-width: 44px;
  }

  /* 3. Reduce padding for screen space */
  .page-container {
    padding: 70px 15px 70px 15px;
  }

  /* 4. Stack multi-column layouts */
  .form-row {
    grid-template-columns: 1fr !important;
  }

  /* 5. Increase font size for readability */
  body {
    font-size: 16px;
  }
}
```

### Responsive Utilities

```css
/* Show/hide based on screen size */
.mobile-only {
  display: block;
}

.desktop-only {
  display: none;
}

@media (min-width: 768px) {
  .mobile-only {
    display: none;
  }

  .desktop-only {
    display: block;
  }
}
```

### Container Queries (Future-Proof)

SoluFlow doesn't use these yet, but consider for v2:

```css
.card-container {
  container-type: inline-size;
}

@container (max-width: 400px) {
  .card {
    /* Adjust for narrow containers */
  }
}
```

---

## Implementation Guide

### Step-by-Step Setup

#### 1. Install Dependencies

```bash
npm install bootstrap@5.3.8
```

#### 2. Create Design System File

Create `src/styles/modern.css` with all CSS variables from this guide

#### 3. Import in Order

```javascript
// src/index.js or src/main.js
import 'bootstrap/dist/css/bootstrap.min.css';  // Foundation
import './styles/modern.css';                     // Design system
import './index.css';                              // Global app styles
```

#### 4. Add Google Fonts

```html
<!-- In public/index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

#### 5. Set Base Styles

```css
/* In index.css */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-family);
  font-size: var(--font-base);
  color: var(--color-text-dark);
  background: var(--color-background);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Customizing for Your App

#### Change Primary Color (3 steps)

```css
/* 1. Choose your brand color */
--color-primary: #your-color;

/* 2. Generate darker variant (use tool like colorkit.co) */
--color-primary-dark: #darker-variant;

/* 3. Get RGB values */
--color-primary-rgb: r, g, b;

/* 4. Update colored shadow */
--shadow-primary: 0 2px 8px rgba(r, g, b, 0.4);
--shadow-primary-hover: 0 4px 12px rgba(r, g, b, 0.6);
```

#### Add Dark Mode (Future Enhancement)

```css
/* Light mode (default) - already defined */
:root {
  --color-background: #f7fafc;
  --color-text-dark: #1a202c;
  /* ... */
}

/* Dark mode */
[data-theme="dark"] {
  --color-background: #1a202c;
  --color-text-dark: #f7fafc;
  --color-white: #2d3748;
  /* Invert other colors as needed */
}
```

Toggle with JavaScript:
```javascript
document.documentElement.setAttribute('data-theme', 'dark');
```

### Component Development Pattern

```jsx
// 1. Create component file
// components/MyComponent.jsx

// 2. Create styles file (if needed)
// components/MyComponent.css

// 3. Use design system classes + custom styles
import './MyComponent.css';

function MyComponent() {
  return (
    <div className="my-component card">  {/* Use design system card */}
      <button className="btn-primary">    {/* Use design system button */}
        Click Me
      </button>
    </div>
  );
}
```

```css
/* MyComponent.css - only custom styles */
.my-component {
  /* Specific layout/behavior for this component */
  /* Use design system variables */
  padding: var(--spacing-lg);
  border-left: 4px solid var(--color-primary);
}
```

### Best Practices

**DO:**
- Use CSS variables for all colors, spacing, shadows
- Apply consistent border radius to all elements
- Use gradient backgrounds for primary actions
- Include colored shadows matching button colors
- Implement hover/active states with transform
- Use `clamp()` for responsive typography
- Keep animations subtle and quick (0.2s)
- Test on real mobile devices

**DON'T:**
- Use inline styles (use CSS variables)
- Create sharp corners (always rounded)
- Use pure black text (#000) - use --color-text-dark
- Animate opacity without also animating transform
- Forget focus states for accessibility
- Use slow animations (> 0.3s)
- Override Bootstrap unnecessarily

### Performance Tips

1. **Use CSS variables** - Faster than Sass/Less compilation
2. **Minimize !important** - Only use for Bootstrap overrides
3. **Optimize animations** - Use `transform` and `opacity` (GPU accelerated)
4. **Lazy load fonts** - Use `font-display: swap`
5. **Minify CSS** - In production builds

### Testing Checklist

- [ ] Test on iOS Safari (input zoom, backdrop-filter)
- [ ] Test on Android Chrome
- [ ] Test with slow 3G connection
- [ ] Test keyboard navigation (focus states)
- [ ] Test with screen reader
- [ ] Test color contrast (WCAG AA minimum)
- [ ] Test with browser zoom at 200%
- [ ] Test in landscape/portrait orientations

---

## Design System Maintenance

### Version Control

Track design system changes:
```
v1.0.0 - Initial design system
v1.1.0 - Added dark mode support
v1.2.0 - New badge variants
```

### Documentation

Keep this guide updated when adding:
- New color variables
- New components
- New animations
- Breaking changes

### Consistency Audits

Periodically check:
- All buttons use same hover pattern
- All cards have consistent shadows
- All spacing uses 4px grid
- All interactive elements have focus states
- All colors use CSS variables (no hardcoded hex)

---

## Quick Reference

### Most Used Variables

```css
/* Colors */
var(--color-primary)
var(--color-text-dark)
var(--color-background)
var(--color-light-gray)

/* Spacing */
var(--spacing-md)    /* 16px - most common */
var(--spacing-lg)    /* 24px - generous */

/* Border Radius */
var(--border-radius-md)  /* 8px - buttons, inputs */
var(--border-radius-lg)  /* 12px - cards */

/* Shadows */
var(--shadow-md)     /* Default card shadow */
var(--shadow-lg)     /* Hover shadow */

/* Typography */
var(--font-base)     /* Body text */
var(--font-semibold) /* Headings, labels */

/* Transitions */
var(--transition-base)  /* 0.2s - use everywhere */
```

### Common Patterns

**Interactive Element:**
```css
transition: all var(--transition-base);
border-radius: var(--border-radius-md);
box-shadow: var(--shadow-md);

:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

**Card:**
```css
background: var(--color-white);
border-radius: var(--border-radius-lg);
box-shadow: var(--shadow-md);
padding: var(--spacing-lg);
```

**Gradient Button:**
```css
background: linear-gradient(135deg,
  var(--color-primary) 0%,
  var(--color-primary-dark) 100%);
```

---

## Conclusion

This design system provides a complete, reusable foundation for building modern web applications with SoluFlow's visual style.

**Key Takeaways:**
1. **Color agnostic** - Change primary color, keep same structure
2. **CSS variables** - All customization in one place
3. **Consistent patterns** - Same interactions throughout
4. **Mobile-first** - Responsive by default
5. **Bootstrap base** - Familiar, battle-tested foundation
6. **Gradient-heavy** - Depth through linear gradients
7. **Shadow layering** - Visual hierarchy through elevation
8. **Subtle animations** - Delight without distraction

**Next Steps:**
1. Copy CSS variables to your project
2. Customize primary color
3. Implement core components (buttons, cards, forms)
4. Build your unique features using the foundation
5. Maintain consistency through the design system

**Questions or Need Help?**
Refer to `modern.css` in the SoluFlow codebase for complete implementation details.

---

*SoluFlow Design System v1.0 - Built with care for modern web applications*
