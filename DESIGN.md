---
name: Lab-Precision Modernism
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0edec'
  surface-container-high: '#ebe7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#464652'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#777683'
  outline-variant: '#c7c5d4'
  surface-tint: '#4f54b4'
  primary: '#15157d'
  on-primary: '#ffffff'
  primary-container: '#2e3192'
  on-primary-container: '#9da1ff'
  inverse-primary: '#c0c1ff'
  secondary: '#a04100'
  on-secondary: '#ffffff'
  secondary-container: '#fc7728'
  on-secondary-container: '#5d2300'
  tertiary: '#282828'
  on-tertiary: '#ffffff'
  tertiary-container: '#3e3e3e'
  on-tertiary-container: '#aaa9a9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#04006d'
  on-primary-fixed-variant: '#373a9b'
  secondary-fixed: '#ffdbcb'
  secondary-fixed-dim: '#ffb693'
  on-secondary-fixed: '#341000'
  on-secondary-fixed-variant: '#7a3000'
  tertiary-fixed: '#e4e2e2'
  tertiary-fixed-dim: '#c8c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
  lab-white: '#FFFFFF'
  surface-gray: '#F8F9FA'
  border-subtle: '#E2E4E8'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  caption:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1200px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 20px
---

## Brand & Style

The design system is engineered for a research and educational environment that balances scientific rigor with approachable mentorship. The brand personality is **authoritative, innovative, and nurturing**. It seeks to evoke a sense of "smart trust"—where users feel they are interacting with sophisticated technology that remains accessible and human-centric.

The visual direction follows a **Corporate / Modern** aesthetic with **Minimalist** influences. This is characterized by:
- **Structured Clarity:** High contrast between text and background to ensure educational content is the priority.
- **Functional Accents:** Using vibrant energy (Orange) to highlight calls to action and discovery, while deep tones (Blue) establish institutional stability.
- **Precision Detailing:** Micro-interactions and layout choices that reflect the meticulous nature of a laboratory.

## Colors

The palette is anchored by **Deep Research Blue**, representing stability and academic integrity. **Innovation Orange** is used sparingly but impactfully for primary actions, notifications, and interactive elements to provide a warm, energetic counterpoint to the blue.

- **Primary (#2E3192):** Used for navigation headers, primary buttons, and institutional branding.
- **Secondary (#F37021):** Reserved for "Aha!" moments, active states, and key conversions.
- **Neutrals:** A range of grays from `#111111` for maximum legibility to `#F8F9FA` for background layering. 

Color application should follow a 60-30-10 rule to maintain a clean, white-space-heavy laboratory feel, preventing the vibrant orange from overwhelming the instructional content.

## Typography

The typography system pairs **Hanken Grotesk** for structural elements and **Noto Sans** for continuous reading. 

- **Headlines:** Use Hanken Grotesk to convey a modern, geometric, and precise "tech-lab" feel. High-level headers should utilize tight letter spacing and bold weights to command attention.
- **Body Text:** Noto Sans is chosen for its exceptional legibility in both Korean and English, essential for educational materials. 
- **Scale:** On mobile, large display titles scale down significantly to maintain readability without excessive scrolling. Use `body-lg` for introductory paragraphs and `body-md` for general interface text.

## Layout & Spacing

The layout uses a **Fixed Grid** model for desktop to ensure data-heavy educational content remains centered and focused, transitioning to a fluid model for smaller breakpoints.

- **Grid:** A 12-column system for desktop (1200px max-width) and a 4-column system for mobile.
- **Rhythm:** An 8px linear scale governs all padding and margins (8, 16, 24, 32, 48, 64).
- **Reflow:** Components should stack vertically on mobile. For complex data tables or lab results, horizontal overflow with a visual cue (gradient fade) is preferred over aggressive shrinking.

## Elevation & Depth

To maintain the "Clean Lab" aesthetic, the design system avoids heavy shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.

- **Surface Tiers:** Use `#FFFFFF` for the primary interaction layer (cards, modals) and `#F8F9FA` for the background canvas.
- **Borders:** Instead of shadows, use 1px solid borders in `#E2E4E8` to define component boundaries. 
- **Active Elevation:** When an element requires focus (e.g., a selected lab module), apply a very soft, diffused ambient shadow: `0px 4px 12px rgba(46, 49, 146, 0.08)`. This uses a tint of the Primary Blue to maintain color harmony.
- **Overlays:** Modals and dropdowns use a subtle backdrop blur (8px) to provide depth without losing the context of the instructional background.

## Shapes

The design system utilizes **Soft** corner treatment. This 4px (0.25rem) base radius provides a professional and "engineered" look that is less aggressive than sharp corners but more serious than highly rounded "bubbly" UI.

- **Small Components:** Buttons, input fields, and tags use the base `rounded` (4px).
- **Large Containers:** Cards and modals use `rounded-lg` (8px) to soften the overall layout.
- **Interactive Elements:** Progress bars and specific "Badge" items may use a full pill-shape to distinguish them from structural containers.

## Components

- **Buttons:** Primary buttons use a solid Deep Blue background with white text. CTA/Special buttons use the Orange. Secondary buttons should be outlined (1px Blue border).
- **Input Fields:** Clean white backgrounds with a 1px gray border. On focus, the border transitions to Primary Blue with a 2px "inner" glow. Labels must always be visible using `label-md`.
- **Chips/Badges:** Use light tints of the brand colors (e.g., 10% opacity Blue) with solid text for status indicators (e.g., "In Progress", "Completed").
- **Cards:** White background, 1px subtle border, and 16px internal padding. Avoid shadows unless the card is hovering or active.
- **Lists:** Scientific data should be displayed in clean, striped rows using `#F8F9FA` for alternating backgrounds to enhance scanability.
- **Navigation:** A clean top-bar with a white background and the logo on the left. Active links are indicated by a 2px bottom border in Primary Blue, not a color change of the text itself.