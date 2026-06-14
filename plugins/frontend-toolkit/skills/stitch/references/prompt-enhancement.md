# Prompt Enhancement Patterns for Stitch AI

## Table of Contents

- [Vague-to-Specific Translation](#vague-to-specific-translation)
- [Mood/Emotion Translation](#moodemotion-translation)
- [Color Formatting](#color-formatting)
- [Structural Hints](#structural-hints)
- [Multi-Page Consistency](#multi-page-consistency)

---

## Vague-to-Specific Translation

Transform underspecified prompts into rich visual descriptions before sending to Stitch.

| Vague Prompt | Enhanced Prompt |
|---|---|
| "a login page" | "A login page with centered card layout, email and password fields, 'Sign In' primary button, 'Forgot password?' link, social login options (Google, Apple), subtle gradient background" |
| "dashboard" | "Analytics dashboard with sidebar navigation, header with search and notifications, main area with 4 KPI metric cards in a grid, line chart for trends, recent activity table" |
| "mobile app" | "Mobile app home screen with bottom tab navigation (Home, Search, Profile), hero card with gradient, scrollable content cards, floating action button" |

**Key principle**: Every noun becomes a component, every adjective becomes a style token. If the user says "a settings page," expand it to include specific form controls, section groupings, toggle switches, save/cancel actions, and navigation context.

---

## Mood/Emotion Translation

Convert emotional or aesthetic descriptors into concrete visual attributes.

| Mood | Visual Attributes |
|---|---|
| **Professional** | Clean sans-serif typography, muted color palette, ample whitespace, subtle shadows |
| **Playful** | Rounded corners, vibrant colors, emoji/illustrations, bouncy spacing |
| **Minimal** | Monochrome or 2-color palette, large typography, generous negative space |
| **Luxurious** | Dark backgrounds, gold/champagne accents, serif headings, high contrast imagery |
| **Techy** | Dark theme, monospace accents, neon/electric highlights, grid layouts |

When users describe a feeling ("make it feel warm"), translate to specifics: warm-toned palette (ambers, soft oranges), rounded shapes, friendly illustration style, comfortable spacing.

---

## Color Formatting

When specifying colors in prompts, use the pattern: **"Descriptive Name (#hex) for role"**

Examples:
- "Ocean Blue (#1E40AF) for primary actions"
- "Warm Gray (#6B7280) for secondary text"
- "Emerald (#059669) for success states"
- "Rose (#E11D48) for error and destructive actions"

This format gives Stitch both semantic meaning and exact values, producing more consistent output than hex codes alone or color names alone.

---

## Structural Hints

Always include these four dimensions in enhanced prompts:

1. **Page type** — landing, dashboard, settings, profile, checkout, onboarding, pricing, blog post, etc.
2. **Layout structure** — sidebar + main, full-width, centered card, split screen, multi-column grid, sticky header with scrollable body.
3. **Key components** — navigation bars, forms, tables, charts, cards, modals, hero sections, CTAs, footers.
4. **Device context** — desktop implies wide multi-column layout; mobile implies stacked single-column with touch-friendly targets; tablet implies adaptive grid.

Example: Instead of "a profile page," say "A desktop profile page with left sidebar showing avatar and stats, main content area with tabbed sections (Posts, Activity, Settings), and a sticky top navigation bar."

---

## Multi-Page Consistency

When generating multiple pages for the same site or app:

- **Reference DESIGN.md tokens from page 1**: Include "Use the same color palette and typography as the homepage" in subsequent prompts.
- **Specify shared elements explicitly**: "Same header/footer/navigation as previous screens."
- **Mention brand elements**: "Keep the logo placement and primary color consistent across all pages."
- **Carry forward spacing and radius values**: "Use the same 8px corner radius and 24px section spacing established on the homepage."

This prevents visual drift across pages and ensures Stitch produces a cohesive design system rather than isolated screens.
