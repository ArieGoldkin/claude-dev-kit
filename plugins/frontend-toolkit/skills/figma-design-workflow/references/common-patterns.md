# Common Patterns

Frequently used workflows and patterns for Figma-to-code.

## Table of Contents

- [URL Parsing Patterns](#url-parsing-patterns)
  - [Standard Design URL](#standard-design-url)
  - [Branch URL](#branch-url)
  - [Page URL (no specific node)](#page-url-no-specific-node)
- [Design Token Extraction](#design-token-extraction)
  - [Workflow](#workflow)
- [Batch Implementation](#batch-implementation)
  - [Multiple Components from Same File](#multiple-components-from-same-file)
  - [Set Up Code Connect for Existing Components](#set-up-code-connect-for-existing-components)
- [Integration with prototype-to-production](#integration-with-prototype-to-production)
  - [Workflow](#workflow)
- [Troubleshooting](#troubleshooting)
  - [Permission Issues](#permission-issues)
  - [Node Not Found](#node-not-found)
  - [Large Design](#large-design)

## URL Parsing Patterns

### Standard Design URL
```
https://figma.com/design/pqrs/ExampleFile?node-id=1-2

fileKey: "pqrs"
nodeId: "1:2"  (convert hyphen to colon)
```

### Branch URL
```
https://figma.com/design/abc/branch/xyz/FileName?node-id=10-20

fileKey: "xyz"  (use branchKey, not original fileKey)
nodeId: "10:20"
```

### Page URL (no specific node)
```
https://figma.com/design/abc/FileName

fileKey: "abc"
nodeId: Use get_metadata to find specific node IDs
```

## Design Token Extraction

### Workflow

1. Get variables from Figma:
```typescript
mcp__Figma__get_variable_defs({
  fileKey: "abc123",
  nodeId: "1:2"
})
```

2. Map to CSS variables:
```css
:root {
  /* Colors */
  --color-primary: #5dc1bd;
  --color-text: #1a1a1a;

  /* Spacing */
  --spacing-sm: 8px;
  --spacing-md: 16px;

  /* Typography */
  --font-display: "Fraunces", serif;
  --font-ui: "Lexend", sans-serif;
}
```

3. Reference in components:
```scss
.component {
  color: var(--color-primary);
  padding: var(--spacing-md);
  font-family: var(--font-ui);
}
```

## Batch Implementation

### Multiple Components from Same File

```typescript
const fileKey = "abc123";
const components = [
  { nodeId: "1:2", name: "Button" },
  { nodeId: "1:3", name: "Card" },
  { nodeId: "1:4", name: "Header" }
];

// Get design context for each
for (const component of components) {
  mcp__Figma__get_design_context({
    fileKey,
    nodeId: component.nodeId,
    clientLanguages: "typescript",
    clientFrameworks: "react"
  });
}
```

### Set Up Code Connect for Existing Components

```typescript
const mappings = [
  { nodeId: "1:2", source: "src/components/ui/button.tsx", name: "Button" },
  { nodeId: "1:3", source: "src/components/ui/card.tsx", name: "Card" }
];

for (const mapping of mappings) {
  mcp__Figma__add_code_connect_map({
    fileKey: "abc123",
    nodeId: mapping.nodeId,
    source: mapping.source,
    componentName: mapping.name,
    label: "React"
  });
}
```

## Integration with prototype-to-production

### Workflow

1. **Get design context:**
```typescript
const result = mcp__Figma__get_design_context({
  fileKey: "abc123",
  nodeId: "1:2",
  clientLanguages: "typescript",
  clientFrameworks: "react"
});
// Returns: { code: "...", assets: { ... } }
```

2. **Pass to prototype-to-production** for:
   - Component decomposition (atomic design)
   - TypeScript interface generation
   - Accessibility attributes
   - Project tech stack adaptation

3. **Download assets** from returned URLs

4. **Map component** after implementation:
```typescript
mcp__Figma__add_code_connect_map({
  fileKey: "abc123",
  nodeId: "1:2",
  source: "src/components/my-component.tsx",
  componentName: "MyComponent",
  label: "React"
});
```

## Troubleshooting

### Permission Issues
```typescript
// Check authenticated user
mcp__Figma__whoami()
```

### Node Not Found
- Verify nodeId format (use colon: `1:2`, not hyphen: `1-2`)
- Check if node still exists in Figma
- Use `get_metadata` to explore available nodes

### Large Design
- Use `get_metadata` first to understand structure
- Target specific frames/components, not entire pages
- Process in batches if needed
