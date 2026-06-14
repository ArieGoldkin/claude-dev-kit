---
name: notebooklm
description: Google NotebookLM programmatic access — create notebooks, manage sources (URLs, PDFs, YouTube, Drive), generate audio/video/slides/quizzes, and chat with documents. Triggers on notebooklm, podcast from docs, research notebook.
effort: medium
paths:
  - "**/*notebook*"
  - "**/*notebooklm*"
---

# NotebookLM

Programmatic access to Google NotebookLM via the `notebooklm-py` CLI. Supports notebook management, source ingestion, AI chat, and content generation (audio, video, slides, reports, quizzes, flashcards, infographics, mind maps).

## Prerequisites

Verify installation before any operation:

```bash
notebooklm --version        # Check CLI installed
notebooklm auth check --test # Verify authentication
```

If not installed: see `${CLAUDE_SKILL_DIR}/references/setup-guide.md`.

## Core Workflows

### 1. Create Notebook + Add Sources

```bash
notebooklm create "Project Research"
notebooklm use <notebook_id>
notebooklm source add "https://example.com/article"
notebooklm source add "./document.pdf"
notebooklm source add "https://youtube.com/watch?v=..."
notebooklm source wait    # Block until all sources processed
```

Source types: URLs, PDFs, YouTube, text, Markdown, Word, audio, video, images, Google Drive.

### 2. Chat with Notebook

```bash
notebooklm ask "Summarize the key findings"
notebooklm ask "Compare the approaches in sources 1 and 2" --json
notebooklm history         # View conversation history
```

### 3. Generate Content

All generation commands support `--wait` (block until complete) and `--language` override.

```bash
# Audio podcast (5-20 min generation)
notebooklm generate audio "Make it conversational" --wait

# Video overview (15-45 min generation)
notebooklm generate video --style whiteboard --wait

# Slide deck
notebooklm generate slide-deck --wait

# Report
notebooklm generate report --template briefing-doc --wait

# Quiz / Flashcards
notebooklm generate quiz --difficulty hard --wait
notebooklm generate flashcards --quantity more --wait

# Infographic / Mind map / Data table
notebooklm generate infographic --orientation landscape --wait
notebooklm generate mind-map --wait
notebooklm generate data-table "Compare features" --wait
```

### 4. Download Artifacts

```bash
notebooklm download audio ./podcast.mp3
notebooklm download video ./overview.mp4
notebooklm download slide-deck ./slides.pptx    # Editable PPTX
notebooklm download quiz --format markdown ./quiz.md
notebooklm download flashcards --format json ./cards.json
notebooklm download infographic ./infographic.png
notebooklm download mind-map ./mindmap.json
notebooklm download data-table ./data.csv
```

### 5. Research Agents

```bash
notebooklm source add-research "topic query"           # Fast mode (default)
notebooklm source add-research "topic query" --deep     # Deep research
```

Auto-searches web/Drive and imports relevant sources into the notebook.

## Generation Reference

| Type | Formats | Styles/Options | Output | Time |
|------|---------|---------------|--------|------|
| Audio | deep-dive, brief, critique, debate | 3 lengths, 50+ languages | MP3 | 5-20 min |
| Video | explainer, brief, cinematic | 9 visual styles | MP4 | 15-45 min |
| Slides | detailed, presenter | adjustable length, slide revision | PDF/PPTX | 2-5 min |
| Report | briefing, study-guide, blog-post | custom templates | Markdown | 1-3 min |
| Quiz | configurable quantity | easy/medium/hard | JSON/MD/HTML | 1-2 min |
| Flashcards | configurable quantity | easy/medium/hard | JSON/MD/HTML | 1-2 min |
| Infographic | landscape/portrait/square | 3 detail levels | PNG | 2-5 min |
| Mind Map | sync/instant | hierarchical | JSON | instant-2 min |
| Data Table | natural language spec | custom columns | CSV | 1-2 min |

## CLI Reference

For the complete command reference with all flags and options, see `${CLAUDE_SKILL_DIR}/references/cli-reference.md`.

## Multi-Agent Safety

When running multiple agents concurrently, always pass explicit notebook IDs:

```bash
notebooklm -n <notebook_id> ask "question"
notebooklm -n <notebook_id> generate audio --wait
```

Or isolate with per-agent config directories: `NOTEBOOKLM_HOME=/tmp/agent-1 notebooklm ...`

## Autonomy Guidelines

**No confirmation needed**: `list`, `status`, `auth check`, `source list`, `ask`, `history`, `language list/get`, `metadata`, `artifact list`.

**Confirm with user first**: `delete`, `generate *`, `download *`, `source add`, `share *`.

## Error Handling

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | Success | Continue |
| 1 | Error | Check message, retry if transient |
| 2 | Timeout | Increase `--retry` or check `artifact list` |

Auth failures → re-run `notebooklm login`. Rate limits → wait 5-10 minutes.

## Limitations

- Uses undocumented Google APIs — can break without notice
- Source limits by plan: Standard (50), Plus (100), Pro (300), Ultra (600)
- Not officially affiliated with Google
- Recommended for research/prototyping, not production-critical workflows
