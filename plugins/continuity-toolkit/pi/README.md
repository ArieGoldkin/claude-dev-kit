# Continuity Toolkit — Pi Adapter

Runs the Continuity Toolkit's Claude Code (CC) hook handlers inside the
[Pi coding agent](https://github.com/earendil-works/pi-coding-agent).

It does **not** reimplement the handlers. It spawns the already-built CC runner
(`../hooks/dist/bin/run-hook.js`) as a subprocess per Pi event, translating the
Pi event ⇄ CC JSON protocol. You get 100% handler reuse and the same
process-level safe-fallback guarantees the CC plugin already ships with.

## Install

1. Build the hooks bundle once (the adapter depends on `hooks/dist`):

   ```bash
   cd ../hooks && npm install && npm run build
   ```

2. Point Pi at this extension. Either symlink it into a Pi extension dir:

   ```bash
   ln -s "$(pwd)/.." ~/.pi/agent/extensions/continuity-toolkit
   # Pi loads <dir>/index.ts — so symlink the `pi/` dir itself:
   ln -s "$PWD" ~/.pi/agent/extensions/ctk
   ```

   …or reference it from `~/.pi/agent/settings.json`:

   ```json
   { "extensions": ["/abs/path/to/plugins/continuity-toolkit/pi/index.ts"] }
   ```

3. Or load ad-hoc for a single run:

   ```bash
   pi -e /abs/path/to/plugins/continuity-toolkit/pi/index.ts
   ```

If `hooks/dist` is missing, the adapter degrades gracefully and prints a
one-time warning at session start.

## Event coverage

| CC hook event        | Pi event                  | Handlers run                                                        | Status |
|----------------------|---------------------------|--------------------------------------------------------------------|--------|
| SessionStart         | `session_start`           | `lifecycle/session-loader`                                          | ✅ |
| PreCompact           | `session_before_compact`  | `lifecycle/pre-compact-saver`                                       | ✅ |
| SessionEnd           | `session_shutdown`        | `lifecycle/session-end`                                             | ✅ |
| PreToolUse (block)   | `tool_call`               | `pretool/bash-combined`, `pretool/write-combined`, `pretool/read-cache` | ✅ |
| PostToolUse          | `tool_result`             | `posttool/{secret-detector,error-warner,dirty-state-tracker,lint-checker,read-cache-writer}` | ✅ |
| UserPromptSubmit     | `input`                   | `prompt/context-monitor`                                            | ✅ |

`updatedInput` rewrites from PreToolUse are applied back onto the Pi tool args
in place. Block decisions (`continue:false` or `permissionDecision:"deny"`) map
to Pi's `{ block: true, reason }`.

## Gaps (no Pi host event — not bridged)

These CC features have no equivalent Pi event and are intentionally dropped:

- **PermissionRequest auto-approve** (`auto-approve-safe-bash`,
  `auto-approve-project-writes`, `profile-evaluator`) — Pi gates via
  imperative `ctx.ui.confirm()` inside `tool_call`, not a declarative
  allow/deny/ask protocol.
- **StatusLine context %** — Pi has no statusline-hook API. Context warnings are
  instead injected through the `input` event.
- **Worktree / Task / Teammate / Subagent / Notification / ConfigChange /
  Elicitation** events — Pi multi-agent surface differs; no binding target.
- **MessageDisplay PHI redaction** — Pi's `message_end` rewrites stored history
  rather than filtering rendered output; different semantics, left out by default.

## Tool-name / field translation

| Pi tool | CC tool | Field mapping |
|---------|---------|---------------|
| `bash`  | `Bash`  | `command`, `timeout` |
| `read`  | `Read`  | `path` → `file_path` |
| `write` | `Write` | `path` → `file_path`, `content` |
| `edit`  | `Edit`  | `path` → `file_path`, `edits[].oldText/newText` → `old_string/new_string` (+ `edits[]`) |

## Notes on the context-injection difference

CC's `UserPromptSubmit` can inject `additionalContext` invisibly (model sees it,
user doesn't). Pi's `input` event has no invisible channel, so the adapter
appends the guidance as a visible bracketed `[continuity] …` note via a
`transform`. If you need true invisibility, move the injection to a
`before_provider_request` handler instead.
