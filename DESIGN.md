---
name: FilDOCS Design System
description: A high-density, professional document operations interface for Filamer Christian University.
colors:
  primary: "#0ea5e9"
  primary-deep: "#0284c7"
  neutral-bg: "#f8fafc"
  surface-dark: "#0d1117"
  border-slate: "#e2e8f0"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 450
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 32px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
---

# Design System: FilDOCS

## 1. Overview

**Creative North Star: "The Institutional Ledger"**

FilDOCS is designed as a high-integrity, modern productivity tool. Like a perfectly bound research paper or an official ledger, every element must feel grounded, precise, and reliable. We reject "vibe-coded" trends—such as excessive blur, soft shadows, and oversized rounded corners—in favor of structural clarity.

**Key Characteristics:**
- **Border-First Hierarchy**: Structure is defined by 1px solid lines rather than depth or shadows.
- **High Information Density**: Designed for power users who need to process tasks quickly.
- **Surgical Typography**: Tight tracking and tabular numbers for readability under pressure.
- **FCU Identity**: Anchored by the institutional sky blue, maintaining a clean and professional atmosphere.

## 2. Colors

The palette is restrained and professional, using deep slates and high-contrast blues to drive action without causing eye strain.

### Primary
- **FCU Sky Blue** (#0ea5e9): Our core action color. Used for primary buttons, active states, and critical highlights.
- **Deep Action Blue** (#0284c7): Used for hover states and high-emphasis labels.

### Neutral
- **Institutional Slate** (#0d1117): The base for dark mode and high-contrast text in light mode.
- **Canvas Gray** (#f8fafc): The default light-mode background for maximum readability.
- **Ledger Border** (#e2e8f0): The standard 1px border color for cards and sections.

### Named Rules
**The 10% Accent Rule.** FCU Sky Blue is a powerful highlight. It should cover no more than 10% of any given screen to ensure that action points remain rare and obvious.

## 3. Typography

**Display Font:** Inter (Sans-serif)
**Body Font:** Inter (Sans-serif)

**Character:** We use a single, highly legible font family to maintain technical consistency. Hierarchy is achieved through weight (450 to 700) and scale contrast rather than font switching.

### Hierarchy
- **Display** (700, 3rem, 1.1): Used for page-level titles and high-impact headers.
- **Headline** (600, 1.5rem, 1.2): Used for section headers.
- **Body** (450, 1rem, 1.5): The standard for all document text and descriptions.
- **Label** (600, 0.75rem, normal): Used for metadata, badges, and small UI actions.

## 4. Elevation

FilDOCS uses a **"Flat-by-Default"** strategy. We prioritize 1px solid borders over drop shadows to define surfaces.

### Shadow Vocabulary
- **Elevated Overlay** (0 4px 12px rgba(0,0,0,0.1)): Used strictly for floating elements like dropdowns, popovers, or modals.

### Named Rules
**The Border-over-Shadow Rule.** Never use a shadow to separate a card from a background if a 1px border can achieve the same effect. Shadows are for "floating," borders are for "structuring."

## 5. Components

### Buttons
- **Shape:** Refined medium radius (6px).
- **Tactile Feedback:** Buttons scale to 98% on click to feel alive and responsive.
- **Reveal Pattern:** Workflow actions use the "reveal" pattern (icon only, text on hover) to save space.

### Cards
- **Border:** 1px solid (#e2e8f0).
- **Background:** Pure white in light mode, deep slate in dark mode.
- **Padding:** Strict 24px (lg) padding for standard cards.

### Inputs
- **Focus:** 2px solid FCU Sky Blue focus ring with 2px offset.
- **Stroke:** 1px solid ledger border.

## 6. Do's and Don'ts

### Do:
- **Do** use `tabular-nums` for all dates, version numbers, and quantities.
- **Do** use `stroke-width: 2.25px` for all Lucide icons to ensure visibility.
- **Do** prioritize a dense, functional layout over "airy" marketing whitespace.

### Don't:
- **Don't** use `rounded-3xl` or any radius larger than 8px on standard UI elements.
- **Don't** use purple or pink accents; stick strictly to the FCU Sky Blue theme.
- **Don't** use "glassmorphism" or background blurs as a default container style.
- **Don't** use "vibe-coded" soft shadows for section separation.
