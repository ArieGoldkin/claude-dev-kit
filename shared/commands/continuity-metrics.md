---
description: View session status and continuity metrics. Use to check current session state.
---

# /continuity-metrics - View Session Status

Display **current session** metrics: dirty tracking, hook status, and quick health check.

## When to Use

- See current session activity (files edited, time active)
- Verify hooks are working
- Check if previous session ended cleanly
- Quick health snapshot

**For archiving/maintenance needs**: Use `/check-maintenance` instead (token estimates, archive history, detailed thresholds).

## What This Command Does

1. **Gather metrics** from context files and directories
2. **Calculate health scores** for each subsystem
3. **Display dashboard** with actionable recommendations

## Execution Steps

### Step 1: Read Context Files

```
Read: .claude/context/shared-context.json
Read the project ledger in .claude/continuity/ledgers/
LEDGER=$(ls .claude/continuity/ledgers/CONTINUITY_*.md | head -1)
```

### Step 2: Count Resources

```bash
# Count handoffs
ls -1 .claude/continuity/handoffs/*.yaml .claude/continuity/handoffs/*.md 2>/dev/null | wc -l

# Count archived content
ls -1 .claude/continuity/archive/*.md 2>/dev/null | wc -l

# Check ledger line count
LEDGER=$(ls .claude/continuity/ledgers/CONTINUITY_*.md | head -1)
wc -l "$LEDGER"
```

### Step 3: Calculate Metrics

From `shared-context.json`:
- `dirty_tracking.files_edited_count` - Current session edits
- `dirty_tracking.threshold_auto_suggest` - Auto-suggest threshold
- `session_heartbeat.was_cleanly_ended` - Last session status
- `session_heartbeat.session_start` - Current session start time

From filesystem:
- Handoff count (total `.yaml` + `.md` files in handoffs/)
- Ledger line count
- Archive file count

### Step 4: Display Dashboard

```
╔═══════════════════════════════════════════════════════════════╗
║                  CONTINUITY SYSTEM METRICS                    ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  SESSION STATUS                                               ║
║  ─────────────                                                ║
║  Current Session:     {{SESSION_ID}}                          ║
║  Started:             {{SESSION_START}}                       ║
║  Files Edited:        {{EDIT_COUNT}} / {{THRESHOLD}}          ║
║  Last Activity:       {{LAST_ACTIVITY}}                       ║
║  Clean End (prev):    {{WAS_CLEAN}} ✓/✗                       ║
║                                                               ║
║  CONTEXT HEALTH                                               ║
║  ──────────────                                               ║
║  Ledger Lines:        {{LEDGER_LINES}} (target: <300)         ║
║  Handoff Files:       {{HANDOFF_COUNT}}                       ║
║  Archive Files:       {{ARCHIVE_COUNT}}                       ║
║  Context Size:        {{CONTEXT_SIZE}} bytes                  ║
║                                                               ║
║  HOOK STATUS                                                  ║
║  ───────────                                                  ║
║  SessionStart:        {{HOOK_1_STATUS}}                       ║
║  PreCompact:          {{HOOK_2_STATUS}}                       ║
║  PostToolUse:         {{HOOK_3_STATUS}}                       ║
║                                                               ║
║  RECOMMENDATIONS                                              ║
║  ───────────────                                              ║
║  {{RECOMMENDATIONS}}                                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### Step 5: Generate Recommendations

Based on metrics, provide actionable recommendations:

| Condition | Recommendation |
|-----------|----------------|
| `files_edited_count >= threshold_auto_suggest` | "Consider /create-handoff (20+ edits)" |
| `files_edited_count >= threshold_warning` | "Approaching handoff threshold" |
| `ledger_lines > 500` | "Ledger too large, run /create-handoff" |
| `ledger_lines > 300` | "Ledger growing, consider cleanup" |
| `was_cleanly_ended == false` | "Previous session not saved, run /save-state" |
| `handoff_count == 0` | "No handoffs yet, create baseline with /create-handoff" |
| All healthy | "System healthy, no action needed" |

## Example Output

```
╔═══════════════════════════════════════════════════════════════╗
║                  CONTINUITY SYSTEM METRICS                    ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  SESSION STATUS                                               ║
║  ─────────────                                                ║
║  Current Session:     napp-2792-activity-intro-page           ║
║  Started:             2026-01-19T21:00:00Z                    ║
║  Files Edited:        7 / 20                                  ║
║  Last Activity:       2026-01-19T22:35:00Z                    ║
║  Clean End (prev):    ✓ Yes                                   ║
║                                                               ║
║  CONTEXT HEALTH                                               ║
║  ──────────────                                               ║
║  Ledger Lines:        187 (target: <300)                ✓     ║
║  Handoff Files:       5                                       ║
║  Archive Files:       2                                       ║
║  Context Size:        4.2 KB                                  ║
║                                                               ║
║  HOOK STATUS                                                  ║
║  ───────────                                                  ║
║  SessionStart:        ✓ Configured                            ║
║  PreCompact:          ✓ Configured                            ║
║  PostToolUse:         ✓ Configured                            ║
║                                                               ║
║  RECOMMENDATIONS                                              ║
║  ───────────────                                              ║
║  ✓ System healthy, no action needed                           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

## Quick Health Check Script

For terminal-based quick check, use:

```bash
bash .claude/scripts/check-continuity-health.sh
```

---
*Metrics Dashboard v1.0*
