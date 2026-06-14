---
description: Initialize the continuity system for a new project. Use when setting up continuity for the first time.
---

# /setup-continuity - Initialize Continuity System

One-time setup wizard to ensure all continuity system components are properly configured.

## When to Use

- First time setting up continuity system in a project
- After cloning a repo with existing continuity files
- When hooks or automation aren't working
- To verify system health after updates

## What This Command Does

1. **Verify directories** - Create missing continuity directories
2. **Update .gitignore** - Ensure session state files are not committed
3. **Check settings.local.json** - Ensure hooks are configured
4. **Initialize ledger** - Create from template if missing
5. **Verify hook scripts** - Check they're executable
6. **Initialize shared-context.json** - Set up tracking fields
7. **Create initial handoff** - Optional first checkpoint

## Execution Steps

### Step 1: Check Directory Structure

Verify and create required directories:

```bash
Required directories:
- .claude/
- .claude/commands/
- .claude/context/
- .claude/continuity/
- .claude/continuity/handoffs/
- .claude/continuity/ledgers/
- .claude/continuity/archive/
- .claude/continuity/learnings/
```

For any missing directories, create them:
```
mkdir -p .claude/continuity/{handoffs,ledgers,archive,learnings}
mkdir -p .claude/context
```

### Step 2: Update .gitignore

Continuity files are **user-specific session state** and should NOT be committed to git. They contain:
- Personal working notes and timestamps
- Session-specific context that varies per developer
- Transient data that would cause merge conflicts

Check if `.gitignore` exists and contains the required entries:

```gitignore
# Claude session state (user-specific, not shared)
.claude/context/
.claude/continuity/
```

**Implementation:**

1. Check if `.gitignore` exists in project root
2. If it exists, check if it already contains `.claude/continuity/`
3. If entries are missing, append them:

```bash
# Check and append if needed
if ! grep -q "\.claude/continuity/" .gitignore 2>/dev/null; then
  echo "" >> .gitignore
  echo "# Claude session state (user-specific, not shared)" >> .gitignore
  echo ".claude/context/" >> .gitignore
  echo ".claude/continuity/" >> .gitignore
fi
```

4. If `.gitignore` doesn't exist, create it with the entries

**Why this matters:**
- Different team members have different sessions
- Handoffs contain personal working notes
- Ledger updates would conflict on every merge
- Shared-context.json changes constantly

### Step 3: Verify settings.local.json

Check that `.claude/settings.local.json` exists with hooks configured. The plugin provides hooks via `hooks/hooks.json` which are auto-discovered. However, if projects need local hook overrides, verify the format:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node hooks/dist/src/lifecycle/session-loader.js"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node hooks/dist/src/lifecycle/pre-compact-saver.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node hooks/dist/src/posttool/dirty-state-tracker.js"
          }
        ]
      }
    ]
  }
}
```

**Note**: Hook format requires nested `hooks` array. `matcher` is a regex string pattern (e.g., `"Write|Edit"`).

If missing or incomplete, create/update it.

### Step 4: Initialize Ledger

Check if a ledger exists at `.claude/continuity/ledgers/CONTINUITY_<project-name>.md` (where `<project-name>` is the directory basename of the current project).

If missing, create from template:
```
Read: skills/continuity-management/templates/ledger-template.md
Write: .claude/continuity/ledgers/CONTINUITY_<project-name>.md
```

Replace `{{PROJECT_NAME}}` in the template with the actual project directory basename.

### Step 5: Verify Hooks

Check that the plugin hooks are compiled and available:

```bash
# Verify hooks are built
ls hooks/dist/src/lifecycle/session-loader.js
ls hooks/dist/src/lifecycle/pre-compact-saver.js
ls hooks/dist/src/posttool/dirty-state-tracker.js
```

If not found, build them:
```bash
cd hooks && npm install && npm run build
```

**Note**: The plugin uses TypeScript hooks compiled to JavaScript. Only 3 hook events are relevant: SessionStart, PreCompact, PostToolUse. Other events like "PostSaveState" or "PreHandoff" don't exist.

### Step 6: Initialize shared-context.json

Check that `.claude/context/shared-context.json` exists with required fields:

```json
{
  "version": "4.2.0",
  "dirty_tracking": {
    "files_edited_count": 0,
    "last_edit_timestamp": null,
    "files_edited_this_session": [],
    "threshold_warning": 15,
    "threshold_auto_suggest": 20
  },
  "session_heartbeat": {
    "last_activity": null,
    "session_start": null,
    "was_cleanly_ended": true
  },
  "continuity": {
    "current_ledger": ".claude/continuity/ledgers/CONTINUITY_<project-name>.md",
    "last_handoff": null,
    "session_start": null
  }
}
```

If missing fields, add them. Replace `<project-name>` with the actual directory basename.

### Step 7: Verify Templates

Check that templates exist within the plugin:
- `skills/continuity-management/templates/handoff-template.yaml`
- `skills/continuity-management/templates/ledger-template.md`

### Step 8: Test Hooks (Optional)

Run hook tests if available:
```bash
cd hooks && npm test
```

### Step 9: Create Initial State (Optional)

Ask user if they want to create an initial handoff checkpoint:
- If yes: Run `/create-handoff` workflow
- If no: Just confirm setup complete

## Output

Display setup summary:

```
CONTINUITY SYSTEM SETUP COMPLETE

Directories:
  ✓ .claude/continuity/handoffs/
  ✓ .claude/continuity/ledgers/
  ✓ .claude/continuity/archive/
  ✓ .claude/continuity/learnings/

Git Configuration:
  ✓ .gitignore updated - continuity files excluded from git

Configuration:
  ✓ hooks compiled and available
  ✓ shared-context.json - tracking fields present

Hooks:
  ✓ session-loader (SessionStart)
  ✓ pre-compact-saver (PreCompact)
  ✓ dirty-state-tracker (PostToolUse)

Templates:
  ✓ handoff-template.yaml
  ✓ ledger-template.md

System Ready!

Available commands:
  /save-state        - Update project ledger
  /create-handoff    - End session properly
  /resume-session    - Load previous context
  /continuity-metrics - View system health
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Hooks not firing | Check `hooks.json` syntax, rebuild with `cd hooks && npm run build`, restart Claude Code |
| Permission denied on scripts | Ensure hooks are compiled: `cd hooks && npm run build` |
| Context file corruption | Restore from git or recreate with defaults |
| Continuity files committed to git | Run `git rm -r --cached .claude/continuity/` then commit |
| Gitignore not working | Ensure entries are on separate lines, check for typos |

---
*Setup Wizard v1.1*
