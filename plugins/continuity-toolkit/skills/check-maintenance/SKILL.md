---
name: check-maintenance
description: Check continuity system health and file integrity. Use for periodic maintenance checks.
effort: low
---

# /check-maintenance

Check the health of the continuity system and identify maintenance needs.

## When to Use
- Weekly maintenance (every Friday or end of week)
- When experiencing slow context loading
- Before long breaks (end of month, vacation)
- When Claude suggests maintenance

## What It Does
- Checks ledger size and health (healthy <500 lines, warning 500-800, urgent >800)
- Checks handoff file count (healthy <20, warning 20-40, urgent >40)
- Checks shared context file size (healthy <50KB, warning 50-100KB, urgent >100KB)
- Reviews archive history (recent <30 days, warning 30-60, overdue >60)
- Estimates context token consumption across all subsystems
- Displays health dashboard with status indicators and specific recommendations
- Suggests priority-ordered maintenance commands to run

## Related
- See `/continuity-management` for full system documentation
