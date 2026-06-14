# Container Queries Deep Dive

## Table of Contents

- [Containment Fundamentals](#containment-fundamentals)
- [Size Queries](#size-queries)
- [Container Query Units](#container-query-units)
- [Style Queries](#style-queries)
- [Scroll-State Queries](#scroll-state-queries)
- [React Patterns](#react-patterns)
- [Tailwind v4 Integration](#tailwind-v4-integration)
- [Fallback Strategies](#fallback-strategies)
- [Browser Support](#browser-support)
- [Common Patterns](#common-patterns)

---

## Containment Fundamentals

Container queries require establishing a **containment context** on an ancestor element. The browser needs to know which element's dimensions to measure.

```css
/* Inline-size containment (most common -- responds to width changes) */
.container {
  container-type: inline-size;
}

/* Both axes (use sparingly -- prevents height: auto) */
.container {
  container-type: size;
}

/* Named container for targeted queries */
.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

/* Shorthand */
.sidebar {
  container: sidebar / inline-size;
}
```

**Key constraint**: `container-type: inline-size` establishes containment on the inline axis only. The element can still have intrinsic block-size (height). Using `container-type: size` requires explicit height because the element can no longer derive height from its content.

---

## Size Queries

Size queries test the dimensions of a containment context.

```css
/* Target a named container */
@container sidebar (min-width: 250px) {
  .nav-item { display: flex; gap: 0.5rem; }
  .nav-label { display: inline; }
}

@container sidebar (max-width: 249px) {
  .nav-item { justify-content: center; }
  .nav-label { display: none; }
}

/* Range syntax (preferred in 2026) */
@container card (200px <= width <= 500px) {
  .card-content { padding: 1rem; }
}

@container card (width > 500px) {
  .card-content { padding: 1.5rem 2rem; }
}

/* Unnamed container -- matches nearest ancestor with containment */
@container (min-width: 400px) {
  .adaptive-element { flex-direction: row; }
}
```

### Logical properties in container queries

Container queries support logical properties, which are preferable for internationalization:

```css
@container (min-inline-size: 400px) {
  .card { grid-template-columns: 200px 1fr; }
}
```

---

## Container Query Units

Container query units are relative to the dimensions of the nearest containment context.

| Unit    | Definition                          | Use case |
|---------|-------------------------------------|----------|
| `cqi`   | 1% of container inline size         | Width-relative sizing |
| `cqb`   | 1% of container block size          | Height-relative sizing (needs `size` containment) |
| `cqw`   | 1% of container width               | Same as `cqi` in horizontal writing modes |
| `cqh`   | 1% of container height              | Same as `cqb` in horizontal writing modes |
| `cqmin` | Smaller of `cqi` and `cqb`          | Aspect-ratio-safe sizing |
| `cqmax` | Larger of `cqi` and `cqb`           | Aspect-ratio-safe sizing |

```css
.card-wrapper {
  container-type: inline-size;
}

.card-title {
  /* Scales with container, clamped to readable range */
  font-size: clamp(1rem, 4cqi, 1.75rem);
}

.card-icon {
  /* Icon scales proportionally to container width */
  width: clamp(1.5rem, 8cqi, 3rem);
  height: clamp(1.5rem, 8cqi, 3rem);
}

.card-padding {
  /* Padding scales with container */
  padding: clamp(0.75rem, 3cqi, 2rem);
}
```

---

## Style Queries

Style queries test the computed value of custom properties on a container. They do not require `container-type` -- only `container-name` (or an unnamed container).

```css
/* Parent sets a style condition via custom property */
.theme-area {
  container-name: theme;
  --theme: light;
}

.theme-area[data-theme="dark"] {
  --theme: dark;
}

/* Children respond to the custom property value */
@container theme style(--theme: dark) {
  .card {
    background: oklch(0.25 0.02 260);
    color: oklch(0.95 0.01 260);
    border-color: oklch(0.35 0.03 260);
  }
}

@container theme style(--theme: light) {
  .card {
    background: oklch(0.99 0.005 260);
    color: oklch(0.2 0.02 260);
  }
}
```

### Practical use: variant-driven components

```css
.button-group {
  container-name: btn-ctx;
  --button-variant: default;
}

.button-group.destructive {
  --button-variant: destructive;
}

@container btn-ctx style(--button-variant: destructive) {
  .btn {
    background: oklch(0.55 0.22 25);
    color: white;
  }
  .btn:hover {
    background: oklch(0.48 0.22 25);
  }
}
```

**Browser support**: Style queries for custom properties ship in Chrome 111+, Safari 18+, Firefox 128+.

---

## Scroll-State Queries

Scroll-state container queries (Chrome 133+, progressive enhancement for others) test whether a scroll container is scrollable, scrolled to an edge, or whether an element is stuck/snapped.

```css
.scroll-area {
  container-type: scroll-state;
  overflow-y: auto;
}

/* Show a shadow when scrolled away from the top */
@container scroll-state(scrollable: top) {
  .scroll-area::before {
    content: "";
    position: sticky;
    top: 0;
    display: block;
    height: 4px;
    background: linear-gradient(to bottom, oklch(0 0 0 / 0.15), transparent);
  }
}

/* Detect sticky positioning */
.sticky-header {
  position: sticky;
  top: 0;
  container-type: scroll-state;
}

@container scroll-state(stuck: top) {
  .sticky-header {
    box-shadow: 0 2px 8px oklch(0 0 0 / 0.1);
    backdrop-filter: blur(8px);
  }
}
```

**Note**: Scroll-state queries are the newest addition. Always use `@supports` or treat as progressive enhancement.

---

## React Patterns

### Container query wrapper component

```tsx
interface ContainerProps {
  name?: string;
  type?: "inline-size" | "size";
  className?: string;
  children: React.ReactNode;
}

function Container({
  name,
  type = "inline-size",
  className = "",
  children,
}: ContainerProps) {
  const containerStyle = {
    containerType: type,
    ...(name ? { containerName: name } : {}),
  };

  return (
    <div style={containerStyle} className={className}>
      {children}
    </div>
  );
}
```

Usage:

```tsx
function ProductCard({ product }: { product: Product }) {
  return (
    <Container name="product-card">
      <div className="product-card">
        <img src={product.image} alt={product.name} />
        <div className="product-card__details">
          <h3>{product.name}</h3>
          <p className="product-card__price">{product.price}</p>
        </div>
      </div>
    </Container>
  );
}
```

```css
@container product-card (min-width: 350px) {
  .product-card {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 1rem;
  }
}

@container product-card (min-width: 550px) {
  .product-card {
    grid-template-columns: 200px 1fr;
  }
  .product-card__details {
    display: flex;
    justify-content: space-between;
    align-items: start;
  }
}
```

### Using CSS Modules with container queries

```tsx
// ProductCard.module.css
.wrapper {
  container: product-card / inline-size;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@container product-card (min-width: 400px) {
  .card {
    flex-direction: row;
  }
}
```

```tsx
import styles from "./ProductCard.module.css";

function ProductCard({ product }: { product: Product }) {
  return (
    <div className={styles.wrapper}>
      <article className={styles.card}>
        {/* content */}
      </article>
    </div>
  );
}
```

### Tailwind v4 in React (JSX)

```tsx
function AdaptiveCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container/card">
      <div className="flex flex-col gap-3 p-4 @sm/card:flex-row @sm/card:gap-4 @md/card:p-6 @lg/card:grid @lg/card:grid-cols-[200px_1fr]">
        {children}
      </div>
    </div>
  );
}
```

---

## Tailwind v4 Integration

Tailwind v4 has native container query support with the `@container` utility and `@` breakpoint prefix.

### Establishing containment

```html
<!-- Unnamed container (inline-size) -->
<div class="@container">

<!-- Named container -->
<div class="@container/card">

<!-- Both axes (rare) -->
<div class="@container-size">
```

### Querying container size

Tailwind provides `@`-prefixed variants that map to container widths:

| Variant | Min container width |
|---------|-------------------|
| `@xs`   | 320px (20rem)     |
| `@sm`   | 384px (24rem)     |
| `@md`   | 448px (28rem)     |
| `@lg`   | 512px (32rem)     |
| `@xl`   | 576px (36rem)     |
| `@2xl`  | 672px (42rem)     |
| `@3xl`  | 768px (48rem)     |
| `@4xl`  | 896px (56rem)     |
| `@5xl`  | 1024px (64rem)    |

```html
<div class="@container/card">
  <article class="flex flex-col @sm/card:flex-row @lg/card:grid @lg/card:grid-cols-3 gap-4">
    <img class="w-full @sm/card:w-40 @lg/card:w-auto aspect-video object-cover rounded-lg" />
    <div class="flex-1">
      <h3 class="text-base @md/card:text-lg @xl/card:text-xl font-semibold">Title</h3>
      <p class="text-sm @md/card:text-base text-muted-foreground mt-1">Description</p>
    </div>
    <div class="hidden @lg/card:flex flex-col justify-between">
      <span class="text-sm text-muted-foreground">Metadata</span>
    </div>
  </article>
</div>
```

### Custom container breakpoints in Tailwind v4

Use the `@theme` directive to define custom container sizes:

```css
@theme {
  --container-3xs: 160px;
  --container-2xs: 240px;
  /* Default sizes still available */
}
```

Then use them: `@3xs/sidebar:block`.

### Container query units in Tailwind v4

Tailwind v4 supports arbitrary values with container query units:

```html
<div class="@container">
  <h2 class="text-[clamp(1rem,4cqi,1.75rem)]">Fluid heading</h2>
  <div class="p-[clamp(0.75rem,3cqi,2rem)]">Fluid padding</div>
</div>
```

---

## Fallback Strategies

### Feature detection with @supports

```css
/* Fallback: media query based */
@media (min-width: 640px) {
  .card { flex-direction: row; }
}

/* Enhancement: container query overrides when supported */
@supports (container-type: inline-size) {
  .card-wrapper { container-type: inline-size; }

  @container (min-width: 400px) {
    .card { flex-direction: row; }
  }

  /* Remove the media query fallback behavior if needed */
  @media (min-width: 640px) {
    .card { flex-direction: column; } /* Reset -- let container decide */
  }
}
```

### JavaScript feature detection

```typescript
const supportsContainerQueries = CSS.supports("container-type", "inline-size");
const supportsStyleQueries = CSS.supports("container-type", "normal")
  && CSS.supports("container-name", "test");
```

### ResizeObserver fallback for older browsers

```typescript
function containerQueryFallback(
  container: HTMLElement,
  breakpoints: Record<string, number>,
) {
  const observer = new ResizeObserver(([entry]) => {
    const width = entry.contentBoxSize[0].inlineSize;
    for (const [name, minWidth] of Object.entries(breakpoints)) {
      container.classList.toggle(`cq-${name}`, width >= minWidth);
    }
  });
  observer.observe(container);
  return () => observer.disconnect();
}

// Usage
containerQueryFallback(element, { sm: 384, md: 448, lg: 512 });
```

```css
/* Fallback classes set by ResizeObserver */
.card.cq-sm { flex-direction: row; }
.card.cq-md { grid-template-columns: 200px 1fr; }
```

---

## Browser Support

As of March 2026:

| Feature | Chrome | Firefox | Safari | Notes |
|---------|--------|---------|--------|-------|
| Size container queries | 105+ | 110+ | 16+ | Universal support |
| Container query units (`cqi`, `cqb`) | 105+ | 110+ | 16+ | Universal support |
| Named containers | 105+ | 110+ | 16+ | Universal support |
| Style queries (custom properties) | 111+ | 128+ | 18+ | Wide support |
| Style queries (standard properties) | Partial | Partial | Partial | Still evolving spec |
| Scroll-state queries | 133+ | Partial | No | Progressive enhancement only |

**Recommendation**: Size queries and container units are safe for production without fallbacks. Style queries for custom properties are safe with a minor fallback for older Firefox. Scroll-state queries should always be progressive enhancement.

---

## Common Patterns

### Responsive navigation

```css
.nav-wrapper {
  container: nav / inline-size;
}

/* Compact: icon-only */
@container nav (max-width: 199px) {
  .nav-label { display: none; }
  .nav-link { justify-content: center; padding: 0.75rem; }
}

/* Medium: icon + label */
@container nav (200px <= width <= 599px) {
  .nav-link { display: flex; gap: 0.5rem; align-items: center; }
}

/* Wide: full navigation with grouping */
@container nav (min-width: 600px) {
  .nav { flex-direction: row; }
  .nav-group { display: flex; gap: 0.25rem; }
}
```

### Dashboard widget

```css
.widget-container {
  container: widget / inline-size;
}

/* Small: number only */
@container widget (max-width: 199px) {
  .widget-chart { display: none; }
  .widget-value { font-size: clamp(1.25rem, 6cqi, 2rem); }
}

/* Medium: number + sparkline */
@container widget (200px <= width <= 399px) {
  .widget { display: grid; grid-template-rows: auto 1fr; }
  .widget-chart { height: 60px; }
}

/* Large: full chart with legend */
@container widget (min-width: 400px) {
  .widget { display: grid; grid-template-columns: 1fr 1fr; }
  .widget-chart { height: 120px; }
  .widget-legend { display: block; }
}
```

### Responsive table to cards

```css
.table-wrapper {
  container: data-table / inline-size;
}

/* Narrow: stack as cards */
@container data-table (max-width: 599px) {
  .table-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    padding: 1rem;
    border-bottom: 1px solid oklch(0.9 0.01 260);
  }
  .table-header { display: none; }
  .table-cell::before {
    content: attr(data-label);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: oklch(0.55 0.02 260);
  }
}

/* Wide: standard table layout */
@container data-table (min-width: 600px) {
  .table-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr auto;
    align-items: center;
  }
}
```
