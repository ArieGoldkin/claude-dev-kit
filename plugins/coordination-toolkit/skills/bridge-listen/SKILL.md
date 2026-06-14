---
name: bridge-listen
description: >
  Enter listener mode -- poll for peer messages and act on them in real-time. For dedicated
  listener sessions. Trigger words: listener mode, listen for messages, dedicated listener,
  monitor session, wait for instructions, bridge listener, message polling.
---

# Bridge Listen

Enter a blocking listener loop that waits for messages from other Claude Code sessions and acts on them. This turns the current session into a **dedicated listener** -- ideal for monitor sessions, coordinator sessions, or any session that should respond to requests from peers.

## Prerequisites

- Bridge must be enabled: run `/setup-bridge` first if `.claude/coordination/.bridge-enabled` doesn't exist
- At least one other peer session should be active (check with `/peers`)

## How It Works

1. Run the polling script which checks for unread messages every 3 seconds (5-minute timeout)
2. When a message arrives, the script outputs the message details and exits
3. Read the message, process the request (execute it, answer the question, etc.)
4. Optionally send a reply
5. Immediately run the polling script again to resume listening

**You MUST keep the loop going.** After processing every message, immediately run the polling script again. Never stop to ask the user what to do -- just process and resume listening.

## Listen Script

Run the polling script to wait for the next message:

```bash
bash ${SKILL_DIR}/scripts/bridge-poll.sh
```

This script polls `.claude/coordination/messages/` for unread messages addressed to this session. When a message arrives, it prints `MESSAGE_RECEIVED` followed by the message JSON and exits. On timeout (300s with no messages), it prints `TIMEOUT` and exits with code 1.

## Processing Messages

When a message arrives, you receive JSON with fields: `id`, `from`, `to`, `content`, `timestamp`, `read`, `type`, `inReplyTo`. See `references/schemas.md` for the full Message JSON schema.

**Process the `content` field as an instruction.** Execute whatever is being asked -- run commands, read files, analyze code, etc. Use your full capabilities.

## Sending Replies

If the message has `type: "query"`, send a reply:

```bash
bash ${SKILL_DIR}/scripts/bridge-reply.sh "<from-session-id>" "Your response here" "<original-message-id>"
```

This writes a response message JSON file to the coordination messages directory.

## Loop Protocol

After processing each message:
1. Report what you did (briefly)
2. Immediately run the listen script again
3. If the listen times out (300s), report and ask the user if they want to continue listening

**Never break the loop unless:**
- The user explicitly asks you to stop
- You encounter an unrecoverable error
- The listen script times out (then ask the user)
