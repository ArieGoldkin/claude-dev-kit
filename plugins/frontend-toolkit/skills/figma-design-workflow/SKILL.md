---
name: figma-design-workflow
description: "Figma MCP workflow \u2014 extract designs, convert to code, Code Connect mappings, design tokens. Triggers on Figma URLs"
effort: medium
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.css"
  - "**/*.figma"
---

# Figma Design Workflow

Select the right Figma MCP tool and follow efficient design-to-code patterns.

## Tool Selection

| Goal | Tool |
|------|------|
| Get code from design | `get_design_context` (primary) |
| Visual reference | `get_screenshot` |
| Explore structure | `get_metadata` |
| Extract design tokens | `get_variable_defs` |
| Map code to Figma | `add_code_connect_map` |
| Check existing mappings | `get_code_connect_map` |
| FigJam boards | `get_figjam` |
| Create diagrams | `generate_diagram` |
| Debug auth | `whoami` |

**For decision tree:** See `${CLAUDE_SKILL_DIR}/references/tool-selection-guide.md`

## URL Parsing

```
https://figma.com/design/:fileKey/:fileName?node-id=:nodeId

Example: https://figma.com/design/abc123/MyDesign?node-id=1966-17723
         fileKey = "abc123"
         nodeId = "1966:17723"  (convert hyphen to colon)
```

**Branch URLs:** Use `branchKey` as fileKey:
```
https://figma.com/design/:fileKey/branch/:branchKey/:fileName
```

## Typical Workflow

1. **Parse URL** → Extract fileKey and nodeId
2. **Screenshot** → `get_screenshot` for visual reference
3. **Design context** → `get_design_context` for code
4. **Variables** → `get_variable_defs` for design tokens
5. **Implement** → Use `prototype-to-production` skill for conversion
6. **Map** → `add_code_connect_map` to link component

## Quick Examples

```typescript
// Get code from design
mcp__Figma__get_design_context({
  fileKey: "abc123",
  nodeId: "1966:17723",
  clientLanguages: "typescript",
  clientFrameworks: "react"
})

// Extract design tokens
mcp__Figma__get_variable_defs({
  fileKey: "abc123",
  nodeId: "1966:17723"
})

// Map component to Figma
mcp__Figma__add_code_connect_map({
  fileKey: "abc123",
  nodeId: "1966:17723",
  source: "src/components/ui/button.tsx",
  componentName: "Button",
  label: "React"
})
```

## Integration

- **`prototype-to-production`**: Pass `get_design_context` output for component decomposition and TypeScript generation
- **`frontend-creative-design`**: Use extracted tokens for creative direction

## References

- `${CLAUDE_SKILL_DIR}/references/tool-selection-guide.md` - Detailed decision tree with examples
- `${CLAUDE_SKILL_DIR}/references/common-patterns.md` - Batch operations, token extraction workflow
