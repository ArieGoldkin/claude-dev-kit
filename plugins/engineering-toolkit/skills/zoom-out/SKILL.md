---
name: zoom-out
description: Force a higher-abstraction explanation of the current code region — modules, callers, glossary vocab. Use when you're unfamiliar with a section of code, need to understand how it fits into the bigger picture, or say "zoom out", "give me the bigger picture", "I don't know this area", "explain at a higher level". Triggers on zoom-out, bigger picture, higher level, broader context, what does this fit into, map of modules.
disable-model-invocation: true
disallowed-tools:
  - Edit
  - Write
  - NotebookEdit
---

# Zoom Out

I don't know this area of code well. Go up a layer of abstraction. Give me a map of all the relevant modules and callers, using the project's domain vocabulary.

## Output shape

Return one tight block:

- **Module map** — 3-7 modules at the relevant abstraction layer with one-line summaries
- **Caller graph** — upstream (what calls into this region) and downstream (what this region calls)
- **Glossary terms** — domain vocabulary used here, one-line definitions. Source from `CONTEXT.md`, `docs/adr/`, `README`, or other glossary docs if present; otherwise note "no project glossary found".
- **Where this fits** — one sentence on why this region exists

Use names from the project's actual vocabulary, not generic ("OrderRepository" not "data layer").

## Why `disable-model-invocation: true`

Auto-invocation would fire on every "explain this" prompt, polluting normal explanations. This skill is reserved for the explicit "I'm lost, zoom out" intent — user-typed only.

---

Adapted from [`github.com/mattpocock/skills/skills/engineering/zoom-out`](https://github.com/mattpocock/skills/tree/main/skills/engineering/zoom-out) (MIT, 2026-05-19 snapshot). Original by Matt Pocock.
