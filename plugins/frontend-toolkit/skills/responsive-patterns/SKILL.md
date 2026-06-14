---
name: responsive-patterns
description: "Responsive design \u2014 container queries, fluid typography, CSS subgrid, View Transitions, scroll animations, Tailwind v4"
effort: low
keep-coding-instructions: true
paths:
  - "**/*.css"
  - "**/*.tsx"
  - "**/*.jsx"
  - "tailwind.config.*"
---

# Responsive Patterns

## Overview

Responsive design in 2026 has moved well beyond media queries. Container queries let components own their layout logic. Fluid typography eliminates breakpoint jumps. CSS subgrid aligns deeply nested elements. Intrinsic layouts with `auto-fit` and `minmax()` adapt without any queries at all.

This skill covers nine pattern families that together produce layouts which adapt gracefully from 320px phones to ultrawide monitors with minimal explicit breakpoints.

**Bundled References:**
- `${CLAUDE_SKILL_DIR}/references/container-queries.md` -- Deep dive into `@container` size, style, and scroll-state queries with React patterns, Tailwind v4 integration, and browser support
- `${CLAUDE_SKILL_DIR}/references/fluid-typography-and-spacing.md` -- `clamp()` formulas, fluid scale generators, practical spacing examples, and Tailwind v4 fluid utilities

---

## Quick Reference: Container Queries

Container queries scope layout decisions to the nearest containment context instead of the viewport.

```css
/* Establish containment */
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

/* Respond to container width */
@container card (min-width: 400px) {
  .card { grid-template-columns: 200px 1fr; }
}

@container card (min-width: 700px) {
  .card { grid-template-columns: 250px 1fr 150px; }
}
```

Container query length units scale relative to the container:

| Unit  | Relative to                  |
|-------|------------------------------|
| `cqi` | Container inline size (width in LTR) |
| `cqb` | Container block size (height in LTR) |
| `cqmin` | Smaller of `cqi` / `cqb`   |
| `cqmax` | Larger of `cqi` / `cqb`    |

```css
.card-title {
  font-size: clamp(1rem, 4cqi, 1.75rem);
}
```

**Tailwind v4** supports container queries natively:

```html
<div class="@container/card">
  <div class="flex flex-col @md/card:flex-row @lg/card:grid @lg/card:grid-cols-3">
    <!-- Adapts to container, not viewport -->
  </div>
</div>
```

**Read `${CLAUDE_SKILL_DIR}/references/container-queries.md` for style queries, scroll-state queries, React wrapper patterns, and fallback strategies.**

---

## Quick Reference: Fluid Typography

Replace breakpoint-stepped font sizes with a single `clamp()` declaration that scales smoothly between a minimum and maximum.

```css
/* Formula: clamp(min, preferred, max) */
/* preferred = viewport-relative expression that bridges min and max */

:root {
  --text-sm:   clamp(0.875rem, 0.8rem + 0.25vw, 1rem);
  --text-base: clamp(1rem, 0.9rem + 0.35vw, 1.125rem);
  --text-lg:   clamp(1.125rem, 0.95rem + 0.5vw, 1.375rem);
  --text-xl:   clamp(1.25rem, 1rem + 0.75vw, 1.75rem);
  --text-2xl:  clamp(1.5rem, 1rem + 1.25vw, 2.25rem);
  --text-3xl:  clamp(1.875rem, 1rem + 2vw, 3rem);
  --text-4xl:  clamp(2.25rem, 1rem + 3vw, 4rem);
}

h1 { font-size: var(--text-4xl); }
p  { font-size: var(--text-base); }
```

Fluid spacing follows the same pattern:

```css
:root {
  --space-xs: clamp(0.25rem, 0.2rem + 0.15vw, 0.375rem);
  --space-sm: clamp(0.5rem, 0.4rem + 0.25vw, 0.75rem);
  --space-md: clamp(1rem, 0.85rem + 0.5vw, 1.5rem);
  --space-lg: clamp(1.5rem, 1.1rem + 1vw, 2.5rem);
  --space-xl: clamp(2rem, 1.25rem + 2vw, 4rem);
}
```

**Read `${CLAUDE_SKILL_DIR}/references/fluid-typography-and-spacing.md` for the derivation formula, a fluid scale generator approach, and Tailwind v4 integration.**

---

## Quick Reference: CSS Subgrid

Subgrid lets a child grid inherit track sizing from its parent, keeping nested elements aligned across siblings.

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.card {
  display: grid;
  /* Inherit parent's row tracks so all cards align header/body/footer */
  grid-template-rows: subgrid;
  grid-row: span 3; /* header + body + footer */
}
```

This guarantees that every card's header, body, and footer align horizontally even when content lengths differ. Browser support is universal in 2026 (Chrome 117+, Firefox 71+, Safari 16+).

---

## Quick Reference: Intrinsic Layout

Intrinsic layouts use `auto-fit`/`auto-fill` with `minmax()` to create grids that reflow without any media or container queries.

```css
/* Cards that are at least 280px, fill available space, wrap automatically */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}
```

The `min(280px, 100%)` pattern prevents overflow on narrow viewports where 280px exceeds the container.

| Pattern | Behavior |
|---------|----------|
| `auto-fill` | Creates as many tracks as fit; empty tracks remain and hold space |
| `auto-fit` | Creates as many tracks as fit; collapses empty tracks so items expand |

In Tailwind v4:

```html
<div class="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-[clamp(1rem,2vw,2rem)]">
  <div><!-- card --></div>
  <div><!-- card --></div>
</div>
```

---

## Quick Reference: Mobile-First CSS

Progressive enhancement starts with the small-screen layout and layers complexity at wider breakpoints using `min-width`.

```css
/* Base: single column, stacked */
.layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-sm);
}

/* Tablet: side-by-side */
@media (min-width: 640px) {
  .layout {
    flex-direction: row;
    flex-wrap: wrap;
  }
}

/* Desktop: grid with sidebar */
@media (min-width: 1024px) {
  .layout {
    display: grid;
    grid-template-columns: 260px 1fr;
  }
}
```

Tailwind enforces mobile-first by default -- unprefixed utilities are the base, and `sm:`, `md:`, `lg:` add `min-width` layers:

```html
<div class="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap lg:grid lg:grid-cols-[260px_1fr]">
```

---

## Quick Reference: View Transitions API

The View Transitions API enables smooth animated transitions between page states. Always treat it as progressive enhancement.

```css
/* Opt in to cross-document transitions (MPA) */
@view-transition {
  navigation: auto;
}

/* Name elements that should animate between states */
.hero-image {
  view-transition-name: hero;
}

/* Customize the transition */
::view-transition-old(hero) {
  animation: fade-out 0.3s ease-out;
}
::view-transition-new(hero) {
  animation: fade-in 0.3s ease-in;
}
```

For SPA (same-document) transitions:

```typescript
function navigate(updateDOM: () => void) {
  if (!document.startViewTransition) {
    updateDOM();
    return;
  }
  document.startViewTransition(() => updateDOM());
}
```

---

## Quick Reference: Scroll-Driven Animations

Scroll-driven animations tie animation progress to scroll position or element visibility. Gate behind `@supports` for progressive enhancement.

```css
@supports (animation-timeline: scroll()) {
  .parallax-bg {
    animation: parallax linear both;
    animation-timeline: scroll();
    animation-range: 0% 100%;
  }

  @keyframes parallax {
    from { transform: translateY(0); }
    to   { transform: translateY(-30%); }
  }
}

/* Animate elements as they enter the viewport */
@supports (animation-timeline: view()) {
  .reveal {
    animation: reveal linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 100%;
  }

  @keyframes reveal {
    from { opacity: 0; transform: translateY(2rem); }
    to   { opacity: 1; transform: translateY(0); }
  }
}
```

---

## Quick Reference: Responsive Images

Deliver appropriately sized images for every device and connection.

```html
<!-- srcset with sizes for art direction -->
<img
  src="hero-800.jpg"
  srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1200.jpg 1200w, hero-1600.jpg 1600w"
  sizes="(min-width: 1024px) 50vw, 100vw"
  alt="Descriptive alt text"
  width="1600"
  height="900"
  loading="lazy"
  decoding="async"
  class="aspect-video w-full object-cover"
/>

<!-- <picture> for format selection and art direction -->
<picture>
  <source media="(min-width: 768px)" srcset="hero-wide.avif" type="image/avif" />
  <source media="(min-width: 768px)" srcset="hero-wide.webp" type="image/webp" />
  <source srcset="hero-square.avif" type="image/avif" />
  <source srcset="hero-square.webp" type="image/webp" />
  <img src="hero-wide.jpg" alt="Descriptive alt text" width="1200" height="675" />
</picture>
```

Always set explicit `width` and `height` (or use `aspect-ratio`) to prevent layout shift. Use `loading="lazy"` for below-the-fold images, `loading="eager"` (default) for LCP images.

---

## Quick Reference: Touch-Friendly Design

Design for imprecise input on touch devices.

```css
/* Minimum 44x44px touch targets (WCAG 2.5.8 -- 2.2 AA requires 24px, best practice is 44px) */
.touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 0.5rem;
}

/* Ensure adequate spacing between interactive elements */
.action-group {
  display: flex;
  gap: 0.5rem; /* minimum 8px between touch targets */
}

/* Use @media (pointer) to detect input precision */
@media (pointer: coarse) {
  .nav-link {
    padding: 0.75rem 1rem;
    min-height: 48px;
  }
}

@media (pointer: fine) {
  .nav-link {
    padding: 0.375rem 0.75rem;
  }
}
```

Thumb zone layout -- place primary actions in the lower-center area on mobile where thumbs naturally rest:

```css
@media (max-width: 639px) {
  .primary-actions {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.75rem 1rem;
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  }
}
```

---

## Pattern Selection Guide

| Situation | Recommended pattern |
|-----------|-------------------|
| Component adapts to its container, not viewport | Container queries |
| Font sizes should scale smoothly, no jumps | Fluid typography with `clamp()` |
| Nested elements must align with parent grid | CSS subgrid |
| Grid should reflow without queries | Intrinsic layout (`auto-fit`/`auto-fill`) |
| Building a layout from scratch | Mobile-first with `min-width` breakpoints |
| Page or route transitions | View Transitions API |
| Animations tied to scroll position | Scroll-driven animations |
| Images served at multiple sizes/formats | `srcset` + `sizes` + `<picture>` |
| Interactive elements on touch devices | 44px targets, thumb zones, pointer queries |
