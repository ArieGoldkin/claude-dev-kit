# Evidence Standards

## Table of Contents
- [Minimum Evidence Requirements](#minimum-evidence-requirements)
- [Production-Grade Requirements](#production-grade-requirements)
- [Evidence Template](#evidence-template)
- [Coverage Thresholds](#coverage-thresholds)
- [Common Failure Patterns](#common-failure-patterns)

## Minimum Evidence Requirements

At least ONE verification type executed with:
- Exit code captured (0 = pass, non-zero = fail)
- Timestamp recorded
- Output summary preserved

## Production-Grade Requirements

ALL must pass for production-ready code:
- Tests pass (exit code 0)
- Coverage >= 70% (or project-defined threshold)
- Build succeeds (exit code 0)
- No critical linter errors (warnings acceptable)
- Type checker passes (0 errors)
- No known security vulnerabilities in dependencies

## Evidence Template

```markdown
## Verification Evidence — [date]

### Test Results
- **Command**: `npm test -- --run`
- **Exit code**: 0
- **Passed**: 24 | **Failed**: 0 | **Skipped**: 1
- **Coverage**: 87.5% (statements)
- **Duration**: 12.4s

### Type Check
- **Command**: `npx tsc --noEmit`
- **Exit code**: 0
- **Errors**: 0
- **Duration**: 3.2s

### Lint
- **Command**: `npx biome check .`
- **Exit code**: 0
- **Errors**: 0 | **Warnings**: 3
- **Duration**: 1.1s

### Quality Level: PASS (warnings only)
### Recommendation: Safe to commit. Review 3 lint warnings.
```

## Coverage Thresholds

| Project Type | Minimum | Target | Stretch |
|-------------|---------|--------|---------|
| Library/SDK | 80% | 90% | 95% |
| API/Backend | 70% | 80% | 90% |
| Frontend UI | 60% | 70% | 80% |
| CLI tool | 70% | 80% | 90% |
| Infrastructure | 50% | 60% | 70% |

Use project-configured thresholds when available (jest.config, vitest.config, .nycrc, pyproject.toml).

## Common Failure Patterns

| Failure | Likely Cause | Quick Fix |
|---------|-------------|-----------|
| Tests fail with import errors | Missing dependency or build step | `npm install` or `npm run build` first |
| Typecheck finds errors in node_modules | Missing `skipLibCheck: true` | Add to tsconfig.json |
| Lint errors on generated files | Generated files not excluded | Add to .biome ignore or .eslintignore |
| Tests timeout | Async test missing await/done | Check test for hanging promises |
| Coverage below threshold | New code lacks tests | Write tests for uncovered paths |
