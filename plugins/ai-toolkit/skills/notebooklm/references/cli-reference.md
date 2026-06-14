# NotebookLM CLI Reference

## Table of Contents
- [Global Flags](#global-flags)
- [Authentication](#authentication)
- [Notebooks](#notebooks)
- [Sources](#sources)
- [Chat](#chat)
- [Generation](#generation)
- [Downloads](#downloads)
- [Artifacts](#artifacts)
- [Research](#research)
- [Sharing](#sharing)
- [Notes](#notes)
- [Configuration](#configuration)

## Global Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--json` | | Output structured JSON |
| `--notebook <id>` | `-n` | Explicit notebook ID (required for multi-agent) |
| `--language <code>` | | Override language for generation |
| `--source <id>` | `-s` | Filter to specific source(s) |
| `--retry <N>` | | Retry count for wait operations |
| `--wait` | | Block until operation completes |
| `--version` | | Show CLI version |

## Authentication

```bash
notebooklm login               # Browser-based Google OAuth
notebooklm auth check           # Quick auth status
notebooklm auth check --test    # Full validation with network test
```

## Notebooks

```bash
notebooklm create "Name"        # Create notebook, returns ID
notebooklm list                  # List all notebooks
notebooklm use <id>              # Set default notebook context
notebooklm status                # Show current notebook context
notebooklm metadata              # Notebook metadata
notebooklm metadata --json       # Structured metadata output
notebooklm delete <id>           # Delete notebook (destructive)
```

## Sources

```bash
notebooklm source add "<url>"                    # Add URL
notebooklm source add "./file.pdf"               # Add local file
notebooklm source add "https://youtube.com/..."  # Add YouTube
notebooklm source add "https://drive.google.com/..." # Add Drive doc
notebooklm source list                           # List sources
notebooklm source list --json                    # JSON source list
notebooklm source wait                           # Wait for processing
notebooklm source fulltext <source_id>           # Get source full text
notebooklm source guide <source_id>              # Source study guide
notebooklm source delete <source_id>             # Delete source
notebooklm source delete-by-title "title"        # Delete by title match
```

## Chat

```bash
notebooklm ask "question"                        # Ask notebook
notebooklm ask "question" --json                 # JSON response with citations
notebooklm ask "question" -s <source_id>         # Scope to specific source
notebooklm history                               # Conversation history
```

## Generation

All support `--wait` and `--language <code>`.

### Audio

```bash
notebooklm generate audio                        # Default deep-dive
notebooklm generate audio "custom instructions"  # With instructions
notebooklm generate audio --format brief          # brief|deep-dive|critique|debate
notebooklm generate audio --length short          # short|medium|long
notebooklm generate audio --wait                  # Block until complete
```

### Video

```bash
notebooklm generate video                         # Default style
notebooklm generate video --style whiteboard      # 9 styles available
notebooklm generate video --format explainer       # explainer|brief|cinematic
notebooklm generate cinematic-video "prompt"       # Cinematic shorthand
```

**Video styles**: classic, whiteboard, kawaii, anime, sci-fi, nature, urban, abstract, minimal.

### Slide Decks

```bash
notebooklm generate slide-deck                    # Default
notebooklm generate slide-deck --mode detailed    # detailed|presenter
notebooklm generate slide-deck --length short     # Control slide count
```

### Reports

```bash
notebooklm generate report                        # Default template
notebooklm generate report --template briefing-doc
notebooklm generate report --template study-guide
notebooklm generate report --template blog-post
```

### Quizzes & Flashcards

```bash
notebooklm generate quiz --difficulty hard         # easy|medium|hard
notebooklm generate quiz --quantity more           # fewer|default|more
notebooklm generate flashcards --difficulty medium
notebooklm generate flashcards --quantity more
```

### Infographics

```bash
notebooklm generate infographic                    # Default
notebooklm generate infographic --orientation portrait  # landscape|portrait|square
notebooklm generate infographic --detail high      # low|medium|high
```

### Mind Maps & Data Tables

```bash
notebooklm generate mind-map                      # Interactive hierarchy
notebooklm generate data-table "instructions"     # Natural language spec
```

## Downloads

```bash
notebooklm download audio ./output.mp3
notebooklm download video ./output.mp4
notebooklm download slide-deck ./output.pdf
notebooklm download slide-deck ./output.pptx       # Editable format
notebooklm download infographic ./output.png
notebooklm download mind-map ./output.json
notebooklm download data-table ./output.csv
notebooklm download quiz --format json ./quiz.json
notebooklm download quiz --format markdown ./quiz.md
notebooklm download quiz --format html ./quiz.html
notebooklm download flashcards --format json ./cards.json
notebooklm download report ./report.md
```

## Artifacts

```bash
notebooklm artifact list                           # List generated artifacts
notebooklm artifact wait <task_id>                 # Wait for specific artifact
```

## Research

```bash
notebooklm source add-research "query"             # Fast web/Drive search
notebooklm source add-research "query" --deep      # Deep research mode
```

Automatically searches and imports relevant sources into the current notebook.

## Sharing

```bash
notebooklm share status                            # Current sharing settings
notebooklm share enable                            # Enable public link
notebooklm share disable                           # Disable sharing
notebooklm share add <email> --role editor         # Add user (viewer|editor)
notebooklm share remove <email>                    # Remove user access
```

## Notes

```bash
notebooklm note list                               # List saved notes
notebooklm note add "content"                      # Create note
notebooklm note delete <note_id>                   # Delete note
```

## Configuration

```bash
notebooklm language list                           # List 80+ languages
notebooklm language get                            # Current language
notebooklm language set <code>                     # Set language (e.g., en, zh_Hans, ja)
notebooklm skill install                           # Install skill for AI agents
notebooklm skill status                            # Check skill installation
```
