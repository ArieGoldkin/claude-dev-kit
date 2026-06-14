# shadcn/ui, Radix Primitives, and CVA Patterns

Detailed reference for customizing shadcn/ui components, composing with Radix primitives, and defining type-safe variants with class-variance-authority.

---

## Table of Contents

- [The cn() Utility](#the-cn-utility)
- [shadcn/ui Component Customization](#shadcnui-component-customization)
- [Radix Primitives and asChild Composition](#radix-primitives-and-aschild-composition)
- [Data-Attribute Styling](#data-attribute-styling)
- [CVA Variant Definitions](#cva-variant-definitions)
- [Compound Variants](#compound-variants)
- [Composing CVA with Radix](#composing-cva-with-radix)
- [Tailwind v4 Theme Integration](#tailwind-v4-theme-integration)
- [Cascade Layers](#cascade-layers)
- [Common Patterns](#common-patterns)

---

## The cn() Utility

The `cn()` function is the foundation of class management in a shadcn/ui project. It combines `clsx` for conditional classes with `tailwind-merge` to resolve conflicts.

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Why tailwind-merge matters

Without `twMerge`, conflicting Tailwind classes stack rather than override:

```ts
// Without twMerge -- broken: both p-4 and p-2 apply, last wins by source order (unreliable)
clsx("p-4", "p-2"); // => "p-4 p-2"

// With twMerge -- correct: p-2 wins deterministically
cn("p-4", "p-2"); // => "p-2"
```

### Usage patterns

```tsx
// Conditional classes
cn("flex items-center", isActive && "bg-accent", isDisabled && "opacity-50 pointer-events-none");

// Allowing consumer className overrides (the standard shadcn pattern)
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border bg-card p-6", className)} {...props} />;
}

// Merging with CVA output
cn(buttonVariants({ variant, size }), className);
```

---

## shadcn/ui Component Customization

shadcn/ui components are copied into your project (not imported from a package). This means you own the source and can modify it directly.

### Customization strategies

**1. Modify the source component directly** -- for project-wide changes:

```tsx
// components/ui/button.tsx -- modified source
const buttonVariants = cva(
  // Changed: added your project's default transition
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200 ease-out ...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        // Added: project-specific variant
        brand: "bg-brand-500 text-white hover:bg-brand-600 shadow-md hover:shadow-lg",
      },
      // ...
    },
  }
);
```

**2. Wrap the component** -- for specialized versions that keep the original intact:

```tsx
// components/domain/submit-button.tsx
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SubmitButtonProps extends ButtonProps {
  isLoading?: boolean;
}

export function SubmitButton({ isLoading, children, className, disabled, ...props }: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={disabled || isLoading}
      className={cn("min-w-[120px]", className)}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Submitting...</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
```

**3. Extend via className** -- for one-off overrides at the call site:

```tsx
<Button className="w-full rounded-full text-base" size="lg">
  Get Started
</Button>
```

### File organization

```
components/
  ui/              # shadcn/ui primitives (Button, Input, Dialog, etc.)
  domain/          # Wrapped/composed components (SubmitButton, MetricCard, etc.)
  layout/          # Layout components (AppShell, Sidebar, PageHeader)
```

---

## Radix Primitives and asChild Composition

Radix UI primitives render a default DOM element but support `asChild` to delegate rendering to a child element. This enables composing behavior without extra wrapper elements.

### Basic asChild pattern

```tsx
import * as Dialog from "@radix-ui/react-dialog";

// Without asChild -- Radix renders its own <button>
<Dialog.Trigger>Open</Dialog.Trigger>

// With asChild -- Radix delegates to YOUR element, merging props and event handlers
<Dialog.Trigger asChild>
  <Button variant="outline">Open Dialog</Button>
</Dialog.Trigger>
```

When `asChild` is true, Radix uses `Slot` internally to:
1. Merge its props (event handlers, ARIA attributes) onto your child element
2. Not render any wrapper DOM node of its own

### Common asChild compositions

```tsx
// Navigation link that is also a Radix menu trigger
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import Link from "next/link";

<NavigationMenu.Link asChild>
  <Link href="/dashboard">Dashboard</Link>
</NavigationMenu.Link>

// Tooltip on a custom button
import * as Tooltip from "@radix-ui/react-tooltip";

<Tooltip.Trigger asChild>
  <IconButton aria-label="Settings">
    <SettingsIcon />
  </IconButton>
</Tooltip.Trigger>
```

### Building your own Slot-compatible components

If you create components that accept `asChild`, use Radix's `Slot`:

```tsx
import { Slot } from "@radix-ui/react-slot";

interface CardActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const CardAction = React.forwardRef<HTMLButtonElement, CardActionProps>(
  ({ asChild, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn("underline-offset-4 hover:underline", className)} {...props} />;
  }
);
CardAction.displayName = "CardAction";
```

---

## Data-Attribute Styling

Radix primitives expose state via `data-*` attributes, enabling CSS-only state styling without JavaScript state management.

### Common Radix data attributes

| Attribute | Values | Component |
|-----------|--------|-----------|
| `data-state` | `open`, `closed`, `checked`, `unchecked`, `active`, `inactive` | Dialog, Accordion, Checkbox, Tabs |
| `data-disabled` | present when disabled | All interactive primitives |
| `data-orientation` | `horizontal`, `vertical` | Separator, Tabs, Toolbar |
| `data-side` | `top`, `right`, `bottom`, `left` | Popover, Tooltip, DropdownMenu |
| `data-align` | `start`, `center`, `end` | Popover, Tooltip, DropdownMenu |

### Styling with Tailwind data-attribute variants

```tsx
// Accordion item that animates based on Radix state
<AccordionContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
  {children}
</AccordionContent>

// Tab trigger with active indicator
<TabsTrigger className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground">
  {label}
</TabsTrigger>

// Checkbox with custom checked styling
<Checkbox className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" />
```

### Defining custom Tailwind animations for Radix states

```css
/* In your global CSS or Tailwind v4 theme */
@theme {
  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;
  --animate-collapsible-down: collapsible-down 0.2s ease-out;
  --animate-collapsible-up: collapsible-up 0.2s ease-out;
}

@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}
```

---

## CVA Variant Definitions

class-variance-authority provides type-safe variant management. Each variant maps prop values to Tailwind class strings.

### Anatomy of a CVA definition

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const alertVariants = cva(
  // Base classes (always applied)
  "relative w-full rounded-lg border p-4 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:translate-y-[-3px] [&>svg~*]:pl-7",
  {
    variants: {
      // Each key becomes a prop, each value maps to classes
      variant: {
        default: "bg-background text-foreground",
        info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100 [&>svg]:text-blue-600",
        success: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100 [&>svg]:text-green-600",
        warning: "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100 [&>svg]:text-yellow-600",
        destructive: "border-destructive/50 bg-destructive/10 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

// Extract the variant props type
type AlertProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>;

function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
```

### Multi-axis variants

```tsx
const inputVariants = cva(
  "flex w-full rounded-md border bg-transparent px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-input",
        ghost: "border-transparent hover:border-input",
        error: "border-destructive focus-visible:ring-destructive",
      },
      inputSize: {
        sm: "h-8 px-2 text-xs",
        md: "h-10 px-3 text-sm",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "md",
    },
  }
);
```

---

## Compound Variants

Compound variants activate when multiple variant axes match simultaneously. Use them for combinations that need special treatment.

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4 py-2",
        lg: "h-11 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    compoundVariants: [
      // Destructive + outline = red border, not filled red
      {
        variant: "destructive",
        size: "icon",
        className: "rounded-full",
      },
      // Link variant ignores size padding
      {
        variant: "link",
        size: ["sm", "md", "lg"],
        className: "h-auto px-0 py-0",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);
```

### When to use compound variants vs. separate variants

- **Compound variants**: When a specific combination of existing axes needs overrides (e.g., destructive + icon = round)
- **New variant axis**: When the distinction is orthogonal to existing axes (e.g., adding `rounded: "full" | "md" | "none"`)
- **Wrapper component**: When the combination implies different markup or behavior, not just different classes

---

## Composing CVA with Radix

Pattern for building a complete Radix-based component with CVA variants:

```tsx
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toggleGroupItemVariants = cva(
  "inline-flex items-center justify-center text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:bg-accent data-[state=on]:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-accent",
      },
      size: {
        sm: "h-8 px-2.5",
        md: "h-10 px-3",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

type ToggleGroupItemProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleGroupItemVariants>;

const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  ToggleGroupItemProps
>(({ className, variant, size, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(toggleGroupItemVariants({ variant, size }), className)}
    {...props}
  />
));
ToggleGroupItem.displayName = "ToggleGroupItem";
```

---

## Tailwind v4 Theme Integration

Tailwind v4 replaces `tailwind.config.js` with the CSS-native `@theme` directive.

### Defining design tokens

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Colors using oklch for perceptual uniformity */
  --color-brand-50: oklch(0.97 0.02 255);
  --color-brand-100: oklch(0.93 0.04 255);
  --color-brand-500: oklch(0.65 0.19 255);
  --color-brand-600: oklch(0.55 0.19 255);
  --color-brand-700: oklch(0.45 0.19 255);

  /* Semantic color mapping */
  --color-primary: var(--color-brand-500);
  --color-primary-foreground: oklch(0.98 0 0);

  /* Typography */
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Cal Sans", var(--font-sans);
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;

  /* Spacing scale (8px grid) */
  --spacing-0: 0px;
  --spacing-1: 0.25rem;  /* 4px */
  --spacing-2: 0.5rem;   /* 8px */
  --spacing-3: 0.75rem;  /* 12px */
  --spacing-4: 1rem;     /* 16px */
  --spacing-6: 1.5rem;   /* 24px */
  --spacing-8: 2rem;     /* 32px */

  /* Border radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-card: 0 1px 3px 0 oklch(0 0 0 / 0.08), 0 1px 2px -1px oklch(0 0 0 / 0.08);
  --shadow-popover: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);

  /* Animation durations */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
}
```

### Dark mode with CSS variables

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.15 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.15 0 0);
  --muted: oklch(0.96 0 0);
  --muted-foreground: oklch(0.55 0 0);
  --accent: oklch(0.96 0 0);
  --accent-foreground: oklch(0.15 0 0);
  --border: oklch(0.9 0 0);
  --ring: oklch(0.65 0.19 255);
}

.dark {
  --background: oklch(0.12 0 0);
  --foreground: oklch(0.95 0 0);
  --card: oklch(0.15 0 0);
  --card-foreground: oklch(0.95 0 0);
  --muted: oklch(0.2 0 0);
  --muted-foreground: oklch(0.55 0 0);
  --accent: oklch(0.2 0 0);
  --accent-foreground: oklch(0.95 0 0);
  --border: oklch(0.25 0 0);
  --ring: oklch(0.65 0.19 255);
}
```

Use these in Tailwind classes: `bg-[--background]`, `text-[--foreground]`, or define them in `@theme` for first-class utility support.

---

## Cascade Layers

Tailwind v4 uses CSS cascade layers to ensure utility classes always override component styles regardless of source order.

```css
/* Layer order: base < components < utilities */
@layer base {
  /* Reset and element defaults */
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}

@layer components {
  /* Reusable component classes when Tailwind utilities are insufficient */
  .prose-custom { /* ... */ }
}

/* Tailwind utilities are automatically in the highest-priority layer */
```

### When to use @layer components

Use `@layer components` sparingly -- only when a pattern requires classes that Tailwind utilities cannot express (complex selectors, pseudo-element content, multi-property groups that always travel together). Prefer CVA + `cn()` for most component styling.

---

## Common Patterns

### Polymorphic component with CVA

```tsx
type PolymorphicProps<E extends React.ElementType> = VariantProps<typeof textVariants> & {
  as?: E;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<E>, "as" | "className" | "children">;

const textVariants = cva("", {
  variants: {
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    color: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      destructive: "text-destructive",
    },
  },
  defaultVariants: { size: "base", weight: "normal", color: "default" },
});

function Text<E extends React.ElementType = "p">({
  as,
  size,
  weight,
  color,
  className,
  ...props
}: PolymorphicProps<E>) {
  const Comp = as || "p";
  return <Comp className={cn(textVariants({ size, weight, color }), className)} {...props} />;
}

// Usage
<Text as="h2" size="xl" weight="bold">Heading</Text>
<Text as="span" size="sm" color="muted">Caption</Text>
```

### Responsive dialog (drawer on mobile, dialog on desktop)

```tsx
import * as Dialog from "@radix-ui/react-dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Drawer } from "vaul";

function ResponsiveDialog({ children, ...props }: Dialog.DialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <Dialog.Root {...props}>{children}</Dialog.Root>;
  }

  return <Drawer.Root {...props}>{children}</Drawer.Root>;
}
```

### Icon button with tooltip

```tsx
import * as Tooltip from "@radix-ui/react-tooltip";

function IconButton({
  icon: Icon,
  label,
  ...props
}: { icon: React.ComponentType<{ className?: string }>; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-md",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
            aria-label={label}
            {...props}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content
          className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          sideOffset={5}
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
```
