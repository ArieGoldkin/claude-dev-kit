# Coverage Report Template

## Report Structure

After test generation and healing, produce this report:

```markdown
## Coverage Report: {scope}

**Generated**: {timestamp}
**Tiers**: {unit|integration|e2e}
**Effort**: {low|medium|high}
**Heal iterations used**: {n}/{max}

### Coverage Delta

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Lines | {n}% | {n}% | +{n}% |
| Branches | {n}% | {n}% | +{n}% |
| Functions | {n}% | {n}% | +{n}% |
| Statements | {n}% | {n}% | +{n}% |

### Tests Generated

| Tier | Files Created | Tests | Pass | Fail | Healed |
|------|--------------|-------|------|------|--------|
| Unit | {n} | {n} | {n} | {n} | {n} |
| Integration | {n} | {n} | {n} | {n} | {n} |
| E2E | {n} | {n} | {n} | {n} | {n} |
| **Total** | **{n}** | **{n}** | **{n}** | **{n}** | **{n}** |

### Files Created

- `tests/unit/auth.test.ts` (12 tests)
- `tests/integration/api-users.test.ts` (5 tests)
- `tests/e2e/checkout.spec.ts` (3 tests)

### Real Services Used

- PostgreSQL via docker-compose (integration tests)
- Redis via testcontainers (integration tests)
- None (E2E used dev server only)

### Source Bugs Detected

List any bugs found in source code during test generation:

- [BUG] `file:line` — description (not fixed — tests only)
- None detected

### Remaining Gaps

Files or functions that still lack coverage and why:

- `src/utils/crypto.ts` — complex branching, needs manual review
- `src/legacy/compat.ts` — deprecated, not worth covering

### Next Steps

Recommended follow-up actions:

1. Review generated tests for domain correctness
2. Add generated tests to CI pipeline
3. Fix reported source bugs
4. Run `/verify` to collect full quality evidence
```

## Coverage Commands

Use these to collect before/after metrics:

```bash
# Vitest
npx vitest run --coverage --reporter=json --outputFile=coverage.json

# Jest
npx jest --coverage --json --outputFile=coverage.json

# pytest
pytest --cov --cov-report=json:coverage.json

# Playwright (for E2E — counts test pass/fail, not line coverage)
npx playwright test --reporter=json > playwright-results.json
```

## Delta Calculation

```
delta = after - before
```

Report deltas as `+N%` or `-N%`. Negative deltas can happen if generated tests reveal that previously-counted code was unreachable.

## Autonomous Coverage Improvement Log

When `--target=N%` was used and Phase 5b ran, append this section after the standard report:

```markdown
### Autonomous Coverage Improvement

Target: {target}% | Baseline: {baseline}% | Final: {final}% | Result: {reached|exhausted|stuck}

| Iter | Before | After | Delta | Tests Added | Kept | Status | Description |
|------|--------|-------|-------|-------------|------|--------|-------------|
| 1 | 62.0% | 67.3% | +5.3% | 6 | 6 | keep | uncovered branches in auth/login.ts |
| 2 | 67.3% | 71.8% | +4.5% | 4 | 4 | keep | error paths in payments/checkout.ts |
| 3 | 71.8% | 72.0% | +0.2% | 3 | 0 | discard | edge cases in cart/totals.ts (marginal) |

Iterations: {used}/{max} | Total improvement: +{delta}%
```

Omit this section entirely if `--target` was not used or if coverage already met the target before Phase 5b.
