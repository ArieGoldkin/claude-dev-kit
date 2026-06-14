---
description: Update project ledger with current state. Use periodically to preserve context before compaction.
---

# /save-state - Update Project Ledger

Update the project state ledger with current context using the **append-until-handoff** model.

## Model: Append-Until-Handoff

This command uses a hybrid approach:
- **REPLACE**: Current State sections (snapshot of current work)
- **APPEND**: Session Activity Log (accumulates within session)
- **APPEND**: Key Decisions (preserves decision history)
- **Cleanup**: Happens only on `/create-handoff` (session boundary)

## When to Use

- Before context window gets full
- After completing a major milestone
- Before switching to different work
- Periodically during long sessions (every 1-2 hours)

## What This Command Does

1. **Read current context**: Load `.claude/context/shared-context.json`
2. **Extract key information**:
   - Recent decisions from `agent_decisions`
   - Completed tasks from `tasks_completed`
   - Pending work from `tasks_pending`
   - Open blockers
3. **Update ledger**: Using append-until-handoff model
4. **Check thresholds**: Suggest `/create-handoff` if ledger >500 lines

## Execution Steps

### Step 1: Read Current Context

```
Read: .claude/context/shared-context.json
Extract:
- agent_decisions (recent)
- tasks_completed (recent)
- tasks_pending
- codebase_patterns
```

### Step 2: Read Current Ledger

```
Read the project ledger in .claude/continuity/ledgers/
LEDGER=$(ls .claude/continuity/ledgers/CONTINUITY_*.md | head -1)
Count lines to check thresholds
```

### Step 3: Update Ledger Sections (Append-Until-Handoff Model)

**Section Behaviors:**

| Section | Behavior | Description |
|---------|----------|-------------|
| Current State (Now) | REPLACE | Snapshot of current focus |
| Done (Recent) | REPLACE | Rolling window (last 10 items) |
| Next | REPLACE | Snapshot of upcoming work |
| **Session Activity Log** | **APPEND** | New entry at TOP with timestamp |
| **Key Decisions** | **APPEND** | New decisions added, old preserved |
| Open Questions | REPLACE | Snapshot of current blockers |

### Step 4: APPEND to Session Activity Log

Add a new timestamped entry at the TOP of the Session Activity Log section:

```markdown
## Session Activity Log

### YYYY-MM-DD HH:MM
- [Summary of work done since last save]
- [Key discoveries or changes in approach]
- [Problems encountered and solutions]
- [Files modified]

<!-- Previous entries remain below -->
```

**Entry format:**
- Timestamp in local time (YYYY-MM-DD HH:MM)
- Bullet points summarizing activity
- Include: what was attempted, what worked/failed, why approach changed
- Keep concise (3-8 bullet points per entry)

### Step 5: APPEND New Key Decisions

If new architectural or pattern decisions were made:

```markdown
## Key Decisions

### Architecture

#### [Decision Title] (Added YYYY-MM-DD)
**Decision:** [What was decided]
**Reasoning:** [Why this approach]
**Impact:** [What changes as a result]

<!-- Previous decisions remain below - DO NOT REMOVE -->
```

**Important:** Never remove existing decisions. Only add new ones.

### Step 6: REPLACE Snapshot Sections

Update these sections with fresh information (replacing previous content):

**Current State**
- Now: Current single focus item
- Done (Recent): Rolling window of last 10 completed items
- Next: What to work on after current focus

**Open Questions**
- Blocking: Items that prevent progress
- Non-blocking: Questions to address eventually

### Step 7: Update Timestamp

Update the header:
```markdown
> Last updated: [current ISO timestamp]
> Session: [current session description]
```

### Step 8: Write Updated Ledger

```
Write the updated content to the project ledger in .claude/continuity/ledgers/CONTINUITY_<project-name>.md
(where <project-name> is the directory basename of the current project)
```

### Step 9: Check Threshold and Suggest Handoff

After writing, count ledger lines:

```
If ledger > 500 lines:
  Output: "⚠️ Ledger has [N] lines. Consider running /create-handoff to clean up."

If ledger > 800 lines:
  Output: "🔴 Ledger has [N] lines (urgent). Run /create-handoff before continuing."
```

## Output

Confirm ledger update with:
- Timestamp updated
- Sections refreshed
- Session Activity Log entry added
- New decisions captured (if any)
- Line count and threshold status

## Example Usage

User: /save-state

Claude:
1. Reads shared-context.json
2. Reads current ledger (245 lines)
3. APPENDS new entry to Session Activity Log
4. APPENDS any new decisions to Key Decisions
5. REPLACES Current State and Open Questions with fresh snapshot
6. Writes updated ledger
7. Confirms: "Ledger updated at 2026-01-19T15:30:00Z"
   - Session Activity Log: +1 entry (total: 3 entries this session)
   - Key Decisions: +1 decision (total: 8)
   - Line count: 278 lines ✅

## Comparison: Old vs New Model

| Aspect | Old (Replace) | New (Append-Until-Handoff) |
|--------|---------------|---------------------------|
| Session Activity Log | N/A (didn't exist) | APPEND (accumulates) |
| Key Decisions | REPLACE | APPEND (preserves history) |
| Current State | REPLACE | REPLACE (same) |
| Open Questions | REPLACE | REPLACE (same) |
| Information loss | High (each save overwrites) | Low (history preserved) |
| Cleanup trigger | Manual `/archive-ledger` | Automatic on `/create-handoff` |

---
*Model: Append-Until-Handoff (v2.0)*
