# MCP Integration

## Overview

`@json-render/mcp` serves interactive UIs as MCP Apps inside Claude, Cursor, and other MCP-compatible clients. UIs render directly in chat conversations.

## Setup

```bash
npm install @json-render/mcp @json-render/core @modelcontextprotocol/sdk zod
```

## Server

```typescript
import { createMcpApp } from '@json-render/mcp'
import { catalog, registry } from './catalog'

const app = createMcpApp({
  name: 'session-dashboard',
  catalog,
  registry,
})

app.listen({ transport: 'stdio' })
```

## Claude Desktop / Cursor Configuration

```json
{
  "mcpServers": {
    "session-dashboard": {
      "command": "node",
      "args": ["./mcp-server.js", "--stdio"]
    }
  }
}
```

## Advanced: Register on Existing Server

Add json-render to an existing MCP server:

```typescript
import { registerJsonRenderTool, registerJsonRenderResource } from '@json-render/mcp'

registerJsonRenderTool(existingServer, { catalog, registry })
registerJsonRenderResource(existingServer, { catalog, registry })
```

## Client-Side (for custom MCP hosts)

```typescript
import { useJsonRenderApp } from '@json-render/mcp/app'

function McpUI() {
  const { spec, isConnected } = useJsonRenderApp()
  if (!isConnected) return <Connecting />
  return <Renderer spec={spec} registry={registry} />
}
```

## Use Cases

| Use Case | Implementation |
|----------|---------------|
| Interactive dashboards in Claude | `createMcpApp` with analytics catalog |
| Data exploration in Cursor | Register tool on existing MCP server |
| Session monitor in Claude | Stream session metrics as json-render spec |
| Admin panels | Full CRUD with state management + event handlers |
