# Token Hierarchy

## Table of Contents

- [Overview](#overview)
- [W3C DTCG Format](#w3c-dtcg-format)
- [Tier 1: Global Primitives](#tier-1-global-primitives)
- [Tier 2: Semantic Aliases](#tier-2-semantic-aliases)
- [Tier 3: Component-Scoped Tokens](#tier-3-component-scoped-tokens)
- [Naming Conventions](#naming-conventions)
- [Style Dictionary 4.x Pipeline](#style-dictionary-4x-pipeline)
- [Migration Guide: Hardcoded Values to Tokens](#migration-guide-hardcoded-values-to-tokens)

---

## Overview

The three-tier token hierarchy separates raw values from their meaning and their usage. This separation enables theming (swap semantic aliases), platform targeting (transform primitives per output), and component isolation (change a button without affecting a card).

```
Tier 1: Primitives     -- What values exist
Tier 2: Semantic        -- What values mean
Tier 3: Component       -- Where values are used
```

## W3C DTCG Format

The W3C Design Tokens Community Group defines a JSON structure where each token has a `$value` and `$type`. Groups are nested objects. Aliases use the `{group.token}` reference syntax.

### Primitives file: `primitives.tokens.json`

```json
{
  "color": {
    "blue": {
      "50":  { "$value": "oklch(0.97 0.02 260)", "$type": "color" },
      "100": { "$value": "oklch(0.93 0.04 260)", "$type": "color" },
      "200": { "$value": "oklch(0.86 0.08 260)", "$type": "color" },
      "300": { "$value": "oklch(0.77 0.12 260)", "$type": "color" },
      "400": { "$value": "oklch(0.67 0.17 260)", "$type": "color" },
      "500": { "$value": "oklch(0.55 0.20 260)", "$type": "color" },
      "600": { "$value": "oklch(0.47 0.20 260)", "$type": "color" },
      "700": { "$value": "oklch(0.39 0.18 260)", "$type": "color" },
      "800": { "$value": "oklch(0.31 0.14 260)", "$type": "color" },
      "900": { "$value": "oklch(0.23 0.10 260)", "$type": "color" }
    },
    "neutral": {
      "0":   { "$value": "oklch(1.00 0 0)", "$type": "color" },
      "50":  { "$value": "oklch(0.98 0.003 260)", "$type": "color" },
      "100": { "$value": "oklch(0.96 0.005 260)", "$type": "color" },
      "200": { "$value": "oklch(0.91 0.008 260)", "$type": "color" },
      "300": { "$value": "oklch(0.83 0.01 260)", "$type": "color" },
      "400": { "$value": "oklch(0.71 0.01 260)", "$type": "color" },
      "500": { "$value": "oklch(0.60 0.01 260)", "$type": "color" },
      "600": { "$value": "oklch(0.49 0.01 260)", "$type": "color" },
      "700": { "$value": "oklch(0.39 0.01 260)", "$type": "color" },
      "800": { "$value": "oklch(0.27 0.008 260)", "$type": "color" },
      "900": { "$value": "oklch(0.18 0.005 260)", "$type": "color" },
      "950": { "$value": "oklch(0.12 0.003 260)", "$type": "color" }
    },
    "green": {
      "500": { "$value": "oklch(0.62 0.17 145)", "$type": "color" },
      "600": { "$value": "oklch(0.52 0.17 145)", "$type": "color" }
    },
    "red": {
      "500": { "$value": "oklch(0.58 0.22 25)", "$type": "color" },
      "600": { "$value": "oklch(0.48 0.22 25)", "$type": "color" }
    }
  },
  "spacing": {
    "0":  { "$value": "0px", "$type": "dimension" },
    "1":  { "$value": "0.25rem", "$type": "dimension" },
    "2":  { "$value": "0.5rem", "$type": "dimension" },
    "3":  { "$value": "0.75rem", "$type": "dimension" },
    "4":  { "$value": "1rem", "$type": "dimension" },
    "5":  { "$value": "1.25rem", "$type": "dimension" },
    "6":  { "$value": "1.5rem", "$type": "dimension" },
    "8":  { "$value": "2rem", "$type": "dimension" },
    "10": { "$value": "2.5rem", "$type": "dimension" },
    "12": { "$value": "3rem", "$type": "dimension" },
    "16": { "$value": "4rem", "$type": "dimension" }
  },
  "font": {
    "size": {
      "xs":  { "$value": "0.75rem", "$type": "dimension" },
      "sm":  { "$value": "0.875rem", "$type": "dimension" },
      "base": { "$value": "1rem", "$type": "dimension" },
      "lg":  { "$value": "1.125rem", "$type": "dimension" },
      "xl":  { "$value": "1.25rem", "$type": "dimension" },
      "2xl": { "$value": "1.5rem", "$type": "dimension" },
      "3xl": { "$value": "1.875rem", "$type": "dimension" },
      "4xl": { "$value": "2.25rem", "$type": "dimension" }
    },
    "weight": {
      "normal":   { "$value": "400", "$type": "fontWeight" },
      "medium":   { "$value": "500", "$type": "fontWeight" },
      "semibold": { "$value": "600", "$type": "fontWeight" },
      "bold":     { "$value": "700", "$type": "fontWeight" }
    },
    "family": {
      "sans":  { "$value": "'Inter Variable', ui-sans-serif, system-ui, sans-serif", "$type": "fontFamily" },
      "mono":  { "$value": "'JetBrains Mono', ui-monospace, monospace", "$type": "fontFamily" }
    }
  },
  "radius": {
    "none": { "$value": "0px", "$type": "dimension" },
    "sm":   { "$value": "0.25rem", "$type": "dimension" },
    "md":   { "$value": "0.375rem", "$type": "dimension" },
    "lg":   { "$value": "0.5rem", "$type": "dimension" },
    "xl":   { "$value": "0.75rem", "$type": "dimension" },
    "2xl":  { "$value": "1rem", "$type": "dimension" },
    "full": { "$value": "9999px", "$type": "dimension" }
  },
  "shadow": {
    "sm":  { "$value": "0 1px 2px 0 oklch(0 0 0 / 0.05)", "$type": "shadow" },
    "md":  { "$value": "0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1)", "$type": "shadow" },
    "lg":  { "$value": "0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1)", "$type": "shadow" },
    "xl":  { "$value": "0 20px 25px -5px oklch(0 0 0 / 0.1), 0 8px 10px -6px oklch(0 0 0 / 0.1)", "$type": "shadow" }
  },
  "motion": {
    "duration": {
      "instant": { "$value": "0ms", "$type": "duration" },
      "fast":    { "$value": "100ms", "$type": "duration" },
      "normal":  { "$value": "200ms", "$type": "duration" },
      "slow":    { "$value": "300ms", "$type": "duration" },
      "slower":  { "$value": "500ms", "$type": "duration" }
    },
    "easing": {
      "ease-in":     { "$value": "cubic-bezier(0.4, 0, 1, 1)", "$type": "cubicBezier" },
      "ease-out":    { "$value": "cubic-bezier(0, 0, 0.2, 1)", "$type": "cubicBezier" },
      "ease-in-out": { "$value": "cubic-bezier(0.4, 0, 0.2, 1)", "$type": "cubicBezier" }
    }
  }
}
```

### Semantic file: `semantic.tokens.json`

Semantic tokens reference primitives via `{group.subgroup.item}` syntax:

```json
{
  "color": {
    "primary":    { "$value": "{color.blue.500}", "$type": "color" },
    "primary-hover": { "$value": "{color.blue.600}", "$type": "color" },
    "on-primary": { "$value": "{color.neutral.0}", "$type": "color" },
    "secondary":  { "$value": "{color.neutral.600}", "$type": "color" },

    "surface":       { "$value": "{color.neutral.0}", "$type": "color" },
    "surface-raised": { "$value": "{color.neutral.0}", "$type": "color" },
    "surface-sunken": { "$value": "{color.neutral.50}", "$type": "color" },
    "background":    { "$value": "{color.neutral.50}", "$type": "color" },

    "border":        { "$value": "{color.neutral.200}", "$type": "color" },
    "border-strong": { "$value": "{color.neutral.300}", "$type": "color" },

    "text":          { "$value": "{color.neutral.900}", "$type": "color" },
    "text-muted":    { "$value": "{color.neutral.500}", "$type": "color" },
    "text-subtle":   { "$value": "{color.neutral.400}", "$type": "color" },

    "success":       { "$value": "{color.green.500}", "$type": "color" },
    "error":         { "$value": "{color.red.500}", "$type": "color" }
  },
  "spacing": {
    "card-padding":   { "$value": "{spacing.6}", "$type": "dimension" },
    "section-gap":    { "$value": "{spacing.8}", "$type": "dimension" },
    "input-x":        { "$value": "{spacing.3}", "$type": "dimension" },
    "input-y":        { "$value": "{spacing.2}", "$type": "dimension" },
    "stack-sm":       { "$value": "{spacing.2}", "$type": "dimension" },
    "stack-md":       { "$value": "{spacing.4}", "$type": "dimension" },
    "stack-lg":       { "$value": "{spacing.8}", "$type": "dimension" }
  },
  "radius": {
    "card":    { "$value": "{radius.xl}", "$type": "dimension" },
    "button":  { "$value": "{radius.lg}", "$type": "dimension" },
    "input":   { "$value": "{radius.md}", "$type": "dimension" },
    "badge":   { "$value": "{radius.full}", "$type": "dimension" }
  },
  "shadow": {
    "card":     { "$value": "{shadow.md}", "$type": "shadow" },
    "dropdown": { "$value": "{shadow.lg}", "$type": "shadow" },
    "dialog":   { "$value": "{shadow.xl}", "$type": "shadow" }
  }
}
```

## Tier 1: Global Primitives

Primitives are the raw palette. They have no opinion about usage.

**Rules:**
- Names describe the value, not its purpose: `color.blue.500`, not `color.brand`
- Scale numerically: 50-950 for colors, 0-16 for spacing
- Exhaustive: every value the system can produce lives here
- Stable: adding a new shade does not rename existing ones
- Components never reference primitives directly

**Spacing follows an 8px base grid** (via rem): `spacing.1` = 4px, `spacing.2` = 8px, `spacing.4` = 16px.

## Tier 2: Semantic Aliases

Semantic tokens answer "what does this value mean in our UI?"

**Rules:**
- Names describe purpose: `color.primary`, `spacing.card-padding`
- Always reference a primitive via `{group.item}` syntax
- This is the main theming layer -- dark mode swaps semantic aliases, not primitives
- Kept intentionally flat (no deep nesting beyond `category.purpose`)

**Semantic tokens are the primary consumption layer.** Tailwind utilities, CSS classes, and component styles should reference semantic tokens.

## Tier 3: Component-Scoped Tokens

Component tokens answer "what value does this specific element use?"

**Rules:**
- Scoped to a single component: `button.bg`, `input.border-color`, `card.radius`
- Reference semantic tokens (or occasionally primitives for one-off cases)
- Optional -- only create when a component needs to diverge from semantic defaults or when the component is complex enough that its token bindings deserve documentation

### Component token file: `components/button.tokens.json`

```json
{
  "button": {
    "bg":           { "$value": "{color.primary}", "$type": "color" },
    "bg-hover":     { "$value": "{color.primary-hover}", "$type": "color" },
    "text":         { "$value": "{color.on-primary}", "$type": "color" },
    "radius":       { "$value": "{radius.button}", "$type": "dimension" },
    "padding-x":    { "$value": "{spacing.4}", "$type": "dimension" },
    "padding-y":    { "$value": "{spacing.2}", "$type": "dimension" },
    "font-size":    { "$value": "{font.size.sm}", "$type": "dimension" },
    "font-weight":  { "$value": "{font.weight.semibold}", "$type": "fontWeight" },
    "shadow":       { "$value": "{shadow.sm}", "$type": "shadow" },
    "transition":   { "$value": "{motion.duration.fast}", "$type": "duration" }
  }
}
```

### Component token file: `components/input.tokens.json`

```json
{
  "input": {
    "bg":             { "$value": "{color.surface}", "$type": "color" },
    "border-color":   { "$value": "{color.border}", "$type": "color" },
    "border-focus":   { "$value": "{color.primary}", "$type": "color" },
    "border-error":   { "$value": "{color.error}", "$type": "color" },
    "text":           { "$value": "{color.text}", "$type": "color" },
    "placeholder":    { "$value": "{color.text-subtle}", "$type": "color" },
    "radius":         { "$value": "{radius.input}", "$type": "dimension" },
    "padding-x":      { "$value": "{spacing.input-x}", "$type": "dimension" },
    "padding-y":      { "$value": "{spacing.input-y}", "$type": "dimension" },
    "font-size":      { "$value": "{font.size.sm}", "$type": "dimension" },
    "ring-width":     { "$value": "2px", "$type": "dimension" },
    "ring-color":     { "$value": "{color.primary}", "$type": "color" },
    "ring-offset":    { "$value": "1px", "$type": "dimension" }
  }
}
```

## Naming Conventions

### Pattern: `category.type.item`

```
category   = color | spacing | font | radius | shadow | motion
type       = purpose or scale position
item       = variant or state (optional)
```

### Rules

1. **kebab-case** throughout: `font-size`, `card-padding`, `ease-in-out`
2. **Dots separate hierarchy levels** in token files; **hyphens separate words** within a level
3. **State suffixes** use hyphens: `color.primary-hover`, `color.primary-disabled`
4. **Scale tokens** use numbers: `color.blue.500`, `spacing.4`
5. **Semantic tokens** use descriptive names: `color.surface`, `spacing.card-padding`
6. **Component tokens** are prefixed with the component name: `button.bg`, `input.border-color`
7. **CSS output** converts dots to hyphens: `color.primary` becomes `--color-primary`

### Naming anti-patterns

| Bad | Why | Good |
|---|---|---|
| `color.brandBlue` | camelCase, encodes brand in primitive | `color.blue.500` (primitive), `color.primary` (semantic) |
| `color.btn-primary-bg` | component concern in semantic tier | `button.bg` (component tier) |
| `spacing.medium` | ambiguous scale | `spacing.4` |
| `color.darkModePrimary` | mode encoded in name | `color.primary` (swapped via theme layer) |
| `font.size.bodyText` | usage in primitive name | `font.size.base` (primitive), then reference semantically |

## Style Dictionary 4.x Pipeline

Style Dictionary transforms the DTCG JSON files into platform-specific outputs.

### Project structure

```
tokens/
  primitives.tokens.json
  semantic.tokens.json
  components/
    button.tokens.json
    input.tokens.json
    card.tokens.json
build/
  css/
    tokens.css
  tailwind/
    tokens.js
  ios/
    Tokens.swift
  android/
    tokens.xml
style-dictionary.config.mjs
```

### Configuration: `style-dictionary.config.mjs`

```javascript
import StyleDictionary from 'style-dictionary';

// Register OKLCH-to-hex fallback transform
StyleDictionary.registerTransform({
  name: 'color/oklch-hex-fallback',
  type: 'value',
  filter: (token) => token.$type === 'color',
  transform: (token) => {
    // In a real pipeline, use culori or colorjs.io to convert
    // For illustration, this preserves OKLCH and adds a fallback comment
    return token.$value;
  },
});

// Register CSS custom property format with fallbacks
StyleDictionary.registerFormat({
  name: 'css/custom-properties-oklch',
  format: ({ dictionary }) => {
    const lines = dictionary.allTokens.map((token) => {
      const prop = token.name; // Already kebab-cased by transform
      return `  --${prop}: ${token.$value};`;
    });
    return `:root {\n${lines.join('\n')}\n}\n`;
  },
});

export default {
  source: ['tokens/**/*.tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: '',
      buildPath: 'build/css/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: {
            outputReferences: true,
          },
        },
      ],
    },
    tailwind: {
      transformGroup: 'js',
      buildPath: 'build/tailwind/',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6',
        },
      ],
    },
    ios: {
      transformGroup: 'ios-swift',
      buildPath: 'build/ios/',
      files: [
        {
          destination: 'Tokens.swift',
          format: 'ios-swift/class.swift',
          className: 'DesignTokens',
        },
      ],
    },
    android: {
      transformGroup: 'android',
      buildPath: 'build/android/',
      files: [
        {
          destination: 'tokens.xml',
          format: 'android/resources',
        },
      ],
    },
  },
};
```

### Build command

```bash
npx style-dictionary@4 build --config style-dictionary.config.mjs
```

### CSS output example (with `outputReferences: true`)

```css
:root {
  /* Primitives */
  --color-blue-500: oklch(0.55 0.2 260);
  --color-neutral-0: oklch(1.00 0 0);
  --spacing-4: 1rem;
  --radius-lg: 0.5rem;

  /* Semantic aliases reference primitives */
  --color-primary: var(--color-blue-500);
  --color-on-primary: var(--color-neutral-0);
  --spacing-card-padding: var(--spacing-4);
  --radius-button: var(--radius-lg);

  /* Component tokens reference semantic aliases */
  --button-bg: var(--color-primary);
  --button-text: var(--color-on-primary);
  --button-padding-x: var(--spacing-4);
  --button-radius: var(--radius-button);
}
```

## Migration Guide: Hardcoded Values to Tokens

### Phase 1: Audit

Extract all unique design values from the codebase:

```bash
# Find all hex colors
grep -rhoE '#[0-9a-fA-F]{3,8}' src/ | sort -u > audit/colors.txt

# Find all pixel/rem values used in spacing or sizing
grep -rhoE '[0-9]+px\|[0-9.]+rem' src/ | sort -u > audit/dimensions.txt

# Find all font-size declarations
grep -rhoE 'font-size:\s*[^;]+' src/ | sort -u > audit/font-sizes.txt
```

### Phase 2: Normalize

Group near-identical values into single primitives. Tools like `culori` can compute color distance to detect near-duplicates.

### Phase 3: Name

Map each unique value to the three-tier hierarchy:
1. Create a primitive for every distinct value
2. Create semantic aliases for the 15-25 most-used purposes (primary, surface, text, etc.)
3. Create component tokens only for components with 5+ token bindings

### Phase 4: Replace

Replace in order of frequency. Start with the most-used values to get the highest coverage per commit:

```css
/* Before */
.card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

/* After */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--spacing-card-padding);
  box-shadow: var(--shadow-card);
}
```

### Material-UI to Tailwind Token Mapping

When migrating from MUI's theme to tokens:

| MUI Theme Key | Token (Semantic) | CSS Custom Property |
|---|---|---|
| `palette.primary.main` | `color.primary` | `--color-primary` |
| `palette.primary.dark` | `color.primary-hover` | `--color-primary-hover` |
| `palette.primary.contrastText` | `color.on-primary` | `--color-on-primary` |
| `palette.background.default` | `color.background` | `--color-background` |
| `palette.background.paper` | `color.surface` | `--color-surface` |
| `palette.text.primary` | `color.text` | `--color-text` |
| `palette.text.secondary` | `color.text-muted` | `--color-text-muted` |
| `palette.divider` | `color.border` | `--color-border` |
| `palette.error.main` | `color.error` | `--color-error` |
| `palette.success.main` | `color.success` | `--color-success` |
| `spacing(1)` = 8px | `spacing.2` | `--spacing-2` |
| `spacing(2)` = 16px | `spacing.4` | `--spacing-4` |
| `spacing(3)` = 24px | `spacing.6` | `--spacing-6` |
| `shape.borderRadius` = 4px | `radius.sm` | `--radius-sm` |
