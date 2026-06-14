---
name: resume-session
description: Load previous context from handoffs and ledger. Use when starting a new session or returning after a break.
effort: low
---

# /resume-session

Load context from previous session for seamless continuation.

## When to Use
- Starting a new Claude session
- Returning after a break
- Picking up interrupted work
- When context was cleared

## Auto-resume (since ctk 2.4.0)

Most resume scenarios are handled automatically. The `pre-compact-saver` lifecycle hook writes `.claude/continuity/handoffs/handoff-latest.json` on every compaction, and the `session-loader` hook surfaces a compact summary of it via `additionalContext` at the start of every new session. The summary includes branch, dirty file count, open MRs, next steps, and blockers.

You still want this skill when:
- The auto-loaded summary is not enough (e.g., you need the full Activity Log from a YAML handoff)
- You're picking up from a handoff written days ago, not the immediate previous compaction
- You want to inspect a specific named handoff, not the latest

If the auto-loaded summary already covered what you need, skip this skill.

## Execution Steps

### Step 1: Find Latest Handoff

```
Glob: .claude/continuity/handoffs/*.yaml
Sort: By date prefix in filename (newest first)
Select: Most recent file
Filename format: YYYY-MM-DD_topic-name.yaml
```

### Step 2: Read All Context Sources

Read these files (skip any that don't exist):

1. **Latest handoff** (from Step 1)
2. **Project ledger**: `.claude/continuity/ledgers/CONTINUITY_*.md` (glob for first match)
3. **Shared context**: `.claude/context/shared-context.json`

### Step 3: Synthesize Context Summary

**From Handoff:**
- What was accomplished last session
- Recommended first task (look for `recommended_first: true` in pending)
- Blockers and issues
- Key decisions and context

**From Ledger:**
- Current project state (Current State > Now section)
- Key decisions (recent, with reasoning)
- Open questions (blocking and non-blocking)
- Next steps (Current State > Next section)

**From shared-context.json:**
- Codebase patterns
- Recent agent decisions
- Dirty tracking state

### Step 4: Present Unified Summary

```markdown
## Session Resumption Summary

### Last Session (from handoff)
- **Date**: [handoff date]
- **Topic**: [session topic]
- **Accomplished**: [summary of accomplished items]
- **Blockers**: [any blockers, or "None"]

### Current State (from ledger)
- **Active Work**: [current focus from Now section]
- **Key Decisions**: [recent decisions]
- **Open Questions**: [blocking questions]

### Recommended Actions
1. [First priority - recommended_first from handoff]
2. [Second priority]
3. [Third priority]
```

## When No Handoff Exists

If no `.yaml` files found in handoffs/:
1. Read ledger only + shared-context.json
2. Present available context from ledger
3. Note: "No handoff found - using ledger and context only"

## Comparison with Built-in /recap

CC v2.1.108+ includes a built-in `/recap` command for lightweight session context restoration. Key differences:

| Feature | `/resume-session` | `/recap` |
|---------|-------------------|----------|
| Cross-session persistence | Yes (handoffs + ledger files) | No (in-session only) |
| Multi-source synthesis | Handoff + ledger + shared-context.json | Conversation history summary |
| Prioritized next steps | Yes (recommended_first from handoff) | No |
| Manual control | Full (save-state / create-handoff cycle) | Automatic |

Use `/recap` for quick in-session context refresh. Use `/resume-session` when starting a new session that needs full project state from previous work.

## Related
- See `/continuity-management` for full system documentation
