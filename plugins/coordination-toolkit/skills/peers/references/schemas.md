# Coordination Toolkit Data Schemas

Reference for the JSON data structures used by the coordination-toolkit plugin.

---

## Peer Schema

Stored in: `.claude/coordination/peers/<session-id>.json`

Represents an active Claude Code session participating in coordination.

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
  "files_editing": ["src/foo.ts", "src/bar.ts"],
  "name": "branch-shortId"
}
```

**Fields:**
- `id` — Unique session identifier
- `pid` — OS process ID (used for liveness checks / garbage collection)
- `cwd` — Working directory of the session
- `branch` — Git branch the session is on
- `started_at` — ISO 8601 timestamp when the session registered
- `last_heartbeat` — ISO 8601 timestamp of last heartbeat (used for stale detection)
- `status` — One of: `active` (working normally), `busy` (in a long operation), `idle` (waiting)
- `summary` — Human-readable description of current work
- `files_editing` — List of files currently being edited (relative paths)
- `name` — Display name, typically `branch-shortId`

---

## Claim Schema

Stored in: `.claude/coordination/claims/<file-path-hash>.json`

Represents an exclusive file claim to prevent edit conflicts between sessions.

```json
{
  "file_path": "src/foo.ts",
  "claimed_by": "session-id",
  "claimed_at": "2026-04-05T00:00:00Z",
  "expires_at": "2026-04-05T00:05:00Z"
}
```

**Fields:**
- `file_path` — Relative path of the claimed file
- `claimed_by` — Session ID that holds the claim
- `claimed_at` — ISO 8601 timestamp when the claim was made
- `expires_at` — ISO 8601 timestamp when the claim automatically expires (used for GC)

---

## Task Schema

Stored in: `.claude/coordination/tasks/<task-id>.json`

Represents a distributable unit of work on the shared task board.

```json
{
  "id": "task-001",
  "description": "Implement user auth endpoint",
  "claimed_by": null,
  "status": "open",
  "result": null,
  "created_at": "2026-04-05T00:00:00Z",
  "claimed_at": null,
  "completed_at": null
}
```

**Fields:**
- `id` — Unique task identifier
- `description` — Human-readable description of the task
- `claimed_by` — Session ID that claimed this task, or `null` if unclaimed
- `status` — One of: `open` (available), `claimed` (in progress), `done` (completed), `failed`
- `result` — Task result or error message, `null` until completed
- `created_at` — ISO 8601 timestamp when the task was created
- `claimed_at` — ISO 8601 timestamp when the task was claimed, or `null`
- `completed_at` — ISO 8601 timestamp when the task was completed, or `null`

---

## Message Schema

Stored in: `.claude/coordination/messages/<message-id>.json`

Represents a peer-to-peer message sent via the coordination bridge.

```json
{
  "id": "msg-123",
  "from": "session-id",
  "to": "session-id",
  "content": "message text",
  "timestamp": "2026-04-09T12:00:00Z",
  "read": false,
  "type": "query|response",
  "inReplyTo": null
}
```

**Fields:**
- `id` — Unique message identifier (generated from timestamp + random nonce)
- `from` — Session ID of the sender
- `to` — Session ID of the recipient
- `content` — Message text
- `timestamp` — ISO 8601 timestamp when the message was sent
- `read` — Whether the recipient has read the message (`true`/`false`)
- `type` — One of: `query` (initial question/request), `response` (reply to a query)
- `inReplyTo` — ID of the original message this is replying to, or `null` for initial messages
