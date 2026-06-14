# Diagram Templates

Copy-paste skeletons for common diagram types. Replace placeholder text with your content.

## Architecture Template

```
+------------------+     +------------------+     +------------------+
|  [LAYER 1 NAME]  |     |  [LAYER 2 NAME]  |     |  [LAYER 3 NAME]  |
|                  |---->|                  |---->|                  |
|  [Technology 1]  |     |  [Technology 2]  |     |  [Technology 3]  |
|  [Technology 2]  |     |  [Technology 3]  |     |  [Technology 4]  |
+------------------+     +------------------+     +------------------+
        |                         |                        |
        v                         v                        v
  [Support Svc 1]          [Support Svc 2]          [Support Svc 3]
```

**Customization:**
- Add/remove columns for more/fewer tiers
- Add rows below for supporting services
- Use `<-->` for bidirectional data flow
- Widen boxes if labels don't fit (keep consistent within row)

## Workflow Template

```
                    +------------------+
                    |  [START EVENT]   |
                    +--------+---------+
                             |
                             v
                    +--------+---------+
                    | [PROCESS STEP]   |
                    +--------+---------+
                             |
                    +--------+---------+
                    | [DECISION?]      |
                    +---+----------+---+
                        |          |
                  [Yes] |          | [No]
                        v          v
              +---------+--+  +----+---------+
              | [PATH A]   |  | [PATH B]     |
              +-----+------+  +----+---------+
                    |              |
                    v              v
              +-----+--------------+------+
              |     [MERGE / END]         |
              +---------------------------+
```

**Customization:**
- Add more decision branches with additional `+---+` boxes
- Nest decisions for complex logic
- Add loop-back arrows with `<--` for retry patterns

## Comparison Table Template

```
+-------------------+----------+----------+----------+
| [CRITERION]       | [OPT A]  | [OPT B]  | [OPT C]  |
+-------------------+----------+----------+----------+
| [Feature 1]       |   [val]  |   [val]  |   [val]  |
| [Feature 2]       |   [val]  |   [val]  |   [val]  |
| [Feature 3]       |   [val]  |   [val]  |   [val]  |
| [Feature 4]       |   [val]  |   [val]  |   [val]  |
| [Feature 5]       |   [val]  |   [val]  |   [val]  |
+-------------------+----------+----------+----------+
  [LEGEND if needed]
```

**Customization:**
- Use Y/N for boolean features
- Use High/Med/Low for qualitative scales
- Add recommendation row at bottom
- Limit to 4-5 columns to stay under 80 chars

## File Tree Template

```
[project-name]/
├── [dir-1]/                       # [annotation]
│   ├── [file-1]                   # [annotation]
│   ├── [file-2]                   # [annotation]
│   └── [dir-1a]/                  # [annotation]
│       ├── [file-3]
│       └── [file-4]
├── [dir-2]/                       # [annotation]
│   └── [file-5]
├── [config-file-1]                # [annotation]
├── [config-file-2]
└── README.md
```

**Customization:**
- Use `├──` for items with siblings below, `└──` for last item
- Collapse unimportant dirs with `...` and a count
- Align `#` annotations at a consistent column
- Show function-level detail when discussing specific code

## Combined System Overview

```
                         [SYSTEM NAME]
    ================================================================

    +-------------+                          +-------------+
    |  [Client]   |--- [protocol] --------->|  [Server]   |
    +------+------+                          +------+------+
           |                                        |
           v                                        v
    +------+------+                          +------+------+
    | [Component] |                          | [Component] |
    +------+------+                          +------+------+
           |                                        |
           v                                        v
    +------+------+     +-------------+      +------+------+
    | [Component] |<--->| [Shared Svc]|<---->| [Component] |
    +-------------+     +-------------+      +-------------+
                               |
                               v
                        +------+------+
                        | [Data Store]|
                        +-------------+

    ================================================================
    Legend:
      ---->  Request flow
      <---->  Bidirectional sync
      [xxx]   Replace with actual names
```

**Customization:**
- Add/remove components as needed
- Use double lines (`====`) for visual section breaks
- Include a legend for non-obvious arrow types
- Add annotations below specific components

## Swimlane Template

```
  [Actor 1]       [Actor 2]       [Actor 3]       [Actor 4]
      |                |                |                |
      |  [action 1]    |                |                |
      |--------------->|                |                |
      |                |  [action 2]    |                |
      |                |--------------->|                |
      |                |                |  [action 3]    |
      |                |                |--------------->|
      |                |                |  [response 3]  |
      |                |                |<---------------|
      |                |  [response 2]  |                |
      |                |<---------------|                |
      |  [response 1]  |                |                |
      |<---------------|                |                |
      |                |                |                |
```

**Customization:**
- Add/remove actor columns as needed
- Use solid arrows (`--->`) for sync calls, dashed (`- ->`) for async
- Add timestamps or step numbers on the left margin
- Show parallel calls with arrows at the same vertical position

## Quick Reference: Box Sizes

Keep boxes consistent. Common widths:

```
Short label (8 chars):    +----------+
                          | [label]  |
                          +----------+

Medium label (16 chars):  +------------------+
                          | [longer label]   |
                          +------------------+

Wide label (24 chars):    +--------------------------+
                          | [very long label here]   |
                          +--------------------------+
```

Choose one width per row and pad all boxes to match.
