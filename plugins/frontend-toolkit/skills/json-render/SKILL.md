---
name: json-render
description: "Generative UI with json-render \u2014 Zod-typed catalogs, flat-tree specs, SSE streaming. Triggers on json-render, generative UI"
effort: low
paths:
  - "**/*render*"
  - "**/*json-render*"
  - "**/*.tsx"
  - "**/*.jsx"
keep-coding-instructions: true
---

# json-render

AI generates UIs from natural language, constrained to developer-defined component catalogs with Zod schemas. Flat-tree JSON specs stream progressively and render across React, React Native, PDF, email, and more.

## Quick Start

```bash
npm install @json-render/core @json-render/react @json-render/shadcn zod
```

## 3-Step Process

### Step 1: Define a Catalog

```typescript
import { defineCatalog } from '@json-render/core'
import { z } from 'zod'

export const catalog = defineCatalog({
  Card: {
    props: z.object({
      title: z.string().max(100),
      description: z.string().max(500).optional(),
    }),
    children: true,
  },
  Metric: {
    props: z.object({
      label: z.string(),
      value: z.string(),
      trend: z.enum(['up', 'down', 'flat']).optional(),
    }),
    children: false,
  },
  Button: {
    props: z.object({
      label: z.string().max(50),
      variant: z.enum(['default', 'destructive', 'outline', 'ghost']),
    }),
    children: false,
  },
})
```

Catalog best practices and prop constraint patterns: `${CLAUDE_SKILL_DIR}/references/catalog-patterns.md`

### Step 2: AI Generates a Spec

The AI outputs a flat-tree JSON spec — all elements as top-level siblings, referenced by ID:

```json
{
  "root": "card-1",
  "elements": {
    "card-1": {
      "type": "Card",
      "props": { "title": "Revenue Dashboard" },
      "children": ["metric-1", "metric-2", "btn-1"]
    },
    "metric-1": {
      "type": "Metric",
      "props": { "label": "Total Revenue", "value": "$48,200", "trend": "up" }
    },
    "metric-2": {
      "type": "Metric",
      "props": { "label": "Active Users", "value": "1,247", "trend": "flat" }
    },
    "btn-1": {
      "type": "Button",
      "props": { "label": "View Details", "variant": "outline" }
    }
  }
}
```

Full spec format (state, events, reactive bindings): `${CLAUDE_SKILL_DIR}/references/spec-format.md`

### Step 3: Render

```tsx
import { Renderer, StateProvider, VisibilityProvider } from '@json-render/react'
import { registry } from './registry'

function App({ spec }) {
  return (
    <StateProvider initialState={{}}>
      <VisibilityProvider>
        <Renderer spec={spec} registry={registry} />
      </VisibilityProvider>
    </StateProvider>
  )
}
```

## Streaming (SSE + JSON Patch)

Stream specs progressively using JSON Patch (RFC 6902). Elements render as soon as their props are complete:

```typescript
import { useUIStream } from '@json-render/react'

function Dashboard() {
  const { spec, isStreaming } = useUIStream('/api/generate', {
    prompt: 'Build a revenue dashboard',
    catalog,
  })
  return <Renderer spec={spec} registry={registry} />
}
```

Server-side (Hono/Express):
```typescript
// Each line is a JSON Patch operation
{"op":"add","path":"/elements/card-1","value":{"type":"Card","props":{"title":"Dashboard"},"children":[]}}
{"op":"add","path":"/elements/metric-1","value":{"type":"Metric","props":{"label":"Revenue","value":"$48K"}}}
{"op":"add","path":"/elements/card-1/children/-","value":"metric-1"}
```

Streaming patterns for SSE and real-time UIs: `${CLAUDE_SKILL_DIR}/references/streaming-patterns.md`

## YAML Mode (30% Token Savings)

For one-shot generation (non-streaming), use YAML for ~30% fewer tokens:

```yaml
root: card-1
elements:
  card-1:
    type: Card
    props:
      title: Revenue Dashboard
    children: [metric-1, btn-1]
  metric-1:
    type: Metric
    props:
      label: Total Revenue
      value: "$48,200"
```

Use JSON for streaming (JSON Patch requires it). Use YAML for one-shot where token cost matters.

## Pre-Built shadcn Catalog

`@json-render/shadcn` provides 36 ready-to-use components (Radix + Tailwind):

```bash
npm install @json-render/shadcn
```

Includes: Accordion, Alert, Avatar, Badge, Button, Calendar, Card, Chart, Checkbox, Collapsible, DataTable, Dialog, Drawer, Form, Input, Label, Metric, NavigationMenu, Pagination, Popover, Progress, RadioGroup, ScrollArea, Select, Separator, Sheet, Skeleton, Slider, Switch, Table, Tabs, Textarea, Toast, Toggle, Tooltip, Typography.

When to extend vs use as-is: `${CLAUDE_SKILL_DIR}/references/catalog-patterns.md`

## Production: Spec to JSX Codegen

Convert AI-generated specs to reviewable, deterministic JSX:

```bash
npm install @json-render/codegen
```

```typescript
import { generateCode } from '@json-render/codegen'

const jsx = generateCode(spec, { framework: 'react', catalog })
// Outputs standard React JSX component file
```

Use for production code that needs review, versioning, and deterministic behavior — not runtime spec interpretation.

Production patterns and state management: `${CLAUDE_SKILL_DIR}/references/production-patterns.md`

## MCP Integration

Serve interactive UIs inside Claude/Cursor conversations:

```typescript
import { createMcpApp } from '@json-render/mcp'

const app = createMcpApp({
  catalog,
  registry,
  name: 'dashboard-app',
})

app.listen({ transport: 'stdio' })
```

MCP setup and use cases: `${CLAUDE_SKILL_DIR}/references/mcp-integration.md`

## Package Ecosystem

| Package | Purpose |
|---------|---------|
| `@json-render/core` | Schemas, catalogs, AI prompts, streaming compiler |
| `@json-render/react` | React renderer + hooks (`useUIStream`, `useChatUI`) |
| `@json-render/shadcn` | 36 pre-built shadcn/ui components |
| `@json-render/yaml` | YAML wire format (30% token savings) |
| `@json-render/codegen` | Spec → production JSX conversion |
| `@json-render/mcp` | MCP protocol for interactive UIs in Claude/Cursor |
| `@json-render/react-native` | 25+ mobile components |
| `@json-render/react-pdf` | PDF generation from specs |
| `@json-render/react-email` | HTML/plain-text email from specs |
| `@json-render/zustand` | Zustand state adapter |

## Related Skills

- `ai-ui-generation` — Decision framework: when to use json-render vs Stitch vs manual components
- `shadcn` — shadcn/ui component patterns (complements `@json-render/shadcn`)
- `design-system-tokens` — Design token management for catalog prop constraints
