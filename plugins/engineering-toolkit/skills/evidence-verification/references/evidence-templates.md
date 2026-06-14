# Evidence Collection Templates

Inline template examples for quick evidence capture. For full fill-in-the-blank templates with examples, see the [templates/](../templates/) directory.

## Table of Contents

- [Template 1: Test Evidence](#template-1-test-evidence)
- [Template 2: Build Evidence](#template-2-build-evidence)
- [Template 3: Code Quality Evidence](#template-3-code-quality-evidence)
- [Template 4: Combined Evidence Report](#template-4-combined-evidence-report)

---

## Template 1: Test Evidence

Use this template when running tests:

```markdown
## Test Evidence

**Command:** `npm test` (or equivalent)
**Exit Code:** 0 / non-zero
**Duration:** X seconds
**Results:**
- Tests passed: X
- Tests failed: X
- Tests skipped: X
- Coverage: X%

**Output Snippet:**
[First 10 lines of test output]

**Timestamp:** YYYY-MM-DD HH:MM:SS
**Environment:** Node vX.X.X, OS, etc.
```

## Template 2: Build Evidence

Use this template when building:

```markdown
## Build Evidence

**Command:** `npm run build` (or equivalent)
**Exit Code:** 0 / non-zero
**Duration:** X seconds
**Artifacts Created:**
- dist/bundle.js (XXX KB)
- dist/styles.css (XXX KB)

**Errors:** X
**Warnings:** X

**Output Snippet:**
[First 10 lines of build output]

**Timestamp:** YYYY-MM-DD HH:MM:SS
```

## Template 3: Code Quality Evidence

Use this template for linting and type checking:

```markdown
## Code Quality Evidence

**Linter:** ESLint / Ruff / etc.
**Command:** `npm run lint`
**Exit Code:** 0 / non-zero
**Errors:** X
**Warnings:** X

**Type Checker:** TypeScript / mypy / etc.
**Command:** `npm run typecheck`
**Exit Code:** 0 / non-zero
**Type Errors:** X

**Timestamp:** YYYY-MM-DD HH:MM:SS
```

## Template 4: Combined Evidence Report

Use this comprehensive template for task completion:

```markdown
## Task Completion Evidence

### Task: [Task description]
### Agent: [Agent name]
### Completed: YYYY-MM-DD HH:MM:SS

### Verification Results

| Check | Command | Exit Code | Result |
|-------|---------|-----------|--------|
| Tests | `npm test` | 0 | 45 passed, 0 failed |
| Build | `npm run build` | 0 | Bundle created (234 KB) |
| Linter | `npm run lint` | 0 | No errors, 2 warnings |
| Types | `npm run typecheck` | 0 | No type errors |

### Coverage
- Statements: 87%
- Branches: 82%
- Functions: 90%
- Lines: 86%

### Evidence Files
- Test output: `.claude/quality-gates/evidence/tests-2025-XX-XX.log`
- Build output: `.claude/quality-gates/evidence/build-2025-XX-XX.log`

### Conclusion
All verification checks passed. Task ready for review.
```
