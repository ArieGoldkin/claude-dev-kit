# Styling & Tailwind

## Table of Contents
- [Semantic colors](#semantic-colors)
- [Built-in variants first](#built-in-variants-first)
- [className for layout only](#classname-for-layout-only)
- [Spacing](#spacing)
- [Sizing](#sizing)
- [Conditional classes](#conditional-classes)
- [Dark mode](#dark-mode)
- [Overlay z-index](#overlay-z-index)

## Semantic colors

```tsx
// WRONG
<div className="bg-blue-500 text-white">
  <p className="text-gray-600">Secondary</p>
</div>

// CORRECT
<div className="bg-primary text-primary-foreground">
  <p className="text-muted-foreground">Secondary</p>
</div>
```

For status indicators, use Badge variants or `text-destructive` — not raw Tailwind colors:

```tsx
// WRONG
<span className="text-emerald-600">+20.1%</span>

// CORRECT
<Badge variant="secondary">+20.1%</Badge>
```

## Built-in variants first

```tsx
// WRONG
<Button className="border border-input bg-transparent hover:bg-accent">Click</Button>

// CORRECT
<Button variant="outline">Click</Button>
```

Preference order: built-in variants > semantic tokens > CSS variables.

## className for layout only

Use for `max-w-*`, `mx-auto`, `mt-*`, `grid`, `flex` — not for colors or typography.

```tsx
// WRONG
<Card className="bg-blue-100 text-blue-900 font-bold">

// CORRECT
<Card className="max-w-md mx-auto">
```

## Spacing

Use `gap-*` not `space-x-*` / `space-y-*`:

```tsx
// WRONG
<div className="space-y-4">

// CORRECT
<div className="flex flex-col gap-4">
```

## Sizing

Use `size-*` when width equals height: `size-10` not `w-10 h-10`.

Use `truncate` shorthand, not `overflow-hidden text-ellipsis whitespace-nowrap`.

## Conditional classes

Use `cn()` utility:

```tsx
// WRONG
<div className={`flex ${isActive ? "bg-primary" : "bg-muted"}`}>

// CORRECT
import { cn } from "@/lib/utils"
<div className={cn("flex", isActive ? "bg-primary" : "bg-muted")}>
```

## Dark mode

Never use manual `dark:` overrides. Semantic tokens handle light/dark via CSS variables:

```tsx
// WRONG
<div className="bg-white dark:bg-gray-950">

// CORRECT
<div className="bg-background text-foreground">
```

## Overlay z-index

Dialog, Sheet, Drawer, AlertDialog, DropdownMenu, Popover, Tooltip, HoverCard handle their own stacking. Never add `z-50` or `z-[999]`.
