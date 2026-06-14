# Quality Gate Workflows

Detailed workflow procedures for quality gate validation.

## Table of Contents

- [Workflow 1: Pre-Task Gate Validation](#workflow-1-pre-task-gate-validation)
- [Workflow 2: Stuck Detection & Escalation](#workflow-2-stuck-detection--escalation)
- [Workflow 3: Complexity Breakdown (Level 4-5)](#workflow-3-complexity-breakdown-level-4-5)
- [Workflow 4: Requirements Completeness Check](#workflow-4-requirements-completeness-check)

## Workflow 1: Pre-Task Gate Validation

**When:** Before starting any task (especially Level 3-5)

**Steps:**

1. **Assess Complexity**
   ```
   Read task description
   Count file changes needed
   Estimate lines of code
   Identify dependencies
   Count unknowns
   → Assign complexity score (1-5)
   ```

2. **Identify Critical Questions**
   ```
   What must I know to complete this?
   - Data structures?
   - Expected behaviors?
   - Edge cases?
   - Error handling?
   - API contracts?

   → List all critical questions
   → Count unanswered questions
   ```

3. **Check Dependencies**
   ```
   What does this task depend on?
   - Other tasks?
   - External services?
   - Database changes?
   - Configuration?

   → Verify dependencies ready
   → List blockers
   ```

4. **Gate Decision**
   ```
   if (unansweredQuestions > 3) → BLOCK
   if (missingDependencies > 0) → BLOCK
   if (complexity >= 4 && !hasPlan) → BLOCK
   if (complexity == 3) → WARN
   else → PASS
   ```

5. **Document in Context**
   ```javascript
   context.tasks_pending.push({
     id: 'task-' + Date.now(),
     task: "Task description",
     complexity_score: 3,
     gate_status: 'pass',
     critical_questions: [...],
     dependencies: [...],
     timestamp: new Date().toISOString()
   });
   ```

---

## Workflow 2: Stuck Detection & Escalation

**When:** After multiple failed attempts at same task

**Steps:**

1. **Track Attempts**
   ```javascript
   // In context, track attempts
   if (!context.attempt_tracking) {
     context.attempt_tracking = {};
   }

   if (!context.attempt_tracking[taskId]) {
     context.attempt_tracking[taskId] = {
       attempts: [],
       first_attempt: new Date().toISOString()
     };
   }

   context.attempt_tracking[taskId].attempts.push({
     timestamp: new Date().toISOString(),
     approach: "Describe what was tried",
     outcome: "Failed because X",
     error_message: "Error details"
   });
   ```

2. **Check Threshold**
   ```javascript
   const attemptCount = context.attempt_tracking[taskId].attempts.length;

   if (attemptCount >= 3) {
     // ESCALATE - stuck
     return {
       status: 'blocked',
       reason: 'stuck_after_3_attempts',
       escalate_to: 'user',
       attempts_history: context.attempt_tracking[taskId].attempts
     };
   }
   ```

3. **Escalation Message**
   ```markdown
   ## 🚨 Escalation: Task Stuck

   **Task:** [Task description]
   **Attempts:** 3
   **Status:** BLOCKED - Need human guidance

   ### What Was Tried
   1. **Attempt 1:** [Approach] → Failed: [Reason]
   2. **Attempt 2:** [Approach] → Failed: [Reason]
   3. **Attempt 3:** [Approach] → Failed: [Reason]

   ### Current Blocker
   [Describe the persistent problem]

   ### Need Guidance On
   - [Specific question 1]
   - [Specific question 2]

   **Recommendation:** Human review needed to unblock
   ```

---

## Workflow 3: Complexity Breakdown (Level 4-5)

**When:** Assigned a Level 4 or 5 complexity task

**Steps:**

1. **Break Down into Subtasks**
   ```markdown
   ## Task Breakdown: [Main Task]
   **Overall Complexity:** Level 4

   ### Subtasks
   1. **Subtask 1:** [Description]
      - Complexity: Level 2
      - Dependencies: None
      - Estimated: 2 hours

   2. **Subtask 2:** [Description]
      - Complexity: Level 3
      - Dependencies: Subtask 1
      - Estimated: 4 hours

   3. **Subtask 3:** [Description]
      - Complexity: Level 2
      - Dependencies: Subtask 2
      - Estimated: 2 hours

   **Total Estimated:** 8 hours
   **Complexity Check:** All subtasks ≤ Level 3 ✅
   ```

2. **Validate Breakdown**
   ```
   Check:
   - [ ] All subtasks are Level 1-3
   - [ ] Dependencies clearly mapped
   - [ ] Each subtask has clear acceptance criteria
   - [ ] Sum of estimates reasonable
   - [ ] No overlapping work
   ```

3. **Create Execution Plan**
   ```markdown
   ## Execution Plan

   **Phase 1:** Subtask 1
   - Start: After requirements confirmed
   - Gate check: Pass
   - Evidence: Tests pass, build succeeds

   **Phase 2:** Subtask 2
   - Start: After Subtask 1 complete
   - Gate check: Verify Subtask 1 evidence
   - Evidence: Integration tests pass

   **Phase 3:** Subtask 3
   - Start: After Subtask 2 complete
   - Gate check: End-to-end verification
   - Evidence: Full feature tests pass
   ```

---

## Workflow 4: Requirements Completeness Check

**When:** Starting a new feature or significant task

**Steps:**

1. **Functional Requirements Check**
   ```markdown
   ## Functional Requirements

   - [ ] **Happy path defined:** What should happen when everything works?
   - [ ] **Error cases defined:** What should happen when things fail?
   - [ ] **Edge cases identified:** What are the boundary conditions?
   - [ ] **Input validation:** What inputs are valid/invalid?
   - [ ] **Output format:** What should the output look like?
   - [ ] **Success criteria:** How do we know it works?
   ```

2. **Technical Requirements Check**
   ```markdown
   ## Technical Requirements

   - [ ] **API contracts:** Endpoints, methods, schemas defined?
   - [ ] **Data structures:** Models, types, interfaces specified?
   - [ ] **Database changes:** Schema migrations needed?
   - [ ] **Authentication:** Who can access this?
   - [ ] **Performance:** Any latency/throughput requirements?
   - [ ] **Security:** Any special security considerations?
   ```

3. **Count Critical Unknowns**
   ```javascript
   const criticalUnknowns = [
     !functionalRequirements.happyPath,
     !functionalRequirements.errorCases,
     !technicalRequirements.apiContracts,
     !technicalRequirements.dataStructures
   ].filter(unknown => unknown).length;

   if (criticalUnknowns > 3) {
     return {
       gate_status: 'blocked',
       reason: 'incomplete_requirements',
       critical_unknowns: criticalUnknowns,
       action: 'clarify_requirements'
     };
   }
   ```
