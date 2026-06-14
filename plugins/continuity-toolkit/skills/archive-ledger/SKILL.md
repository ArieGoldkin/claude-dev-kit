---
name: archive-ledger
description: Archive old ledger sections to reduce file size. Use when ledger exceeds 500 lines.
effort: low
---

# /archive-ledger

Archive old sections of the project ledger to keep it lean and context-efficient.

## When to Use
- When ledger exceeds 500 lines (warning) or 800 lines (urgent)
- Weekly maintenance if ledger is growing fast
- Before long breaks (quarterly cleanup)
- When `/check-maintenance` recommends it

## What It Does
- Reads current ledger and identifies archivable content (>28 days old)
- Archives old "Done" items and Key Decisions (>30 days) to quarterly file
- Creates archive at `.claude/continuity/archive/ledger-YYYY-QQ.md`
- Replaces archived sections with summaries and archive links
- Keeps recent 4 weeks of work and last 30 days of decisions in detail
- Verifies ledger reduced to <500 lines after cleanup
- Creates backup before archiving for safety

## Related
- See `/continuity-management` for full system documentation
