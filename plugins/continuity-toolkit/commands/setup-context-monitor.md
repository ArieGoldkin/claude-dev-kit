---
description: Configure the StatusLine-based context percentage monitor. Use when setting up context window warnings for the first time.
---

# /setup-context-monitor - Configure Context Window Monitoring

One-time setup to enable proactive context window usage warnings. Creates a stable launcher script and configures global settings so context monitoring works across all projects and survives plugin updates.

## When to Use

- First time enabling context monitoring
- After reinstalling the plugin (launcher script should still work)
- When context warnings aren't appearing
- To verify the monitoring pipeline is working

## Prerequisites

- Continuity toolkit plugin installed and hooks compiled (`cd hooks && npm run build`)
- Claude Code v4.1+ (StatusLine support required)

## What This Command Does

1. **Create stable launcher** - Write `~/.config/claude/continuity-statusline.sh` that finds the plugin script via glob
2. **Configure global StatusLine** - Add `statusLine.command` to `~/.claude/settings.json` (applies to ALL projects)
3. **Verify hook** - Confirm context-monitor hook is registered in `hooks.json`
4. **Test pipeline** - Verify temp file appears after a message exchange

## Execution Steps

### Step 1: Create the Stable Launcher Script

Create the directory and launcher script at `~/.config/claude/continuity-statusline.sh`:

```bash
mkdir -p ~/.config/claude
```

**Always overwrite** the launcher (do not skip if it already exists). A pre-existing launcher from an older install may hardcode the legacy `continuity-toolkit` cache path only and silently fail to `[?] unknown` once the plugin is renamed or its old cache is cleaned. Re-running this command must self-heal those installs.

Write the following content to `~/.config/claude/continuity-statusline.sh`:

```bash
#!/bin/bash
# Continuity Toolkit - Context Monitor StatusLine Launcher
# Finds the latest installed version of the plugin's context-percentage.js.
# Matches both `ctk` (current name) and `continuity-toolkit` (legacy name) so
# the launcher stays valid through plugin renames without manual intervention.
script=$(find "$HOME/.claude/plugins/cache" \
  \( -path "*/ctk/*/hooks/dist/src/statusline/context-percentage.js" \
  -o -path "*/continuity-toolkit/*/hooks/dist/src/statusline/context-percentage.js" \) \
  2>/dev/null | sort -V | tail -1)
[ -f "$script" ] && exec node "$script"
echo "[?] unknown"
```

Make it executable:

```bash
chmod +x ~/.config/claude/continuity-statusline.sh
```

### Step 2: Configure Global StatusLine Settings

Read `~/.claude/settings.json` and merge the `statusLine` configuration into it. If the file doesn't exist, create it. If it already has other settings, preserve them and only add/update the `statusLine` key.

The resulting `~/.claude/settings.json` should contain (among any existing keys):

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash ~/.config/claude/continuity-statusline.sh"
  }
}
```

**Important**: Do NOT write to any project's `.claude/settings.local.json`. The global settings file covers all projects automatically.

If a project already has a `statusLine` entry in its `.claude/settings.local.json` from a previous setup, inform the user that it can be removed since the global setting now handles it (project-level settings override global, so it would still work either way).

### Step 3: Verify Hook Registration

Confirm that `hooks/hooks.json` includes the context-monitor in the UserPromptSubmit section. It should already be present after the plugin update.

### Step 4: Test the Pipeline

After configuring:

1. Inform the user they need to restart Claude Code (or start a new session)
2. After restart, send a message and wait for a response
3. Check if the temp file was created:

```bash
ls -la /tmp/claude-context-pct-*.txt
```

4. If the file exists, read its content to see the current percentage:

```bash
cat /tmp/claude-context-pct-*.txt
```

5. The context-monitor hook will automatically inject warnings when the percentage crosses thresholds (70%, 80%, 90%).

## How It Works

```
~/.config/claude/continuity-statusline.sh        (stable launcher, never changes)
       |
       | finds at runtime via glob (matches `ctk` or legacy `continuity-toolkit`):
       v
~/.claude/plugins/cache/*/{ctk,continuity-toolkit}/*/hooks/dist/src/statusline/context-percentage.js
       |
       | node executes the script
       v
Reads stdin JSON --> writes /tmp/claude-context-pct-*.txt --> outputs two-line status:
       |                                                         Line 1: [Opus] my-app | feature/auth
       |                                                         Line 2: ████░░░░░░ 42% | $0.08 | 7m 3s
       |
       v
UserPromptSubmit hook reads temp file --> injects tiered warnings
```

### Warning Tiers

| Percentage | Tier | Message |
|-----------|------|---------|
| < 70% | None | No warning |
| 70-79% | Advisory | "Consider running /create-handoff when at a stopping point." |
| 80-89% | Warning | "Recommend /create-handoff then /clear soon." |
| 90%+ | Critical | "Run /create-handoff NOW, then /clear. Auto-compaction imminent." |

Warnings only escalate (never repeat at the same tier). After compaction drops context below 70%, the cycle resets.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No temp file created | Verify StatusLine is configured and Claude Code version supports it |
| Warnings not appearing | Check `hooks.json` includes context-monitor; rebuild hooks |
| Stale percentage after /clear | Normal - file persists in /tmp; new messages will update it |
| StatusLine shows "[?] unknown" | Plugin script not found; verify plugin is installed and hooks are compiled |
| Permission error on /tmp | Check OS permissions; temp files use session ID naming |
| Previous per-project setup | Remove `statusLine` from project's `.claude/settings.local.json`; global settings handle it |

---
*Part of the ctk context monitoring system*
