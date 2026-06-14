# File Locations and Maintenance Schedule

## Active Files

- **Ledger**: `.claude/continuity/ledgers/CONTINUITY_<project-name>.md` (keep <500 lines)
- **Handoffs**: `.claude/continuity/handoffs/handoff-<YYYY-MM-DD>.md` (keep <20 files)
- **Learnings**: `.claude/continuity/learnings/extracted-patterns.md`
- **Context**: `.claude/context/shared-context.json`

## Archive Files

- **Ledger Archives**: `.claude/continuity/archive/ledger-YYYY-QQ.md` (quarterly)
- **Handoff Archives**: `.claude/continuity/archive/handoffs-YYYY-MM/` (monthly folders)

---

## Maintenance Schedule

Recommended maintenance routine:

| Frequency | Commands | Purpose |
|-----------|----------|---------|
| **Daily** | `/save-state` (after 3-5 tasks) | Keep ledger current |
| **Daily** | `/create-handoff` (EOD) | Session transitions |
| **Weekly** | `/check-maintenance` (Friday EOD) | Monitor system health |
| **As Needed** | `/archive-ledger` (when >500 lines) | Keep ledger lean |
| **Monthly** | `/archive-handoffs` (when >20 files) | Keep directory clean |

**Weekly routine example:**
```bash
# Every Friday EOD
1. /check-maintenance           # Check system health
2. /archive-ledger (if needed)  # If ledger >500 lines
3. /archive-handoffs (if needed)# If handoffs >20 files
4. /create-handoff              # Weekly summary
```
