# Autonomous Coverage Improvement

## Table of Contents
- [Overview](#overview)
- [Phase 5b: Autonomous Coverage Improvement](#phase-5b-autonomous-coverage-improvement)
- [Iteration Loop Detail](#iteration-loop-detail)
- [Keep/Discard Logic](#keepdiscard-logic)
- [Budget and Stuck Detection](#budget-and-stuck-detection)
- [Improvement Log Schema](#improvement-log-schema)
- [Status Protocol Events](#status-protocol-events)
- [Example Output](#example-output)
- [Integration Notes](#integration-notes)

## Overview

Autonomous iteration toward a coverage target using the Karpathy Loop pattern: hypothesize which uncovered paths matter most, generate tests, measure, keep improvements, discard regressions, repeat. Activates when `--target=N%` is specified. Eliminates manual iteration and compounds improvements across runs -- ideal for overnight or CI-driven coverage campaigns.

## Phase 5b: Autonomous Coverage Improvement

Phase 5b inserts between Phase 5 (Heal) and Phase 6 (Report). It only activates when both conditions are met:

1. `--target=N%` flag was provided
2. Current coverage (after Phase 5 heals) is below the target

```
Phase 5 (Heal) completes
        │
        ▼
  Coverage < target?  ──No──▶  Skip to Phase 6
        │
       Yes
        │
        ▼
  Phase 5b Loop (iterate until exit condition)
        │
        ▼
  Phase 6 (Report) includes improvement log
```

## Iteration Loop Detail

Each iteration follows six steps:

### Step 1: Analyze coverage gaps

Read the coverage report from Phase 2's command. Identify uncovered lines, branches, and functions. Rank by potential impact -- prefer files with many uncovered branches over files missing a single line.

### Step 2: Hypothesize

Select the gap most likely to yield the largest coverage delta. Prefer:
- Uncovered branches in already-partially-tested files (lower effort)
- Error/edge-case paths (high branch coverage impact)
- Exported functions with zero coverage (high function coverage impact)

### Step 3: Generate targeted tests

Write test file(s) targeting the identified gap. Follow the same conventions as Phase 3 (AAA pattern, factories, boundary mocking). Name files with an `_auto` suffix to distinguish from Phase 3 output: `auth.auto.test.ts`, `test_auth_auto.py`.

### Step 4: Measure

Run the same coverage command used in Phase 2. Capture the new coverage percentages.

### Step 5: Evaluate (keep or discard)

Compare new coverage against the baseline. Apply the [keep/discard logic](#keepdiscard-logic).

### Step 6: Log and check exit

Append the iteration result to `.cover/improvement-log.tsv`. Check [exit conditions](#budget-and-stuck-detection). If not met, return to Step 1.

## Keep/Discard Logic

| Outcome | Condition | Action |
|---------|-----------|--------|
| **Keep** | Coverage improved >= 0.5% | Retain test files, update baseline to new coverage |
| **Discard** | Coverage improved < 0.5% | Delete generated test files, baseline unchanged |
| **Crash** | Test execution failed (non-zero exit, compilation error) | Log as crash, delete test files, baseline unchanged |

The 0.5% threshold prevents accumulating marginal tests that add maintenance cost without meaningful coverage gain.

On **keep**: the new coverage becomes the baseline for subsequent iterations. This means the loop compounds -- each kept iteration raises the bar.

On **discard**: the consecutive-discard counter increments. On **keep**: it resets to 0.

## Budget and Stuck Detection

Three exit conditions stop the loop:

| Condition | Default | Flag | Behavior |
|-----------|---------|------|----------|
| **Target reached** | -- | `--target=N%` | Coverage >= N%. Report success. |
| **Budget exhausted** | 10 | `--max-iterations=N` | N iterations completed. Report best achieved vs target. |
| **Stuck** | 3 consecutive discards | -- | 3 consecutive discard/crash results. Report stall. |

When budget is exhausted or stuck is detected, the loop stops gracefully and Phase 6 reports the best coverage achieved alongside the original target.

## Improvement Log Schema

Each iteration appends a row to `.cover/improvement-log.tsv`:

```
iteration	coverage_before	coverage_after	delta	tests_added	tests_kept	status	description	timestamp
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `iteration` | `int` | 1-indexed iteration number |
| `coverage_before` | `float` | Line coverage % before this iteration |
| `coverage_after` | `float` | Line coverage % after running new tests |
| `delta` | `float` | `coverage_after - coverage_before` (signed) |
| `tests_added` | `int` | Number of test cases generated this iteration |
| `tests_kept` | `int` | Number of test cases retained (0 on discard/crash) |
| `status` | `string` | `keep`, `discard`, or `crash` |
| `description` | `string` | Brief note on what was targeted (e.g., "error branches in auth.ts") |
| `timestamp` | `ISO 8601` | When the iteration completed |

### Example Log

```tsv
iteration	coverage_before	coverage_after	delta	tests_added	tests_kept	status	description	timestamp
1	62.0	67.3	5.3	6	6	keep	uncovered branches in auth/login.ts	2026-03-28T02:15:00Z
2	67.3	71.8	4.5	4	4	keep	error paths in payments/checkout.ts	2026-03-28T02:18:00Z
3	71.8	72.0	0.2	3	0	discard	edge cases in cart/totals.ts (marginal)	2026-03-28T02:21:00Z
4	71.8	75.1	3.3	5	5	keep	missing function coverage in cart/discount.ts	2026-03-28T02:24:00Z
5	75.1	75.1	0.0	2	0	crash	integration test compilation error	2026-03-28T02:26:00Z
```

## Status Protocol Events

When `--status-protocol` is enabled, Phase 5b emits three event types. Filter lines starting with `[COVER_TARGET_` to extract them.

### Loop start

```
[COVER_TARGET_START] target=85 baseline=62
```

Emitted once when Phase 5b begins. `baseline` is coverage after Phase 5 heals.

### Per-iteration

```
[COVER_TARGET_ITERATION] iteration=1 coverage=67.3 delta=+5.3 status=keep
[COVER_TARGET_ITERATION] iteration=2 coverage=71.8 delta=+4.5 status=keep
[COVER_TARGET_ITERATION] iteration=3 coverage=71.8 delta=+0.2 status=discard
[COVER_TARGET_ITERATION] iteration=4 coverage=75.1 delta=+3.3 status=keep
[COVER_TARGET_ITERATION] iteration=5 coverage=75.1 delta=+0.0 status=crash
```

### Loop end

```
[COVER_TARGET_DONE] result=reached|exhausted|stuck final=75.1 target=85 iterations=5
```

`result` values:
- `reached` -- target met or exceeded
- `exhausted` -- max iterations hit without reaching target
- `stuck` -- 3 consecutive discards/crashes

## Example Output

A realistic 5-iteration run targeting 85% from a 62% baseline:

```
Phase 5b: Autonomous Coverage Improvement
──────────────────────────────────────────
Target: 85%  |  Baseline: 62.0%  |  Budget: 10 iterations

[COVER_TARGET_START] target=85 baseline=62

Iteration 1/10: Targeting uncovered branches in auth/login.ts
  Generated 6 tests in auth/login.auto.test.ts
  Coverage: 62.0% → 67.3% (+5.3%)  ✓ KEEP
  [COVER_TARGET_ITERATION] iteration=1 coverage=67.3 delta=+5.3 status=keep

Iteration 2/10: Targeting error paths in payments/checkout.ts
  Generated 4 tests in payments/checkout.auto.test.ts
  Coverage: 67.3% → 71.8% (+4.5%)  ✓ KEEP
  [COVER_TARGET_ITERATION] iteration=2 coverage=71.8 delta=+4.5 status=keep

Iteration 3/10: Targeting edge cases in cart/totals.ts
  Generated 3 tests in cart/totals.auto.test.ts
  Coverage: 71.8% → 72.0% (+0.2%)  ✗ DISCARD (below 0.5% threshold)
  Deleted cart/totals.auto.test.ts
  [COVER_TARGET_ITERATION] iteration=3 coverage=71.8 delta=+0.2 status=discard

Iteration 4/10: Targeting missing function coverage in cart/discount.ts
  Generated 5 tests in cart/discount.auto.test.ts
  Coverage: 71.8% → 75.1% (+3.3%)  ✓ KEEP
  [COVER_TARGET_ITERATION] iteration=4 coverage=75.1 delta=+3.3 status=keep

Iteration 5/10: Targeting integration paths in cart/totals.ts
  Generated 2 tests in cart/totals.auto.test.ts
  Test execution failed: TypeError — cannot read property 'items' of undefined
  ✗ CRASH — deleted cart/totals.auto.test.ts
  [COVER_TARGET_ITERATION] iteration=5 coverage=75.1 delta=+0.0 status=crash

  ... (iterations 6-10 continue) ...

Phase 5b complete: 75.1% achieved (target: 85%, +13.1% from baseline)
[COVER_TARGET_DONE] result=exhausted final=75.1 target=85 iterations=10
```

## Integration Notes

- Phase 5b only runs if **all** Phase 5 heals pass. Unresolved heal failures block autonomous iteration.
- Fingerprint gating is bypassed within the loop. Each iteration builds on cumulative improvements rather than re-checking file hashes.
- Each iteration reuses the same coverage command discovered in Phase 2.
- Auto-generated test files use the `_auto` / `.auto` naming convention to distinguish them from Phase 3 output.
- `.cover/improvement-log.tsv` is additive across runs. Add `.cover/` to `.gitignore` (same as fingerprints).
- Cross-reference: the `/experiment` skill implements the generalized Karpathy Loop pattern that this phase specializes for coverage.
