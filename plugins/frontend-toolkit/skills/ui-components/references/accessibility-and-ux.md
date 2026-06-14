# Accessibility and UX Patterns

ARIA patterns, keyboard navigation, focus management, cognitive load rules, interaction states, and loading patterns for production React components.

---

## Table of Contents

- [ARIA Patterns](#aria-patterns)
- [Keyboard Navigation](#keyboard-navigation)
- [Focus Management](#focus-management)
- [Color Contrast and Visual Accessibility](#color-contrast-and-visual-accessibility)
- [Screen Reader Patterns](#screen-reader-patterns)
- [Cognitive Load Rules](#cognitive-load-rules)
- [Skeleton Loading](#skeleton-loading)
- [Empty States](#empty-states)
- [Error Boundaries](#error-boundaries)
- [Touch Target Sizing](#touch-target-sizing)
- [Testing Accessibility](#testing-accessibility)

---

## ARIA Patterns

### When to use ARIA

ARIA supplements HTML semantics -- it does not replace them. Follow this priority:

1. Use native HTML elements first (`<button>`, `<nav>`, `<dialog>`, `<details>`)
2. Add ARIA only when native semantics are insufficient
3. Never use ARIA to override correct native semantics

### Common ARIA roles and attributes

```tsx
// Live region -- announces dynamic content changes to screen readers
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// Labeling a region
<section aria-labelledby="section-heading">
  <h2 id="section-heading">Recent Activity</h2>
  {/* content */}
</section>

// Describing supplementary information
<input aria-describedby="password-hint" type="password" />
<p id="password-hint" className="text-sm text-muted-foreground">
  Must be at least 8 characters with one uppercase letter.
</p>

// Current page in navigation
<nav aria-label="Main navigation">
  <a href="/dashboard" aria-current="page">Dashboard</a>
  <a href="/settings">Settings</a>
</nav>

// Expanded/collapsed state
<button aria-expanded={isOpen} aria-controls="menu-panel" onClick={toggle}>
  Menu
</button>
<div id="menu-panel" hidden={!isOpen}>
  {/* menu content */}
</div>
```

### ARIA for custom components

| Component | Key ARIA | Notes |
|-----------|----------|-------|
| Tabs | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected` | Arrow keys navigate between tabs |
| Accordion | `aria-expanded`, `aria-controls` | Each header is a button |
| Combobox | `role="combobox"`, `aria-expanded`, `aria-activedescendant` | Complex -- prefer Radix Combobox |
| Tree view | `role="tree"`, `role="treeitem"`, `aria-expanded`, `aria-level` | Arrow keys for navigation |
| Tooltip | `role="tooltip"`, `aria-describedby` | Trigger element references tooltip |
| Alert dialog | `role="alertdialog"`, `aria-labelledby`, `aria-describedby` | Focus trapped, Escape closes |

When using Radix primitives, ARIA is handled automatically. Only add ARIA manually for custom-built components.

---

## Keyboard Navigation

### Foundational patterns

Every interactive element must be operable via keyboard:

| Key | Action |
|-----|--------|
| `Tab` | Move focus to next focusable element |
| `Shift+Tab` | Move focus to previous focusable element |
| `Enter` | Activate buttons, links, submit forms |
| `Space` | Activate buttons, toggle checkboxes |
| `Escape` | Close modal, popover, dropdown; cancel action |
| `Arrow keys` | Navigate within composite widgets (tabs, menus, listboxes) |
| `Home/End` | Jump to first/last item in a list or composite widget |

### Roving tabindex

For composite widgets (tab lists, toolbars, radio groups), use roving tabindex so the group is a single tab stop:

```tsx
function TabList({ tabs, activeIndex, onSelect }: TabListProps) {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let nextIndex: number | null = null;

    switch (e.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    onSelect(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div role="tablist" aria-label="Content tabs">
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          ref={(el) => { tabRefs.current[i] = el; }}
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={i === activeIndex}
          aria-controls={`panel-${tab.id}`}
          tabIndex={i === activeIndex ? 0 : -1}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onClick={() => onSelect(i)}
          className={cn(
            "px-4 py-2 text-sm font-medium",
            i === activeIndex
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

### Skip navigation link

```tsx
// Place as the first focusable element in the document
function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}

// Target
<main id="main-content" tabIndex={-1}>
  {/* page content */}
</main>
```

---

## Focus Management

### Focus trap for modals

Radix Dialog handles focus trapping automatically. For custom modals:

```tsx
import { FocusTrap } from "@radix-ui/react-focus-scope";

function CustomModal({ open, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <FocusTrap asChild>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </FocusTrap>
    </div>
  );
}
```

### Focus restoration

When a modal or popover closes, return focus to the element that triggered it:

```tsx
function useModalFocus(isOpen: boolean) {
  const triggerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);
}
```

### Focus visible styling

Use `focus-visible` (not `focus`) to show focus rings only for keyboard navigation:

```tsx
// Standard focus ring for all interactive elements
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

// Usage
<button className={cn("rounded-md px-4 py-2", focusRing)}>Action</button>
```

---

## Color Contrast and Visual Accessibility

### WCAG 2.1 AA requirements

| Element | Minimum Contrast Ratio |
|---------|----------------------|
| Normal text (< 18px) | 4.5:1 |
| Large text (>= 18px or >= 14px bold) | 3:1 |
| UI components and graphical objects | 3:1 |
| Decorative elements | No requirement |

### Practical contrast pairs

```css
/* Safe high-contrast pairs using oklch */
:root {
  /* Text on light backgrounds */
  --foreground: oklch(0.15 0 0);        /* ~14:1 on white */
  --muted-foreground: oklch(0.45 0 0);  /* ~5.5:1 on white */

  /* Text on dark backgrounds */
  --dark-foreground: oklch(0.95 0 0);        /* ~15:1 on dark bg */
  --dark-muted-foreground: oklch(0.65 0 0);  /* ~5:1 on dark bg */

  /* Interactive element colors */
  --primary: oklch(0.55 0.19 255);           /* 4.7:1 on white */
  --primary-foreground: oklch(0.98 0 0);     /* 8:1 on primary */
}
```

### Do not rely on color alone

Always pair color with a secondary indicator:

```tsx
// Bad: only color differentiates success from error
<span className="text-green-600">Available</span>
<span className="text-red-600">Unavailable</span>

// Good: icon + color + text
<span className="flex items-center gap-1.5 text-green-600">
  <CheckCircle className="h-4 w-4" aria-hidden="true" />
  Available
</span>
<span className="flex items-center gap-1.5 text-destructive">
  <XCircle className="h-4 w-4" aria-hidden="true" />
  Unavailable
</span>
```

---

## Screen Reader Patterns

### Visually hidden content

```tsx
// For content visible only to screen readers
<span className="sr-only">3 unread notifications</span>

// For decorative elements that should be hidden
<svg aria-hidden="true" className="h-5 w-5">...</svg>

// For icons paired with visible text
<button>
  <TrashIcon className="h-4 w-4" aria-hidden="true" />
  <span>Delete</span>
</button>

// For icon-only buttons
<button aria-label="Delete item">
  <TrashIcon className="h-4 w-4" aria-hidden="true" />
</button>
```

### Announcing dynamic updates

```tsx
// Polite announcement (waits for current speech to finish)
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {items.length} results found
</div>

// Assertive announcement (interrupts current speech) -- use sparingly
<div aria-live="assertive" role="alert" className="sr-only">
  {errorMessage}
</div>
```

### Accessible loading states

```tsx
function DataTable({ data, isLoading }: DataTableProps) {
  return (
    <div aria-busy={isLoading} aria-live="polite">
      {isLoading ? (
        <>
          <span className="sr-only">Loading data...</span>
          <TableSkeleton rows={5} />
        </>
      ) : (
        <table>{/* render data */}</table>
      )}
    </div>
  );
}
```

---

## Cognitive Load Rules

Design principles grounded in cognitive psychology research.

### Miller's Law: 7 +/- 2 items

Working memory holds approximately 7 items. Exceeding this causes decision fatigue and errors.

**Application:**
- Navigation menus: maximum 7 top-level items; group extras under "More"
- Form sections: chunk into groups of 5-7 fields with clear headings
- Lists and tables: paginate or virtualize beyond 7-10 visible items
- Dashboard widgets: limit to 5-7 visible metrics; use progressive disclosure for details

```tsx
// Good: chunked form with clear sections
<fieldset>
  <legend className="text-lg font-semibold">Personal Information</legend>
  {/* 4 fields: name, email, phone, date of birth */}
</fieldset>
<fieldset>
  <legend className="text-lg font-semibold">Address</legend>
  {/* 5 fields: street, city, state, zip, country */}
</fieldset>
```

### Hick's Law: Decision time increases with options

Time to decide = log2(n + 1). More options means slower, more stressful choices.

**Application:**
- One primary CTA per view (visually dominant button)
- Maximum 2-3 actions in a card or row
- Use progressive disclosure: show advanced options only on request
- Default selections for common choices

```tsx
// Good: clear primary/secondary hierarchy
<div className="flex gap-3">
  <Button variant="default">Save Changes</Button>                    {/* Primary */}
  <Button variant="outline">Cancel</Button>                          {/* Secondary */}
  <Button variant="ghost" size="icon" aria-label="More options">     {/* Tertiary */}
    <MoreHorizontal className="h-4 w-4" />
  </Button>
</div>
```

### Doherty Threshold: 400ms response time

Users perceive responses under 400ms as instantaneous. Beyond 1 second, they lose flow.

**Application:**
- Optimistic UI updates for mutations (show success immediately, roll back on error)
- Skeleton screens appear instantly (no delay before showing them)
- Prefetch data on hover for links and tabs
- Debounce search inputs at 300ms

```tsx
// Optimistic update pattern
async function handleToggleFavorite(id: string) {
  // Immediately update UI
  setFavorites((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  try {
    await api.toggleFavorite(id);
  } catch {
    // Revert on failure
    setFavorites((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    toast.error("Failed to update. Please try again.");
  }
}
```

### Fitts's Law: Size and distance matter

Time to reach a target is proportional to distance and inversely proportional to size.

**Application:**
- Minimum 44x44px touch targets (WCAG 2.5.5)
- Place primary actions in thumb-reachable zones on mobile
- Group related actions together to reduce pointer travel
- Make destructive actions smaller and further from primary actions

```tsx
// Touch-friendly button with minimum target size
<button
  className={cn(
    "min-h-[44px] min-w-[44px] px-4 py-2",      // Meets 44px minimum
    "rounded-md text-sm font-medium",
    "hover:bg-accent active:scale-[0.98]"
  )}
>
  {children}
</button>

// Touch-friendly icon button (padding extends the target)
<button className="p-2.5" aria-label="Close">       {/* 20px icon + 10px padding each side = 40px, add 2px border */}
  <XIcon className="h-5 w-5" aria-hidden="true" />
</button>
```

---

## Skeleton Loading

Prefer skeleton screens over spinners for content areas. Skeletons reduce perceived wait time by showing the layout shape immediately.

### Skeleton primitives

```tsx
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

// Usage: card skeleton
function CardSkeleton() {
  return (
    <div className="rounded-lg border p-6 space-y-4">
      <Skeleton className="h-5 w-2/3" />              {/* Title */}
      <Skeleton className="h-4 w-full" />              {/* Description line 1 */}
      <Skeleton className="h-4 w-4/5" />               {/* Description line 2 */}
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-20 rounded-md" />   {/* Button 1 */}
        <Skeleton className="h-9 w-20 rounded-md" />   {/* Button 2 */}
      </div>
    </div>
  );
}

// Usage: table skeleton
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-8 w-1/4" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-8 w-1/4" />
        </div>
      ))}
    </div>
  );
}
```

### When to use spinners vs. skeletons

| Scenario | Use |
|----------|-----|
| Page or section loading | Skeleton |
| Data table loading | Skeleton matching column layout |
| Button action in progress | Inline spinner inside the button |
| Form submission | Inline spinner + disabled state |
| File upload | Progress bar |
| Infinite scroll | Skeleton rows at the bottom |

---

## Empty States

Every data-driven component needs an empty state. Empty states should explain why it is empty and what the user can do.

```tsx
interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Usage
<EmptyState
  icon={InboxIcon}
  title="No messages yet"
  description="When you receive messages, they will appear here."
  action={{ label: "Compose message", onClick: () => setComposeOpen(true) }}
/>
```

---

## Error Boundaries

Catch rendering errors and display a recovery UI instead of a white screen.

```tsx
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center"
    >
      <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-4 max-w-full overflow-auto rounded bg-muted p-3 text-left text-xs">
          {error.message}
        </pre>
      )}
      <Button className="mt-4" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
}

// Wrap sections of the UI independently
function Dashboard() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => queryClient.invalidateQueries()}>
        <MetricsPanel />
      </ErrorBoundary>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <ActivityFeed />
      </ErrorBoundary>
    </div>
  );
}
```

Place error boundaries at meaningful UI divisions so a failure in one section does not take down the entire page.

---

## Touch Target Sizing

### WCAG 2.5.5 requirements

All interactive elements must have a minimum target size of 44x44 CSS pixels. This includes the element itself plus any padding that extends the clickable area.

```tsx
// Patterns for meeting 44px targets

// Text link in a list (use padding to extend target)
<a href="/settings" className="block py-3 px-4 -mx-4 hover:bg-accent rounded-md">
  Settings
</a>

// Small icon button with adequate padding
<button className="p-3" aria-label="Notifications">
  <BellIcon className="h-5 w-5" />  {/* 20px icon + 12px padding each side = 44px */}
</button>

// Checkbox with label (label extends clickable area)
<label className="flex items-center gap-3 py-2 cursor-pointer">
  <input type="checkbox" className="h-5 w-5" />
  <span className="text-sm">Accept terms</span>
</label>

// Navigation on mobile -- full-width tap targets
<nav className="flex flex-col">
  {links.map((link) => (
    <a key={link.href} href={link.href} className="flex items-center gap-3 px-4 py-3 min-h-[44px]">
      <link.icon className="h-5 w-5" aria-hidden="true" />
      <span>{link.label}</span>
    </a>
  ))}
</nav>
```

---

## Testing Accessibility

### Automated testing

```tsx
// With jest-axe in component tests
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

test("LoginForm has no accessibility violations", async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Manual testing checklist

1. **Tab through the entire page** -- is the order logical? Can you reach everything?
2. **Activate with keyboard** -- do Enter and Space work on all buttons and links?
3. **Escape from modals** -- does Escape close overlays and return focus?
4. **Screen reader test** -- navigate with VoiceOver (macOS) or NVDA (Windows)
5. **Zoom to 200%** -- does the layout remain usable?
6. **High contrast mode** -- are all elements visible in Windows High Contrast?
7. **Reduced motion** -- do animations respect `prefers-reduced-motion`?
