---
name: agent-browser
description: "Headless browser via agent-browser CLI (93% less context than Playwright MCP). Snapshot + refs workflow for scraping and E2E"
effort: medium
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.html"
keep-coding-instructions: true
---

# Browser Automation with agent-browser

Headless browser automation via CLI. **93% less context** than Playwright MCP through Snapshot + Refs workflow. 100% native Rust (v0.20+), 7MB install, 8MB memory, ~617ms cold start.

## Quick Start

```bash
agent-browser navigate <url>      # Navigate to page
agent-browser snapshot -i         # Get interactive elements with refs
agent-browser click @e1           # Click element by ref
agent-browser fill @e2 "text"     # Fill input by ref
agent-browser close               # Close browser
```

## Core Workflow

1. **Navigate**: `agent-browser navigate <url>`
2. **Snapshot**: `agent-browser snapshot -i` (returns elements with refs like @e1, @e2)
3. **Interact** using refs from the snapshot
4. **Re-snapshot** after navigation or significant DOM changes (refs invalidate on DOM change)

Detailed snapshot + refs patterns: [references/snapshot-refs.md](${CLAUDE_SKILL_DIR}/references/snapshot-refs.md)

## Command Categories (Top 10)

| Category | Common Commands | Details |
|----------|----------------|---------|
| Navigation | `navigate`, `back`, `forward`, `reload`, `close` | [commands.md](${CLAUDE_SKILL_DIR}/references/commands.md#navigation) |
| Snapshot | `snapshot -i`, `snapshot -s`, `snapshot -d` | [commands.md](${CLAUDE_SKILL_DIR}/references/commands.md#snapshot) |
| Interaction | `click`, `fill`, `type`, `press`, `select`, `hover` | [commands.md](${CLAUDE_SKILL_DIR}/references/commands.md#interaction) |
| Extraction | `get text`, `get html`, `get value`, `get attribute` | [commands.md](${CLAUDE_SKILL_DIR}/references/commands.md#extraction) |
| Wait | `wait @e1`, `wait --load`, `wait --text`, `wait --url` | [commands.md](${CLAUDE_SKILL_DIR}/references/commands.md#wait) |
| Screenshot | `screenshot`, `screenshot --full`, `screenshot --annotate` | [commands.md](${CLAUDE_SKILL_DIR}/references/commands.md#screenshot) |
| Session/State | `state save`, `state load`, `auth save`, `auth login` | [commands.md](${CLAUDE_SKILL_DIR}/references/commands.md#session-state) |
| Network | `network requests`, `network route`, `network har start` | [commands.md](${CLAUDE_SKILL_DIR}/references/commands.md#network) |
| Batch | `batch` (pipe JSON array via stdin) | [commands.md](${CLAUDE_SKILL_DIR}/references/commands.md#batch) |
| Diff | `diff snapshot`, `diff screenshot`, `diff url` | [commands.md](${CLAUDE_SKILL_DIR}/references/commands.md#diff) |
| ARIA Snapshot Diffing | ARIA tree capture, diffing, regression detection | [aria-snapshot-diffing.md](${CLAUDE_SKILL_DIR}/references/aria-snapshot-diffing.md) |

**Full reference (150+ commands, 33 categories):** [references/commands.md](${CLAUDE_SKILL_DIR}/references/commands.md) — includes keyboard, clipboard, cookies, dialogs, tabs, frames, emulation, stream, profiler, debugging, mouse, semantic find, recording, browser control, and global flags.

## Example: Form Submission

```bash
agent-browser navigate https://example.com/form
agent-browser snapshot -i
# Output: textbox "Email" [ref=e1], textbox "Password" [ref=e2], button "Submit" [ref=e3]

agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --load networkidle
agent-browser snapshot -i  # Check result
```

## Example: Auth with State Persistence

```bash
# Login once and save to encrypted vault
agent-browser navigate https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "$USERNAME"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3
agent-browser wait --url "**/dashboard"
agent-browser auth save myapp

# Later sessions: restore from vault
agent-browser auth login myapp
agent-browser navigate https://app.example.com/dashboard
```

**Detailed auth patterns:** [references/authentication.md](${CLAUDE_SKILL_DIR}/references/authentication.md)

## Example: Batch Commands

Execute multiple commands atomically from stdin:

```bash
echo '[
  {"command": "navigate", "args": ["https://example.com"]},
  {"command": "snapshot", "args": ["-i"]},
  {"command": "screenshot", "args": ["--annotate"]}
]' | agent-browser batch
```

## Example: Annotated Screenshots

Capture screenshots with numbered element overlays for verification:

```bash
agent-browser screenshot --annotate evidence.png
# Creates screenshot with numbered labels on interactive elements
```

## Security Features

- **Content boundaries**: `--content-boundaries` — LLM safety delimiters to prevent prompt injection from page content
- **Domain allowlist**: `--allowed-domains example.com,api.example.com` — restrict navigation
- **Action policies**: `--action-policy policy.json` — restrict allowed actions
- **Encrypted state**: `AGENT_BROWSER_ENCRYPTION_KEY` — AES-256-GCM for saved state files

See [references/security.md](${CLAUDE_SKILL_DIR}/references/security.md) for details.

## Cloud Browser Providers

Run on remote browsers instead of local Chrome:

| Provider | Env Var | Flag |
|----------|---------|------|
| Browserbase | `BROWSERBASE_API_KEY` | `--provider browserbase` |
| Browserless | `BROWSERLESS_API_KEY` | `--provider browserless` |
| Browser Use | `BROWSER_USE_API_KEY` | `--provider browser-use` |
| Kernel | `KERNEL_API_KEY` | `--provider kernel` |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CLI over MCP | Bash commands | Simpler integration, no MCP config needed |
| Snapshot + Refs | @e1, @e2 pattern | 93% context reduction vs Playwright MCP |
| 100% Native Rust | v0.20.0+ architecture | 7MB install, 8MB memory, no Node.js dependency |
| Session isolation | `--session-name` flag | Safe concurrent automation with auto-save/restore |
| Config file | `agent-browser.json` | Persistent per-project settings |

## Related Skills

- `browser-content-capture` — Content extraction patterns using agent-browser
- `cover` (etk) — E2E test generation using agent-browser for discovery + Playwright for codification. For automated ARIA regression testing as part of E2E test pipelines, see Phases 3b and 4b which use ARIA diffing.
