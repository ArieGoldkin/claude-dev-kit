# Heal Loop Strategy

## Table of Contents
- [Failure Classification](#failure-classification)
- [Iteration Budget](#iteration-budget)
- [Source Bug Detection](#source-bug-detection)
- [Flaky Test Handling](#flaky-test-handling)

## Failure Classification

Classify each test failure and apply the corresponding fix strategy. Fix test code only — never modify source.

| Failure Type | Symptoms | Fix Strategy |
|-------------|----------|-------------|
| **Assertion mismatch** | `Expected X, received Y` | Update expected value if test assumption was wrong. If source returns wrong value, report as source bug. |
| **Import/module error** | `Cannot find module`, `is not exported` | Fix import path. Check for barrel exports, file extensions (.js in ESM), or missing package. |
| **Setup/teardown** | Tests pass alone, fail together | Fix test isolation: add cleanup in `afterEach`, avoid shared mutable state, use fresh fixtures per test. |
| **Timeout** | `Exceeded timeout of 5000ms` | Add proper `await` for async ops. Increase timeout for slow operations. For E2E: add `waitFor` before assertions. |
| **Selector stale (E2E)** | `Element not found`, `Locator resolved to hidden` | Re-snapshot the page state. Update selector. Add `await locator.waitFor()` before interaction. |
| **Type error** | `Property X does not exist on type Y` | Fix type annotations in test code. Add type assertions or update mock types. |
| **Flaky** | Passes on retry, fails intermittently | See [Flaky Test Handling](#flaky-test-handling). |
| **Environment** | `ECONNREFUSED`, `Database not available` | Check if services are running. Add skip condition: `test.skip(!process.env.DATABASE_URL)`. |

## Iteration Budget

3-iteration maximum, prioritized by fix difficulty:

### Iteration 1: Obvious Fixes
- Import errors (wrong paths, missing extensions)
- Type errors in test code
- Assertion mismatches from wrong expected values
- Missing `await` keywords

### Iteration 2: Interaction Errors
- Setup/teardown isolation issues
- Timeout adjustments
- Selector updates for E2E
- Mock configuration fixes

### Iteration 3: Edge Cases
- Flaky test stabilization
- Environment-dependent fixes
- Complex assertion logic
- Race condition fixes

After 3 iterations, report remaining failures in the coverage report with diagnosis.

## Source Bug Detection

If a test failure reveals a genuine bug in source code:

1. **Do NOT fix the source code** — the cover skill writes tests only
2. **Mark the test** with a clear comment:
   ```typescript
   test.skip('processPayment returns undefined for zero amount', async () => {
     // SOURCE BUG: processPayment() returns undefined when amount === 0
     // Expected: should return { success: true, amount: 0 }
     // Fix in: src/payment/processor.ts:42
     const result = processPayment(0);
     expect(result).toBeDefined();
   });
   ```
3. **Report in Phase 6** under "Source Bugs Detected"

## Flaky Test Handling

A test is flaky if it passes on retry but fails intermittently.

### Diagnosis
```bash
# Run the suspicious test 5 times
npx vitest run path/to/test.ts --repeat=5
npx playwright test path/to/test.spec.ts --repeat-each=5
```

### Common Causes + Fixes

| Cause | Fix |
|-------|-----|
| Race condition (async) | Add explicit `await` + `waitFor` |
| Shared state | Isolate with `beforeEach` setup |
| Time-dependent | Mock `Date.now()` or use fake timers |
| Network timing (E2E) | Add `page.waitForResponse()` before assertion |
| Animation (E2E) | Add `await page.waitForTimeout(300)` or disable animations in test config |
| Port conflict | Use random ports or `--shard` for parallelism |

### Last Resort
If a test remains flaky after 3 fix attempts, mark it:
```typescript
test('flaky scenario', { retry: 2 }, async () => {
  // Retries up to 2 times in CI
});
```
