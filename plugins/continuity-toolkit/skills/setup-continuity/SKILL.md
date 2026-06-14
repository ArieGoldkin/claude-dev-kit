---
name: setup-continuity
description: Initialize the continuity system for a new project. Use when setting up continuity for the first time.
effort: low
---

# /setup-continuity

One-time setup wizard to ensure all continuity system components are properly configured.

## When to Use
- First time setting up continuity system in a project
- After cloning a repo with existing continuity files
- When hooks or automation aren't working
- To verify system health after updates

## What It Does
- Creates required directories (handoffs, ledgers, archive, learnings, context)
- Updates `.gitignore` to exclude continuity session state from version control
- Verifies hooks are compiled and available (session-loader, pre-compact-saver, dirty-state-tracker)
- Initializes project ledger from template if missing
- Sets up `shared-context.json` with required tracking fields (dirty_tracking, session_heartbeat)
- Verifies templates exist (handoff-template.yaml, ledger-template.md)
- Optionally creates an initial handoff checkpoint

## Related
- See `/continuity-management` for full system documentation
