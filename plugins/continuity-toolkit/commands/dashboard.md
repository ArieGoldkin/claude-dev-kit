---
description: Start the Claude Session Monitor dashboard — live monitoring of tool usage, errors, agents, and session metrics
---

# /dashboard - Live Session Monitor

Start the Claude Session Monitor and open the live dashboard in your browser.

## Prerequisites

The session monitor must be installed:

```bash
cd ~/projects/claude-session-monitor
npm install
```

## What This Command Does

1. Check if the monitor server is already running on port 3117
2. If not running, start it in the background
3. Open the dashboard in your browser at http://localhost:3117
4. The dashboard shows real-time session activity via Server-Sent Events

## Execution Steps

### Step 1: Check if monitor is running

```bash
curl -s http://localhost:3117/api/sessions > /dev/null 2>&1
```

If the above succeeds, the monitor is already running — skip to Step 3.

### Step 2: Start the monitor

```bash
# Find the monitor project
MONITOR_DIR="${CLAUDE_SESSION_MONITOR_DIR:-$HOME/projects/claude-session-monitor}"

if [ ! -f "$MONITOR_DIR/package.json" ]; then
  echo "Claude Session Monitor not found at $MONITOR_DIR"
  echo "Install: git clone <repo-url> $MONITOR_DIR && cd $MONITOR_DIR && npm install"
  exit 0
fi

# Start in background
cd "$MONITOR_DIR" && npx tsx src/cli.ts --no-open &
sleep 2
```

### Step 3: Open dashboard

```bash
open http://localhost:3117
```

### Step 4: Verify connection

The dashboard should show "Connected" in the top-right corner. As you work in Claude Code, events will appear in real-time if HTTP hooks are configured.

## HTTP Hook Configuration

For the monitor to receive events, add HTTP hooks to your project's `.claude/settings.json` or the plugin's `hooks.json`:

```json
{
  "hooks": {
    "PostToolUse": [{ "url": "http://localhost:3117/events", "timeout": 1000 }],
    "SessionStart": [{ "url": "http://localhost:3117/events", "timeout": 1000 }],
    "SessionEnd": [{ "url": "http://localhost:3117/events", "timeout": 1000 }],
    "Stop": [{ "url": "http://localhost:3117/events", "timeout": 1000 }],
    "PostToolUseFailure": [{ "url": "http://localhost:3117/events", "timeout": 1000 }],
    "SubagentStart": [{ "url": "http://localhost:3117/events", "timeout": 1000 }],
    "SubagentStop": [{ "url": "http://localhost:3117/events", "timeout": 1000 }],
    "UserPromptSubmit": [{ "url": "http://localhost:3117/events", "timeout": 1000 }],
    "PreCompact": [{ "url": "http://localhost:3117/events", "timeout": 1000 }]
  }
}
```

Place this in your **user-level** settings (`~/.claude/settings.json`) to monitor all projects, or in a project's `.claude/settings.json` for project-specific monitoring.

## Dashboard Panels

- **KPI Cards** — Active sessions, tool calls, errors, files edited
- **Tool Distribution** — Stacked bar showing tool usage breakdown
- **Live Timeline** — Real-time event feed with colored indicators
- **Active Sessions** — Cards per session with project, model, duration
- **Events Table** — Sortable table of recent events

## Stopping the Monitor

```bash
# Find and kill the process
lsof -ti:3117 | xargs kill
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_SESSION_MONITOR_DIR` | `~/projects/claude-session-monitor` | Monitor project location |
| `CLAUDE_SESSION_MONITOR_PORT` | `3117` | Server port |
