---
name: setup-bridge
description: >
  Enable the real-time inter-session messaging bridge (opt-in). Creates bridge marker and
  message directories. Trigger words: enable bridge, setup messaging, enable real-time
  messages, configure bridge, inter-session messaging.
---

# Setup Bridge

Enable the real-time messaging bridge for the current project. This is an **opt-in** feature -- without running this command, the bridge PostToolUse hook is a no-op (fast-path exit in the shell wrapper, zero Node overhead).

## Setup

Run the setup script:

```bash
bash ${SKILL_DIR}/scripts/setup-bridge.sh
```

This script:
1. Creates `.claude/coordination/.bridge-enabled` marker file
2. Creates `.claude/coordination/outbox/` directory for message audit logs
3. Ensures `.claude/coordination/messages/` directory exists
4. Adds `.claude/coordination/` to `.gitignore` if not already present

## Verify Hooks

Check that `hooks/dist/bin/run-hook.js` exists. If not, build with:

```bash
cd plugins/coordination-toolkit/hooks && npm run build
```

## Confirm Setup

Report to the user:

> Bridge enabled! Real-time messaging is now active for this project.
>
> **How it works:**
> - Messages from other sessions are delivered within ~3 seconds during active work (via PostToolUse hook)
> - Messages are also checked on every prompt submission (UserPromptSubmit hook)
> - Sent messages are logged in `.claude/coordination/outbox/` for debugging
>
> **Usage:**
> - Ask me to "send a message to [peer-name]" to message another session
> - Run `/peers` to see active sessions
> - Run `/bridge-listen` in a dedicated session to create a listener that waits for instructions
>
> **To disable:** Delete `.claude/coordination/.bridge-enabled`
