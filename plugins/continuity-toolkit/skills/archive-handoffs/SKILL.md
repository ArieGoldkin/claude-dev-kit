---
name: archive-handoffs
description: Archive old handoff files to maintain a clean continuity directory. Use when handoffs accumulate.
effort: low
---

# /archive-handoffs

Archive old handoff files to keep the handoffs directory clean and focused on recent sessions.

## When to Use
- When handoff count exceeds 20 files (warning) or 40 files (urgent)
- Monthly maintenance (end of month)
- When `/check-maintenance` recommends it
- Before long breaks (cleanup before vacation)

## What It Does
- Lists all handoff files and identifies those older than 30 days
- Groups old handoffs by month for organized archiving
- Moves files to `.claude/continuity/archive/handoffs-YYYY-MM/` directories
- Creates README.md index in each archive month directory
- Verifies recent handoffs (last 30 days) remain in active directory
- No impact on session-start performance (hook loads only latest handoff)

## Related
- See `/continuity-management` for full system documentation
