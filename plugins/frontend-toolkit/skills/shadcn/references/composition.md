# Component Composition

## Table of Contents
- [Items inside Groups](#items-inside-groups)
- [Custom triggers](#custom-triggers)
- [Overlay selection](#overlay-selection)
- [Card structure](#card-structure)
- [Required patterns](#required-patterns)
- [Use components over custom markup](#use-components-over-custom-markup)
- [Button loading state](#button-loading-state)

## Items inside Groups

Items stay inside their parent Group components:
- `SelectItem` inside `SelectGroup`
- `DropdownMenuItem` inside `DropdownMenuGroup`
- `ContextMenuItem` inside `ContextMenuGroup`
- `TabsTrigger` inside `TabsList`

## Custom triggers

Use `asChild` (radix) or `render` (base) — don't wrap triggers in extra elements:

```tsx
// Radix
<DialogTrigger asChild>
  <Button>Open</Button>
</DialogTrigger>

// Base
<DialogTrigger render={<Button />}>Open</DialogTrigger>
```

## Overlay selection

| Purpose | Component |
|---------|-----------|
| Focused input task | Dialog |
| Destructive confirmation | AlertDialog |
| Side panel with content | Sheet |
| Mobile-first bottom panel | Drawer |
| Hover preview | HoverCard |
| Click-triggered context | Popover |

Dialog/Sheet/Drawer require accessible Title (`DialogTitle`, `SheetTitle`, `DrawerTitle`).

## Card structure

Use the full composition:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

## Required patterns

- Avatar always needs `AvatarFallback`
- Toast notifications use `sonner` library
- `TabsTrigger` must be inside `TabsList`

## Use components over custom markup

| Instead of | Use |
|-----------|-----|
| Custom callout div | `Alert` |
| Empty state div | `Empty` |
| `<hr>` element | `Separator` |
| Loading placeholder | `Skeleton` |
| Styled span for tags | `Badge` |

## Button loading state

Button has no `isPending` or `isLoading` prop. Compose with Spinner:

```tsx
<Button disabled={isPending}>
  {isPending && <Spinner />}
  Submit
</Button>
```
