---
name: design-system-tokens
description: "Design tokens (W3C DTCG) \u2014 CSS custom properties, Tailwind v3/v4, OKLCH color, dark mode, Style Dictionary pipelines"
effort: low
keep-coding-instructions: true
paths:
  - "**/tokens/**"
  - "**/theme/**"
  - "tailwind.config.*"
---

# Design System Tokens

## Overview

Design tokens are the single source of truth for visual decisions in a design system. They capture colors, spacing, typography, shadows, and motion as named, platform-agnostic values that flow into CSS custom properties, Tailwind themes, native stylesheets, and Figma variables.

This skill teaches a modern token workflow built on three principles:

1. **W3C DTCG format** for interoperable `.tokens.json` files
2. **Three-tier hierarchy** -- primitives, semantic aliases, component-scoped -- for scalable theming
3. **Automated pipelines** via Style Dictionary 4.x for multi-platform output

**Bundled References:**
- `${CLAUDE_SKILL_DIR}/references/token-hierarchy.md` -- Detailed tier system with W3C DTCG examples, naming conventions, and Style Dictionary pipeline configuration
- `${CLAUDE_SKILL_DIR}/references/tailwind-integration.md` -- Connecting tokens to Tailwind v3 `theme.extend` and v4 `@theme` directive patterns
- `${CLAUDE_SKILL_DIR}/references/color-and-contrast.md` -- OKLCH color space, WCAG contrast enforcement at the token level, and dark mode theming via `data-theme`

---

## Token Hierarchy at a Glance

```
Tier 1: Global Primitives        color.blue.500, spacing.4, font.size.lg
         |
Tier 2: Semantic Aliases          color.primary, color.surface, spacing.card-padding
         |
Tier 3: Component-Scoped          button.background, input.border-color, card.radius
```

Primitives are raw values. Semantic aliases give them meaning. Component tokens bind meaning to specific UI elements. Consumers reference Tier 3 (or Tier 2 for layout); no component should ever reference a primitive directly.

**Read `${CLAUDE_SKILL_DIR}/references/token-hierarchy.md` for complete examples, the W3C DTCG JSON structure, naming conventions, and the Style Dictionary 4.x transformation pipeline.**

## CSS Custom Properties Output

Tokens compile to CSS custom properties scoped under a predictable namespace:

```css
:root {
  /* Primitives (rarely referenced directly in components) */
  --color-blue-500: oklch(0.55 0.2 260);
  --spacing-4: 1rem;

  /* Semantic aliases (the main consumption layer) */
  --color-primary: var(--color-blue-500);
  --color-surface: oklch(0.99 0.005 260);
  --spacing-card-padding: var(--spacing-4);

  /* Component tokens */
  --button-bg: var(--color-primary);
  --input-border: var(--color-neutral-300);
}
```

## Tailwind CSS Integration

Tokens feed into Tailwind so that utility classes like `bg-primary` and `p-card-padding` resolve to your governed token values.

- **Tailwind v3**: Map tokens into `theme.extend` in `tailwind.config.ts`
- **Tailwind v4**: Use the `@theme` directive in CSS to register tokens directly

**Read `${CLAUDE_SKILL_DIR}/references/tailwind-integration.md` for complete v3 and v4 patterns including dynamic dark-mode switching.**

## Color and Contrast

This skill recommends **OKLCH** as the primary color space for perceptual uniformity, with hex fallbacks for legacy browsers. Contrast ratios are enforced at the token level, not at the component level, so violations are caught before they reach production.

**Read `${CLAUDE_SKILL_DIR}/references/color-and-contrast.md` for OKLCH palettes, WCAG enforcement scripts, and dark mode theming via the `data-theme` attribute.**

## Migration Path: Hardcoded Values to Tokens

A practical migration follows four phases:

1. **Audit** -- Extract every unique color, spacing, font-size, shadow, and radius value from the codebase.
2. **Normalize** -- Deduplicate near-identical values (e.g., `#3b82f6` and `#3a80f5` become one primitive).
3. **Name** -- Assign primitive names, then create semantic aliases that match how the values are actually used.
4. **Replace** -- Swap hardcoded values for CSS custom properties or Tailwind classes in order of frequency.

For Material-UI to shadcn/radix-ui migrations, map MUI theme keys (`palette.primary.main`, `spacing(2)`) to the equivalent semantic tokens (`--color-primary`, `--spacing-2`), then wire those tokens into the Tailwind theme.

## Quick Reference: Naming Convention

Tokens use **kebab-case** with a **category.type.item** pattern:

| Category | Examples |
|---|---|
| `color` | `color.blue.500`, `color.primary`, `color.surface` |
| `spacing` | `spacing.1` through `spacing.16`, `spacing.card-padding` |
| `font` | `font.size.sm`, `font.weight.semibold`, `font.family.body` |
| `radius` | `radius.sm`, `radius.lg`, `radius.full` |
| `shadow` | `shadow.sm`, `shadow.card`, `shadow.dropdown` |
| `motion` | `motion.duration.fast`, `motion.easing.ease-out` |

In CSS output, dots become hyphens: `color.primary` becomes `--color-primary`.
