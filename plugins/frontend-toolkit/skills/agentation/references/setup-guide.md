# Agentation Setup Guide

Complete installation and configuration instructions for your application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Steps](#installation-steps)
  - [1. Install Package](#1-install-package)
  - [2. Add Component to App Root](#2-add-component-to-app-root)
  - [3. Verify Installation](#3-verify-installation)
- [Configuration Options](#configuration-options)
  - [Basic Configuration](#basic-configuration-recommended)
  - [Advanced Configuration](#advanced-configuration)
- [Environment Guards](#environment-guards)
- [Integration Patterns](#integration-patterns)
  - [Pattern 1: Root App Component](#pattern-1-root-app-component-recommended)
  - [Pattern 2: DevTools Wrapper](#pattern-2-devtools-wrapper)
  - [Pattern 3: Storybook Integration](#pattern-3-storybook-integration)
- [Vite Configuration](#vite-configuration)
- [TypeScript Configuration](#typescript-configuration)
- [Troubleshooting](#troubleshooting)
- [Verification Checklist](#verification-checklist)
- [Next Steps](#next-steps)
- [Support](#support)

## Prerequisites

- React 18+
- Vite dev server
- Desktop browser for testing
- Node.js + npm

## Installation Steps

### 1. Install Package

```bash
cd your-app
npm install agentation -D
```

### 2. Add Component to App Root

**File:** `src/App.tsx`

```tsx
import { Agentation } from 'agentation'

function App() {
  return (
    <>
      {/* Existing app structure */}
      <YourAppContent />

      {/* Development-only annotation tool */}
      {process.env.NODE_ENV === 'development' && <Agentation />}
    </>
  )
}
```

**Why at root level?**
- Needs access to full DOM tree
- Must render above all other content (z-index)
- Only initialized once per session

### 3. Verify Installation

**Start dev server:**
```bash
npm run dev
```

**Expected result:**
1. App loads normally
2. Small toolbar appears in bottom-right corner
3. Click toolbar to activate annotation mode
4. Hover over elements to see highlighting

**Not working? See Troubleshooting below.**

## Configuration Options

### Basic Configuration (Recommended)

```tsx
{process.env.NODE_ENV === 'development' && <Agentation />}
```

**This provides:**
- Default click-to-annotate behavior
- Automatic clipboard copy
- Standard markdown output
- Dark/light mode support

### Advanced Configuration

```tsx
{process.env.NODE_ENV === 'development' && (
  <Agentation
    onAnnotationAdd={(annotation) => {
      console.log('New annotation:', annotation)
      // Send to custom API, logging service, etc.
    }}
    copyToClipboard={true}  // Default: true
  />
)}
```

**`onAnnotationAdd` callback receives:**
```typescript
interface Annotation {
  element: {
    selector: string        // CSS selector
    className: string       // Element classes
    tagName: string        // HTML tag
    position: {
      x: number
      y: number
      width: number
      height: number
    }
  }
  note: string             // User's feedback text
  timestamp: number
}
```

**Use cases for callback:**
- Send annotations to Jira API directly
- Log to analytics/monitoring
- Batch multiple annotations
- Custom formatting/processing

## Environment Guards

### Critical: Development-Only

**Always wrap with NODE_ENV check:**
```tsx
{process.env.NODE_ENV === 'development' && <Agentation />}
```

**Why?**
- Agentation is dev tooling, not user-facing feature
- ~1MB bundle size (avoid in production)
- DOM manipulation overhead
- No value to end users

**Verification:**
```bash
# Check it's in devDependencies (not dependencies)
grep -A 5 "devDependencies" package.json | grep agentation
```

Should show:
```json
"devDependencies": {
  "agentation": "^x.x.x",
  ...
}
```

## Integration Patterns

### Pattern 1: Root App Component (Recommended)

```tsx
// src/App.tsx
import { Agentation } from 'agentation'

function App() {
  return (
    <>
      <AppRoutes />
      {process.env.NODE_ENV === 'development' && <Agentation />}
    </>
  )
}
```

**Pros:**
- Single initialization point
- Available across all routes
- Clean separation from app logic

### Pattern 2: DevTools Wrapper

```tsx
// src/components/DevTools.tsx
import { Agentation } from 'agentation'

export function DevTools() {
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="dev-tools">
      <Agentation />
      {/* Other dev tools */}
    </div>
  )
}

// In App.tsx
import { DevTools } from '@/components/DevTools'

function App() {
  return (
    <>
      <AppRoutes />
      <DevTools />
    </>
  )
}
```

**Pros:**
- Centralized dev tooling
- Easy to add more dev-only features
- Clean abstraction

### Pattern 3: Storybook Integration

```tsx
// .storybook/preview.tsx
import { Agentation } from 'agentation'

export const decorators = [
  (Story) => (
    <>
      <Story />
      <Agentation />
    </>
  ),
]
```

**Pros:**
- Available in all Storybook stories
- Design review workflow
- Component-level annotations

## Vite Configuration

**No changes needed!** Agentation works out-of-box with Vite.

**Why it works:**
- Pure React component (no special build steps)
- No Vite plugin required
- Standard ES modules
- Tree-shakeable

**Build verification:**
```bash
npm run build
```

Should complete without errors. Agentation won't be in production bundle (NODE_ENV check).

## TypeScript Configuration

**No changes needed!** Agentation ships with TypeScript types.

**If you see type errors:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Verify types:**
```bash
# Check type definitions exist
ls node_modules/agentation/dist/index.d.ts
```

## Troubleshooting

### Toolbar Not Appearing

**Check 1: NODE_ENV**
```tsx
console.log('NODE_ENV:', process.env.NODE_ENV)
// Should log: "development"
```

**Check 2: Component mounted**
```tsx
console.log('Agentation loaded')
{process.env.NODE_ENV === 'development' && <Agentation />}
```

**Check 3: Browser console**
Open DevTools → Console → Look for errors

**Common issue: Production mode**
```bash
# Vite defaults to development, but verify:
npm run dev  # Not npm run preview (production mode)
```

### Elements Not Highlighting

**Issue:** Elements don't highlight on hover

**Fix 1:** Increase z-index
```css
/* Custom CSS if needed */
[data-agentation-toolbar] {
  z-index: 999999 !important;
}
```

**Fix 2:** Disable browser extensions
- React DevTools can interfere
- Other overlay tools may conflict
- Test in incognito mode

**Fix 3:** Check element pointer-events
```css
/* If elements have pointer-events: none */
.your-element {
  pointer-events: auto !important;
}
```

### Copy Not Working

**Issue:** Annotations don't copy to clipboard

**Fix 1:** Check browser permissions
- Chrome: Allow clipboard access
- Firefox: about:config → dom.events.testing.asyncClipboard

**Fix 2:** Use manual copy
- Click "View Output" in toolbar
- Select all text
- Ctrl+C / Cmd+C

**Fix 3:** Disable custom handler
```tsx
<Agentation copyToClipboard={false} />
// Then manually copy from UI
```

### Performance Issues

**Issue:** App feels slow with Agentation

**Rare in practice, but if it happens:**

**Fix 1:** Mount only when needed
```tsx
const [showAgentation, setShowAgentation] = useState(false)

// Toggle with keyboard shortcut
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      setShowAgentation(prev => !prev)
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])

return (
  <>
    <AppRoutes />
    {process.env.NODE_ENV === 'development' && showAgentation && <Agentation />}
  </>
)
```

**Fix 2:** Use portal for complex overlays
```tsx
import { createPortal } from 'react-dom'

{process.env.NODE_ENV === 'development' &&
  createPortal(<Agentation />, document.body)
}
```

## Verification Checklist

After installation, verify:

- [ ] Package in devDependencies (not dependencies)
- [ ] Component wrapped with NODE_ENV check
- [ ] Toolbar appears in dev server (bottom-right)
- [ ] Elements highlight on hover
- [ ] Annotations can be added
- [ ] Output copies to clipboard
- [ ] Production build excludes Agentation
- [ ] No console errors in browser

## Next Steps

1. ✅ Installation complete
2. → Read [usage-guide.md](usage-guide.md) for how to use
3. → Review [examples/react-integration.tsx](../examples/react-integration.tsx)
4. → Train team on QA workflow

## Support

**Package issues:** https://github.com/benjitaylor/agentation/issues
**Project issues:** Ask in your team's engineering channel
**Documentation:** https://agentation.dev
