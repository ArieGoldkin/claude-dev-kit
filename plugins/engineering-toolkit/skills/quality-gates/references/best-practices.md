# Quality Gates Best Practices

Guidelines and common pitfalls for quality gate implementation.

## Table of Contents

- [Best Practices](#best-practices)
  - [1. Always Run Gate Check Before Starting](#1-always-run-gate-check-before-starting)
  - [2. Document All Assumptions](#2-document-all-assumptions)
  - [3. Track Attempts for Stuck Detection](#3-track-attempts-for-stuck-detection)
  - [4. Break Down Complex Tasks Proactively](#4-break-down-complex-tasks-proactively)
- [Common Pitfalls](#common-pitfalls)

## Best Practices

### 1. Always Run Gate Check Before Starting

```javascript
// ❌ BAD: Start immediately
function startTask(task) {
  implementTask(task);
}

// ✅ GOOD: Gate check first
function startTask(task) {
  const gateCheck = runQualityGate(task);

  if (gateCheck.status === 'blocked') {
    escalate(gateCheck.reason);
    return;
  }

  if (gateCheck.status === 'warning') {
    documentAssumptions(gateCheck.warnings);
  }

  implementTask(task);
}
```

### 2. Document All Assumptions

When proceeding with warnings, document assumptions:

```markdown
## Assumptions Made
1. **Assumption:** API will return JSON format
   **Risk:** Low - standard REST practice
   **Mitigation:** Add try-catch for parsing

2. **Assumption:** User authentication already implemented
   **Risk:** Medium - might not exist
   **Mitigation:** Check early, escalate if missing
```

### 3. Track Attempts for Stuck Detection

```javascript
// Track every attempt
function attemptTask(taskId, approach) {
  trackAttempt(taskId, approach);

  const attemptCount = getAttemptCount(taskId);
  if (attemptCount >= 3) {
    escalateToUser(taskId);
    return 'blocked';
  }

  return executeApproach(approach);
}
```

### 4. Break Down Complex Tasks Proactively

```javascript
// ❌ BAD: Tackle Level 5 task directly
implementComplexFeature();

// ✅ GOOD: Break down first
function handleComplexTask(task) {
  if (task.complexity >= 4) {
    const subtasks = breakDownIntoSubtasks(task);

    subtasks.forEach(subtask => {
      runQualityGate(subtask);
      implementSubtask(subtask);
    });
  } else {
    implementTask(task);
  }
}
```

---

## Common Pitfalls

### ❌ Pitfall 1: Skipping Gate Checks for "Simple" Tasks

**Problem:** Assume task is simple, skip gate check, get stuck later

**Solution:** Always run gate check, even for Level 1-2 tasks (quick check)

### ❌ Pitfall 2: Ignoring Warning Status

**Problem:** Proceed with warnings without documenting assumptions

**Solution:** Document every assumption when proceeding with warnings

### ❌ Pitfall 3: Not Tracking Attempts

**Problem:** Keep trying same approach repeatedly, waste cycles

**Solution:** Track every attempt, escalate after 3

### ❌ Pitfall 4: Proceeding When Blocked

**Problem:** Gate says BLOCKED but proceed anyway "to make progress"

**Solution:** NEVER bypass BLOCKED gates - resolve blockers first
