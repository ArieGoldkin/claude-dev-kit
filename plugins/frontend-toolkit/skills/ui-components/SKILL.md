---
name: ui-components
description: "Production React UI \u2014 shadcn/ui, Radix, CVA variants, React Hook Form + Zod, accessibility, Motion, Tailwind v4"
effort: low
keep-coding-instructions: true
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/components/**"
  - "**/*.css"
---

# UI Components

## Overview

Consolidated reference for building robust, accessible, and performant UI components in a React + TypeScript stack using shadcn/ui, Radix primitives, Tailwind CSS v4, and the Motion library. Covers the full lifecycle from design tokens and variant definitions through form validation, accessibility, animation, and cognitive load optimization.

**Bundled References:**
- `${CLAUDE_SKILL_DIR}/references/shadcn-radix-patterns.md` -- shadcn/ui customization, Radix primitives, CVA variant definitions
- `${CLAUDE_SKILL_DIR}/references/forms-and-validation.md` -- React Hook Form v7 + Zod, error states, accessible form patterns
- `${CLAUDE_SKILL_DIR}/references/accessibility-and-ux.md` -- ARIA, keyboard navigation, cognitive load rules, interaction patterns
- `${CLAUDE_SKILL_DIR}/references/animation-and-motion.md` -- Motion library, View Transitions API, GPU compositing, reduced motion

---

## Quick Reference

### Component Architecture (Atomic Design)

```
Atoms        -- Button, Input, Badge, Avatar, Label, Skeleton
Molecules    -- FormField (Label + Input + Error), SearchBar, Card
Organisms    -- DataTable, NavigationMenu, MultiStepForm, Dashboard
Templates    -- Page layouts composing organisms with responsive slots
Pages        -- Template instances bound to data
```

Design rule: components at each level only import from the same level or below.

### shadcn/ui + Radix Essentials

```tsx
// Extend a shadcn component -- always use the cn() merge utility
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function PrimaryAction({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button className={cn("min-w-[120px]", className)} {...props} />;
}
```

**Read `${CLAUDE_SKILL_DIR}/references/shadcn-radix-patterns.md`** for `asChild` composition, data-attribute styling, CVA compound variants, and the `cn()` utility internals.

### CVA Variant Pattern

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const badge = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-primary/10 text-primary",
      success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      destructive: "bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badge({ variant }), className)} {...props} />;
}
```

### Form Pattern (React Hook Form + Zod)

```tsx
const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { email: "", password: "" },
});
```

**Read `${CLAUDE_SKILL_DIR}/references/forms-and-validation.md`** for field-level error display, `aria-describedby` wiring, async validation, and multi-step form patterns.

### Accessibility Checklist

| Area | Requirement |
|------|-------------|
| Color contrast | 4.5:1 normal text, 3:1 large text (WCAG AA) |
| Touch targets | Minimum 44x44px (Fitts's Law) |
| Keyboard | All interactive elements reachable via Tab, operable via Enter/Space |
| Focus | Visible focus ring, logical tab order, focus trapping in modals |
| Screen readers | Meaningful labels, live regions for dynamic content |

**Read `${CLAUDE_SKILL_DIR}/references/accessibility-and-ux.md`** for ARIA patterns, roving tabindex, cognitive load rules, and skeleton loading guidance.

### Cognitive Load Rules

| Law | Guideline | Practical Application |
|-----|-----------|----------------------|
| Miller's Law | 7 +/- 2 items in working memory | Limit nav items, chunk form fields into sections |
| Hick's Law | Decision time increases with choices | 1 primary CTA per view, progressive disclosure for options |
| Doherty threshold | Keep response time under 400ms | Optimistic UI, skeleton screens, prefetch on hover |
| Fitts's Law | Larger + closer targets are faster to hit | 44px min touch targets, place primary actions within thumb zone |

### Animation Essentials

```tsx
import { motion, AnimatePresence } from "motion/react";

<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div
      key="panel"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

**Read `${CLAUDE_SKILL_DIR}/references/animation-and-motion.md`** for layout animations, staggered lists, scroll-triggered reveals, and `prefers-reduced-motion` handling.

### Tailwind v4 + CSS Patterns

```css
/* tailwind.css -- v4 theme directive replaces tailwind.config.js */
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.65 0.19 255);
  --color-brand-600: oklch(0.55 0.19 255);
  --radius-card: 0.75rem;
  --font-display: "Cal Sans", sans-serif;
}
```

The `cn()` utility merges Tailwind classes without conflicts:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Responsive Components

```tsx
// Fluid sizing with clamp() -- no breakpoints needed
<h1 className="text-[clamp(1.5rem,4vw,2.5rem)]">Responsive Heading</h1>

// Container queries for component-level responsiveness
<div className="@container">
  <div className="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3 gap-4">
    {items.map(item => <Card key={item.id} {...item} />)}
  </div>
</div>
```

### Interaction States

Every interactive component must define five states:

| State | Visual Treatment |
|-------|-----------------|
| Default | Base appearance |
| Hover | Subtle background shift or underline (`hover:bg-accent`) |
| Active / Pressed | Slight scale or darker shade (`active:scale-[0.98]`) |
| Disabled | Reduced opacity, `pointer-events-none`, `aria-disabled="true"` |
| Loading | Skeleton placeholder or inline spinner with `aria-busy="true"` |

Prefer **skeleton screens** over spinners for content areas. Use spinners only for discrete actions (form submit, button click).

---

## V1 to V2 Migration Notes

When migrating from Material-UI (V1) to shadcn/radix-ui + Tailwind (V2):

| V1 (Material-UI) | V2 (shadcn + Radix + Tailwind) |
|-------------------|-------------------------------|
| `<MuiButton variant="contained">` | `<Button variant="default">` with CVA |
| `sx` prop / `makeStyles` | Tailwind utility classes + `cn()` |
| `<TextField>` with built-in validation | `<Input>` + React Hook Form + Zod |
| Theme provider with `createTheme()` | Tailwind v4 `@theme` directive + CSS variables |
| `<Dialog>` (MUI) | `<Dialog>` (Radix) with data-attribute animations |
| `<Autocomplete>` | Radix `<Combobox>` or cmdk |

Key migration principles:
1. Replace MUI's runtime CSS-in-JS with Tailwind's compile-time utility classes
2. Move validation from component props to schema-level (Zod)
3. Use Radix primitives for headless behavior, style with Tailwind
4. Define variants in CVA instead of MUI theme overrides
