# Evidence Verification Workflows

Detailed step-by-step workflows for different verification scenarios.

## Workflow 1: Code Implementation Verification

**When:** After writing code for a feature or bug fix

**Steps:**

1. **Save all files** - Ensure changes are written

2. **Run tests**
   ```bash
   npm test
   # or: pytest, cargo test, go test, etc.
   ```
   - Capture exit code
   - Note passed/failed counts
   - Record coverage if available

3. **Run build** (if applicable)
   ```bash
   npm run build
   # or: cargo build, go build, etc.
   ```
   - Capture exit code
   - Note any errors/warnings
   - Verify artifacts created

4. **Run linter**
   ```bash
   npm run lint
   # or: ruff check, cargo clippy, golangci-lint run
   ```
   - Capture exit code
   - Note errors/warnings

5. **Run type checker** (if applicable)
   ```bash
   npm run typecheck
   # or: mypy, tsc --noEmit
   ```
   - Capture exit code
   - Note type errors

6. **Document evidence**
   - Use Combined Evidence Report template
   - Add to shared context under `quality_evidence`
   - Reference in task completion message

7. **Mark task complete** (only if all evidence passes)

---

## Workflow 2: Code Review Verification

**When:** Reviewing another agent's code or user's PR

**Steps:**

1. **Read the code changes**

2. **Verify tests exist**
   - Are there tests for new functionality?
   - Do tests cover edge cases?
   - Are existing tests updated?

3. **Run tests**
   - Execute test suite
   - Verify exit code 0
   - Check coverage didn't decrease

4. **Check build**
   - Ensure project still builds
   - No new build errors

5. **Verify code quality**
   - Run linter
   - Run type checker
   - Check for security issues

6. **Document review evidence**
   - Tests verified (exit code, count)
   - Code quality checks passed
   - Any concerns noted

7. **Approve or request changes** based on evidence

---

## Workflow 3: Production Deployment Verification

**When:** Deploying to production or verifying a deployment

**Steps:**

1. **Pre-deployment checks**
   - All tests pass
   - Build succeeds
   - Security scan clear

2. **Execute deployment**
   - Record deployment start time
   - Capture deployment output

3. **Verify deployment status**
   - Check deployment success/failure
   - Capture any error messages

4. **Run health checks**
   ```bash
   curl -s https://api.example.com/health
   ```
   - Verify HTTP 200
   - Check response body

5. **Verify rollback capability**
   - Ensure previous version can be restored
   - Document rollback procedure

---

## Evidence Storage

### Where to Store Evidence

**Shared Context** (Primary)
```json
{
  "quality_evidence": {
    "tests_run": true,
    "test_exit_code": 0,
    "coverage_percent": 87,
    "build_success": true,
    "build_exit_code": 0,
    "linter_errors": 0,
    "linter_warnings": 2,
    "timestamp": "2025-11-02T10:30:00Z"
  }
}
```

**Evidence Files** (Secondary)
- `.claude/quality-gates/evidence/` directory
- One file per verification run
- Format: `{type}-{timestamp}.log`
- Example: `tests-2025-11-02-103000.log`

**Task Completion Messages**
- Include evidence summary
- Link to detailed evidence files
- Example: "Task complete. Tests passed (exit 0, 87% coverage), build succeeded."
