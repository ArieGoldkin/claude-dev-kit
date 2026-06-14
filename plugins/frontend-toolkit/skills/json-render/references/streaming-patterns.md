# Streaming Patterns

## Table of Contents
- [JSON Patch Streaming](#json-patch-streaming)
- [SSE Server Implementation](#sse-server-implementation)
- [React Client Hook](#react-client-hook)
- [Hono SSE Endpoint](#hono-sse-endpoint)
- [Inline Chat Mode](#inline-chat-mode)

## JSON Patch Streaming

Specs stream as JSON Patch operations (RFC 6902) over JSONL. Each line is one operation:

```jsonl
{"op":"add","path":"/root","value":"card-1"}
{"op":"add","path":"/elements/card-1","value":{"type":"Card","props":{"title":"Dashboard"},"children":[]}}
{"op":"add","path":"/elements/metric-1","value":{"type":"Metric","props":{"label":"Revenue","value":"$48K"}}}
{"op":"add","path":"/elements/card-1/children/-","value":"metric-1"}
```

Elements render as soon as their props are complete -- no waiting for the full spec.

Supported operations:

| Operation | Purpose | Example |
|-----------|---------|---------|
| `add` | Add new element or prop | `{"op":"add","path":"/elements/btn-1","value":{...}}` |
| `replace` | Update existing prop | `{"op":"replace","path":"/elements/btn-1/props/label","value":"Save"}` |
| `remove` | Delete element | `{"op":"remove","path":"/elements/btn-1"}` |
| `move` | Reparent element | `{"op":"move","from":"/elements/a","path":"/elements/b"}` |

## SSE Server Implementation

Generic Node.js/Express pattern:

```typescript
import { streamSpec } from '@json-render/core'

app.get('/api/generate', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const stream = await streamSpec({
    prompt: req.query.prompt,
    catalog,
    model: 'claude-sonnet-4-6',
  })

  for await (const patch of stream) {
    res.write(`data: ${JSON.stringify(patch)}\n\n`)
  }
  res.end()
})
```

## React Client Hook

```typescript
import { useUIStream } from '@json-render/react'

function Dashboard() {
  const { spec, isStreaming, error } = useUIStream('/api/generate', {
    prompt: 'Build a session analytics dashboard',
    catalog,
  })

  if (error) return <ErrorDisplay error={error} />
  return (
    <div>
      {isStreaming && <StreamingIndicator />}
      <Renderer spec={spec} registry={registry} />
    </div>
  )
}
```

Hook options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prompt` | string | Required | Generation prompt |
| `catalog` | Catalog | Required | Component catalog for validation |
| `onPatch` | function | -- | Callback per patch |
| `onComplete` | function | -- | Callback when stream ends |
| `onError` | function | -- | Error handler |

## Hono SSE Endpoint

For Hono-based servers (e.g., session monitor):

```typescript
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

const app = new Hono()

app.get('/api/dashboard/generate', async (c) => {
  const prompt = c.req.query('prompt')
  return streamSSE(c, async (stream) => {
    const patches = await streamSpec({ prompt, catalog, model: 'claude-sonnet-4-6' })
    for await (const patch of patches) {
      await stream.writeSSE({ data: JSON.stringify(patch) })
    }
  })
})
```

## Inline Chat Mode

For conversational UIs where AI interleaves prose with UI patches:

```typescript
import { pipeJsonRender } from '@json-render/core'

const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message }),
})
const { text, spec } = await pipeJsonRender(response.body, catalog)
// text = prose portions, spec = accumulated UI spec
```

Two modes:

| Mode | Output | Use Case |
|------|--------|----------|
| Standalone | Pure JSONL patches | Dashboards, tools, data views |
| Inline | Prose interleaved with patches | Chat interfaces, explanations |

Inline mode example:

```typescript
function ChatUI() {
  const { messages, streamMessage } = useChat()

  const handleSend = async (input: string) => {
    const response = await streamMessage(input)
    // Each message may contain both text and a UI spec
    // Renderer handles both automatically
  }

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.text && <p>{msg.text}</p>}
          {msg.spec && <Renderer spec={msg.spec} registry={registry} />}
        </div>
      ))}
    </div>
  )
}
```
