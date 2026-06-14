# Production Patterns

## Table of Contents
- [Codegen: Spec to JSX](#codegen-spec-to-jsx)
- [State Management Adapters](#state-management-adapters)
- [Testing Generated UIs](#testing-generated-uis)
- [Performance Considerations](#performance-considerations)

## Codegen: Spec to JSX

Convert AI-generated specs to reviewable, deterministic production code:

```typescript
import { generateCode } from '@json-render/codegen'

const jsxCode = generateCode(spec, {
  framework: 'react',
  catalog,
  typescript: true,
  prettier: true,
})

// Write to file for code review
fs.writeFileSync('src/components/Dashboard.tsx', jsxCode)
```

When to use codegen vs runtime rendering:

| Criteria | Codegen | Runtime |
|----------|---------|---------|
| PR review required | Yes | No |
| Deterministic rendering | Yes | No |
| Performance-critical | Yes (0ms parse) | No (~5ms parse) |
| Compliance (HIPAA, SOC2) | Yes | No |
| On-the-fly from prompts | No | Yes |
| Rapid iteration | No | Yes |
| Internal tools | Either | Yes |

## State Management Adapters

Connect json-render state to your app's state manager:

### Zustand (recommended for React)

```typescript
import { createJsonRenderStore } from '@json-render/zustand'

const useStore = createJsonRenderStore(initialSpec)

function Dashboard() {
  const spec = useStore((s) => s.spec)
  const dispatch = useStore((s) => s.dispatch)

  return <Renderer spec={spec} registry={registry} onAction={dispatch} />
}
```

### Redux

```typescript
import { createJsonRenderSlice } from '@json-render/redux'

const jsonRenderSlice = createJsonRenderSlice(initialSpec)
// Add to Redux store configuration
```

### Jotai

```typescript
import { specAtom } from '@json-render/jotai'

const dashboardSpec = specAtom(initialSpec)

function Dashboard() {
  const [spec] = useAtom(dashboardSpec)
  return <Renderer spec={spec} registry={registry} />
}
```

## Testing Generated UIs

Validate specs programmatically:

```typescript
import { validateSpec } from '@json-render/core'

const result = validateSpec(spec, catalog)
if (!result.valid) {
  console.error(result.errors)
  // errors: [{ path: '/elements/btn-1/props/variant', message: 'Invalid enum value' }]
}
```

Use agent-browser to verify rendered output:

```bash
# Start app with json-render UI
agent-browser navigate http://localhost:3000/dashboard
agent-browser snapshot -i
# Verify expected components rendered with correct props
```

Unit test pattern:

```typescript
import { validateSpec } from '@json-render/core'
import { render } from '@testing-library/react'
import { Renderer } from '@json-render/react'

describe('Dashboard spec', () => {
  it('passes validation', () => {
    const result = validateSpec(dashboardSpec, catalog)
    expect(result.valid).toBe(true)
  })

  it('renders without errors', () => {
    const { getByText } = render(
      <Renderer spec={dashboardSpec} registry={registry} />
    )
    expect(getByText('Dashboard')).toBeInTheDocument()
  })
})
```

## Performance Considerations

| Approach | Parse Time | Bundle Impact | Best For |
|----------|-----------|---------------|----------|
| Runtime rendering | ~5ms per spec | +45KB (core + react) | Dynamic/internal UIs |
| Codegen to JSX | 0ms (pre-compiled) | 0 additional | Production/external UIs |
| YAML mode | ~8ms parse | +12KB (yaml parser) | One-shot generation |
| Streaming | Progressive | Same as runtime | Real-time dashboards |

Guidelines:
- Use runtime for internal tools and dashboards
- Use codegen for production-facing, compliance-required UIs
- Stream for anything real-time (monitoring, analytics)
- Pre-validate all specs before rendering: `validateSpec(spec, catalog)`
- Memoize registry objects to avoid unnecessary re-renders
- Use `React.memo` on custom registry components
