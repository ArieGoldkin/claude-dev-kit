---
description: Load previous context from handoffs and ledger. Use when starting a new session or returning after a break.
---

# /resume-session - Load Previous Context

Load context from previous session for seamless continuation.

## When to Use

- Starting a new Claude session
- Returning after a break
- Picking up interrupted work
- When context was cleared

## What This Command Does

1. **Find latest handoff**: Locate most recent handoff file
2. **Read ledger**: Get current project state
3. **Read context**: Load shared-context.json
4. **Summarize for Claude**: Present unified context

## Execution Steps

### Step 1: Find Latest Handoff

```
List: .claude/continuity/handoffs/*.yaml
Sort: By date (newest first)
Select: Most recent file
```

### Step 2: Read All Context Sources

```
Read: Latest handoff file
Read the project ledger in .claude/continuity/ledgers/
LEDGER=$(ls .claude/continuity/ledgers/CONTINUITY_*.md | head -1)
Read: .claude/context/shared-context.json
```

### Step 3: Synthesize Context Summary

Present to Claude (and user):

**From Handoff:**
- What was accomplished last session
- Recommended first task
- Blockers and issues
- Key context

**From Ledger:**
- Current project state
- Key decisions
- Open questions
- Next steps

**From shared-context.json:**
- Codebase patterns
- Recent agent decisions
- Pending tasks

### Step 4: Present Unified Summary

Format:

```markdown
## Session Resumption Summary

### Last Session (from handoff)
- **Date**: [handoff date]
- **Topic**: [session topic]
- **Accomplished**: [summary]
- **Blockers**: [any blockers]

### Current State (from ledger)
- **Active Work**: [current focus]
- **Key Decisions**: [recent decisions]
- **Open Questions**: [blocking questions]

### Recommended Actions
1. [First priority from handoff]
2. [Second priority]
3. [Third priority]

### Codebase Context
- **Patterns**: [established patterns]
- **Tech Stack**: [key technologies]
```

## Output

After loading context:
- Summary displayed
- Claude has full context
- Ready to continue work

## Example Usage

User: /resume-session

Claude:
1. Finds latest handoff: `2026-01-07_continuity-implementation.yaml`
2. Reads ledger and context
3. Presents summary:
   - "Last session: Implemented continuity system"
   - "Recommended next: Test commands"
   - "No blockers"
4. Ready to continue

## When No Handoff Exists

If no handoff files found:
1. Read ledger only
2. Read shared-context.json
3. Present available context
4. Note: "No handoff found - using ledger and context only"
