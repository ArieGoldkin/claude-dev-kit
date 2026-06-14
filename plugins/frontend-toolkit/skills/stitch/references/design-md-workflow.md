# DESIGN.md Workflow

Complete workflow for using DESIGN.md as the bridge between Stitch AI designs and
production code. Inspired by the Google Stitch 2.0 + Claude Code pattern.

## Table of Contents

- [Overview](#overview)
- [Step 1: Generate Design in Stitch](#step-1-generate-design-in-stitch)
- [Step 2: Export to DESIGN.md](#step-2-export-to-designmd)
- [Step 3: Configure CLAUDE.md](#step-3-configure-claudemd)
- [Step 4: Generate Tailwind Config](#step-4-generate-tailwind-config)
- [Step 5: Generate Components](#step-5-generate-components)
- [Step 6: Audit Consistency](#step-6-audit-consistency)
- [DESIGN.md Template](#designmd-template)
- [Tailwind Config Generation](#tailwind-config-generation)
- [MCP Integration Notes](#mcp-integration-notes)

## Overview

The core idea: instead of giving AI a screenshot or Figma frame, give it a **structured
text document** (DESIGN.md) that fits in a context window. Text-based specs are more
reliable than visual interpretation for maintaining design consistency.

```
Stitch AI → DESIGN.md → CLAUDE.md rules → Tailwind config → Components
   (design)    (spec)      (enforcement)    (constraint)     (output)
```

**Two-layer enforcement:**
1. **CLAUDE.md rules** — natural language instructions telling Claude to use DESIGN.md
2. **tailwind.config.js** — physically constrains available CSS values to design tokens

Together they ensure consistent output even with imprecise prompts.

## Step 1: Generate Design in Stitch

Use the standard `/stitch` workflow:

```
stitch_create_project("My App")
stitch_generate(project_id, "Modern SaaS dashboard with sidebar nav, metrics cards, and data table", "DESKTOP")
stitch_get_image(project_id, screen_id)  // Preview
```

For **vibe design** requests, translate emotions into visual attributes:
- "calm professional" → "muted blue-gray palette, generous whitespace, sans-serif, subtle shadows"
- "bold startup energy" → "vibrant gradients, large type, asymmetric layouts, dark background"
- "clean minimal" → "white background, single accent color, tight spacing, system font"

Iterate with `stitch_edit` or explore with `stitch_generate_variants` until satisfied.

## Step 2: Export to DESIGN.md

After design approval:

```
stitch_extract_design(project_id, screen_id)  // Returns design tokens
stitch_get_html(project_id, screen_id)         // Returns full HTML/CSS
```

Combine the extracted tokens into `DESIGN.md` at the project root. Parse the HTML
for any values the extract_design tool didn't capture (fonts from link tags, specific
animations, gradient definitions).

### What to Include

| Section | What to capture | Source |
|---------|----------------|--------|
| Colors | All hex values with semantic names | `stitch_extract_design` |
| Typography | Font families, weights, size scale | HTML link tags + extract |
| Spacing | Padding/margin values, gap sizes | HTML inspection |
| Border radius | Per component type (cards, inputs, pills) | Extract + HTML |
| Shadows | Box-shadow values | HTML inspection |
| Breakpoints | Responsive breakpoints | HTML media queries |
| Component states | Hover, active, disabled, focus | HTML :hover/:focus rules |
| Layout | Grid structure, sidebar width, header height | HTML structure |

## Step 3: Configure CLAUDE.md

Add this section to the project's `CLAUDE.md` (or `.claude/CLAUDE.md`):

```markdown
## Design System

This project uses a design system defined in DESIGN.md at the project root.

Rules:
- Always reference DESIGN.md before generating any UI component
- Use ONLY the colors, fonts, spacing, and border-radius values defined in DESIGN.md
- Never invent new design values — if something isn't in DESIGN.md, ask before adding
- Match component states (hover, active, disabled) exactly as specified
- Use the Tailwind custom classes from tailwind.config.js (generated from DESIGN.md)
```

This ensures every Claude Code session automatically follows the design system,
even across different conversations.

## Step 4: Generate Tailwind Config

Translate DESIGN.md tokens into `tailwind.config.js`:

```javascript
// tailwind.config.js — Generated from DESIGN.md
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          active: "#1E40AF",
        },
        surface: "#FFFFFF",
        background: "#FAFAFA",
        muted: "#6B7280",
        accent: "#10B981",
        destructive: "#EF4444",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        xs: "0.75rem",    // 12px
        sm: "0.875rem",   // 14px
        base: "1rem",     // 16px
        lg: "1.25rem",    // 20px
        xl: "1.5rem",     // 24px
        "2xl": "2rem",    // 32px
        "3xl": "3rem",    // 48px
      },
      spacing: {
        // Matches DESIGN.md 4px unit scale
        1: "0.25rem",     // 4px
        2: "0.5rem",      // 8px
        3: "0.75rem",     // 12px
        4: "1rem",        // 16px
        6: "1.5rem",      // 24px
        8: "2rem",        // 32px
        12: "3rem",       // 48px
        16: "4rem",       // 64px
      },
      borderRadius: {
        card: "8px",
        input: "6px",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0, 0, 0, 0.1)",
        elevated: "0 4px 6px rgba(0, 0, 0, 0.1)",
      },
    },
  },
} satisfies Config;
```

This creates a **second enforcement layer** — even if a prompt is vague, the available
Tailwind utility classes are physically constrained to the design system.

## Step 5: Generate Components

With DESIGN.md + tailwind.config.js in place, generate components:

```
Build a primary button component using the design system in DESIGN.md.
Include hover, active, disabled, and loading states.
Use the Tailwind custom classes from tailwind.config.js.
```

Claude Code will:
1. Read DESIGN.md for the button specification
2. Use custom Tailwind classes (`bg-primary`, `rounded-input`, `shadow-card`)
3. Apply states from DESIGN.md (hover darken 10%, disabled opacity 0.5)

## Step 6: Audit Consistency

Periodically check that all components follow the design system:

```
Review all files in src/components/ and identify any that use:
- Hardcoded hex colors not defined in DESIGN.md
- Arbitrary Tailwind values (bg-[#...], text-[#...], p-[...])
- Font families not in the design system
- Spacing values outside the defined scale

For each violation, suggest the correct DESIGN.md replacement.
```

**Automating audits**: This check can be integrated into the `/verify` pipeline or run
as a standalone command. Pattern: `grep -r 'bg-\[#' src/components/` catches arbitrary
color values; `grep -r 'text-\[#' src/components/` catches arbitrary text colors.

## DESIGN.md Template

```markdown
# Design System
> Generated from Google Stitch AI on YYYY-MM-DD
> Source: [project_name] / [screen_name]

## Colors

### Primary Palette
| Token | Hex | Usage |
|-------|-----|-------|
| primary | #2563EB | Buttons, links, active indicators |
| primary-hover | #1D4ED8 | Button hover state |
| primary-active | #1E40AF | Button pressed state |

### Neutral Palette
| Token | Hex | Usage |
|-------|-----|-------|
| background | #FAFAFA | Page background |
| surface | #FFFFFF | Cards, panels, modals |
| border | #E5E7EB | Dividers, input borders |
| text | #1A1A2E | Body text |
| text-muted | #6B7280 | Secondary text, labels |

### Semantic Colors
| Token | Hex | Usage |
|-------|-----|-------|
| success | #10B981 | Positive actions, status |
| warning | #F59E0B | Caution, pending status |
| destructive | #EF4444 | Delete, error states |

## Typography

| Element | Font | Weight | Size | Line Height |
|---------|------|--------|------|-------------|
| H1 | Inter | 600 | 48px | 1.1 |
| H2 | Inter | 600 | 32px | 1.2 |
| H3 | Inter | 600 | 24px | 1.3 |
| Body | Inter | 400 | 16px | 1.5 |
| Small | Inter | 400 | 14px | 1.5 |
| Caption | Inter | 400 | 12px | 1.4 |

## Spacing

Base unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight gaps, icon padding |
| sm | 8px | Form element gaps |
| md | 16px | Card padding, section gaps |
| lg | 24px | Section padding |
| xl | 32px | Page margins |
| 2xl | 48px | Hero spacing |

## Components

### Buttons
- Border radius: 6px
- Padding: 8px 16px (sm), 12px 24px (md), 16px 32px (lg)
- Font: 14px/600 (sm), 16px/600 (md)
- States: hover (darken 10%), active (darken 15%), disabled (opacity 0.5), loading (spinner + opacity 0.7)

### Cards
- Border radius: 8px
- Shadow: 0 1px 3px rgba(0,0,0,0.1)
- Padding: 24px
- Border: 1px solid #E5E7EB (optional)

### Inputs
- Border radius: 6px
- Border: 1px solid #E5E7EB
- Padding: 8px 12px
- Focus: 2px ring primary color
- Error: border #EF4444, text #EF4444

## Layout

- Max width: 1280px (content), 1440px (full)
- Sidebar: 256px fixed
- Header: 64px fixed
- Grid: 12-column, 24px gap
- Breakpoints: sm 640px, md 768px, lg 1024px, xl 1280px
```

## MCP Integration Notes

Our Stitch MCP server (`stitch-server.js`) provides direct access to Stitch's design
data. Key tools for the DESIGN.md workflow:

- **`stitch_extract_design`** — Returns design tokens (colors, typography, spacing, layout patterns). This is the primary data source for DESIGN.md generation. The output includes structured JSON with color palettes, font stacks, and spacing scales.

- **`stitch_get_html`** — Returns the full HTML/CSS. Use this to capture values that `extract_design` misses: exact gradient definitions, animation keyframes, specific media query breakpoints, and component state styles (:hover, :focus, :active CSS rules).

- **`stitch_get_image`** — Returns a screenshot URL. Use for visual reference alongside the text-based DESIGN.md — helpful for complex layouts where spatial relationships matter more than individual values.

**Stitch 2.0 features** accessible via MCP:
- Generate multiple design variations simultaneously (use `stitch_generate_variants`)
- Vibe design: describe a feeling → get multiple directions (use enhanced prompts)
- Edit in-context: refine specific elements without regenerating (use `stitch_edit`)

The MCP server makes the design system a **live, queryable resource** rather than a
static snapshot. For ongoing projects, prefer querying via MCP over relying solely
on the DESIGN.md file — the Stitch project remains the source of truth.
