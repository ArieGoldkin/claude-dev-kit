# Color and Contrast

## Table of Contents

- [Overview](#overview)
- [Why OKLCH](#why-oklch)
- [Building an OKLCH Palette](#building-an-oklch-palette)
- [Hex Fallbacks for Legacy Browsers](#hex-fallbacks-for-legacy-browsers)
- [WCAG Contrast Enforcement at the Token Level](#wcag-contrast-enforcement-at-the-token-level)
- [Contrast Pairing Table](#contrast-pairing-table)
- [Dark Mode Theming with data-theme](#dark-mode-theming-with-data-theme)
- [Domain-Specific Color Patterns](#domain-specific-color-patterns)
- [Automated Contrast Checking Script](#automated-contrast-checking-script)

---

## Overview

Color tokens must satisfy three requirements simultaneously:

1. **Perceptual uniformity** -- colors at the same lightness step should look equally bright
2. **Accessibility compliance** -- text and UI contrast ratios meet WCAG 2.1 AA thresholds
3. **Themeable** -- dark mode and multi-brand variants swap cleanly without per-component overrides

OKLCH addresses requirement 1, token-level contrast pairing addresses requirement 2, and the `data-theme` attribute pattern addresses requirement 3.

## Why OKLCH

OKLCH is a perceptually uniform color space with three channels:

| Channel | Meaning | Range |
|---|---|---|
| **L** (Lightness) | Perceived brightness | 0 (black) to 1 (white) |
| **C** (Chroma) | Color intensity / saturation | 0 (gray) to ~0.4 (most vivid) |
| **H** (Hue) | Color angle on the hue wheel | 0-360 degrees |

### Advantages over HSL and hex

- **Perceptual uniformity**: L=0.5 blue and L=0.5 yellow actually look the same brightness. In HSL, they do not.
- **Predictable lightness scales**: A 10-step scale from L=0.97 to L=0.12 produces even visual steps.
- **Chroma independence**: You can adjust saturation without shifting perceived brightness.
- **Dark mode math**: Inverting lightness values (L=0.55 becomes L=0.75) produces usable dark-mode pairs.

### OKLCH syntax in CSS

```css
/* Basic */
color: oklch(0.55 0.20 260);

/* With alpha */
color: oklch(0.55 0.20 260 / 0.5);

/* CSS relative color syntax for computed variants */
--color-primary-hover: oklch(from var(--color-primary) calc(l - 0.08) c h);
```

### Browser support

OKLCH is supported in all modern browsers (Chrome 111+, Firefox 113+, Safari 15.4+). For older browsers, provide hex fallbacks.

## Building an OKLCH Palette

### Step 1: Choose a hue angle

Common hue angles for product design:

| Color | Hue (H) | Typical use |
|---|---|---|
| Red | 25 | Error, destructive |
| Orange | 55 | Warning |
| Yellow | 90 | Caution, highlight |
| Green | 145 | Success, positive |
| Teal | 185 | Info, secondary |
| Blue | 260 | Primary, links |
| Purple | 300 | Accent, premium |

### Step 2: Build a 10-step lightness scale

Use consistent lightness values across all hues:

| Step | Lightness (L) | Typical use |
|---|---|---|
| 50 | 0.97 | Tinted background |
| 100 | 0.93 | Subtle background |
| 200 | 0.86 | Light accent |
| 300 | 0.77 | Border, divider |
| 400 | 0.67 | Placeholder text (check contrast) |
| 500 | 0.55 | Primary action on white |
| 600 | 0.47 | Hover state for 500 |
| 700 | 0.39 | Active/pressed state |
| 800 | 0.31 | High-contrast accent |
| 900 | 0.23 | Near-black tinted |
| 950 | 0.12 | Darkest tint |

### Step 3: Adjust chroma per step

Chroma peaks in the mid-range (steps 400-600) and tapers at extremes:

```
Step 50:  C = 0.02   (nearly gray, just a tint)
Step 100: C = 0.04
Step 200: C = 0.08
Step 300: C = 0.12
Step 400: C = 0.17
Step 500: C = 0.20   (peak vibrancy)
Step 600: C = 0.20
Step 700: C = 0.18
Step 800: C = 0.14
Step 900: C = 0.10
Step 950: C = 0.06
```

### Example: Blue palette

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
      "900": { "$value": "oklch(0.23 0.10 260)", "$type": "color" },
      "950": { "$value": "oklch(0.12 0.06 260)", "$type": "color" }
    }
  }
}
```

## Hex Fallbacks for Legacy Browsers

Use the CSS `color()` function with `@supports` or provide fallbacks inline:

### Approach 1: Fallback declaration (recommended)

```css
:root {
  /* Hex fallback first, OKLCH override second */
  --color-primary: #3b6fd4;
  --color-primary: oklch(0.55 0.20 260);
}
```

Browsers that don't understand `oklch()` ignore the second declaration and use the hex value.

### Approach 2: Style Dictionary transform

Add a transform to Style Dictionary that outputs both values:

```javascript
StyleDictionary.registerFormat({
  name: 'css/oklch-with-fallback',
  format: ({ dictionary }) => {
    const lines = dictionary.allTokens
      .filter((t) => t.$type === 'color')
      .flatMap((token) => {
        const hex = convertOklchToHex(token.$value); // use culori or colorjs.io
        return [
          `  --${token.name}: ${hex};`,
          `  --${token.name}: ${token.$value};`,
        ];
      });

    return `:root {\n${lines.join('\n')}\n}\n`;
  },
});
```

### Conversion libraries

| Library | Install | Usage |
|---|---|---|
| **culori** | `npm install culori` | `formatHex(parse('oklch(0.55 0.20 260)'))` |
| **colorjs.io** | `npm install colorjs.io` | `new Color('oklch', [0.55, 0.20, 260]).to('srgb').toString({format: 'hex'})` |

## WCAG Contrast Enforcement at the Token Level

### Required contrast ratios (WCAG 2.1 AA)

| Element | Minimum ratio | Applies to |
|---|---|---|
| Normal text (< 18px or < 14px bold) | **4.5:1** | Body copy, labels, form text |
| Large text (>= 18px or >= 14px bold) | **3:1** | Headings, large labels |
| UI components and graphical objects | **3:1** | Borders, icons, focus indicators |
| Decorative / disabled elements | No requirement | Placeholder text, disabled buttons |

### Enforcing at the token level

Instead of checking contrast in every component, define **contrast pairs** at the semantic token tier. Each foreground token declares which background token it must pass against:

```json
{
  "color": {
    "text": {
      "$value": "{color.neutral.900}",
      "$type": "color",
      "$extensions": {
        "contrast": {
          "against": ["color.surface", "color.background"],
          "minRatio": 4.5
        }
      }
    },
    "text-muted": {
      "$value": "{color.neutral.500}",
      "$type": "color",
      "$extensions": {
        "contrast": {
          "against": ["color.surface"],
          "minRatio": 4.5
        }
      }
    },
    "on-primary": {
      "$value": "{color.neutral.0}",
      "$type": "color",
      "$extensions": {
        "contrast": {
          "against": ["color.primary"],
          "minRatio": 4.5
        }
      }
    },
    "border": {
      "$value": "{color.neutral.200}",
      "$type": "color",
      "$extensions": {
        "contrast": {
          "against": ["color.surface"],
          "minRatio": 3.0
        }
      }
    }
  }
}
```

A CI script reads the `$extensions.contrast` metadata and fails the build if any pair violates its threshold.

## Contrast Pairing Table

Document every foreground-background pairing and its expected ratio:

| Foreground Token | Background Token | Required Ratio | Light Mode | Dark Mode |
|---|---|---|---|---|
| `color.text` | `color.surface` | 4.5:1 | ~15.4:1 | ~14.8:1 |
| `color.text` | `color.background` | 4.5:1 | ~14.2:1 | ~15.4:1 |
| `color.text-muted` | `color.surface` | 4.5:1 | ~5.3:1 | ~5.1:1 |
| `color.on-primary` | `color.primary` | 4.5:1 | ~7.2:1 | ~6.8:1 |
| `color.primary` | `color.surface` | 3:1 | ~4.8:1 | ~4.5:1 |
| `color.border` | `color.surface` | 3:1 | ~3.2:1 | ~3.1:1 |
| `color.error` | `color.surface` | 3:1 | ~4.1:1 | ~3.8:1 |
| `color.success` | `color.surface` | 3:1 | ~3.5:1 | ~3.3:1 |

Update this table whenever semantic tokens change. Automate the ratio calculations in CI.

## Dark Mode Theming with data-theme

### Architecture

Dark mode swaps semantic tokens only. Primitives and component tokens remain unchanged.

```
primitives.tokens.json     -- Same in light and dark
semantic.tokens.json       -- Light mode defaults
semantic-dark.tokens.json  -- Dark mode overrides
components/*.tokens.json   -- Unchanged (reference semantic tokens)
```

### Light mode (default): `:root`

```css
:root {
  --color-primary: oklch(0.55 0.20 260);
  --color-surface: oklch(1.00 0 0);
  --color-text: oklch(0.18 0.005 260);
  --color-text-muted: oklch(0.60 0.01 260);
  --color-border: oklch(0.91 0.008 260);
  --color-background: oklch(0.98 0.003 260);
}
```

### Dark mode: `[data-theme="dark"]`

```css
[data-theme="dark"] {
  --color-primary: oklch(0.67 0.17 260);
  --color-surface: oklch(0.18 0.005 260);
  --color-text: oklch(0.98 0.003 260);
  --color-text-muted: oklch(0.60 0.01 260);
  --color-border: oklch(0.31 0.008 260);
  --color-background: oklch(0.12 0.003 260);
}
```

### Why `data-theme` instead of `prefers-color-scheme`

| Approach | Pros | Cons |
|---|---|---|
| `prefers-color-scheme` media query | Zero JS, automatic | No user override, no multi-theme |
| `data-theme` attribute | User toggle, multi-theme, SSR-safe | Requires JS to set attribute |
| CSS class (`.dark`) | Works with Tailwind `dark:` | Pollutes class namespace |

**Recommendation**: Use `data-theme` as the primary mechanism. Add a `prefers-color-scheme` listener that sets `data-theme` for the "system" preference.

### Multi-theme support

The `data-theme` approach extends to brand themes:

```css
[data-theme="brand-a"] {
  --color-primary: oklch(0.55 0.22 145);  /* Green primary */
  --color-surface: oklch(0.99 0.005 145);
}

[data-theme="brand-b"] {
  --color-primary: oklch(0.55 0.20 300);  /* Purple primary */
  --color-surface: oklch(0.99 0.005 300);
}
```

## Domain-Specific Color Patterns

Different application domains have specific color conventions:

### Status and metric colors

Define a semantic token set for status indicators:

```json
{
  "color": {
    "status-positive": { "$value": "{color.green.500}", "$type": "color" },
    "status-neutral":  { "$value": "{color.blue.500}", "$type": "color" },
    "status-warning":  { "$value": "oklch(0.70 0.15 70)", "$type": "color" },
    "status-critical": { "$value": "{color.red.500}", "$type": "color" }
  }
}
```

- **Positive**: Green (H: 145) -- success, completion, improvement
- **Neutral**: Blue (H: 260) -- informational, current state
- **Warning**: Amber (H: 70) -- approaching threshold, needs attention
- **Critical**: Red (H: 25) -- errors, alerts, urgent items

### Color accessibility
- Never rely on color alone to convey information (use icons, labels, patterns)
- Test palettes with color vision deficiency simulators (protanopia, deuteranopia, tritanopia)
- OKLCH helps because lightness differences are preserved even when hue perception changes

## Automated Contrast Checking Script

Run this script in CI to validate every declared contrast pair:

```typescript
// scripts/check-contrast.ts
import { parse, wcagContrast } from 'culori';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

interface ContrastSpec {
  against: string[];
  minRatio: number;
}

interface Token {
  $value: string;
  $type?: string;
  $extensions?: {
    contrast?: ContrastSpec;
  };
}

// Recursively collect all tokens from DTCG JSON
function collectTokens(
  obj: Record<string, unknown>,
  path: string[] = []
): Map<string, Token> {
  const tokens = new Map<string, Token>();

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const currentPath = [...path, key];

    if (typeof value === 'object' && value !== null && '$value' in value) {
      tokens.set(currentPath.join('.'), value as Token);
    } else if (typeof value === 'object' && value !== null) {
      for (const [k, v] of collectTokens(
        value as Record<string, unknown>,
        currentPath
      )) {
        tokens.set(k, v);
      }
    }
  }

  return tokens;
}

// Resolve alias references like {color.blue.500}
function resolveValue(
  value: string,
  allTokens: Map<string, Token>
): string {
  const aliasMatch = value.match(/^\{(.+)\}$/);
  if (aliasMatch) {
    const referenced = allTokens.get(aliasMatch[1]);
    if (!referenced) throw new Error(`Unresolved alias: ${value}`);
    return resolveValue(referenced.$value, allTokens);
  }
  return value;
}

// Main validation
function validate(tokensDir: string): void {
  const allTokens = new Map<string, Token>();
  const files = readdirSync(tokensDir, { recursive: true })
    .filter((f) => String(f).endsWith('.tokens.json'));

  for (const file of files) {
    const content = JSON.parse(
      readFileSync(join(tokensDir, String(file)), 'utf-8')
    );
    for (const [k, v] of collectTokens(content)) {
      allTokens.set(k, v);
    }
  }

  let failures = 0;

  for (const [name, token] of allTokens) {
    const spec = token.$extensions?.contrast;
    if (!spec) continue;

    const fgValue = resolveValue(token.$value, allTokens);
    const fgColor = parse(fgValue);
    if (!fgColor) {
      console.error(`PARSE ERROR: ${name} = ${fgValue}`);
      failures++;
      continue;
    }

    for (const bgName of spec.against) {
      const bgToken = allTokens.get(bgName);
      if (!bgToken) {
        console.error(`MISSING BG: ${bgName} referenced by ${name}`);
        failures++;
        continue;
      }

      const bgValue = resolveValue(bgToken.$value, allTokens);
      const bgColor = parse(bgValue);
      if (!bgColor) {
        console.error(`PARSE ERROR: ${bgName} = ${bgValue}`);
        failures++;
        continue;
      }

      const ratio = wcagContrast(fgColor, bgColor);
      const pass = ratio >= spec.minRatio;
      const status = pass ? 'PASS' : 'FAIL';

      console.log(
        `${status}: ${name} on ${bgName} = ${ratio.toFixed(2)}:1 (min ${spec.minRatio}:1)`
      );

      if (!pass) failures++;
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} contrast violation(s) found.`);
    process.exit(1);
  } else {
    console.log('\nAll contrast checks passed.');
  }
}

validate(process.argv[2] ?? './tokens');
```

### Running in CI

```yaml
# In .gitlab-ci.yml or GitHub Actions
contrast-check:
  script:
    - npm install culori
    - npx tsx scripts/check-contrast.ts ./tokens
```

### Running locally

```bash
npx tsx scripts/check-contrast.ts ./tokens
```

Output:

```
PASS: color.text on color.surface = 15.39:1 (min 4.5:1)
PASS: color.text on color.background = 14.21:1 (min 4.5:1)
PASS: color.text-muted on color.surface = 5.31:1 (min 4.5:1)
PASS: color.on-primary on color.primary = 7.18:1 (min 4.5:1)
PASS: color.primary on color.surface = 4.82:1 (min 3:1)
PASS: color.border on color.surface = 3.24:1 (min 3:1)

All contrast checks passed.
```
