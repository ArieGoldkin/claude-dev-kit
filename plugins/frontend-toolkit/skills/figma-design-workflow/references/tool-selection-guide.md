# Tool Selection Guide

Decision tree for selecting the right Figma MCP tool.

## Table of Contents

- [Decision Tree](#decision-tree)
- [Tool Details](#tool-details)
  - [get_design_context (Primary Tool)](#get_design_context-primary-tool)
  - [get_screenshot](#get_screenshot)
  - [get_metadata](#get_metadata)
  - [get_variable_defs](#get_variable_defs)
  - [add_code_connect_map](#add_code_connect_map)
  - [get_code_connect_map](#get_code_connect_map)
  - [generate_diagram](#generate_diagram)
  - [get_figjam](#get_figjam)
  - [whoami](#whoami)

## Decision Tree

```
What do you need?
│
├─ Code/implementation from design
│   └─ get_design_context (PRIMARY - start here)
│
├─ Visual reference/screenshot
│   └─ get_screenshot
│
├─ Understand structure before implementation
│   └─ get_metadata (returns XML of node hierarchy)
│
├─ Design tokens (colors, spacing, typography)
│   └─ get_variable_defs
│
├─ Link existing code to Figma component
│   └─ add_code_connect_map
│
├─ Check existing code-to-Figma mappings
│   └─ get_code_connect_map
│
├─ Work with FigJam board (not Figma design)
│   └─ get_figjam
│
├─ Create new diagram (flowchart, sequence, etc.)
│   └─ generate_diagram
│
└─ Debug authentication issues
    └─ whoami
```

## Tool Details

### get_design_context (Primary Tool)

**Use when:** Implementing a Figma design in code

**Returns:** Generated code + asset download URLs

**Parameters:**
- `fileKey` (required): From URL
- `nodeId` (required): From URL (use colon format: `1966:17723`)
- `clientLanguages`: e.g., "typescript"
- `clientFrameworks`: e.g., "react"

**Example:**
```typescript
mcp__Figma__get_design_context({
  fileKey: "abc123",
  nodeId: "1966:17723",
  clientLanguages: "typescript",
  clientFrameworks: "react"
})
```

### get_screenshot

**Use when:** Need visual reference, sharing with team, verifying correct node

**Returns:** Image of the specified node

**Parameters:**
- `fileKey` (required)
- `nodeId` (required)

### get_metadata

**Use when:** Understanding structure before deep dive, exploring page hierarchy

**Returns:** XML representation of node structure (IDs, types, names, positions)

**Note:** Only provides overview - use `get_design_context` for actual code

### get_variable_defs

**Use when:** Extracting design tokens for CSS variables

**Returns:** Variable definitions (colors, spacing, etc.) as key-value pairs

**Example output:**
```json
{
  "icon/default/secondary": "#949494",
  "spacing/md": "16px"
}
```

### add_code_connect_map

**Use when:** Linking existing component to Figma for future updates

**Parameters:**
- `fileKey`, `nodeId` (required)
- `source`: Path to component file
- `componentName`: Name in code
- `label`: Framework ("React", "Vue", "SwiftUI", etc.)

### get_code_connect_map

**Use when:** Checking if components are already mapped

**Returns:** Mapping of nodeId to code location and component name

### generate_diagram

**Use when:** Creating NEW diagrams (flowchart, sequence, gantt, state)

**Supports:** Mermaid.js syntax for graph, flowchart, sequenceDiagram, stateDiagram, gantt

**Note:** Returns URL to FigJam board with diagram

### get_figjam

**Use when:** Working with FigJam boards (not Figma design files)

**URL format:** `https://figma.com/board/:fileKey/:fileName?node-id=...`

### whoami

**Use when:** Debugging permission issues

**Returns:** Authenticated user information
