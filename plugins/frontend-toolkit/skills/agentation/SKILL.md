---
name: agentation
description: "Visual feedback tool for AI agents \u2014 CSS selector capture, DOM context, QA bug reports, and UI review"
effort: low
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.css"
  - "**/*.html"
---

# Agentation - Visual Feedback for AI Agents

## Overview

Agentation is a React component that enables visual annotation of UI elements during development. It captures selectors, positions, and contextual data to help AI agents find exact code locations, eliminating ambiguous bug reports like "the blue button doesn't work."

## Core Value Proposition

### Problem
**Traditional QA report:**
> "The submit button in the checkout flow doesn't show a loading state"

**Claude's response:**
> "Which button? I found 3 submit buttons in checkout. Can you describe its location?"

**Result:** 5-10 messages to identify element, 30+ minutes wasted

### Solution with Agentation
**QA clicks element, tool captures:**
```markdown
## Issue: Submit button missing loading state

**Element:** `button.checkout-submit-btn`
**Location:** `src/features/checkout/components/submit-button.tsx:42`
**Context:** Final step button, below payment form
**Screenshot:** [included]
```

**Claude's response:**
> "Found the button at line 42. The loading state prop isn't connected. Fixing now..."

**Result:** Issue identified instantly, fixed in minutes

---

## Quick Start

### Installation (Already Done)
```bash
npm install agentation -D
```

### Configuration
Add to your React app's root (development only):

```tsx
// src/App.tsx
import { Agentation } from 'agentation'

function App() {
  return (
    <>
      {/* Your app */}

      {/* Development-only annotation tool */}
      {process.env.NODE_ENV === 'development' && <Agentation />}
    </>
  )
}
```

### Usage
1. **Start dev server:** `npm run dev`
2. **Open app:** Toolbar appears in bottom-right corner
3. **Click elements:** Tool highlights and captures selector
4. **Add note:** Describe the issue
5. **Copy output:** Structured markdown with selectors
6. **Paste to Claude:** Agent finds code instantly

---

## Features

### Element Selection
- **Click mode**: Click any element to capture its selector
- **Text mode**: Select text across multiple elements
- **Freeze animations**: Pause UI state to capture specific frames

### Data Captured
For each annotation:
- CSS selector (e.g., `.checkout-submit-btn`)
- Class names
- Element position (x, y, width, height)
- DOM path
- User notes/feedback

### Output Format
```markdown
## [Your Issue Title]

**Element:** `.class-name`
**Selector:** `div > button.submit-btn`
**Position:** (x: 340, y: 120)
**Note:** [Your feedback here]
```

---

## Integration Patterns

### Pattern 1: QA Workflow
```
QA finds bug
  ↓
Use Agentation to annotate element
  ↓
Copy structured output
  ↓
Create Jira ticket with output
  ↓
Dev pastes to Claude
  ↓
Claude finds exact code location
  ↓
Fix applied
```

### Pattern 2: Design Review
```
Designer reviews implementation
  ↓
Annotate elements needing adjustment
  ↓
Export all annotations
  ↓
Dev processes batch with Claude
  ↓
All issues addressed in one session
```

### Pattern 3: Self-Service Development
```
Developer sees UI issue
  ↓
Annotate problematic element
  ↓
Paste to Claude Code
  ↓
Claude identifies component + line number
  ↓
Developer reviews + approves fix
```

---

## Application Integration

### Where to Add Component

**Primary location:** Your app's root component (e.g., `src/App.tsx`)
```tsx
{process.env.NODE_ENV === 'development' && <Agentation />}
```

**Alternative locations:**
- Root layout component
- DevTools wrapper component
- Storybook global decorators

### Best Practices

1. **Development-only:** Always wrap with `NODE_ENV` check
2. **Desktop focus:** Tool designed for desktop browsers (not mobile QA)
3. **One issue per annotation:** Easier for AI to address individually
4. **Include context:** Add surrounding element info when helpful
5. **Batch related issues:** Multiple annotations for coordinated fixes

### Security Considerations

**Safe for development:**
- No network requests (client-side only)
- No data transmission
- Runs in browser memory
- Manual copy-paste workflow

**Never in production:**
- Dev dependency only
- NODE_ENV guard required
- No sensitive data exposure

---

## Trial Period Metrics

**Duration:** 1 sprint (6 days)

**Success Criteria:**
| Metric | Target | Measurement |
|--------|--------|-------------|
| Time saved per bug | >30 min | QA report → fix time |
| Reduced back-and-forth | <2 messages | Slack thread length |
| Team adoption | >50% | % of bugs using tool |

**Evaluation questions:**
- Does it reduce QA→Dev clarification time?
- Do developers find exact code faster?
- Is the team actually using it?
- Should we keep, expand, or remove?

---

## Detailed References

**For setup:** See [references/setup-guide.md](${CLAUDE_SKILL_DIR}/references/setup-guide.md)
**For usage:** See [references/usage-guide.md](${CLAUDE_SKILL_DIR}/references/usage-guide.md)
**For examples:** See [examples/react-integration.tsx](${CLAUDE_SKILL_DIR}/examples/react-integration.tsx)

---

## Troubleshooting

**Tool not appearing?**
- Check NODE_ENV === 'development'
- Verify component is mounted
- Check browser console for errors

**Can't select elements?**
- Try freeze mode for animated elements
- Click directly on element (not child text)
- Disable browser extensions if conflicts

**Output not copying?**
- Check browser clipboard permissions
- Try manual copy from output panel
- Verify `copyToClipboard` prop is true

---

## License & Attribution

**Package:** [agentation](https://github.com/benjitaylor/agentation) by Benji Taylor
**License:** PolyForm Shield 1.0.0 (source-available, free for non-competitive use)
**Version:** Latest from npm
**Documentation:** https://agentation.dev

---

## Related Skills

- **code-review-playbook** - For reviewing generated fixes
- **testing-strategy-builder** - For QA test planning
- **ui-developer** - For implementing fixes
