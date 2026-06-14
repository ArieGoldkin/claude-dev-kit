# ARIA Snapshot Diffing

Compare accessibility trees before and after code changes to catch regressions in semantic structure, roles, labels, and landmark hierarchy.

## Table of Contents

- [Overview](#overview)
- [Capturing ARIA Snapshots](#capturing-aria-snapshots)
  - [Full ARIA Snapshot](#full-aria-snapshot)
  - [Output Format](#output-format)
  - [Filtering by Subtree](#filtering-by-subtree)
  - [Filtering by Role](#filtering-by-role)
  - [Full DOM Snapshot vs ARIA Snapshot](#full-dom-snapshot-vs-aria-snapshot)
- [Performing ARIA Diffs](#performing-aria-diffs)
  - [Comparing Two Snapshots](#comparing-two-snapshots)
  - [Diff Categories](#diff-categories)
  - [Severity Classification](#severity-classification)
- [Example Scenarios](#example-scenarios)
  - [Button Losing Its Role](#button-losing-its-role)
  - [Heading Level Change](#heading-level-change)
  - [Form Input Losing Label Association](#form-input-losing-label-association)
- [When to Use ARIA Diffing](#when-to-use-aria-diffing)
- [Interpreting Diff Output](#interpreting-diff-output)
  - [Annotated Example Diff](#annotated-example-diff)
  - [Decision Tree: Regression vs Intentional Change](#decision-tree-regression-vs-intentional-change)
- [Integration with /cover](#integration-with-cover)

## Overview

ARIA snapshots capture the accessibility tree of a page — the semantic structure that assistive technologies and browser APIs expose. Unlike DOM snapshots (which reflect HTML tags and attributes), ARIA snapshots reflect the **computed accessibility** of the page: roles, names, states, and relationships.

Diffing two ARIA snapshots reveals changes that would be invisible in visual screenshots or DOM comparisons but critical for users who depend on assistive technology.

```
Code change → Build → ARIA snapshot (before vs after) → Diff → Classify regressions
```

## Capturing ARIA Snapshots

### Full ARIA Snapshot

Use `agent-browser snapshot` with the `-s` (structure) flag to capture the accessibility tree:

```bash
# Navigate to the page under test
agent-browser navigate http://localhost:3000/dashboard

# Capture the full ARIA snapshot and save to file
agent-browser snapshot -s > /tmp/aria-before.txt

# Make code changes, rebuild, then capture again
agent-browser reload
agent-browser snapshot -s > /tmp/aria-after.txt
```

### Output Format

The ARIA snapshot renders the accessibility tree as an indented structure with role, name, level, and state:

```
[document] "Dashboard - MyApp"
  [banner]
    [navigation] "Main"
      [list]
        [listitem]
          [link] "Home"
        [listitem]
          [link] "Settings"
    [button] "Sign Out"
  [main]
    [heading level=1] "Dashboard"
    [region] "Account Summary"
      [heading level=2] "Account Summary"
      [paragraph] "Welcome back, Jane."
      [table] "Recent Activity"
        [rowgroup]
          [row]
            [columnheader] "Date"
            [columnheader] "Action"
        [rowgroup]
          [row]
            [cell] "2026-03-25"
            [cell] "Logged in"
  [contentinfo]
    [link] "Privacy Policy"
    [link] "Terms of Service"
```

Each line contains:
- **Role** in brackets: `[button]`, `[heading]`, `[link]`, `[navigation]`
- **Name** in quotes (the accessible name): `"Sign Out"`, `"Main"`
- **Level** where applicable: `level=1`, `level=2`
- **State** where applicable: `checked`, `expanded`, `disabled`, `selected`

### Filtering by Subtree

Snapshot a specific component by passing its ref:

```bash
# First, get refs
agent-browser snapshot -i
# Output includes: @e7 [main] ...

# Snapshot only the main content region
agent-browser snapshot -s @e7
```

Output (subtree only):

```
[main]
  [heading level=1] "Dashboard"
  [region] "Account Summary"
    [heading level=2] "Account Summary"
    [paragraph] "Welcome back, Jane."
```

This is useful for diffing a single component in isolation without noise from the rest of the page.

### Filtering by Role

Use `find role` to locate elements of a specific role, then snapshot their subtrees:

```bash
# Find all headings
agent-browser find role "heading"

# Find all form elements
agent-browser find role "textbox"

# Find all landmarks
agent-browser find role "navigation"
```

### Full DOM Snapshot vs ARIA Snapshot

| Aspect | DOM Snapshot (`snapshot -d`) | ARIA Snapshot (`snapshot -s`) |
|--------|----------------------------|------------------------------|
| Shows | HTML tags, attributes, classes | Computed roles, names, states |
| Detects | Tag changes, attribute changes | Accessibility regressions |
| Misses | Implicit role changes | Presentational markup changes |
| Use for | Debugging layout/structure | Verifying accessibility |
| Size | Larger (full attribute dump) | Compact (semantic tree only) |

**Key difference**: A `<div>` with `role="button"` and a `<button>` look identical in the ARIA snapshot — both show `[button]`. If a refactor replaces the `<button>` with a `<div>` and forgets the role attribute, only the ARIA snapshot reveals the regression.

## Performing ARIA Diffs

### Comparing Two Snapshots

Use `diff snapshot` to compare two saved snapshots:

```bash
# Capture before
agent-browser navigate http://localhost:3000/form
agent-browser snapshot -s > /tmp/form-before.txt

# Apply changes, rebuild
agent-browser reload

# Capture after
agent-browser snapshot -s > /tmp/form-after.txt

# Diff the two
agent-browser diff snapshot /tmp/form-before.txt /tmp/form-after.txt
```

### Diff Categories

The diff output classifies changes into three categories:

| Category | Meaning | Example |
|----------|---------|---------|
| **Removed** | Node present in before, absent in after | A `[button]` that no longer appears |
| **Added** | Node absent in before, present in after | A new `[alert]` region |
| **Changed** | Node exists in both but properties differ | `[heading level=2]` became `[heading level=3]` |

### Severity Classification

Not all ARIA changes are equal. Classify by impact on assistive technology users:

| Severity | Condition | Impact |
|----------|-----------|--------|
| **Critical** | Role removed or changed to generic | Element becomes invisible or meaningless to screen readers |
| **Critical** | Landmark deleted (`banner`, `navigation`, `main`, `contentinfo`) | Page structure lost for landmark navigation |
| **Critical** | Label association broken (named element becomes unnamed) | Input or control has no programmatic label |
| **Warning** | Accessible name changed | Users may not find the element by its expected name |
| **Warning** | Heading level changed | Document outline altered, skip-navigation affected |
| **Warning** | State attribute removed (`checked`, `expanded`, `disabled`) | Control state no longer announced |
| **Info** | New element added | Typically not a regression (verify it is intentional) |
| **Info** | Order of siblings changed | May affect reading order but often intentional |

## Example Scenarios

### Button Losing Its Role

A refactor replaces `<button>` with a styled `<div>` but forgets to add `role="button"` and keyboard handling.

**Before** (`/tmp/toolbar-before.txt`):

```
[toolbar] "Formatting"
  [button] "Bold"
  [button] "Italic"
  [button] "Underline"
  [separator]
  [button] "Insert Link"
```

**After** (`/tmp/toolbar-after.txt`):

```
[toolbar] "Formatting"
  [generic] "Bold"
  [button] "Italic"
  [button] "Underline"
  [separator]
  [button] "Insert Link"
```

**Diff output**:

```
Changed: [button] "Bold" → [generic] "Bold"
  Severity: CRITICAL
  Detail: Role changed from 'button' to 'generic'
  Impact: Element no longer operable via keyboard or announced as interactive
```

**Why this matters**: The "Bold" control is now a plain `<div>`. Screen readers will not announce it as interactive. Keyboard users cannot Tab to it or activate it with Enter/Space.

### Heading Level Change

A CSS-driven refactor changes the visual size of headings but inadvertently removes the semantic heading element.

**Before** (`/tmp/article-before.txt`):

```
[main]
  [heading level=1] "Getting Started"
  [paragraph] "This guide walks you through setup."
  [heading level=2] "Prerequisites"
  [list]
    [listitem] "Node.js 20+"
    [listitem] "npm 10+"
  [heading level=2] "Installation"
  [paragraph] "Run the following command:"
```

**After** (`/tmp/article-after.txt`):

```
[main]
  [heading level=1] "Getting Started"
  [paragraph] "This guide walks you through setup."
  [generic] "Prerequisites"
  [list]
    [listitem] "Node.js 20+"
    [listitem] "npm 10+"
  [heading level=2] "Installation"
  [paragraph] "Run the following command:"
```

**Diff output**:

```
Changed: [heading level=2] "Prerequisites" → [generic] "Prerequisites"
  Severity: CRITICAL
  Detail: Role changed from 'heading' to 'generic'; heading level lost
  Impact: Document outline broken; screen reader heading navigation skips this section
```

**Why this matters**: Screen reader users navigate by headings (H key in NVDA/JAWS). The "Prerequisites" section is now invisible in the heading list and unreachable via heading navigation.

### Form Input Losing Label Association

A layout change moves the `<label>` away from the input, breaking the `for`/`id` association.

**Before** (`/tmp/signup-before.txt`):

```
[form] "Create Account"
  [group] "Personal Information"
    [textbox] "First Name"
    [textbox] "Last Name"
    [textbox] "Email Address" required
  [group] "Security"
    [textbox] "Password" required
    [textbox] "Confirm Password" required
  [button] "Create Account"
```

**After** (`/tmp/signup-after.txt`):

```
[form] "Create Account"
  [group] "Personal Information"
    [textbox] "First Name"
    [textbox] "Last Name"
    [textbox] required
  [group] "Security"
    [textbox] "Password" required
    [textbox] "Confirm Password" required
  [button] "Create Account"
```

**Diff output**:

```
Changed: [textbox] "Email Address" required → [textbox] required
  Severity: CRITICAL
  Detail: Accessible name lost (was "Email Address", now unnamed)
  Impact: Screen readers announce only "edit text, required" with no label
```

**Why this matters**: Without a programmatic label, screen readers cannot tell the user what the input is for. Sighted users may still see a visual label, but the association is broken in the accessibility tree.

## When to Use ARIA Diffing

### After Refactoring UI Components

Any time you restructure HTML — replacing native elements with custom components, reorganizing layout wrappers, or migrating to a new component library — ARIA diffing catches semantic regressions.

```bash
# Before refactor
agent-browser navigate http://localhost:3000
agent-browser snapshot -s > /tmp/before-refactor.txt

# After refactor
agent-browser reload
agent-browser snapshot -s > /tmp/after-refactor.txt

agent-browser diff snapshot /tmp/before-refactor.txt /tmp/after-refactor.txt
```

### After CSS/Styling Changes

CSS can affect ARIA. `display: none` removes elements from the accessibility tree. `visibility: hidden` hides them. `content-visibility: auto` can delay their exposure. Diff after styling changes to confirm nothing was accidentally hidden.

### As Part of the E2E Test Pipeline

Capture baseline ARIA snapshots alongside E2E tests. On each test run, diff against the baseline and fail on Critical-severity regressions. Cross-reference the `/cover` skill for integrating this into test generation workflows.

### During Design System Migration

When migrating from one design system to another (e.g., Material UI to shadcn/ui + Radix), ARIA diffing verifies that the new components maintain the same accessibility semantics as the old ones.

## Interpreting Diff Output

### Annotated Example Diff

```
ARIA Snapshot Diff: /tmp/before.txt → /tmp/after.txt

  [banner]                                          # Unchanged landmark
    [navigation] "Main"                             # Unchanged
      [list]                                        # Unchanged
-       [listitem]                                  # REMOVED
-         [link] "Settings"                         # REMOVED — link gone
+       [listitem]                                  # ADDED
+         [generic] "Settings"                      # ADDED — but role is generic, not link!
    [button] "Sign Out"                             # Unchanged

Summary:
  Removed: 2 nodes (1 link, 1 listitem)
  Added:   2 nodes (1 generic, 1 listitem)
  Changed: 0 nodes

  Critical: 1 — [link] "Settings" replaced with [generic] "Settings"
  Warning:  0
  Info:     0
```

Lines prefixed with `-` were present in the before snapshot but absent in the after snapshot. Lines prefixed with `+` are new in the after snapshot. Unchanged lines provide context.

### Decision Tree: Regression vs Intentional Change

When the diff reports a change, work through these questions:

1. **Was the role removed or downgraded to generic?**
   - If unintentional: restore the semantic element or add explicit `role`
   - If intentional: verify the element is truly decorative and should not be interactive

2. **Was an accessible name lost?**
   - Check if a `<label>`, `aria-label`, or `aria-labelledby` was removed
   - Verify visual label still has a programmatic association with its control

3. **Was a landmark removed?**
   - Landmarks (`banner`, `navigation`, `main`, `contentinfo`, `region`) define page structure
   - Removing one breaks skip-navigation and landmark lists in screen readers

4. **Was a heading level changed?**
   - Heading levels must form a logical outline (no skipping from h1 to h4)
   - Visual size changes should use CSS, not heading level changes

5. **Is the change additive only (new nodes, no removals)?**
   - Typically safe — verify the new content is intentional and appropriately labeled

## Integration with /cover

The `/cover` skill (etk) generates test suites in phases. ARIA snapshot diffing integrates at two points:

**Phase 3b — E2E Discovery**: When `/cover` uses agent-browser to discover interactive elements and page structure, ARIA snapshots provide a semantic view of the page that complements the visual snapshot. Use ARIA snapshots to verify that discovered elements have proper roles and labels before codifying tests.

**Phase 4b — E2E Codification**: When `/cover` generates Playwright test code, include ARIA snapshot assertions alongside functional assertions:

```typescript
// Functional assertion (from /cover Phase 4b)
await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();

// ARIA snapshot assertion (from ARIA diffing baseline)
await expect(page.getByRole('form', { name: 'Contact' })).toMatchAriaSnapshot(`
  - form "Contact":
    - textbox "Name" [required]
    - textbox "Email" [required]
    - button "Submit"
`);
```

This ensures that both the visible behavior and the accessibility semantics are preserved across code changes.

For the full `/cover` workflow, see the `cover` skill in etk.
