---
name: save-state
description: Update project ledger with current state. Use periodically to preserve context before compaction.
effort: low
---

# /save-state

Update the project state ledger with current context using the append-until-handoff model.

## When to Use
- Before context window gets full
- After completing a major milestone
- Before switching to different work
- Periodically during long sessions (every 1-2 hours)

## What It Does
- Reads current context from `.claude/context/shared-context.json`
- Extracts recent decisions, completed tasks, pending work, and blockers
- Appends new entry to Session Activity Log (timestamped, 3-8 bullet points)
- Appends new Key Decisions (never removes existing ones)
- Replaces snapshot sections: Current State, Done (Recent), Next, Open Questions
- Updates ledger timestamp and writes to `.claude/continuity/ledgers/`
- Warns if ledger exceeds 500 lines (suggests `/create-handoff`)
- Alerts urgently if ledger exceeds 800 lines

## Related
- See `/continuity-management` for full system documentation
