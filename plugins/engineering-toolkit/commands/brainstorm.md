---
description: Interactive design refinement using Socratic method (default) or comprehensive multi-agent analysis (--deep flag)
---

# Brainstorm: $ARGUMENTS

Activating brainstorming skill to refine your idea into a fully-formed design.

**Mode:** Detecting from arguments...

## Detecting Mode

Check if `$ARGUMENTS` contains `--deep` flag:

- **If `--deep` flag present:** Deep Mode (8 parallel agents + synthesis)
- **If no `--deep` flag:** Simple Mode (Socratic questioning)

## Resume Check

Check if `$ARGUMENTS` contains `--resume` flag:

- **If `--resume` present:** Check for `.claude/context/brainstorm-state.json`
  - If state file exists: Read it, announce topic and last completed phase, offer to resume
  - If state file does not exist: Report "No brainstorm session to resume. Starting fresh."
- **Strip `--resume` and `--deep` flags** from topic string before passing to skill

## Execute Brainstorming Skill

Follow the brainstorming skill exactly as written in `.claude/skills/brainstorming/SKILL.md`.

The skill will:
1. Announce which mode is active (Simple or Deep)
2. Execute appropriate flow based on mode
3. Guide through structured questioning and design exploration
4. Present design incrementally with validation
5. Adapt to detected project context (tech stack, domain, tier)

**Project Context Detection:**
- Detect tech stack from working directory (frameworks, languages, database)
- Detect project context (tech stack, compliance needs)
- Detect project tier (FOCUSED/MODERATE/SIGNIFICANT) for YAGNI gate

See brainstorming SKILL.md "Context Detection" section for heuristics.

## Usage Examples

**Simple Mode (default):**
```
/brainstorm user notification system improvements
```

**Deep Mode (parallel agents):**
```
/brainstorm --deep new task management system with team collaboration
```

**Resume interrupted session:**
```
/brainstorm --resume
```

---

Use and follow the brainstorming skill exactly as written.
