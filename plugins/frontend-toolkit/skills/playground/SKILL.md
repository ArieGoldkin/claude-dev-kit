---
name: playground
description: "Build interactive HTML playgrounds as self-contained single-file explorers. Visual controls, live preview, and prompt copy. Templates for design, data, concept maps, document critique, diff review, code maps, and strategy briefs (roadmaps, option matrices, mermaid diagrams). Use when: creating an interactive explorer, building a visual tool, prototyping with live controls, or presenting a roadmap/strategy doc. Triggers on: playground, explorer, interactive tool, visual builder, live preview, build a playground, HTML explorer, roadmap brief, strategy brief"
effort: low
paths:
  - "**/*.html"
  - "**/*playground*"
  - "**/*explorer*"
---

# Playground Builder

A playground is a self-contained HTML file with interactive controls on one side, a live preview on the other, and a prompt output at the bottom with a copy button. The user adjusts controls, explores visually, then copies the generated prompt back into Claude.

## How to use this skill

1. **Identify the playground type** from the user's request
2. **Load the matching template** from `${CLAUDE_SKILL_DIR}/templates/`:
   - `${CLAUDE_SKILL_DIR}/templates/design-playground.md` — Visual design decisions (components, layouts, spacing, color, typography)
   - `${CLAUDE_SKILL_DIR}/templates/data-explorer.md` — Data and query building (SQL, APIs, pipelines, regex)
   - `${CLAUDE_SKILL_DIR}/templates/concept-map.md` — Learning and exploration (concept maps, knowledge gaps, scope mapping)
   - `${CLAUDE_SKILL_DIR}/templates/document-critique.md` — Document review (suggestions with approve/reject/comment workflow)
   - `${CLAUDE_SKILL_DIR}/templates/diff-review.md` — Code review (git diffs, commits, PRs with line-by-line commenting)
   - `${CLAUDE_SKILL_DIR}/templates/code-map.md` — Codebase architecture (component relationships, data flow, layer diagrams)
   - `${CLAUDE_SKILL_DIR}/templates/strategy-brief.md` — Read-and-decide documents (roadmaps, build-vs-buy, option matrices, migration proposals) with sticky scroll-spy nav, KPI strip, before/after splits, sortable verdict matrix, and mermaid diagrams
3. **Follow the template** to build the playground. If the topic doesn't fit any template cleanly, use the one closest and adapt.
4. **Open in browser.** After writing the HTML file, run `open <filename>.html` to launch it in the user's default browser.

## Core requirements (every playground)

- **Single HTML file.** Inline all CSS and JS. No external dependencies — with ONE exception: strategy briefs may load mermaid from CDN, but MUST include the offline fallback that renders the diagram source when the CDN is unreachable (see the template).
- **Live preview.** Updates instantly on every control change. No "Apply" button.
- **Prompt output.** Natural language, not a value dump. Only mentions non-default choices. Includes enough context to act on without seeing the playground. Updates live. (Strategy briefs are the exception — the brief itself is the deliverable; a prompt output is optional.)
- **Copy button.** Clipboard copy with brief "Copied!" feedback.
- **Sensible defaults + presets.** Looks good on first load. Include 3-5 named presets that snap all controls to a cohesive combination.
- **Dark theme.** System font for UI, monospace for code/values. Minimal chrome.

## Two genres

Control-panel playgrounds (design, data, maps) are **adjust-and-copy** tools: controls on one side, live preview on the other. Strategy briefs are **read-and-decide** documents: a narrative scrolled top-to-bottom where interactivity (sorting, filtering, scroll-spy) serves comprehension. Pick the genre first; it changes the layout, whether a prompt output exists, and the dependency rule above.

## State management pattern

Keep a single state object. Every control writes to it, every render reads from it.

```javascript
const state = { /* all configurable values */ };

function updateAll() {
  renderPreview(); // update the visual
  updatePrompt();  // rebuild the prompt text
}
// Every control calls updateAll() on change
```

## Prompt output pattern

```javascript
function updatePrompt() {
  const parts = [];

  // Only mention non-default values
  if (state.borderRadius !== DEFAULTS.borderRadius) {
    parts.push(`border-radius of ${state.borderRadius}px`);
  }

  // Use qualitative language alongside numbers
  if (state.shadowBlur > 16) parts.push('a pronounced shadow');
  else if (state.shadowBlur > 0) parts.push('a subtle shadow');

  prompt.textContent = `Update the card to use ${parts.join(', ')}.`;
}
```

## Common mistakes to avoid

- Prompt output is just a value dump → write it as a natural instruction
- Too many controls at once → group by concern, hide advanced in a collapsible section
- Preview doesn't update instantly → every control change must trigger immediate re-render
- No defaults or presets → starts empty or broken on load
- External dependencies → if CDN is down, playground is dead
- Prompt lacks context → include enough that it's actionable without the playground
