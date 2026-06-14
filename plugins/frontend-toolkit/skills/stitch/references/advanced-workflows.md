# Advanced Stitch Workflows

## Table of Contents

- [Variant Exploration Deep Dive](#variant-exploration-deep-dive)
- [Multi-Page Site Generation Deep Dive](#multi-page-site-generation-deep-dive)
- [DESIGN.md Synthesis](#designmd-synthesis)
- [External Skills Reference](#external-skills-reference)

---

## Variant Exploration Deep Dive

### Creative Range

The `creative_range` parameter controls how far variants diverge from the original:

| Range | Behavior | Use When |
|---|---|---|
| **REFINE** | Subtle changes: color shade adjustments, spacing tweaks, font weight changes. Preserves overall structure and feel. | "Almost right but needs polish" — fine-tuning a near-final design. |
| **EXPLORE** | Moderate alternatives: different layout arrangements, alternate color schemes, varied component styles. Keeps the same content and purpose. | "Show me options" — comparing viable directions. |
| **REIMAGINE** | Radical redesign: completely different visual approach while maintaining content and purpose. May change layout paradigm entirely. | "Start fresh" or "think outside the box" — breaking out of a direction that isn't working. |

### Aspect Control

The `aspects` parameter targets which visual dimension to vary:

| Aspect | What Changes |
|---|---|
| **LAYOUT** | Grid structure, component placement, section ordering, content flow |
| **COLOR_SCHEME** | Palette, gradients, backgrounds, accent colors, dark/light treatment |
| **IMAGES** | Hero images, illustrations, icons, photography style, decorative elements |
| **TEXT_FONT** | Typography choices, heading styles, body text, font pairings, weight and size |
| **TEXT_CONTENT** | Copy, labels, placeholder text, microcopy, tone of voice |

Combine aspects for broader variation (e.g., `["COLOR_SCHEME", "LAYOUT"]`) or isolate one for targeted comparison.

### Variant Presentation

When presenting variants to the user:

1. Show all variant images side by side (or sequentially with clear labels).
2. Label each variant **A**, **B**, **C**, etc.
3. Describe what distinguishes each variant in 1-2 sentences.
4. Ask the user to pick one, or describe a combination ("Layout from B with colors from A").

### Variant Count Guidance

| Creative Range | Recommended Count | Rationale |
|---|---|---|
| REFINE | 3 | Subtle differences need fewer samples to compare |
| EXPLORE | 3-4 | Enough diversity to surface a clear winner |
| REIMAGINE | 4-5 | More divergent options increase the chance of a breakthrough direction |

---

## Multi-Page Site Generation Deep Dive

### Planning Phase

Before generating the first screen:

1. **Decompose the site into pages** — list every page (Homepage, Features, Pricing, Contact, etc.).
2. **Identify shared elements** — navigation bar, footer, sidebar, brand logo placement.
3. **Define page hierarchy** — which page sets the design DNA (usually the homepage or landing page).

### Design DNA Extraction

After generating and approving page 1:

1. Use `stitch_extract_design` to pull design tokens from the approved screen.
2. Capture the color palette, typography scale, spacing system, and component patterns.
3. Embed these tokens in all subsequent page prompts for visual consistency.

### Sequential Generation with Approval

Generate each page one at a time. Show the preview, get explicit user approval, then proceed to the next page. This prevents wasted generation if the design direction needs adjustment.

### Shared Layout Enforcement

In every prompt after page 1, include explicit references to shared elements:
- "Same navigation bar, footer, and sidebar as the homepage"
- "Use the color palette and typography from DESIGN.md"
- "Maintain the same 8px border-radius and card shadow style"

### Example Flow: 4-Page Marketing Site

```
Page 1 (Homepage):  Generate → extract design DNA → user approves
Page 2 (Features):  Generate with DNA reference → user approves
Page 3 (Pricing):   Generate with DNA reference → user approves
Page 4 (Contact):   Generate with DNA reference → user approves
Export all 4 → prototype-to-production with shared layout
```

Each page prompt after the first should begin with: "Following the design system established on the homepage (colors, typography, spacing, navigation)..."

---

## DESIGN.md Synthesis

After extracting design tokens from a screen, synthesize a DESIGN.md document that captures the full design language.

**Include in DESIGN.md:**

- **Color palette** — descriptive names with hex values: "Ocean Blue (#1E40AF) — primary actions and links"
- **Typography scale** — heading levels, body text, captions with font family, size, weight
- **Spacing system** — section padding, card gaps, component margins
- **Component inventory** — buttons, cards, inputs, navigation items with their style tokens

**Style principle**: Use natural language alongside raw values. Write "Subtly rounded corners (8px)" not just `border-radius: 8px`. This makes the DESIGN.md useful both as a human reference and as context for prompt enhancement on subsequent pages.

The DESIGN.md feeds back into the prompt enhancement loop: when generating page 2+, reference specific tokens from this document to maintain cross-page consistency.

---

## External Skills Reference

For workflows beyond the core Stitch generate/edit/variant loop:

| Skill | Install Command | Purpose |
|---|---|---|
| **stitch-loop** | `npx skills add google-labs-code/stitch-skills --skill stitch-loop --global` | Autonomous multi-page generation without per-page user approval. Useful for rapid prototyping when the design DNA is already established. |
| **remotion** | `npx skills add google-labs-code/stitch-skills --skill remotion --global` | Generate video walkthroughs of designs. Creates animated presentations showing page transitions and interactions. |
