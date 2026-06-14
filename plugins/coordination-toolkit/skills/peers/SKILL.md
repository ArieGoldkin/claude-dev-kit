---
name: peers
description: >
  Show active Claude Code sessions, their branches, file claims, and coordination status.
  Trigger words: peers, who is working, active sessions, file claims, what branches,
  session status, coordination status, who else is here, other sessions.
---

# Peers — Active Session Discovery

Show active Claude Code sessions working on this project, their status, and file claims.

## Usage

```
/peers              # Show all active peers and claims
/peers name "auth"  # Rename this session to "auth" for easier messaging
```

## What It Does

Read `.claude/coordination/peers/` and `.claude/coordination/claims/` to display:

1. **Active Sessions Table**: Each peer's session ID (truncated), branch, worktree (if in a linked git worktree, via `workspace.git_worktree` CC 2.1.97+), status, summary, files being edited, and last heartbeat
2. **Stale Session Warnings**: Peers with heartbeat >60s are flagged as potentially stale
3. **File Claims Table**: All active file claims with path, claimer, and expiry time

## Output Format

See `references/schemas.md` for the full Active Sessions and File Claims table schemas.

Key fields:

- **Status**: `active` (just started), `busy` (editing files), `idle` (TeammateIdle fired)
- **Last Seen**: Time since last heartbeat. >60s means peer may have disconnected.
- **File Claims**: Files locked by a session. Claims expire after 5 minutes of inactivity.

Sessions are auto-named from `branch-shortId` (e.g., `main-a1b2`). Use `/peers name "my-name"` to set a custom name for easier messaging.

## Messaging Between Sessions

To send a message to another session, ask Claude naturally:

> "Send a message to auth-work saying I'm done with the auth module"

Claude will use the coordination system to:
1. Resolve "auth-work" to the session ID via `resolveSessionId()`
2. Send the message via `sendMessage()`
3. The other session receives it on their next prompt (via message-checker hook)

Names are resolved by exact match first, then ID prefix fallback.
