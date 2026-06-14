# Pressure-Testing Skills: TDD for Documentation

A methodology for empirically validating skills against adversarial agent behavior.
Adapted from obra/superpowers' writing-skills approach.

## Core Principle

Skills are executable behavior specifications, not passive documentation. They should be
validated the same way we validate code: write a failing test, write the minimum fix,
refactor based on new failure modes.

## The RED-GREEN-REFACTOR Cycle for Skills

### RED: Discover Failure Modes

Run adversarial scenarios WITHOUT the skill active (or with a minimal version).
Document how the agent fails:

1. Spawn a subagent with the task the skill is designed to guide
2. Observe where the agent cuts corners, skips steps, or rationalizes shortcuts
3. Record each failure as a specific, reproducible scenario

**Example RED scenarios for a TDD skill:**
- Agent writes implementation before tests ("I'll add tests after")
- Agent writes tests that test implementation details, not behavior
- Agent skips edge cases because "the happy path is sufficient"
- Agent marks coverage as complete without running the coverage tool

### GREEN: Write Minimum Skill

Write the smallest possible skill that addresses the observed failures:

1. Each RED failure should map to a specific skill instruction
2. Include anti-rationalization tables for observed rationalizations
3. Add Iron Laws for non-negotiable rules the agent violated
4. Re-run the same scenarios — verify the agent now follows the process

### REFACTOR: Harden Against New Rationalizations

After the skill is in use, monitor for new failure modes:

1. Run the skill with varied tasks (simple, complex, ambiguous)
2. Watch for new rationalizations the agent invents to bypass rules
3. Add counters to the Common Rationalizations table
4. Tighten Iron Laws if agents find loopholes

## Running Pressure Tests

### Manual Pressure Test

```bash
# 1. Spawn a subagent with a task that exercises the skill
# 2. Observe the agent's behavior in the conversation
# 3. Record failures in a pressure-test log
```

### Structured Pressure Test with /experiment

```
/experiment skills/cover/SKILL.md \
  --metric "compliance_rate" \
  --maximize \
  --goal 95
```

Where `compliance_rate` is measured by a reviewer subagent scoring
each test run against a compliance checklist.

## Pressure Test Scenarios

Each skill should have 3-5 pressure test scenarios stored alongside it.
File convention: `{skill-dir}/pressure-tests/scenario-{N}.md`

### Scenario Format

```markdown
# Pressure Test: [Scenario Name]

## Setup
- Task: [specific task to give the agent]
- Context: [any files or state to prepare]
- Skill active: [yes/no — RED phase runs without skill]

## Expected Behavior (with skill)
- [ ] Agent does X before Y
- [ ] Agent produces artifact Z
- [ ] Agent does NOT skip step W

## Known Failure Modes (without skill)
- Agent skips X because [rationalization]
- Agent produces incomplete Z because [shortcut]

## Anti-Rationalization Targets
- "I'll do X later" → Iron Law: X comes FIRST
- "This is too simple for Z" → Red Flag: simplicity is not an excuse
```

## Compliance Scoring

Score each pressure test run on a 0-5 scale:

| Score | Meaning |
|-------|---------|
| 5 | Perfect compliance — all steps followed, no shortcuts |
| 4 | Minor deviation — process followed but with small gaps |
| 3 | Partial compliance — key steps followed, some skipped |
| 2 | Significant deviation — process barely followed |
| 1 | Major failure — agent bypassed most of the skill's guidance |
| 0 | Complete failure — agent ignored the skill entirely |

Target: 4+ average across all scenarios for a skill to be considered validated.

## When to Pressure Test

- **New skills**: Before shipping (minimum 3 scenarios)
- **After rationalization discovery**: When you observe an agent bypassing a rule
- **After skill edits**: Verify edits didn't weaken compliance
- **Quarterly**: Re-run core skill pressure tests to catch model behavior drift

## Integration with Existing Skills

This methodology complements:
- `/cover` — use pressure tests to validate that /cover itself enforces TDD
- `/experiment` — use the experiment loop to iterate on skill compliance rates
- `/verify` — add skill compliance as a verification dimension
