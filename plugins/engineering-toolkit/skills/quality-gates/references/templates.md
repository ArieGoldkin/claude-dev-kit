# Quality Gate Templates

Templates for quality gate checks, escalation, and task breakdowns.

## Table of Contents

- [Template 1: Pre-Task Gate Check](#template-1-pre-task-gate-check)
- [Template 2: Stuck Escalation](#template-2-stuck-escalation)
- [Template 3: Complexity Breakdown](#template-3-complexity-breakdown)

## Template 1: Pre-Task Gate Check

```markdown
# Quality Gate: [Task Name]

**Date:** [YYYY-MM-DD]
**Agent:** [Agent name]

## Complexity Assessment

**Estimated Lines of Code:** [X]
**Estimated Duration:** [X hours]
**File Changes:** [X files]
**Dependencies:** [X dependencies]
**Unknowns:** [X unknowns]

**Complexity Score:** Level [1-5]

## Critical Questions

1. [Question 1] - ✅ Answered / ❌ Unknown
2. [Question 2] - ✅ Answered / ❌ Unknown
3. [Question 3] - ✅ Answered / ❌ Unknown

**Unanswered:** [Count]

## Dependency Check

**Required:**
- [ ] [Dependency 1] - Ready / Blocked
- [ ] [Dependency 2] - Ready / Blocked

**Blockers:** [List]

## Gate Decision

**Status:** ✅ PASS / ⚠️ WARNING / ❌ BLOCKED

**Reasoning:** [Why this decision]

**Actions Required:** [If blocked or warning]

**Can Proceed:** Yes / No
```

## Template 2: Stuck Escalation

```markdown
# Escalation: Task Stuck

**Task:** [Task description]
**Agent:** [Agent name]
**Date:** [YYYY-MM-DD]

## Attempt History

**Attempt 1** ([Timestamp])
- **Approach:** [What was tried]
- **Outcome:** Failed
- **Error:** [Error message or issue]

**Attempt 2** ([Timestamp])
- **Approach:** [What was tried]
- **Outcome:** Failed
- **Error:** [Error message or issue]

**Attempt 3** ([Timestamp])
- **Approach:** [What was tried]
- **Outcome:** Failed
- **Error:** [Error message or issue]

## Current Blocker

[Detailed description of persistent problem]

## Need Guidance

1. [Specific question requiring human input]
2. [Specific question requiring human input]

## Recommendation

**Escalate to:** User / Specific Agent

**Suggested Actions:** [What might unblock this]
```

## Template 3: Complexity Breakdown

```markdown
# Task Breakdown: [Main Task]

**Original Complexity:** Level [4-5]
**Goal:** Break down to Level 1-3 subtasks

## Subtasks

### Subtask 1: [Name]
- **Complexity:** Level [X]
- **Estimated Duration:** [X hours]
- **Dependencies:** [None / List]
- **Acceptance Criteria:**
  - [ ] [Criterion 1]
  - [ ] [Criterion 2]

### Subtask 2: [Name]
- **Complexity:** Level [X]
- **Estimated Duration:** [X hours]
- **Dependencies:** [List]
- **Acceptance Criteria:**
  - [ ] [Criterion 1]
  - [ ] [Criterion 2]

### Subtask 3: [Name]
- **Complexity:** Level [X]
- **Estimated Duration:** [X hours]
- **Dependencies:** [List]
- **Acceptance Criteria:**
  - [ ] [Criterion 1]
  - [ ] [Criterion 2]

## Validation

- [ ] All subtasks ≤ Level 3
- [ ] Dependencies clearly mapped
- [ ] No circular dependencies
- [ ] Acceptance criteria clear
- [ ] Total estimate reasonable

**Can Proceed:** Yes / No
```
