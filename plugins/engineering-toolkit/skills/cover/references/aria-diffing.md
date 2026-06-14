# ARIA Snapshot Diffing for E2E Tests

## Table of Contents
- [Overview](#overview)
- [Phase 3b: Baseline Capture](#phase-3b-baseline-capture)
- [Phase 4b: Diff and Classify](#phase-4b-diff-and-classify)
- [Severity Classification](#severity-classification)
- [Common ARIA Regressions](#common-aria-regressions)
- [Diff Output Format](#diff-output-format)
- [Integration with Phase 6 Report](#integration-with-phase-6-report)
- [When to Use ARIA Diffing](#when-to-use-aria-diffing)
- [Decision Tree: Regression vs Intentional Change](#decision-tree-regression-vs-intentional-change)
- [Baseline Storage](#baseline-storage)

## Overview

ARIA snapshot diffing captures the accessibility tree of a page before and after changes, then compares the two to detect semantic regressions. Unlike visual regression (pixel comparison) or DOM diffing (markup comparison), ARIA diffing catches changes that affect how assistive technologies perceive a page: lost roles, missing labels, broken landmarks, and degraded heading structure.

This matters because:
- A CSS refactor can silently remove a `button` role (swapping `<button>` for a styled `<div>`)
- A component library update can drop `aria-label` attributes
- A design system migration can flatten heading hierarchy
- None of these break visual tests or unit tests, but all break accessibility

ARIA diffing is active when `--tier=e2e` is specified and `--no-aria` is **not** set.

## Phase 3b: Baseline Capture

After test generation (Phase 3), capture the ARIA tree for each E2E test's target page. This runs automatically as a sub-phase of test generation.

### Capture Workflow

```bash
# 1. Navigate to the page under test
agent-browser navigate http://localhost:3000/checkout

# 2. Wait for the page to stabilize
agent-browser wait --load networkidle

# 3. Capture the full ARIA snapshot
agent-browser snapshot
```

The snapshot output is parsed into a structured baseline and stored in `.cover/aria-baselines/`.

### Baseline Format

Each baseline is a JSON file containing a tree of ARIA nodes:

```json
{
  "url": "http://localhost:3000/checkout",
  "timestamp": "2026-03-27T14:30:00Z",
  "testFile": "tests/e2e/checkout.spec.ts",
  "tree": {
    "role": "WebArea",
    "name": "Checkout - MyApp",
    "children": [
      {
        "role": "banner",
        "name": "",
        "children": [
          {
            "role": "navigation",
            "name": "Main",
            "children": [
              { "role": "link", "name": "Home" },
              { "role": "link", "name": "Products" },
              { "role": "link", "name": "Cart (3)" }
            ]
          }
        ]
      },
      {
        "role": "main",
        "name": "",
        "children": [
          {
            "role": "heading",
            "name": "Checkout",
            "level": 1
          },
          {
            "role": "form",
            "name": "Shipping Information",
            "children": [
              { "role": "textbox", "name": "Full Name", "required": true },
              { "role": "textbox", "name": "Email", "required": true },
              { "role": "textbox", "name": "Address", "required": true },
              { "role": "combobox", "name": "Country", "expanded": false }
            ]
          },
          {
            "role": "heading",
            "name": "Payment",
            "level": 2
          },
          {
            "role": "radiogroup",
            "name": "Payment Method",
            "children": [
              { "role": "radio", "name": "Credit Card", "checked": true },
              { "role": "radio", "name": "PayPal", "checked": false }
            ]
          },
          {
            "role": "button",
            "name": "Place Order"
          }
        ]
      },
      {
        "role": "contentinfo",
        "name": "",
        "children": [
          { "role": "link", "name": "Privacy Policy" },
          { "role": "link", "name": "Terms of Service" }
        ]
      }
    ]
  }
}
```

### Node Properties

| Property | Type | Description |
|----------|------|-------------|
| `role` | string | ARIA role (e.g., `button`, `heading`, `navigation`, `textbox`) |
| `name` | string | Accessible name (from label, aria-label, or text content) |
| `level` | number | Heading level (1-6), only present for `heading` role |
| `required` | boolean | Whether the field is required, only for form inputs |
| `checked` | boolean | Check state for radio/checkbox |
| `expanded` | boolean | Expanded state for combobox/disclosure |
| `children` | array | Child nodes in the accessibility tree |

## Phase 4b: Diff and Classify

After test execution (Phase 4), re-capture the ARIA tree for the same page and diff it against the stored baseline.

### Diff Workflow

```bash
# 1. Navigate to the same page
agent-browser navigate http://localhost:3000/checkout
agent-browser wait --load networkidle

# 2. Capture current ARIA snapshot
agent-browser snapshot

# 3. Compare against baseline in .cover/aria-baselines/checkout.spec.json
# Diff is performed node-by-node, matching by role + name path
```

### Matching Strategy

Nodes are matched by their **path in the tree** (role + name combination). This allows detection of:
- Nodes that exist in baseline but are missing in current (removed)
- Nodes that exist in current but not in baseline (added)
- Nodes at the same path whose properties changed (modified)

## Severity Classification

Each diff entry is classified into one of three severity levels.

### CRITICAL

Changes that break assistive technology access. These are almost always regressions.

| Pattern | Example |
|---------|---------|
| Role removed or downgraded | `button` becomes `generic` (div) |
| Landmark deleted | `navigation`, `main`, `banner`, or `contentinfo` removed |
| Form input loses label | `textbox` name changes from `"Email"` to `""` |
| Form input loses role | `textbox` becomes `generic` |
| Heading loses role | `heading` becomes `generic` |
| Image loses accessible name | `img` name changes from `"Product photo"` to `""` |

### WARNING

Changes that may degrade the experience. Require manual review.

| Pattern | Example |
|---------|---------|
| Accessible name changed | Button `"Submit Order"` becomes `"Submit"` |
| Heading level changed | `heading` level 2 becomes level 4 |
| Required state removed | `textbox` loses `required: true` |
| Radio/checkbox state changed | `radio` `checked` state differs from baseline |
| Link text changed significantly | `"View Details"` becomes `"Click Here"` |

### INFO

Changes that are typically intentional. Logged but not flagged.

| Pattern | Example |
|---------|---------|
| New element added | New `button` appears in the tree |
| `aria-expanded` toggled | `combobox` expanded state changed |
| List item count changed | Navigation has 4 links instead of 3 |
| Text content updated | Heading text `"Cart (3)"` becomes `"Cart (4)"` |

## Common ARIA Regressions

### Button Losing Button Role

A styled `<button>` is replaced with a `<div onClick={...}>` during refactoring.

**Before:**
```json
{
  "role": "button",
  "name": "Place Order"
}
```

**After:**
```json
{
  "role": "generic",
  "name": "Place Order"
}
```

**Severity:** CRITICAL -- Screen readers will not announce this as an interactive element. Keyboard users cannot activate it with Enter/Space.

### Heading Losing Level

A `<h2>` is replaced with a styled `<div className="section-title">`.

**Before:**
```json
{
  "role": "heading",
  "name": "Payment",
  "level": 2
}
```

**After:**
```json
{
  "role": "generic",
  "name": "Payment"
}
```

**Severity:** CRITICAL -- Heading navigation is broken. Screen reader users cannot jump to this section.

### Input Losing Associated Label

A form refactor breaks the `<label htmlFor>` association.

**Before:**
```json
{
  "role": "textbox",
  "name": "Email",
  "required": true
}
```

**After:**
```json
{
  "role": "textbox",
  "name": "",
  "required": true
}
```

**Severity:** CRITICAL -- Screen readers announce this as an unlabeled text field. Users cannot determine what to enter.

### Navigation Landmark Removed

A nav element is swapped for a plain `<div>` during a layout refactor.

**Before:**
```json
{
  "role": "navigation",
  "name": "Main",
  "children": [
    { "role": "link", "name": "Home" },
    { "role": "link", "name": "Products" },
    { "role": "link", "name": "Cart (3)" }
  ]
}
```

**After:**
```json
{
  "role": "generic",
  "name": "",
  "children": [
    { "role": "link", "name": "Home" },
    { "role": "link", "name": "Products" },
    { "role": "link", "name": "Cart (3)" }
  ]
}
```

**Severity:** CRITICAL -- Landmark navigation is broken. Screen reader users cannot jump directly to the navigation region.

### Image Losing Alt Text

An `alt` attribute is removed during a component library migration.

**Before:**
```json
{
  "role": "img",
  "name": "Product photo: Running shoes"
}
```

**After:**
```json
{
  "role": "img",
  "name": ""
}
```

**Severity:** CRITICAL -- Screen readers either skip the image entirely or announce the file name, providing no meaningful information.

### Heading Level Skipped

A design update changes heading hierarchy so levels are skipped.

**Before:**
```json
[
  { "role": "heading", "name": "Checkout", "level": 1 },
  { "role": "heading", "name": "Shipping", "level": 2 },
  { "role": "heading", "name": "Payment", "level": 2 }
]
```

**After:**
```json
[
  { "role": "heading", "name": "Checkout", "level": 1 },
  { "role": "heading", "name": "Shipping", "level": 4 },
  { "role": "heading", "name": "Payment", "level": 4 }
]
```

**Severity:** WARNING -- Heading navigation still works, but the skipped levels (2, 3) create a confusing document outline.

## Diff Output Format

The diff output is structured JSON for machine consumption and report integration.

```json
{
  "url": "http://localhost:3000/checkout",
  "baselineTimestamp": "2026-03-27T14:30:00Z",
  "currentTimestamp": "2026-03-27T15:45:00Z",
  "testFile": "tests/e2e/checkout.spec.ts",
  "summary": {
    "critical": 1,
    "warning": 2,
    "info": 3,
    "unchanged": 14
  },
  "changes": [
    {
      "severity": "CRITICAL",
      "type": "role_removed",
      "path": "main > form[Shipping Information] > textbox[Email]",
      "description": "Form input lost its accessible label",
      "before": { "role": "textbox", "name": "Email", "required": true },
      "after": { "role": "textbox", "name": "", "required": true }
    },
    {
      "severity": "WARNING",
      "type": "name_changed",
      "path": "main > button[Place Order]",
      "description": "Button accessible name changed",
      "before": { "role": "button", "name": "Place Order" },
      "after": { "role": "button", "name": "Submit" }
    },
    {
      "severity": "WARNING",
      "type": "level_changed",
      "path": "main > heading[Payment]",
      "description": "Heading level changed from 2 to 4",
      "before": { "role": "heading", "name": "Payment", "level": 2 },
      "after": { "role": "heading", "name": "Payment", "level": 4 }
    },
    {
      "severity": "INFO",
      "type": "element_added",
      "path": "main > form[Shipping Information] > textbox[Phone]",
      "description": "New form input added",
      "before": null,
      "after": { "role": "textbox", "name": "Phone", "required": false }
    }
  ]
}
```

### Field Reference

| Field | Description |
|-------|-------------|
| `severity` | `CRITICAL`, `WARNING`, or `INFO` |
| `type` | Machine-readable change type: `role_removed`, `role_downgraded`, `landmark_deleted`, `label_lost`, `name_changed`, `level_changed`, `state_changed`, `element_added`, `element_removed` |
| `path` | Tree path using `role[name]` notation, delimited by ` > ` |
| `description` | Human-readable summary of the change |
| `before` | Node properties from baseline (`null` if added) |
| `after` | Node properties from current (`null` if removed) |

## Integration with Phase 6 Report

When ARIA diffing is active, the Phase 6 coverage report includes an ARIA section. Insert this after the "Tests Generated" table.

```
### ARIA Accessibility Diff

| Severity | Count | Details |
|----------|-------|---------|
| CRITICAL | 1 | textbox[Email] lost accessible label |
| WARNING | 2 | button name changed, heading level changed |
| INFO | 3 | New elements added |

**Baseline:** `.cover/aria-baselines/checkout.spec.json` (captured 2026-03-27T14:30:00Z)

#### Critical Changes
- **textbox[Email]**: Lost accessible label (`"Email"` -> `""`) at path `main > form[Shipping Information] > textbox[Email]`

#### Warnings
- **button[Place Order]**: Name changed to `"Submit"` at path `main > button[Place Order]`
- **heading[Payment]**: Level changed from 2 to 4 at path `main > heading[Payment]`
```

If no ARIA changes are detected, report:

```
### ARIA Accessibility Diff

No accessibility regressions detected. ARIA tree matches baseline.
```

If `--no-aria` was set, omit the section entirely.

## When to Use ARIA Diffing

ARIA diffing is most valuable in these scenarios:

| Scenario | Why ARIA Diffing Helps |
|----------|----------------------|
| UI refactoring | Changing markup structure can silently drop roles and labels |
| CSS-only changes | Switching from semantic to non-semantic elements for styling |
| Component library updates | New versions may alter the rendered accessibility tree |
| Design system migration | Moving between systems (e.g., Material UI to shadcn) can change roles |
| Heading restructuring | Layout changes can break heading hierarchy |
| Form redesign | New form layouts can break label associations |
| Third-party widget updates | Upgraded widgets may have different ARIA implementations |

ARIA diffing is **less useful** for:
- Pure logic changes with no UI impact
- API-only endpoints
- Tests that do not render a page (unit, integration)

## Decision Tree: Regression vs Intentional Change

When a diff is detected, use this decision tree to determine whether it is a regression or an intentional change:

```
ARIA change detected
|
+-- Is the severity CRITICAL?
|   |
|   +-- YES: Was a semantic element replaced with a non-semantic one?
|   |   |
|   |   +-- YES --> REGRESSION. Restore the semantic element.
|   |   +-- NO  --> Was the removal intentional (feature deleted)?
|   |       |
|   |       +-- YES --> Update baseline: delete old entry.
|   |       +-- NO  --> REGRESSION. Investigate the change.
|   |
|   +-- NO (WARNING/INFO): Continue below.
|
+-- Is the severity WARNING?
|   |
|   +-- Was the name change intentional (e.g., copy update)?
|   |   |
|   |   +-- YES --> Update baseline with new name.
|   |   +-- NO  --> REGRESSION. Label was likely dropped accidentally.
|   |
|   +-- Was the heading level change part of a design update?
|       |
|       +-- YES --> Update baseline. Verify no levels are skipped.
|       +-- NO  --> REGRESSION. Restore correct heading level.
|
+-- Is the severity INFO?
    |
    +-- New element added --> Typically fine. Update baseline.
    +-- State toggle (expanded, checked) --> Typically fine. Ignore.
    +-- Item count changed --> Verify data-driven. Update baseline if correct.
```

**Rule of thumb:** If you cannot explain why the ARIA tree changed, treat it as a regression.

## Baseline Storage

Baselines are stored in `.cover/aria-baselines/` at the project root.

```
.cover/
  aria-baselines/
    checkout.spec.json
    login.spec.json
    dashboard.spec.json
```

### File naming

Baseline files are named after the test file they correspond to, with `.json` extension:
- `tests/e2e/checkout.spec.ts` produces `.cover/aria-baselines/checkout.spec.json`
- `tests/e2e/auth/login.spec.ts` produces `.cover/aria-baselines/auth--login.spec.json` (directory separators become `--`)

### Gitignore

Add `.cover/aria-baselines/` to `.gitignore`. Baselines are environment-specific (different browsers, OS, and app state produce different trees) and should be regenerated locally:

```gitignore
# ARIA snapshot baselines (generated by /cover)
.cover/aria-baselines/
```

### Updating Baselines

To regenerate baselines after intentional changes:

```bash
# Re-run /cover to regenerate baselines
/cover --tier=e2e checkout-flow

# Or delete baselines to force fresh capture
rm -rf .cover/aria-baselines/
```

Baselines are automatically overwritten when `/cover` runs with `--tier=e2e` unless `--no-aria` is set.
