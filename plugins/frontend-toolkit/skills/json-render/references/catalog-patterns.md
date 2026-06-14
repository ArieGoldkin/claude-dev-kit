# Catalog Patterns

## Table of Contents
- [Defining Catalogs](#defining-catalogs)
- [Prop Constraints for AI Safety](#prop-constraints-for-ai-safety)
- [Using the shadcn Catalog](#using-the-shadcn-catalog)
- [Extending the shadcn Catalog](#extending-the-shadcn-catalog)
- [Custom Domain Components](#custom-domain-components)

## Defining Catalogs

Use `defineCatalog()` with Zod schemas. Each component declares its props and whether it accepts children:

```typescript
import { defineCatalog } from '@json-render/core'
import { z } from 'zod'

export const catalog = defineCatalog({
  ComponentName: {
    props: z.object({ /* Zod schema */ }),
    children: true | false,
  },
})
```

## Prop Constraints for AI Safety

Tightly constrain props so AI can only generate valid, safe output:

| Pattern | Good | Bad | Why |
|---------|------|-----|-----|
| Enum values | `z.enum(['sm', 'md', 'lg'])` | `z.string()` | Prevents arbitrary strings |
| Max length | `z.string().max(100)` | `z.string()` | Prevents text walls |
| Bounded arrays | `z.array().max(10)` | `z.array()` | Prevents infinite lists |
| Specific types | `z.number().int().min(0).max(100)` | `z.number()` | Prevents nonsense values |
| Never use | -- | `z.any()`, `z.unknown()` | No validation = no safety |

Rules:
- Every prop MUST have a specific type -- no `z.any()`
- Use `z.enum()` wherever a prop has known valid values
- Set `.max()` on all strings and arrays
- Use `.optional()` for props AI might skip
- Use `.default()` for sensible fallbacks

## Using the shadcn Catalog

`@json-render/shadcn` provides 36 pre-built components. Import and use directly:

```typescript
import { shadcnCatalog, shadcnRegistry } from '@json-render/shadcn'
```

Available components:

| Category | Components |
|----------|------------|
| Layout | Card, Collapsible, Drawer, ScrollArea, Separator, Sheet, Tabs |
| Data Display | Accordion, Alert, Avatar, Badge, Chart, DataTable, Metric, Table, Typography |
| Forms | Checkbox, Form, Input, Label, RadioGroup, Select, Slider, Switch, Textarea, Toggle |
| Navigation | NavigationMenu, Pagination |
| Feedback | Dialog, Popover, Progress, Skeleton, Toast, Tooltip |
| Actions | Button, Calendar |

## Extending the shadcn Catalog

Add custom components alongside shadcn:

```typescript
import { defineCatalog } from '@json-render/core'
import { shadcnCatalog } from '@json-render/shadcn'

export const catalog = defineCatalog({
  ...shadcnCatalog,
  // Custom additions
  MetricCard: {
    props: z.object({
      label: z.string().max(50),
      value: z.string().max(20),
      trend: z.enum(['up', 'down', 'flat']),
      change: z.string().max(10).optional(),
    }),
    children: false,
  },
})
```

When to extend vs use as-is:

| Scenario | Approach |
|----------|----------|
| Standard UIs (forms, tables, navigation) | Use shadcn as-is |
| Domain components (MetricCard, GoalTracker) | Extend the catalog |
| Replacing shadcn behavior | Never -- extend, don't replace |

## Custom Domain Components

For dashboard/monitoring domain:

```typescript
const appCatalog = defineCatalog({
  ...shadcnCatalog,
  ProgressCard: {
    props: z.object({
      title: z.string().max(100),
      current: z.number().min(0),
      target: z.number().min(1),
      unit: z.enum(['steps', 'minutes', 'sessions', 'points']),
    }),
    children: false,
  },
  SessionMetric: {
    props: z.object({
      label: z.string().max(50),
      value: z.string().max(20),
      sparkline: z.array(z.number()).max(30).optional(),
    }),
    children: false,
  },
})
```

Register custom renderers for domain components:

```typescript
import { defineRegistry } from '@json-render/react'
import { shadcnRegistry } from '@json-render/shadcn'

export const registry = defineRegistry({
  ...shadcnRegistry,
  ProgressCard: ({ title, current, target, unit }) => (
    <Card>
      <CardHeader>{title}</CardHeader>
      <CardContent>
        <Progress value={(current / target) * 100} />
        <span>{current} / {target} {unit}</span>
      </CardContent>
    </Card>
  ),
  SessionMetric: ({ label, value, sparkline }) => (
    <div className="flex items-center gap-4">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      {sparkline && <Sparkline data={sparkline} />}
    </div>
  ),
})
```

Checklist for new domain components:
- Define Zod schema with tight constraints
- Register a React renderer in the registry
- Test with `validateSpec()` before deploying
- Document in team catalog reference
