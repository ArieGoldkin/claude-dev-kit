---
name: continuity-metrics
description: View session status and continuity metrics. Use to check current session state.
effort: low
---

# /continuity-metrics

Display current session metrics: dirty tracking, hook status, and quick health check.

## When to Use
- See current session activity (files edited, time active)
- Verify hooks are working
- Check if previous session ended cleanly
- Quick health snapshot (use `/check-maintenance` for detailed analysis)

## What It Does
- Reads session state from `shared-context.json` (dirty tracking, heartbeat)
- Counts handoff files, archive files, and ledger line count
- Displays ASCII dashboard with session status, context health, and hook status
- Shows files edited vs threshold, session start time, clean-end status
- Generates actionable recommendations based on current metrics
- Suggests `/create-handoff` when edit threshold reached or ledger too large

## Related
- See `/continuity-management` for full system documentation
