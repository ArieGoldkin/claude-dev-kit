---
name: setup-context-monitor
description: Configure the StatusLine-based context percentage monitor. Use when setting up context window warnings for the first time.
effort: low
---

# /setup-context-monitor

One-time setup to enable proactive context window usage warnings via StatusLine.

## When to Use
- First time enabling context monitoring
- After reinstalling the plugin
- When context warnings aren't appearing
- To verify the monitoring pipeline is working

## What It Does
- Creates stable launcher script at `~/.config/claude/continuity-statusline.sh`
- Configures global StatusLine in `~/.claude/settings.json` (applies to all projects)
- Sets `refreshInterval: 30` for periodic auto-refresh (CC 2.1.97+)
- Launcher auto-discovers the plugin's context-percentage.js via glob pattern
- Verifies context-monitor hook is registered in `hooks.json`
- StatusLine displays model, project, branch, worktree indicator (CC 2.1.97+), context %, cost, and duration
- Context warnings inject at thresholds: 70% advisory, 80% warning, 90% critical
- Warnings only escalate (never repeat at same tier); reset after compaction drops below 70%

## Related
- See `/continuity-management` for full system documentation
