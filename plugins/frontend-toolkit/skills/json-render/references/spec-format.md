# Spec Format

## Table of Contents
- [Structure](#structure)
- [Flat Tree Design](#flat-tree-design)
- [Element Properties](#element-properties)
- [State Management](#state-management)
- [Event Handlers](#event-handlers)
- [Dynamic Expressions](#dynamic-expressions)

## Structure

A spec has three fields:

```json
{
  "root": "element-id",
  "elements": { },
  "state": { }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `root` | string | Yes | ID of the top-level element |
| `elements` | object | Yes | Flat map of ID to element |
| `state` | object | No | Global state tree |

## Flat Tree Design

All elements are top-level siblings referenced by ID -- not nested:

```json
{
  "root": "page",
  "elements": {
    "page": { "type": "Card", "props": { "title": "Dashboard" }, "children": ["m1", "m2"] },
    "m1": { "type": "Metric", "props": { "label": "Users", "value": "1,247" } },
    "m2": { "type": "Metric", "props": { "label": "Revenue", "value": "$48K" } }
  }
}
```

Benefits:

| Benefit | Explanation |
|---------|-------------|
| Streaming | Elements render as soon as their patch arrives |
| Reuse | Same ID referenced by multiple parents |
| Validation | Each element validated independently |
| Patching | Update one element without re-sending the tree |

## Element Properties

Each element has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must match a catalog component name |
| `props` | object | Yes | Validated against Zod schema |
| `children` | string[] | No | Array of child element IDs |
| `on` | object | No | Event handlers |
| `watch` | object | No | Reactive state bindings |

Example with all fields:

```json
{
  "type": "Button",
  "props": { "label": "Save", "variant": "primary" },
  "children": [],
  "on": { "press": { "action": "submit", "target": "/form" } },
  "watch": { "disabled": { "$state": "/form/submitting" } }
}
```

## State Management

Global state tree using JSON Pointer paths:

```json
{
  "state": {
    "user": { "name": "Alice", "theme": "dark" },
    "dashboard": { "selectedTab": "overview" },
    "form": { "email": "", "submitting": false }
  }
}
```

Reference state in props with `$state`:

```json
{
  "type": "Typography",
  "props": {
    "text": { "$template": "Hello, {{state.user.name}}" }
  }
}
```

## Event Handlers

Built-in actions:

| Action | Purpose | Parameters |
|--------|---------|------------|
| `setState` | Update state value | `path`, `value` |
| `load_data` | Fetch remote data | `url`, `target` |
| `submit` | Submit form data | `target`, `method` |
| `navigate` | Change route/view | `to` |
| `toggle` | Toggle boolean state | `path` |

Example:

```json
{
  "type": "Button",
  "props": { "label": "Switch Theme", "variant": "outline" },
  "on": {
    "press": {
      "action": "setState",
      "path": "/user/theme",
      "value": { "$computed": "state.user.theme === 'dark' ? 'light' : 'dark'" }
    }
  }
}
```

Chain multiple actions:

```json
{
  "on": {
    "press": [
      { "action": "setState", "path": "/form/submitting", "value": true },
      { "action": "submit", "target": "/api/save", "method": "POST" },
      { "action": "setState", "path": "/form/submitting", "value": false }
    ]
  }
}
```

## Dynamic Expressions

| Expression | Purpose | Example |
|-----------|---------|---------|
| `$state` | Reference global state | `{ "$state": "/user/name" }` |
| `$computed` | JavaScript expression | `{ "$computed": "state.count * 2" }` |
| `$template` | String interpolation | `{ "$template": "Hello, {{state.user.name}}" }` |
| `$bindState` | Two-way binding | `{ "$bindState": "/form/email" }` |
| `$item` / `$index` | List iteration | `{ "$item": "name" }` |

Two-way binding for form inputs:

```json
{
  "type": "Input",
  "props": {
    "placeholder": "Enter email",
    "value": { "$bindState": "/form/email" }
  }
}
```

Computed values for derived data:

```json
{
  "type": "Typography",
  "props": {
    "text": { "$computed": "`${state.cart.items.length} items, $${state.cart.total}`" }
  }
}
```

List iteration with `$item` and `$index`:

```json
{
  "type": "Table",
  "props": {
    "data": { "$state": "/users" },
    "columns": [
      { "header": "#", "cell": { "$index": true } },
      { "header": "Name", "cell": { "$item": "name" } },
      { "header": "Email", "cell": { "$item": "email" } }
    ]
  }
}
```
