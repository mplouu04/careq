---
name: Clinical Precision
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e5'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fe'
  surface-container: '#ededf9'
  surface-container-high: '#e7e7f3'
  surface-container-highest: '#e1e2ed'
  on-surface: '#191b23'
  on-surface-variant: '#434655'
  inverse-surface: '#2e3039'
  inverse-on-surface: '#f0f0fb'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ed'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system is engineered for the high-stakes, high-stress environment of healthcare queue management. The brand personality is **reliable, efficient, and calm**, prioritizing clarity of information above all else. 

The aesthetic follows a **Corporate / Modern** approach with a focus on **Minimalism**. By utilizing generous whitespace and a restricted color palette, the UI reduces cognitive load for clinic staff and patients. The visual language conveys a sense of sterile precision without feeling cold, achieved through soft background tints and meticulous alignment.

## Colors
The palette is rooted in "Clinic Blue," a color associated with trust and medical professionalism. 

- **Primary:** Used for the main call-to-action and active states.
- **Neutral/Secondary:** Utilized for secondary information and iconography to maintain a calm hierarchy.
- **Semantic Colors:** Reserved strictly for status indicators (Called, Waiting, Error). 
- **Surfaces:** The app background uses a cool-toned gray-blue (#f8fafc) to reduce screen glare, while interactive cards use pure white to pop forward in the visual stack.

## Typography
The design system exclusively uses **Inter** to leverage its exceptional legibility and systematic weights. 

- **Hierarchy:** Use `headline-lg` for queue numbers or primary screen titles. 
- **Readability:** All body text is set to a 1.5 line height to ensure patient data is easy to scan.
- **Labels:** Uppercase styles with slight letter spacing are reserved for category headers and status badges to differentiate them from interactive text.

## Layout & Spacing
The system operates on a **strict 8px grid**. All dimensions, padding, and margins must be multiples of 8 (or 4 for micro-adjustments).

- **Grid:** A 12-column fluid grid is used for desktop views to manage complex data tables and queue lists. On mobile, a single-column layout with 16px side margins is standard.
- **Density:** Maintain "Relaxed" spacing in patient-facing views to reduce anxiety, and "Compact" spacing (16px gutters) for clinician dashboards where data density is required.

## Elevation & Depth
Depth is conveyed through **Low-contrast outlines** and extremely soft shadows to maintain a clean, "medical" feel.

- **Level 0 (Background):** #f8fafc.
- **Level 1 (Cards):** Pure white surface, 1px border (#e2e8f0), and a subtle shadow (y: 1px, blur: 3px, opacity: 5% black).
- **Level 2 (Hover/Active):** Slightly deeper shadow (y: 4px, blur: 6px, opacity: 8% black) to indicate interactivity.
Avoid using heavy dropshadows or dark overlays; the goal is to feel light and airy.

## Shapes
The shape language balances approachability with professional structure. 

- **Cards:** Use a 12px radius to soften the large surface areas of the queue list.
- **Interactive Elements:** Buttons and Inputs use an 8px radius, providing a crisp, modern look that fits within the 8px spacing grid.
- **Badges:** Use a full pill shape (rounded-full) to instantly distinguish status indicators from clickable buttons.

## Components
Consistent component behavior ensures the system is accessible and predictable.

- **Buttons:** 
  - Minimum height of 44px for touch accessibility. 
  - *Primary:* Blue background, white text. 
  - *Secondary:* 1px border (#e2e8f0), blue text. 
  - *Ghost:* No background or border, blue or gray text.
- **Inputs:** 
  - 44px height. 
  - Focus state must show a 2px blue ring with a 2px offset for high visibility.
- **Badges:** 
  - Small, pill-shaped indicators. Use light background tints of the semantic colors (e.g., Light Green for 'Called') with high-contrast dark text of the same hue.
- **Queue Cards:** 
  - Must include a clear "Queue Number" in `headline-md`, a "Status Badge," and a timestamp. 
  - Interaction is limited to the entire card or a specific "Call Patient" action button.
- **Checkboxes/Radios:** 
  - Large hit targets (minimum 44x44px area including padding) with the primary blue color for checked states.