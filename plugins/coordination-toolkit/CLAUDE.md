# cotk — Coordination Toolkit (Claude Code Plugin)

> **Plugin Name**: cotk (formerly `coordination-toolkit`, renamed in v1.0.0)
> **Version**: 1.0.2
> **Last Updated**: 2026-05-27

## Overview

Multi-session peer coordination toolkit for Claude Code. Enables sessions to discover each other, claim files to prevent conflicts, coordinate work through a filesystem-based registry, and communicate via an opt-in real-time messaging bridge.

**Complementary to ctk**: Install ctk for shared hooks (security, permissions, lifecycle). This plugin adds coordination-specific hooks only — no duplication.

## Skills (4)

| Skill | Description |
|-------|-------------|
| `peers` | Show active sessions, branches, file claims, and coordination status |
| `coordinate` | Distribute tasks across peer sessions with shared task board |
| `bridge-listen` | Enter listener mode to receive and act on peer messages in real-time |
| `setup-bridge` | Enable real-time inter-session messaging bridge (opt-in) |

## Agents

(None yet — planned for Phase 2)

## Commands (4)

| Command | Description |
|---------|-------------|
| `/peers` | Show active Claude Code sessions and file claims |
| `/coordinate` | Distribute tasks across peer sessions with shared task board |
| `/bridge-listen` | Enter listener mode for peer messages |
| `/setup-bridge` | Enable real-time messaging bridge |

## Hooks (9 registrations across 8 event types)

| Hook | Event | Matcher | Purpose |
|------|-------|---------|---------|
| peer-register | SessionStart | — | Register this session as a peer |
| peer-deregister | SessionEnd | — | Deregister peer and release claims |
| peer-deregister | Stop | — | Cleanup on session stop |
| peer-deregister | StopFailure | — | Cleanup on session crash |
| conflict-detector | PreToolUse | Write\|Edit\|MultiEdit | Warn on file conflicts, auto-claim files |
| peer-announcer | PostToolUse | Write\|Edit\|MultiEdit | Update peer's files_editing list |
| bridge-message-checker | PostToolUse | (all) | Check for unread messages (throttled, opt-in via bridge) |
| message-checker | UserPromptSubmit | — | Check for unread peer messages on prompt |
| notification-handler | Notification | — | Handle Notification events for messaging bridge |

## Coordination Directory Structure

```
.claude/coordination/
├── peers/              # One JSON file per active session
│   ├── {session-id}.json
│   └── ...
├── claims/             # One JSON file per claimed file
│   ├── {path-hash}.json
│   └── ...
├── tasks/              # Shared task board (JSON files)
├── messages/           # Inter-session messages (JSON files)
└── outbox/             # Message audit logs (when bridge enabled)
```

### Peer JSON Schema

```json
{
  "id": "session-id",
  "pid": 12345,
  "cwd": "/project/root",
  "branch": "feat/my-feature",
  "started_at": "2026-04-05T00:00:00Z",
  "last_heartbeat": "2026-04-05T00:01:00Z",
  "status": "active|busy|idle",
  "summary": "what the session is working on",
  "files_editing": ["src/foo.ts", "src/bar.ts"]
}
```

### Claim JSON Schema

```json
{
  "file_path": "src/foo.ts",
  "claimed_by": "session-id",
  "claimed_at": "2026-04-05T00:00:00Z",
  "expires_at": "2026-04-05T00:05:00Z"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COORDINATION_LOG_LEVEL` | `warn` | Log level: debug\|info\|warn\|error |
| `CLAUDE_PROJECT_DIR` | cwd | Project root directory |
| `CLAUDE_SESSION_ID` | — | Current session identifier |
| `CLAUDE_PLUGIN_ROOT` | — | Plugin installation root (set by Claude Code) |

## Development

```bash
cd hooks && npm install
cd hooks && npm run build
cd hooks && npm run typecheck
cd hooks && npm test -- --run
cd hooks && npm run lint
```
