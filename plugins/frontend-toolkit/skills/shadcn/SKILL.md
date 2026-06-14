---
name: shadcn
description: "Manage shadcn/ui components \u2014 add, search, style, compose, debug. Covers registries and presets. Triggers on shadcn"
effort: medium
paths:
  - "components.json"
  - "src/components/**"
  - "app/components/**"
keep-coding-instructions: true
---

# shadcn/ui

Framework for building UI with components added as source code via CLI, not as packages. Built on React, TypeScript, Tailwind CSS, and Radix UI or Base UI primitives.

## Prerequisites

Detect project context first:

```bash
npx shadcn@latest info    # Framework, Tailwind version, aliases, base library, installed components
```

Use the project's package runner (`npx`, `pnpm dlx`, or `bunx --bun`) based on lockfile.

## Core Principles

1. **Search before building** — `npx shadcn@latest search @shadcn -q "sidebar"` before custom code
2. **Compose from existing** — combine Tabs + Card + form controls, don't build monolithic components
3. **Use built-in variants** — `variant="outline"`, `size="sm"` before custom styling
4. **Semantic colors** — `bg-primary`, `text-muted-foreground`, never raw color values

## Essential Workflow

1. Check installed components: `npx shadcn@latest info`
2. Search registries: `npx shadcn@latest search @shadcn -q "query"`
3. Fetch docs: `npx shadcn@latest docs <component>` (returns URLs — fetch them)
4. Preview: `npx shadcn@latest add <component> --dry-run`
5. Install: `npx shadcn@latest add <component>`
6. Verify added files comply with rules below

## Critical Rules

### Styling

- `className` for layout only (max-w, mx-auto, mt-4) — not colors/typography
- `gap-*` not `space-x-*` / `space-y-*`
- `size-*` when width equals height
- `cn()` for conditional classes
- Semantic tokens (`bg-primary`) not raw colors (`bg-blue-500`)
- No manual `dark:` overrides — CSS variables handle it
- No manual `z-index` on overlays (Dialog, Sheet, Popover handle their own stacking)

### Forms

- `FieldGroup` + `Field` for layout — never raw div with space-y
- `InputGroup` must contain `InputGroupInput` or `InputGroupTextarea` (not raw Input)
- Buttons inside inputs: `InputGroupAddon` (not absolute positioning)
- 2-7 options: `ToggleGroup` (not Button loop with active state)
- Related checkboxes/radios: `FieldSet` + `FieldLegend`
- Validation: `data-invalid` on Field + `aria-invalid` on control

### Components

- Items inside their Groups (SelectItem in SelectGroup, etc.)
- `asChild` (radix) or `render` (base) for custom triggers
- Dialog/Sheet/Drawer require Title component
- Card: use full Header/Title/Description/Content/Footer structure
- Button has no loading prop — compose with Spinner + disabled
- Avatar always needs AvatarFallback
- TabsTrigger inside TabsList

### Icons

- `data-icon="inline-start"` / `data-icon="inline-end"` on icons in buttons
- No sizing classes on icons inside components (CSS handles it)
- Pass icons as components `icon={CheckIcon}`, not strings

## Component Selection

| Need | Component |
|------|-----------|
| Actions | Button, ToggleGroup |
| Text input | Input, Textarea, InputOTP |
| Selection | Select, Combobox, RadioGroup, Checkbox, Switch |
| Navigation | Tabs, Breadcrumb, Pagination, Sidebar |
| Overlays | Dialog (focused input), AlertDialog (destructive confirm), Sheet (side panel), Drawer (mobile bottom), Popover (click context), HoverCard (hover preview) |
| Feedback | Alert, Badge, Skeleton, Empty, sonner (toast) |
| Layout | Card, Separator, Accordion, Collapsible, Table |
| Data | Chart, DataTable |

## Updating Components

1. `npx shadcn@latest add <component> --dry-run` — preview changes
2. `npx shadcn@latest add <component> --diff <file>` — per-file diff
3. Decide per file: overwrite if no local changes, merge if customized
4. Never use `--overwrite` without explicit user approval

## References

- **CLI reference**: See `${CLAUDE_SKILL_DIR}/references/cli-reference.md`
- **Forms patterns**: See `${CLAUDE_SKILL_DIR}/references/forms.md`
- **Composition patterns**: See `${CLAUDE_SKILL_DIR}/references/composition.md`
- **Styling rules**: See `${CLAUDE_SKILL_DIR}/references/styling.md`
- **Base vs Radix differences**: See `${CLAUDE_SKILL_DIR}/references/base-vs-radix.md`
- **Customization & theming**: See `${CLAUDE_SKILL_DIR}/references/customization.md`
