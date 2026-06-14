# Animation and Motion

Motion library (formerly Framer Motion) patterns, View Transitions API, GPU compositing, performance optimization, and `prefers-reduced-motion` handling.

---

## Table of Contents

- [Motion Library Fundamentals](#motion-library-fundamentals)
- [AnimatePresence for Enter/Exit](#animatepresence-for-enterexit)
- [Layout Animations](#layout-animations)
- [Staggered Lists](#staggered-lists)
- [Scroll-Triggered Animations](#scroll-triggered-animations)
- [Shared Layout Animations](#shared-layout-animations)
- [Gesture Animations](#gesture-animations)
- [View Transitions API](#view-transitions-api)
- [Performance: GPU Compositing](#performance-gpu-compositing)
- [Prefers Reduced Motion](#prefers-reduced-motion)
- [Animation Tokens and Timing](#animation-tokens-and-timing)
- [Common Recipes](#common-recipes)

---

## Motion Library Fundamentals

The Motion library (package: `motion/react`, formerly `framer-motion`) provides declarative animations for React. Use `motion.div` (or any `motion.element`) to animate.

### Basic animation

```tsx
import { motion } from "motion/react";

// Animate on mount
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
>
  Content appears with a fade-up
</motion.div>

// Animate between states
function Expandable({ isOpen }: { isOpen: boolean }) {
  return (
    <motion.div
      animate={{ height: isOpen ? "auto" : 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <div className="p-4">{/* content */}</div>
    </motion.div>
  );
}
```

### Transition types

```tsx
// Spring (natural feel for interactive elements)
transition={{ type: "spring", stiffness: 300, damping: 30 }}

// Tween (precise control, good for fades and slides)
transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}

// Custom cubic bezier
transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}

// Inertia (for drag and scroll momentum)
transition={{ type: "inertia", velocity: 200, power: 0.8 }}
```

### Recommended easings

| Easing | Use Case | Value |
|--------|----------|-------|
| easeOut | Elements entering the viewport | `[0, 0, 0.2, 1]` |
| easeIn | Elements exiting the viewport | `[0.4, 0, 1, 1]` |
| easeInOut | State changes, toggles | `[0.4, 0, 0.2, 1]` |
| Spring | Interactive elements (buttons, cards) | `type: "spring", stiffness: 300, damping: 30` |

---

## AnimatePresence for Enter/Exit

`AnimatePresence` enables exit animations for components that are removed from the React tree.

```tsx
import { motion, AnimatePresence } from "motion/react";

function NotificationList({ notifications }: { notifications: Notification[] }) {
  return (
    <div className="space-y-2">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="rounded-lg border p-4"
          >
            {notification.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

### AnimatePresence modes

```tsx
// "sync" (default) -- enter and exit animations run simultaneously
<AnimatePresence>

// "wait" -- exit completes before enter starts (good for page transitions)
<AnimatePresence mode="wait">

// "popLayout" -- exiting elements are removed from layout flow immediately
<AnimatePresence mode="popLayout">
```

### Page transition pattern

```tsx
// In a layout component (e.g., Next.js layout or React Router outlet)
import { AnimatePresence, motion } from "motion/react";
import { useLocation } from "react-router-dom";

function AnimatedOutlet() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        <Outlet />
      </motion.main>
    </AnimatePresence>
  );
}
```

---

## Layout Animations

The `layout` prop animates CSS layout changes (position, size) automatically. This handles cases that are impossible to animate with transforms alone.

```tsx
// Items reflow smoothly when one is removed
function FilteredList({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout                          // Animates position changes
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ layout: { duration: 0.3, ease: "easeInOut" } }}
            className="rounded-lg border p-4"
          >
            {item.content}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

### Layout animation scoping

Use `layoutScroll` on scrollable containers to prevent layout animations from miscalculating positions:

```tsx
<motion.div layoutScroll className="overflow-y-auto max-h-[400px]">
  {/* items with layout animations */}
</motion.div>
```

Use `layoutId` to animate an element between two different tree positions (shared layout animation):

```tsx
// Thumbnail that expands into a detail view
function ImageGallery({ selectedId, onSelect }: GalleryProps) {
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {images.map((img) => (
          <motion.div key={img.id} layoutId={`image-${img.id}`} onClick={() => onSelect(img.id)}>
            <img src={img.thumb} className="rounded-md" alt={img.alt} />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedId && (
          <motion.div
            layoutId={`image-${selectedId}`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => onSelect(null)}
          >
            <img src={images.find(i => i.id === selectedId)!.full} className="max-h-[80vh] rounded-lg" alt="" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

---

## Staggered Lists

Animate list items with increasing delay for a cascading reveal effect.

```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,  // 50ms between each child
      delayChildren: 0.1,     // 100ms before first child starts
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

function StaggeredList({ items }: { items: ListItem[] }) {
  return (
    <motion.ul variants={container} initial="hidden" animate="show" className="space-y-2">
      {items.map((entry) => (
        <motion.li key={entry.id} variants={item} className="rounded-lg border p-4">
          {entry.content}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

### Stagger on scroll

Combine with `whileInView` to trigger stagger only when the list enters the viewport:

```tsx
<motion.ul
  variants={container}
  initial="hidden"
  whileInView="show"
  viewport={{ once: true, margin: "-100px" }}
>
  {/* items */}
</motion.ul>
```

---

## Scroll-Triggered Animations

### whileInView

```tsx
// Fade in when element enters viewport
<motion.section
  initial={{ opacity: 0, y: 40 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}  // Trigger when 30% visible, only once
  transition={{ duration: 0.5, ease: "easeOut" }}
>
  <h2>Feature Section</h2>
</motion.section>
```

### useScroll for scroll-linked animations

```tsx
import { motion, useScroll, useTransform } from "motion/react";

function ParallaxHero() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, -150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <motion.div style={{ y, opacity }} className="relative h-[60vh]">
      <img src="/hero.jpg" className="h-full w-full object-cover" alt="" />
    </motion.div>
  );
}
```

### Progress bar linked to scroll

```tsx
function ScrollProgress() {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-50"
      style={{ scaleX: scrollYProgress }}
    />
  );
}
```

---

## Shared Layout Animations

Use `layoutId` to create seamless transitions between two instances of the same logical element in different tree positions.

```tsx
// Tab indicator that slides between tabs
function Tabs({ tabs, activeTab, onSelect }: TabsProps) {
  return (
    <div className="relative flex gap-1 border-b">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={cn(
            "relative px-4 py-2 text-sm font-medium",
            activeTab === tab.id ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
```

---

## Gesture Animations

### Hover and tap

```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
  className="rounded-lg bg-primary px-6 py-3 text-primary-foreground"
>
  Click me
</motion.button>
```

### Drag

```tsx
<motion.div
  drag="x"
  dragConstraints={{ left: -200, right: 200 }}
  dragElastic={0.1}
  className="cursor-grab active:cursor-grabbing rounded-lg bg-card p-4 shadow-md"
>
  Drag me horizontally
</motion.div>
```

---

## View Transitions API

The native View Transitions API enables page-level transitions without JavaScript animation libraries. Works in Chrome/Edge; use as progressive enhancement.

### Basic usage

```tsx
// With Next.js App Router or similar
function navigateWithTransition(href: string) {
  if (!document.startViewTransition) {
    // Fallback: navigate without animation
    router.push(href);
    return;
  }

  document.startViewTransition(() => {
    router.push(href);
  });
}
```

### CSS for view transitions

```css
/* Default cross-fade (works out of the box) */
::view-transition-old(root) {
  animation: fade-out 0.15s ease-in;
}

::view-transition-new(root) {
  animation: fade-in 0.15s ease-out;
}

/* Named view transition for a specific element */
.product-image {
  view-transition-name: product-hero;
}

::view-transition-old(product-hero),
::view-transition-new(product-hero) {
  animation-duration: 0.3s;
}
```

### When to use View Transitions vs. Motion library

| Scenario | Recommendation |
|----------|---------------|
| Page-to-page navigation transitions | View Transitions API |
| Component enter/exit within a page | Motion AnimatePresence |
| Layout reflow animations | Motion layout prop |
| Scroll-linked animations | Motion useScroll |
| Cross-browser interactive animations | Motion (wider support) |
| Shared element between pages | View Transitions API (with `view-transition-name`) |

---

## Performance: GPU Compositing

### Properties that trigger GPU compositing (cheap to animate)

These properties are handled by the GPU compositor thread without triggering layout or paint:

| Property | Tailwind | Notes |
|----------|----------|-------|
| `transform` | `translate-x-*`, `scale-*`, `rotate-*` | Best for position and size animations |
| `opacity` | `opacity-*` | Best for fade effects |
| `filter` | `blur-*`, `brightness-*` | GPU-accelerated in modern browsers |

### Properties that trigger layout (expensive to animate)

Avoid animating these -- they cause full layout recalculation:

| Property | Avoid | Use Instead |
|----------|-------|-------------|
| `width` / `height` | `animate-[width]` | `scale` transform or Motion `layout` prop |
| `top` / `left` | `animate-[top]` | `translateX` / `translateY` |
| `margin` / `padding` | direct animation | transform or `gap` changes on parent |
| `border-width` | direct animation | `outline` or `box-shadow` |

### Force GPU compositing

```css
/* Promote element to its own compositing layer */
.will-animate {
  will-change: transform, opacity;
  /* or */
  transform: translateZ(0); /* "null transform" hack -- less preferred */
}
```

Use `will-change` sparingly -- only on elements about to animate. Remove it after animation completes to free GPU memory.

```tsx
// Motion handles will-change automatically during animations
// For CSS animations, apply and remove manually:
<div
  className={cn(
    "transition-transform duration-300",
    isAnimating && "will-change-transform"
  )}
/>
```

### Measuring animation performance

Use Chrome DevTools:
1. Performance panel > check "Screenshots" and "Web Vitals"
2. Record during animation
3. Look for green bars (composited) vs. purple bars (layout) in the "Main" thread
4. Target: animations at 60fps (16.6ms per frame), zero layout thrashing

---

## Prefers Reduced Motion

Users who set `prefers-reduced-motion: reduce` in their OS settings have vestibular disorders, motion sensitivity, or simply prefer less animation. Respect this preference.

### CSS approach

```css
/* Disable transitions globally for reduced-motion users */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Tailwind approach

```tsx
// Tailwind v4 supports motion-safe and motion-reduce variants
<div className="motion-safe:animate-fade-in motion-reduce:opacity-100">
  Content
</div>

// For transitions
<button className="motion-safe:transition-transform motion-safe:hover:scale-105">
  Hover me
</button>
```

### Motion library approach

```tsx
import { useReducedMotion } from "motion/react";

function AnimatedCard({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

### Reusable hook

```tsx
function useMotionPreference() {
  const shouldReduceMotion = useReducedMotion();

  return {
    // Use as transition prop
    transition: shouldReduceMotion
      ? { duration: 0 }
      : { duration: 0.2, ease: "easeOut" },

    // Use to conditionally skip initial animation
    initial: (values: Record<string, unknown>) =>
      shouldReduceMotion ? false : values,

    // Boolean for conditional rendering of complex animations
    animationsEnabled: !shouldReduceMotion,
  };
}
```

---

## Animation Tokens and Timing

Consistent timing across the application prevents animations from feeling random.

```css
/* Define in Tailwind v4 @theme */
@theme {
  /* Durations */
  --duration-instant: 0ms;
  --duration-fast: 100ms;      /* Micro-interactions: button press, checkbox toggle */
  --duration-normal: 200ms;    /* Standard transitions: hover states, small reveals */
  --duration-moderate: 300ms;  /* Medium transitions: panel slides, tab switches */
  --duration-slow: 500ms;      /* Large transitions: page enters, modal opens */

  /* Easings */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Named animations */
  --animate-fade-in: fade-in var(--duration-normal) var(--ease-out);
  --animate-slide-up: slide-up var(--duration-moderate) var(--ease-out);
  --animate-scale-in: scale-in var(--duration-fast) var(--ease-out);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

### Motion library presets

```tsx
// Shared transition presets for consistency
export const transitions = {
  fast: { duration: 0.1, ease: "easeOut" },
  normal: { duration: 0.2, ease: "easeOut" },
  moderate: { duration: 0.3, ease: "easeOut" },
  slow: { duration: 0.5, ease: "easeOut" },
  spring: { type: "spring" as const, stiffness: 300, damping: 30 },
  springBouncy: { type: "spring" as const, stiffness: 400, damping: 15 },
} as const;

// Usage
<motion.div transition={transitions.normal} animate={{ opacity: 1 }} />
```

---

## Common Recipes

### Toast notification

```tsx
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg"
      role="status"
    >
      <p>{message}</p>
      <button onClick={onDismiss} className="ml-4" aria-label="Dismiss">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </motion.div>
  );
}
```

### Accordion with height animation

```tsx
function AccordionItem({ title, children, isOpen, onToggle }: AccordionItemProps) {
  return (
    <div className="border-b">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between py-4 text-sm font-medium"
      >
        {title}
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-4 text-sm text-muted-foreground">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### Number counter

```tsx
import { motion, useMotionValue, useTransform, animate } from "motion/react";

function AnimatedCounter({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest));

  React.useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.8, ease: "easeOut" });
    return controls.stop;
  }, [motionValue, value]);

  return <motion.span>{rounded}</motion.span>;
}
```

### Skeleton to content transition

```tsx
function DataCard({ data, isLoading }: { data?: CardData; isLoading: boolean }) {
  return (
    <div className="rounded-lg border p-6">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-lg font-semibold">{data!.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{data!.description}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```
