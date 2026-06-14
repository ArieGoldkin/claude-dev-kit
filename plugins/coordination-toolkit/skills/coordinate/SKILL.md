---
name: coordinate
description: >
  Distribute tasks across peer sessions with a shared task board. Claim, work, and report
  results collaboratively. Trigger words: distribute tasks, task board, parallel work,
  claim task, assign work, coordinate sessions, multi-session tasks.
keep-coding-instructions: true
---

# Coordinate — Distributed Task Management

Distribute tasks across multiple Claude Code sessions using a shared filesystem-based task board.

## Usage

```
/coordinate                    # Show task board status
/coordinate add "task desc"    # Add a task to the board
/coordinate claim              # Claim the next unclaimed task
/coordinate done "result"      # Mark current task as done with result
```

## Task Board

Tasks are stored in `.claude/coordination/tasks/` as JSON files. See `references/schemas.md` for the full Task JSON schema.

### Status Values

- `open` -- Available for any session to claim
- `claimed` -- A session is working on it
- `done` -- Completed with a result

## Workflow

### 1. Create Tasks

One session creates the task board:

```
/coordinate add "Fix auth endpoint validation"
/coordinate add "Add rate limiting middleware"
/coordinate add "Write integration tests for /api/users"
```

### 2. Claim Tasks

Each session claims one task at a time:

```
/coordinate claim
```

The skill assigns the next unclaimed task and updates the board.

### 3. Work and Report

After completing the work:

```
/coordinate done "Added Zod validation to all auth endpoints. 12 tests pass."
```

### 4. Monitor Progress

Any session can check the board:

```
/coordinate
```

Shows a summary like `Task Board: 3/5 complete` with a table of all tasks, their status, owner, and result.

## Implementation Notes

Stale claims (>30 min) are auto-released back to `open`. Each session can only claim one task at a time.
