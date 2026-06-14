# TDD Protocol

Test-driven development enforcement rules by mode for Phase 4 (Build).

## Core Principle

Every code change must have associated tests. The order and strictness of the test-code
relationship varies by mode.

## Greenfield: Strict Red-Green-Refactor

New code gets the full TDD treatment. No implementation without a failing test first.

**Cycle (per task):**

1. **RED** — Write a test for the next piece of functionality
   - Test must be specific and descriptive
   - Run the test — confirm it **fails** (red)
   - If the test passes without implementation, the test is wrong or the feature already exists

2. **GREEN** — Write the minimum code to make the test pass
   - Only enough code to satisfy the failing test
   - No extra features, no premature optimization
   - Run the test — confirm it **passes** (green)

3. **REFACTOR** — Clean up while tests stay green
   - Remove duplication, improve naming, simplify logic
   - Run tests after each refactor step — must stay green
   - Apply coding-standards checks

4. **Repeat** — Next test for next piece of functionality

**Evidence required:** Test run output showing red → green transition for each task.

## Brownfield: Test-Alongside

Existing code changes get tests written in parallel with implementation.

**Cycle (per task):**

1. **UNDERSTAND** — Read existing code and its tests
   - Identify what's changing and what tests exist
   - Note any untested code paths being modified

2. **WRITE TOGETHER** — Implement change and write test simultaneously
   - Write/update tests that cover the changed behavior
   - Write the implementation
   - Both can be developed iteratively

3. **VERIFY** — Run all tests together
   - New tests must pass
   - Existing tests must still pass (no regressions)
   - If existing tests break, fix implementation (not the tests) unless the test was wrong

4. **REFACTOR** — Clean up with tests as safety net
   - Same refactor rules as greenfield

**Evidence required:** Test run output showing all tests pass, including new tests for changed code.

## Bugfix: Regression Test First

The bug gets a test before it gets a fix. This prevents the same bug from recurring.

**Cycle:**

1. **REPRODUCE** — Write a test that reproduces the bug
   - Test encodes the exact failing behavior
   - Run the test — confirm it **fails** (proving the bug exists)
   - If you can't write a reproducing test, investigate further before fixing

2. **FIX** — Implement the minimum fix
   - Only fix the bug, don't refactor surrounding code
   - Run the regression test — confirm it **passes**

3. **VERIFY** — Run full test suite
   - Regression test passes
   - No other tests broken by the fix
   - If other tests break, the fix has unintended side effects — reconsider approach

**Evidence required:** Test output showing regression test fails before fix, passes after.

## Refactor: Characterization Tests

Refactoring requires proof that behavior is preserved. Write characterization tests first
if coverage is insufficient.

**Cycle:**

1. **CHARACTERIZE** — Assess existing test coverage of code being refactored
   - If coverage >= 80%: existing tests are sufficient, proceed to refactor
   - If coverage < 80%: write characterization tests that capture current behavior
   - Characterization tests document what the code **actually does** (not what it should do)

2. **REFACTOR** — Transform the code
   - Make structural changes (extract, inline, rename, reorganize)
   - Run tests after each small transformation — must stay green
   - If a test breaks, the refactor changed behavior — undo and try differently

3. **VERIFY** — Confirm behavior preservation
   - All original tests pass
   - All characterization tests pass
   - No new tests needed (behavior didn't change, only structure)

**Evidence required:** Test output showing identical pass/fail results before and after refactor.

## Test Quality Standards

Regardless of mode, all tests must meet these standards:

- **Descriptive names**: Test name describes the behavior being tested
- **Single assertion focus**: Each test verifies one behavior (multiple asserts OK if testing one concept)
- **Independent**: Tests don't depend on execution order or shared mutable state
- **Fast**: Unit tests < 100ms each, integration tests < 5s each
- **Deterministic**: Same result every run (no time-dependent, random, or network-dependent tests)

## Technology-Specific Patterns

**Python (pytest):**
- Use `pytest` with `pytest-cov` for coverage
- Fixtures for setup/teardown
- `@pytest.mark.parametrize` for data-driven tests
- Mock external services with `unittest.mock` or `pytest-mock`

**TypeScript (Vitest):**
- Use `vitest` with `@vitest/coverage-v8`
- `describe`/`it` blocks with clear nesting
- `vi.mock()` for module mocking
- `beforeEach`/`afterEach` for test isolation

## When TDD Feels Wrong

If strict TDD doesn't fit the task (e.g., exploratory UI work, spike/prototype):
1. Note the exception in the state file
2. Write tests after implementation (test-after is better than no tests)
3. Ensure coverage meets thresholds before proceeding to Phase 5
