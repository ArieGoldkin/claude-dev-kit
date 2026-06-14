# Status Protocol

Machine-parseable event protocol for `/cover` runs, enabling CI integration, structured logging, and automated monitoring.

## Table of Contents
- [Overview](#overview)
- [Enabling the Protocol](#enabling-the-protocol)
- [Format Specification](#format-specification)
- [Event Types](#event-types)
- [Events Per Phase](#events-per-phase)
- [Summary Event](#summary-event)
- [Error Categories](#error-categories)
- [Full Example Output](#full-example-output)
- [CI Parsing Examples](#ci-parsing-examples)
- [Extending the Protocol](#extending-the-protocol)

## Overview

The status protocol emits structured, single-line events that are easy to filter from human-readable output. Use cases:

- **CI pipelines**: extract coverage deltas for job artifacts and merge request comments
- **Monitoring dashboards**: track phase durations, failure rates, and heal success across runs
- **Structured logging**: ingest events into ELK, Datadog, or CloudWatch for trend analysis
- **Automated gates**: fail a pipeline when coverage delta is below threshold or ARIA regressions appear

## Enabling the Protocol

Pass the `--status-protocol` flag to enable event emission. Without it, no `[COVER_*]` lines are printed -- output remains purely human-readable.

```
/cover --status-protocol src/auth/
/cover --status-protocol --tier=e2e checkout-flow
```

When enabled, status lines are interleaved with normal output. Consumers should filter lines starting with `[COVER_` to extract the protocol stream.

## Format Specification

Each event is a single line:

```
[EVENT_TYPE] key=value key=value ...
```

### Rules

| Rule | Detail |
|------|--------|
| One event per line | Never spans multiple lines |
| No spaces in values | Use underscores or hyphens: `flow=checkout-flow`, `error=no_files` |
| Numeric values unquoted | `files=12`, `duration_ms=4821` |
| Strings unquoted | `phase=discover`, `error=timeout` |
| Booleans | `true` or `false` (lowercase) |
| Lists | Comma-separated, no spaces: `tiers=unit,integration,e2e`, `frameworks=vitest,playwright` |
| Timestamps | ISO 8601 with timezone: `ts=2026-03-27T14:22:01Z` |
| Key order | Not significant; parsers must not depend on position |

## Event Types

| Event | Meaning |
|-------|---------|
| `COVER_STEP_START` | A phase is beginning |
| `COVER_STEP_DONE` | A phase completed successfully |
| `COVER_STEP_FAILED` | A phase failed (run may continue or abort) |
| `COVER_SUMMARY` | Final summary after all phases complete |

## Events Per Phase

### Phase 0: Fingerprint

Cache-based change detection to skip unchanged files.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=fingerprint` | `[COVER_STEP_START] phase=fingerprint` |
| `STEP_DONE` | `cached=N changed=N` | `[COVER_STEP_DONE] phase=fingerprint cached=14 changed=3` |
| `STEP_FAILED` | `error=corrupt_cache` | `[COVER_STEP_FAILED] phase=fingerprint error=corrupt_cache` |

### Phase 1: Discover

Scan for test frameworks and uncovered source files.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=discover` | `[COVER_STEP_START] phase=discover` |
| `STEP_DONE` | `files=N frameworks=list` | `[COVER_STEP_DONE] phase=discover files=8 frameworks=vitest,playwright` |
| `STEP_FAILED` | `error=no_files` | `[COVER_STEP_FAILED] phase=discover error=no_files` |

### Phase 2: Analyze

Run existing tests and collect baseline coverage.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=analyze` | `[COVER_STEP_START] phase=analyze` |
| `STEP_DONE` | `coverage_before=N tests_existing=N` | `[COVER_STEP_DONE] phase=analyze coverage_before=62 tests_existing=45` |
| `STEP_FAILED` | `error=parse_failure` | `[COVER_STEP_FAILED] phase=analyze error=parse_failure` |

### Phase 2b: Flow Match

Match E2E user flows against discovered routes and components.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=flow_match flow=name` | `[COVER_STEP_START] phase=flow_match flow=checkout-flow` |
| `STEP_DONE` | `matched=true\|false` | `[COVER_STEP_DONE] phase=flow_match flow=checkout-flow matched=true` |
| `STEP_FAILED` | `error=flow_not_found` | `[COVER_STEP_FAILED] phase=flow_match flow=checkout-flow error=flow_not_found` |

### Phase 3: Generate

Generate test files across requested tiers.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=generate` | `[COVER_STEP_START] phase=generate` |
| `STEP_DONE` | `tests_generated=N tiers=list` | `[COVER_STEP_DONE] phase=generate tests_generated=34 tiers=unit,integration,e2e` |
| `STEP_FAILED` | `error=generation_failed` | `[COVER_STEP_FAILED] phase=generate error=generation_failed` |

### Phase 3b: ARIA Baseline

Capture accessibility snapshot before test execution for regression detection.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=aria_baseline` | `[COVER_STEP_START] phase=aria_baseline` |
| `STEP_DONE` | `nodes=N pages=N` | `[COVER_STEP_DONE] phase=aria_baseline nodes=142 pages=3` |
| `STEP_FAILED` | `error=snapshot_failed` | `[COVER_STEP_FAILED] phase=aria_baseline error=snapshot_failed` |

### Phase 4: Execute

Run all generated tests.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=execute` | `[COVER_STEP_START] phase=execute` |
| `STEP_DONE` | `pass=N fail=N skip=N duration_ms=N` | `[COVER_STEP_DONE] phase=execute pass=31 fail=3 skip=0 duration_ms=4821` |
| `STEP_FAILED` | `error=timeout` | `[COVER_STEP_FAILED] phase=execute error=timeout` |

### Phase 4b: ARIA Diff

Compare post-execution accessibility state against baseline.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=aria_diff` | `[COVER_STEP_START] phase=aria_diff` |
| `STEP_DONE` | `regressions=N warnings=N` | `[COVER_STEP_DONE] phase=aria_diff regressions=0 warnings=2` |
| `STEP_FAILED` | `error=diff_failed` | `[COVER_STEP_FAILED] phase=aria_diff error=diff_failed` |

### Phase 5: Heal

Fix failing tests iteratively without modifying source code.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=heal iteration=N` | `[COVER_STEP_START] phase=heal iteration=1` |
| `STEP_DONE` | `healed=N remaining=N` | `[COVER_STEP_DONE] phase=heal iteration=1 healed=2 remaining=1` |
| `STEP_FAILED` | `error=heal_exhausted` | `[COVER_STEP_FAILED] phase=heal iteration=3 error=heal_exhausted` |

### Phase 5b: Autonomous Coverage Improvement

Active when `--target=N%` is specified. Emits target-specific events alongside standard step events.

| Event | Keys | Example |
|-------|------|---------|
| `TARGET_START` | `target=N baseline=N` | `[COVER_TARGET_START] target=85 baseline=62` |
| `TARGET_ITERATION` | `iteration=N coverage=N delta=+N status=keep\|discard\|crash` | `[COVER_TARGET_ITERATION] iteration=1 coverage=67.3 delta=+5.3 status=keep` |
| `TARGET_DONE` | `result=reached\|exhausted\|stuck final=N target=N iterations=N` | `[COVER_TARGET_DONE] result=reached final=85.2 target=85 iterations=4` |

**Result values:**
- `reached` — coverage >= target
- `exhausted` — max iterations completed without reaching target
- `stuck` — 3 consecutive discards/crashes

### Phase 6: Report

Generate the final coverage comparison report.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=report` | `[COVER_STEP_START] phase=report` |
| `STEP_DONE` | `coverage_after=N delta=+N` | `[COVER_STEP_DONE] phase=report coverage_after=84 delta=+22` |
| `STEP_FAILED` | `error=report_failed` | `[COVER_STEP_FAILED] phase=report error=report_failed` |

## Summary Event

Emitted once at the end of every run, regardless of success or failure:

```
[COVER_SUMMARY] result=pass|fail phases=N duration_ms=N coverage_delta=+N tests_total=N tests_pass=N tests_fail=N healed=N aria_regressions=N
```

| Key | Type | Description |
|-----|------|-------------|
| `result` | `pass\|fail` | `pass` if all phases succeeded and no test failures remain |
| `phases` | number | Count of phases executed (including sub-phases like 2b, 3b, 4b) |
| `duration_ms` | number | Wall-clock time for the entire run |
| `coverage_delta` | signed number | Coverage change, e.g. `+22` or `-1` |
| `tests_total` | number | Total tests generated |
| `tests_pass` | number | Tests passing after heal loop |
| `tests_fail` | number | Tests still failing after heal loop |
| `healed` | number | Tests fixed during heal iterations |
| `aria_regressions` | number | Accessibility regressions detected (0 if ARIA phases skipped) |

## Error Categories

| Category | Meaning | Typical Phase |
|----------|---------|---------------|
| `timeout` | Operation exceeded time limit | execute, aria_baseline |
| `assertion` | Test assertion failed after all heal attempts | execute, heal |
| `environment` | Missing service, port, or dependency | analyze, execute |
| `parse_failure` | Could not parse coverage output or config | analyze, report |
| `snapshot_failed` | ARIA snapshot could not be captured | aria_baseline |
| `heal_exhausted` | All heal iterations used, failures remain | heal |
| `corrupt_cache` | Fingerprint cache is unreadable | fingerprint |
| `no_files` | No source files found in scope | discover |
| `flow_not_found` | Named E2E flow has no matching routes | flow_match |
| `generation_failed` | Test generation produced no output | generate |
| `diff_failed` | ARIA diff could not compare snapshots | aria_diff |
| `report_failed` | Report generation encountered an error | report |
| `unknown` | Unclassified error | any |

## Full Example Output

A realistic `/cover --status-protocol src/auth/` run with status lines interleaved with human-readable output:

```
$ /cover --status-protocol src/auth/

[COVER_STEP_START] phase=fingerprint
Fingerprinting src/auth/ ...
[COVER_STEP_DONE] phase=fingerprint cached=6 changed=4

[COVER_STEP_START] phase=discover
Scanning for test frameworks...
  Found: vitest.config.ts, playwright.config.ts
  Uncovered files: 4 of 10 in src/auth/
[COVER_STEP_DONE] phase=discover files=4 frameworks=vitest,playwright

[COVER_STEP_START] phase=analyze
Running existing test suite for baseline...
  vitest: 45 tests, 62% line coverage
[COVER_STEP_DONE] phase=analyze coverage_before=62 tests_existing=45

[COVER_STEP_START] phase=flow_match flow=login-flow
  Matching login-flow against discovered routes...
[COVER_STEP_DONE] phase=flow_match flow=login-flow matched=true

[COVER_STEP_START] phase=generate
Generating tests across 3 tiers...
  Unit: 18 tests in 3 files
  Integration: 8 tests in 2 files
  E2E: 3 tests in 1 file
[COVER_STEP_DONE] phase=generate tests_generated=29 tiers=unit,integration,e2e

[COVER_STEP_START] phase=aria_baseline
Capturing ARIA snapshot for 2 pages...
[COVER_STEP_DONE] phase=aria_baseline nodes=98 pages=2

[COVER_STEP_START] phase=execute
Running 29 generated tests...
  Unit:        18 pass, 0 fail
  Integration:  6 pass, 2 fail
  E2E:          3 pass, 0 fail
[COVER_STEP_DONE] phase=execute pass=27 fail=2 skip=0 duration_ms=6340

[COVER_STEP_START] phase=aria_diff
Comparing ARIA snapshots...
[COVER_STEP_DONE] phase=aria_diff regressions=0 warnings=1

[COVER_STEP_START] phase=heal iteration=1
Healing 2 failures (iteration 1/3)...
  Fixed: missing await in token-refresh test
  Fixed: wrong mock return type in session test
[COVER_STEP_DONE] phase=heal iteration=1 healed=2 remaining=0

[COVER_STEP_START] phase=report
Generating coverage report...
  Coverage: 62% -> 84% (+22%)
[COVER_STEP_DONE] phase=report coverage_after=84 delta=+22

[COVER_SUMMARY] result=pass phases=10 duration_ms=14520 coverage_delta=+22 tests_total=29 tests_pass=29 tests_fail=0 healed=2 aria_regressions=0
```

## CI Parsing Examples

### Extract coverage delta

```bash
grep '^\[COVER_SUMMARY\]' cover-output.log | grep -o 'coverage_delta=[^ ]*'
# Output: coverage_delta=+22
```

### Detect failed phases

```bash
grep '^\[COVER_STEP_FAILED\]' cover-output.log | awk '{print $2}'
# Output: phase=execute  (if any phase failed)
```

### Check pass/fail result

```bash
result=$(grep '^\[COVER_SUMMARY\]' cover-output.log | grep -o 'result=[^ ]*' | cut -d= -f2)
if [ "$result" != "pass" ]; then
  echo "Cover run failed"
  exit 1
fi
```

### Convert summary to JSON

```bash
grep '^\[COVER_SUMMARY\]' cover-output.log \
  | sed 's/^\[COVER_SUMMARY\] //' \
  | tr ' ' '\n' \
  | awk -F= '{printf "\"%s\": \"%s\",\n", $1, $2}' \
  | sed '$ s/,$//' \
  | jq -Rs 'split("\n") | map(select(. != "")) | join(" ") | "{" + . + "}" | fromjson'
```

Output:
```json
{
  "result": "pass",
  "phases": "10",
  "duration_ms": "14520",
  "coverage_delta": "+22",
  "tests_total": "29",
  "tests_pass": "29",
  "tests_fail": "0",
  "healed": "2",
  "aria_regressions": "0"
}
```

### GitLab CI job example

```yaml
cover:
  stage: test
  script:
    - claude-code "/cover --status-protocol src/" 2>&1 | tee cover-output.log
    - |
      # Extract summary values for artifacts
      delta=$(grep '^\[COVER_SUMMARY\]' cover-output.log | grep -o 'coverage_delta=[^ ]*' | cut -d= -f2)
      result=$(grep '^\[COVER_SUMMARY\]' cover-output.log | grep -o 'result=[^ ]*' | cut -d= -f2)
      fails=$(grep '^\[COVER_SUMMARY\]' cover-output.log | grep -o 'tests_fail=[^ ]*' | cut -d= -f2)

      echo "COVER_RESULT=$result" >> cover-metrics.env
      echo "COVER_DELTA=$delta" >> cover-metrics.env
      echo "COVER_FAILS=$fails" >> cover-metrics.env

      # Fail the job if cover failed or regressions detected
      if [ "$result" != "pass" ]; then exit 1; fi
  artifacts:
    reports:
      dotenv: cover-metrics.env
    paths:
      - cover-output.log
    when: always
```

The `cover-metrics.env` artifact makes `$COVER_RESULT`, `$COVER_DELTA`, and `$COVER_FAILS` available to downstream jobs (e.g. for MR comments or Slack notifications).

## Extending the Protocol

To add custom keys for plugin-specific phases:

1. **Use the existing event types.** Do not invent new `[COVER_*]` prefixes. Add keys to `STEP_START`, `STEP_DONE`, or `STEP_FAILED` instead.

2. **Namespace custom keys** with a prefix to avoid collisions:
   ```
   [COVER_STEP_DONE] phase=execute pass=31 fail=0 skip=0 duration_ms=4821 myplug_retries=2
   ```

3. **Follow the value rules.** No spaces, no quotes, numeric values unquoted, lists comma-separated.

4. **Document new keys** in this file under the relevant phase table.

5. **Never remove existing keys** from a phase -- only add. Downstream parsers may depend on them.

6. **Custom phases** can be added as new sub-phases (e.g. `phase=my_custom_phase`). The phase name must contain only lowercase letters, digits, underscores, and hyphens. Register the phase in the events-per-phase table above.
