# Customization & Theming

## Table of Contents
- [Architecture](#architecture)
- [Color system](#color-system)
- [Dark mode](#dark-mode)
- [Adding custom colors](#adding-custom-colors)
- [Customization hierarchy](#customization-hierarchy)

## Architecture

Three-layer theming: CSS variables (`:root` light, `.dark` dark mode) > Tailwind utilities > component consumption. Modify one variable, all referencing components update.

## Color system

Colors follow `name` / `name-foreground` pattern:
- `--primary` / `--primary-foreground` — primary actions
- `--secondary` / `--secondary-foreground` — secondary actions
- `--destructive` / `--destructive-foreground` — destructive states
- `--muted` / `--muted-foreground` — muted/disabled elements
- `--accent` / `--accent-foreground` — accents
- `--background` / `--foreground` — page background/text
- `--card` / `--card-foreground` — card background/text
- `--popover` / `--popover-foreground` — popover background/text

Colors use OKLCH format: `--primary: oklch(0.205 0 0)` (lightness, chroma, hue).

## Dark mode

Toggle via `.dark` class on root element. In Next.js, use `next-themes` for system preference detection.

## Adding custom colors

1. Define in global CSS file (the one from `tailwind.css` in components.json — never a new file):

```css
:root {
  --success: oklch(0.72 0.19 142);
  --success-foreground: oklch(0.98 0 0);
}
.dark {
  --success: oklch(0.55 0.15 142);
  --success-foreground: oklch(0.98 0 0);
}
```

2. Register with Tailwind:

```css
/* Tailwind v4 (@theme) */
@theme {
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
}
```

```js
// Tailwind v3 (tailwind.config.js)
module.exports = {
  theme: {
    extend: {
      colors: {
        success: "oklch(var(--success) / <alpha-value>)",
        "success-foreground": "oklch(var(--success-foreground) / <alpha-value>)",
      },
    },
  },
};
```

3. Use via Tailwind: `bg-success text-success-foreground`

## Customization hierarchy

Prefer in this order:
1. **Built-in variants** — `variant="outline"`, `variant="destructive"`
2. **Tailwind classes** — `className` attributes
3. **New variants** — edit component source files
4. **Wrapper components** — compose primitives into custom elements
