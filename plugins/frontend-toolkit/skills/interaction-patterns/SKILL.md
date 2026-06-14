---
name: interaction-patterns
description: "UI interaction patterns \u2014 loading states, pagination, modals, drag-and-drop, ARIA live regions, and error recovery"
effort: low
keep-coding-instructions: true
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.css"
  - "**/components/**"
---

# Interaction Patterns

## Overview

This skill provides enforceable rules and practical React + TypeScript examples for the most common (and most commonly broken) UI interaction patterns. Every pattern includes accessibility requirements, keyboard support, and performance considerations.

**Bundled References:**
- `${CLAUDE_SKILL_DIR}/references/loading-and-feedback.md` -- Skeleton screens, optimistic UI, toast notifications, error recovery
- `${CLAUDE_SKILL_DIR}/references/navigation-and-disclosure.md` -- Modals, drawers, progressive disclosure, pagination, drag-and-drop
- `${CLAUDE_SKILL_DIR}/references/cognitive-load-and-ethics.md` -- Cognitive load laws with code examples, dark pattern detection checklist

---

## Quick Reference

| Pattern | When to Use | Key Accessibility | Reference |
|---|---|---|---|
| Skeleton screens | Data fetching >200ms | `aria-busy="true"` on container | loading-and-feedback |
| Optimistic UI | Write operations with <5% failure rate | Sync indicator + rollback announcement | loading-and-feedback |
| Toast notifications | Non-blocking feedback | `role="status"`, `aria-live="polite"` | loading-and-feedback |
| Error recovery | Network failures, render errors | Focus management on retry controls | loading-and-feedback |
| Modals | Destructive confirmations, focused tasks | Focus trap, Escape to close, scroll lock | navigation-and-disclosure |
| Drawers | Secondary content, filters, navigation | Same as modal; swipe-to-dismiss on mobile | navigation-and-disclosure |
| Inline expansion | Low-interruption detail reveal | `aria-expanded`, `aria-controls` | navigation-and-disclosure |
| Progressive disclosure | Complex forms, onboarding wizards | Step announcements, back navigation | navigation-and-disclosure |
| Pagination | Known dataset size, SEO needs | Keyboard-navigable page links | navigation-and-disclosure |
| Infinite scroll | Social feeds, image galleries | "Load more" fallback, `aria-live` region | navigation-and-disclosure |
| Drag and drop | Reordering lists, kanban boards | Mandatory keyboard alternative | navigation-and-disclosure |
| Dark pattern detection | UX review, compliance audit | DSA Art. 25 checklist | cognitive-load-and-ethics |
| Cognitive load | Any UI design decision | Measurable thresholds | cognitive-load-and-ethics |

## Decision Framework

### Loading: Skeleton vs Spinner vs Optimistic

```
Is the response time <200ms?
  YES --> No loading indicator needed
  NO  --> Is this a write operation with low failure rate?
    YES --> Optimistic UI (instant feedback, rollback on failure)
    NO  --> Skeleton screen matching the layout shape
            Never use a centered spinner for content areas
```

### Container: Modal vs Drawer vs Inline

```
Does the action require leaving current context?
  YES --> Is it a focused, short task (confirm/edit)?
    YES --> Modal (focus-trapped dialog)
    NO  --> Full page navigation
  NO  --> Is the content supplementary (filters, details)?
    YES --> Drawer (side panel, swipe-dismissible on mobile)
    NO  --> Inline expansion (accordion, collapsible section)
```

### List: Pagination vs Infinite Scroll

```
Does the user need to reach a specific item?
  YES --> Pagination with URL-defined pages
  NO  --> Does the user browse casually (feeds, galleries)?
    YES --> Infinite scroll with "Load more" keyboard fallback
    NO  --> Pagination (default safe choice)
```

## Enforceable Rules

These rules can be checked in code review or automated linting:

1. **No spinner-only loading states** -- Every loading state must use skeleton screens or shimmer placeholders that match the layout shape of the content being loaded.
2. **Every `role="dialog"` must trap focus** -- Tab order must cycle within the dialog. Escape must close it. Focus must return to the trigger on close.
3. **Every drag-and-drop must have a keyboard alternative** -- If an element is draggable, it must also be operable via arrow keys or a move menu.
4. **Toast notifications must use `aria-live`** -- All non-modal notifications must be announced to screen readers via `role="status"` or `aria-live="polite"`.
5. **No confirmshaming** -- Decline options must use neutral language, not guilt-inducing phrases.
6. **Interactive choices must respect Hick's Law** -- No more than 7 (plus/minus 2) options at a single decision point without grouping or search.
7. **System response must meet Doherty threshold** -- All user-initiated actions must provide visual feedback within 400ms.

## Getting Started

1. **Implementing loading states or error handling** -- Read `${CLAUDE_SKILL_DIR}/references/loading-and-feedback.md`
2. **Building modals, drawers, accordions, or lists** -- Read `${CLAUDE_SKILL_DIR}/references/navigation-and-disclosure.md`
3. **Reviewing UX quality or auditing for dark patterns** -- Read `${CLAUDE_SKILL_DIR}/references/cognitive-load-and-ethics.md`
