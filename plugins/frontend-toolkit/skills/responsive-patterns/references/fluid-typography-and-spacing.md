# Fluid Typography and Spacing

## Table of Contents

- [The Problem with Breakpoint Steps](#the-problem-with-breakpoint-steps)
- [The clamp() Formula](#the-clamp-formula)
- [Deriving the Preferred Value](#deriving-the-preferred-value)
- [Complete Fluid Type Scale](#complete-fluid-type-scale)
- [Fluid Spacing Scale](#fluid-spacing-scale)
- [Fluid Scale Generator Approach](#fluid-scale-generator-approach)
- [Tailwind v4 Integration](#tailwind-v4-integration)
- [Line Height and Measure](#line-height-and-measure)
- [Accessibility Considerations](#accessibility-considerations)
- [Practical Examples](#practical-examples)

---

## The Problem with Breakpoint Steps

Traditional responsive typography uses media queries to step between sizes:

```css
/* Jumpy -- font size changes abruptly at each breakpoint */
h1 { font-size: 1.5rem; }

@media (min-width: 640px) { h1 { font-size: 2rem; } }
@media (min-width: 1024px) { h1 { font-size: 2.5rem; } }
@media (min-width: 1280px) { h1 { font-size: 3rem; } }
```

This creates visible jumps as the viewport crosses a breakpoint. Fluid typography eliminates these jumps entirely by scaling continuously between a minimum and maximum size.

---

## The clamp() Formula

```css
font-size: clamp(MIN, PREFERRED, MAX);
```

- **MIN**: The smallest the value will ever be (in `rem` for accessibility).
- **PREFERRED**: A viewport-relative expression that produces values between MIN and MAX across a target viewport range.
- **MAX**: The largest the value will ever be (in `rem`).

The browser picks whichever of these three is the "middle" value -- it never goes below MIN or above MAX, and uses PREFERRED when it falls between them.

---

## Deriving the Preferred Value

Given:
- `minSize` (rem) -- minimum font size
- `maxSize` (rem) -- maximum font size
- `minViewport` (px) -- viewport where minimum applies
- `maxViewport` (px) -- viewport where maximum applies

The preferred value is a linear interpolation:

```
slope = (maxSize - minSize) / (maxViewport - minViewport)
intercept = minSize - slope * minViewport

preferred = intercept(rem) + slope * 100(vw)
```

### Worked example

Goal: 1rem at 320px viewport, 1.75rem at 1280px viewport.

```
slope = (1.75 - 1) / (1280 - 320) = 0.75 / 960 = 0.00078125
intercept = 1 - 0.00078125 * 320 = 1 - 0.25 = 0.75

preferred = 0.75rem + 0.078125vw
           (slope * 100 = 0.078125)
```

Rounding for readability:

```css
font-size: clamp(1rem, 0.75rem + 0.078vw, 1.75rem);
```

### Simplified approach

For most practical purposes, you can use these rules of thumb:

| Size increase | Approximate preferred value |
|---------------|---------------------------|
| 0.25rem range | `base + 0.25vw` |
| 0.5rem range  | `base + 0.5vw` |
| 0.75rem range | `base + 0.75vw` |
| 1rem range    | `base + 1vw` |
| 1.5rem range  | `base + 1.5vw` |
| 2rem range    | `base + 2vw` |

Where `base` is approximately `minSize - (range * 0.25)`.

---

## Complete Fluid Type Scale

A practical scale for a content-focused application, scaling between 320px and 1280px viewports:

```css
:root {
  /* Body text sizes */
  --text-xs:    clamp(0.75rem,  0.7rem  + 0.15vw, 0.875rem);
  --text-sm:    clamp(0.875rem, 0.8rem  + 0.25vw, 1rem);
  --text-base:  clamp(1rem,     0.925rem + 0.3vw, 1.125rem);
  --text-lg:    clamp(1.125rem, 1rem    + 0.4vw,  1.375rem);

  /* Heading sizes */
  --text-xl:    clamp(1.25rem,  1.05rem + 0.6vw,  1.75rem);
  --text-2xl:   clamp(1.5rem,   1.15rem + 1vw,    2.25rem);
  --text-3xl:   clamp(1.875rem, 1.3rem  + 1.5vw,  3rem);
  --text-4xl:   clamp(2.25rem,  1.4rem  + 2.25vw, 4rem);
  --text-5xl:   clamp(3rem,     1.75rem + 3.25vw, 5.5rem);

  /* Display / hero sizes */
  --text-display: clamp(3.5rem, 1.75rem + 4.5vw, 7rem);
}
```

Usage:

```css
body        { font-size: var(--text-base); }
.caption    { font-size: var(--text-xs); }
.body-small { font-size: var(--text-sm); }
h6          { font-size: var(--text-lg); }
h5          { font-size: var(--text-xl); }
h4          { font-size: var(--text-2xl); }
h3          { font-size: var(--text-3xl); }
h2          { font-size: var(--text-4xl); }
h1          { font-size: var(--text-5xl); }
.hero-title { font-size: var(--text-display); }
```

---

## Fluid Spacing Scale

Spacing benefits from the same treatment. Gaps, padding, and margins that scale with the viewport eliminate the need for breakpoint-based spacing overrides.

```css
:root {
  /* Tight spacing (borders, inline gaps) */
  --space-3xs: clamp(0.125rem, 0.1rem  + 0.05vw, 0.1875rem);
  --space-2xs: clamp(0.25rem,  0.2rem  + 0.1vw,  0.375rem);
  --space-xs:  clamp(0.5rem,   0.4rem  + 0.2vw,  0.75rem);

  /* Standard spacing (component padding, stack gaps) */
  --space-sm:  clamp(0.75rem,  0.6rem  + 0.35vw, 1rem);
  --space-md:  clamp(1rem,     0.85rem + 0.5vw,  1.5rem);
  --space-lg:  clamp(1.5rem,   1.15rem + 0.85vw, 2.25rem);

  /* Generous spacing (section padding, layout gaps) */
  --space-xl:  clamp(2rem,     1.4rem  + 1.5vw,  3.5rem);
  --space-2xl: clamp(3rem,     2rem    + 2.5vw,  5rem);
  --space-3xl: clamp(4rem,     2.5rem  + 3.75vw, 7.5rem);
}
```

### Spacing pairs (one-up pattern)

A useful technique is to define "pair" tokens that combine two adjacent scales, useful for asymmetric vertical rhythm:

```css
:root {
  /* Pairs: small top + large bottom (or vice versa) for section rhythm */
  --space-sm-md: clamp(0.75rem, 0.5rem + 0.65vw, 1.5rem);
  --space-md-lg: clamp(1rem,    0.7rem + 0.85vw, 2.25rem);
  --space-lg-xl: clamp(1.5rem,  0.85rem + 1.5vw, 3.5rem);
}

/* Usage: sections have tighter top padding, generous bottom */
.section {
  padding-top: var(--space-md);
  padding-bottom: var(--space-lg);
}
```

---

## Fluid Scale Generator Approach

Rather than hand-crafting each value, you can build a systematic scale using a ratio. This approach uses a modular scale that itself fluidly interpolates.

### Design parameters

```
Base size:       1rem (16px)
Min scale ratio: 1.2   (minor third -- at 320px viewport)
Max scale ratio: 1.333 (perfect fourth -- at 1280px viewport)
Steps:           -2, -1, 0, 1, 2, 3, 4, 5, 6
```

### Generated values

```
Step -2: min = 1 / 1.2^2 = 0.694rem,  max = 1 / 1.333^2 = 0.563rem
         (Note: for negative steps, max < min -- use the smaller as min)
         Result: clamp(0.563rem, ..., 0.694rem) -- but typically you'd floor at 0.75rem

Step -1: min = 1 / 1.2 = 0.833rem,    max = 1 / 1.333 = 0.75rem
Step  0: min = 1rem,                   max = 1rem (base stays fixed or grows slightly)
Step  1: min = 1 * 1.2 = 1.2rem,      max = 1 * 1.333 = 1.333rem
Step  2: min = 1 * 1.2^2 = 1.44rem,   max = 1 * 1.333^2 = 1.777rem
Step  3: min = 1 * 1.2^3 = 1.728rem,  max = 1 * 1.333^3 = 2.369rem
Step  4: min = 1 * 1.2^4 = 2.074rem,  max = 1 * 1.333^4 = 3.157rem
Step  5: min = 1 * 1.2^5 = 2.488rem,  max = 1 * 1.333^5 = 4.209rem
Step  6: min = 1 * 1.2^6 = 2.986rem,  max = 1 * 1.333^6 = 5.61rem
```

### As CSS custom properties

```css
:root {
  --fluid--2:  clamp(0.75rem,  0.72rem + 0.08vw, 0.8rem);
  --fluid--1:  clamp(0.833rem, 0.8rem  + 0.1vw,  0.9rem);
  --fluid-0:   clamp(1rem,     0.95rem + 0.15vw, 1.1rem);
  --fluid-1:   clamp(1.2rem,   1.1rem  + 0.3vw,  1.35rem);
  --fluid-2:   clamp(1.44rem,  1.2rem  + 0.55vw, 1.78rem);
  --fluid-3:   clamp(1.73rem,  1.3rem  + 0.9vw,  2.37rem);
  --fluid-4:   clamp(2.07rem,  1.35rem + 1.5vw,  3.16rem);
  --fluid-5:   clamp(2.49rem,  1.4rem  + 2.25vw, 4.21rem);
  --fluid-6:   clamp(2.99rem,  1.35rem + 3.4vw,  5.61rem);
}
```

This modular approach guarantees harmonious proportions at every viewport width.

---

## Tailwind v4 Integration

### Registering fluid tokens as Tailwind theme values

In Tailwind v4, use the `@theme` directive to wire fluid tokens into the utility system:

```css
@theme {
  /* Fluid font sizes */
  --font-size-fluid-xs:    clamp(0.75rem,  0.7rem  + 0.15vw, 0.875rem);
  --font-size-fluid-sm:    clamp(0.875rem, 0.8rem  + 0.25vw, 1rem);
  --font-size-fluid-base:  clamp(1rem,     0.925rem + 0.3vw, 1.125rem);
  --font-size-fluid-lg:    clamp(1.125rem, 1rem    + 0.4vw,  1.375rem);
  --font-size-fluid-xl:    clamp(1.25rem,  1.05rem + 0.6vw,  1.75rem);
  --font-size-fluid-2xl:   clamp(1.5rem,   1.15rem + 1vw,    2.25rem);
  --font-size-fluid-3xl:   clamp(1.875rem, 1.3rem  + 1.5vw,  3rem);
  --font-size-fluid-4xl:   clamp(2.25rem,  1.4rem  + 2.25vw, 4rem);
  --font-size-fluid-5xl:   clamp(3rem,     1.75rem + 3.25vw, 5.5rem);

  /* Fluid spacing */
  --spacing-fluid-xs:  clamp(0.5rem,  0.4rem  + 0.2vw,  0.75rem);
  --spacing-fluid-sm:  clamp(0.75rem, 0.6rem  + 0.35vw, 1rem);
  --spacing-fluid-md:  clamp(1rem,    0.85rem + 0.5vw,  1.5rem);
  --spacing-fluid-lg:  clamp(1.5rem,  1.15rem + 0.85vw, 2.25rem);
  --spacing-fluid-xl:  clamp(2rem,    1.4rem  + 1.5vw,  3.5rem);
  --spacing-fluid-2xl: clamp(3rem,    2rem    + 2.5vw,  5rem);
  --spacing-fluid-3xl: clamp(4rem,    2.5rem  + 3.75vw, 7.5rem);
}
```

Usage in HTML:

```html
<h1 class="text-fluid-5xl font-bold tracking-tight">Hero Heading</h1>
<p class="text-fluid-base leading-relaxed max-w-prose">Body text that scales.</p>

<section class="px-fluid-md py-fluid-xl">
  <div class="grid gap-fluid-lg">
    <!-- content -->
  </div>
</section>
```

### Arbitrary values for one-off fluid sizes

When you need a fluid value that is not in the theme:

```html
<h2 class="text-[clamp(1.5rem,1rem+1.25vw,2.5rem)]">Custom fluid size</h2>
<div class="p-[clamp(1rem,0.5rem+1vw,2rem)]">Custom fluid padding</div>
```

### Combining with container query units

For component-scoped fluid sizing, use `cqi` instead of `vw`:

```html
<div class="@container">
  <h3 class="text-[clamp(1rem,4cqi,1.75rem)]">Container-fluid heading</h3>
  <p class="p-[clamp(0.75rem,3cqi,1.5rem)]">Container-fluid padding</p>
</div>
```

---

## Line Height and Measure

Fluid type needs corresponding fluid line-height and measure (line length) to maintain readability.

### Line height rules

Larger text needs tighter line height:

```css
:root {
  --leading-tight:   1.2;   /* headings, display text */
  --leading-snug:    1.35;  /* subheadings, large body */
  --leading-normal:  1.5;   /* body text (WCAG minimum for AA) */
  --leading-relaxed: 1.65;  /* small text, captions */
}

h1, h2       { line-height: var(--leading-tight); }
h3, h4       { line-height: var(--leading-snug); }
p, li, dd    { line-height: var(--leading-normal); }
.caption, .footnote { line-height: var(--leading-relaxed); }
```

### Measure (line length)

Optimal reading measure is 45-75 characters. Use `ch` units:

```css
.prose {
  max-width: 65ch;
}

/* Wider for larger text */
h1 { max-width: 20ch; }
h2 { max-width: 30ch; }
h3 { max-width: 40ch; }
```

In Tailwind: `max-w-prose` (65ch).

---

## Accessibility Considerations

### Respecting user preferences

Users can set a preferred font size in their browser (the root `rem` reference). Because our `clamp()` minimums use `rem`, they scale with user preferences:

```css
/* If user sets browser font to 20px (125%), the minimum 1rem = 20px */
font-size: clamp(1rem, 0.75rem + 0.5vw, 1.75rem);
/* At 125%: clamp(20px, 15px + 0.5vw, 35px) */
```

### Never use only viewport units

```css
/* BAD: ignores user font size preference entirely */
font-size: 4vw;

/* GOOD: rem base respects user preference, vw adds fluidity */
font-size: clamp(1rem, 0.75rem + 0.5vw, 1.75rem);
```

### WCAG 1.4.4 (Resize Text)

Text must be resizable to 200% without loss of content. Fluid typography with `rem`-based clamp values passes this requirement because `rem` responds to browser zoom. Test by:

1. Setting browser zoom to 200%
2. Confirming all text is visible and no content is clipped
3. Verifying horizontal scrolling is not required at 320px CSS viewport width

### Reduced motion

Fluid typography itself does not involve motion. However, if you pair it with animated size transitions (e.g., during container resizing), respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: no-preference) {
  .fluid-element {
    transition: font-size 0.2s ease-out;
  }
}
```

---

## Practical Examples

### Article page

```css
.article {
  max-width: 65ch;
  margin-inline: auto;
  padding-inline: var(--space-md);
  padding-block: var(--space-xl);
}

.article h1 {
  font-size: var(--text-4xl);
  line-height: var(--leading-tight);
  margin-bottom: var(--space-sm);
}

.article .subtitle {
  font-size: var(--text-xl);
  line-height: var(--leading-snug);
  color: oklch(0.55 0.02 260);
  margin-bottom: var(--space-lg);
}

.article p {
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  margin-bottom: var(--space-md);
}

.article h2 {
  font-size: var(--text-2xl);
  line-height: var(--leading-snug);
  margin-top: var(--space-xl);
  margin-bottom: var(--space-sm);
}
```

### Dashboard header

```css
.dashboard-header {
  padding: var(--space-md) var(--space-lg);
}

.dashboard-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  line-height: var(--leading-tight);
}

.dashboard-stat {
  font-size: var(--text-3xl);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.dashboard-label {
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: oklch(0.55 0.02 260);
}
```

### Card grid with fluid spacing

```html
<section class="px-fluid-md py-fluid-xl">
  <h2 class="text-fluid-3xl font-bold tracking-tight mb-fluid-lg">Features</h2>
  <div class="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-fluid-md">
    <article class="rounded-xl border bg-card p-fluid-md">
      <h3 class="text-fluid-lg font-semibold mb-fluid-xs">Feature Title</h3>
      <p class="text-fluid-base text-muted-foreground leading-normal">
        Description text that scales fluidly with the viewport.
      </p>
    </article>
    <!-- more cards -->
  </div>
</section>
```

### Hero section

```css
.hero {
  min-height: 80svh;
  display: grid;
  place-items: center;
  padding: var(--space-2xl) var(--space-lg);
  text-align: center;
}

.hero-title {
  font-size: var(--text-display);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
  max-width: 15ch;
  text-wrap: balance;
}

.hero-subtitle {
  font-size: var(--text-xl);
  line-height: var(--leading-snug);
  max-width: 45ch;
  margin-top: var(--space-md);
  color: oklch(0.55 0.02 260);
}
```

In Tailwind:

```html
<section class="min-h-[80svh] grid place-items-center px-fluid-lg py-fluid-2xl text-center">
  <div>
    <h1 class="text-fluid-5xl font-extrabold leading-[1.05] tracking-tight max-w-[15ch] text-balance">
      Your headline here
    </h1>
    <p class="text-fluid-xl leading-snug max-w-[45ch] mt-fluid-md text-muted-foreground">
      Supporting text that scales with the viewport.
    </p>
  </div>
</section>
```
