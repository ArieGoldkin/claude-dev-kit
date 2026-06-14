# Status Protocol

Machine-parseable event protocol for `/experiment` runs, enabling CI integration, structured logging, and automated monitoring.

## Table of Contents
- [Overview](#overview)
- [Enabling the Protocol](#enabling-the-protocol)
- [Format Specification](#format-specification)
- [Event Types](#event-types)
- [Events Per Phase](#events-per-phase)
- [Summary Event](#summary-event)
- [Full Example Output](#full-example-output)
- [CI Parsing Examples](#ci-parsing-examples)
- [Extending the Protocol](#extending-the-protocol)

## Overview

The status protocol emits structured, single-line events that are easy to filter from human-readable output. Use cases:

- **CI pipelines**: extract metric deltas for job artifacts and merge request comments
- **Monitoring dashboards**: track iteration outcomes, kept/discarded ratios, and convergence rates across runs
- **Structured logging**: ingest events into ELK, Datadog, or CloudWatch for trend analysis
- **Automated gates**: fail a pipeline when metric regression exceeds threshold or stuck detection triggers

## Enabling the Protocol

Pass the `--status-protocol` flag to enable event emission. Without it, no `[EXPERIMENT_*]` lines are printed -- output remains purely human-readable.

```
/experiment src/api/handler.ts --metric "npm run bench" --minimize --status-protocol
/experiment src/ --metric "stat -f%z dist/bundle.js" --minimize --goal 50000 --status-protocol
```

When enabled, status lines are interleaved with normal output. Consumers should filter lines starting with `[EXPERIMENT_` to extract the protocol stream.

## Format Specification

Each event is a single line:

```
[EVENT_TYPE] key=value key=value ...
```

### Rules

| Rule | Detail |
|------|--------|
| One event per line | Never spans multiple lines |
| No spaces in values | Use underscores or hyphens: `name=reduce-latency`, `status=keep` |
| Numeric values unquoted | `iteration=3`, `duration_ms=4821` |
| Strings unquoted | `phase=setup`, `status=discard` |
| Booleans | `true` or `false` (lowercase) |
| Lists | Comma-separated, no spaces: `files=handler.ts,utils.ts` |
| Timestamps | ISO 8601 with timezone: `ts=2026-03-28T14:22:01Z` |
| Key order | Not significant; parsers must not depend on position |

## Event Types

| Event | Meaning |
|-------|---------|
| `EXPERIMENT_STEP_START` | A phase is beginning |
| `EXPERIMENT_STEP_DONE` | A phase completed successfully |
| `EXPERIMENT_STEP_FAILED` | A phase failed (run may continue or abort) |
| `EXPERIMENT_SUMMARY` | Final summary after all phases complete |

## Events Per Phase

### Phase 1: Setup

Validate inputs and prepare the experiment environment.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=setup` | `[EXPERIMENT_STEP_START] phase=setup` |
| `STEP_DONE` | `name=N target=path` | `[EXPERIMENT_STEP_DONE] phase=setup name=reduce-latency target=src/api/handler.ts` |
| `STEP_FAILED` | `error=not_git_repo` | `[EXPERIMENT_STEP_FAILED] phase=setup error=not_git_repo` |

### Phase 2: Baseline

Establish the starting metric value.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=baseline` | `[EXPERIMENT_STEP_START] phase=baseline` |
| `STEP_DONE` | `metric=N unit=U goal=N\|none` | `[EXPERIMENT_STEP_DONE] phase=baseline metric=187.3 unit=ms goal=100` |
| `STEP_FAILED` | `error=metric_failed` | `[EXPERIMENT_STEP_FAILED] phase=baseline error=metric_failed` |

### Phase 3: Hypothesize

Analyze the target and propose a change.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=hypothesize iteration=N` | `[EXPERIMENT_STEP_START] phase=hypothesize iteration=1` |
| `STEP_DONE` | `description=desc` | `[EXPERIMENT_STEP_DONE] phase=hypothesize iteration=1 description=memoize-expensive-lookup` |
| `STEP_FAILED` | `error=no_hypothesis` | `[EXPERIMENT_STEP_FAILED] phase=hypothesize iteration=1 error=no_hypothesis` |

### Phase 4: Modify

Apply the hypothesized change and commit.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=modify iteration=N` | `[EXPERIMENT_STEP_START] phase=modify iteration=1` |
| `STEP_DONE` | `commit=hash files_changed=N` | `[EXPERIMENT_STEP_DONE] phase=modify iteration=1 commit=b2c3d4e files_changed=1` |
| `STEP_FAILED` | `error=constraint_violation` | `[EXPERIMENT_STEP_FAILED] phase=modify iteration=1 error=constraint_violation` |

### Phase 5: Evaluate

Run the metric command and compare to current best.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=evaluate iteration=N` | `[EXPERIMENT_STEP_START] phase=evaluate iteration=1` |
| `STEP_DONE` | `metric=N delta=N delta_pct=N` | `[EXPERIMENT_STEP_DONE] phase=evaluate iteration=1 metric=142.1 delta=-45.2 delta_pct=-24.1` |
| `STEP_FAILED` | `error=crash\|timeout` | `[EXPERIMENT_STEP_FAILED] phase=evaluate iteration=1 error=crash` |

### Phase 6: Decide

Keep or discard the change based on metric comparison.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=decide iteration=N` | `[EXPERIMENT_STEP_START] phase=decide iteration=1` |
| `STEP_DONE` | `status=keep\|discard\|crash\|timeout` | `[EXPERIMENT_STEP_DONE] phase=decide iteration=1 status=keep` |

### Phase 7: Log

Record the iteration result to TSV.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=log iteration=N` | `[EXPERIMENT_STEP_START] phase=log iteration=1` |
| `STEP_DONE` | `metric=N status=S` | `[EXPERIMENT_STEP_DONE] phase=log iteration=1 metric=142.1 status=keep` |

### Phase 8: Iterate or Report

Check stopping conditions and generate the final report.

| Event | Keys | Example |
|-------|------|---------|
| `STEP_START` | `phase=iterate iteration=N` | `[EXPERIMENT_STEP_START] phase=iterate iteration=5` |
| `STEP_DONE` | `action=continue\|stop reason=R` | `[EXPERIMENT_STEP_DONE] phase=iterate iteration=5 action=stop reason=goal_reached` |

## Summary Event

Emitted once at the end of every run, regardless of success or failure:

```
[EXPERIMENT_SUMMARY] result=R iterations=N metric_start=N metric_end=N delta=N kept=N discarded=N crashed=N duration_ms=N
```

| Key | Type | Description |
|-----|------|-------------|
| `result` | `goal_reached\|budget_exhausted\|time_exhausted\|user_stopped\|stuck` | How the experiment ended |
| `iterations` | number | Total iterations executed |
| `metric_start` | number | Baseline metric value |
| `metric_end` | number | Final best metric value |
| `delta` | signed number | Change from baseline, e.g. `-52.2` or `+18` |
| `kept` | number | Iterations where the change was kept |
| `discarded` | number | Iterations where the change was discarded |
| `crashed` | number | Iterations where the metric command crashed |
| `duration_ms` | number | Wall-clock time for the entire run |

## Full Example Output

A realistic `/experiment --status-protocol` run with status lines interleaved with human-readable output:

```
$ /experiment src/api/handler.ts --metric "npm run bench -- --json | jq '.results[0].mean'" --minimize --goal 100 --unit ms --iterations 6 --status-protocol

[EXPERIMENT_STEP_START] phase=setup
Validating inputs and preparing environment...
  Target: src/api/handler.ts
  Direction: minimize
  Budget: 6 iterations, 60 minutes
[EXPERIMENT_STEP_DONE] phase=setup name=reduce-latency target=src/api/handler.ts

[EXPERIMENT_STEP_START] phase=baseline
Running metric command against unmodified codebase...
  Baseline: 187.3 ms (goal: 100 ms, gap: 87.3 ms)
[EXPERIMENT_STEP_DONE] phase=baseline metric=187.3 unit=ms goal=100

[EXPERIMENT_STEP_START] phase=hypothesize iteration=1
Analyzing src/api/handler.ts for optimization opportunities...
  Hypothesis: memoize expensive database lookup in getUser()
[EXPERIMENT_STEP_DONE] phase=hypothesize iteration=1 description=memoize-expensive-lookup
[EXPERIMENT_STEP_START] phase=modify iteration=1
[EXPERIMENT_STEP_DONE] phase=modify iteration=1 commit=b2c3d4e files_changed=1
[EXPERIMENT_STEP_START] phase=evaluate iteration=1
  Metric: 142.1 ms (-45.2, -24.1%)
[EXPERIMENT_STEP_DONE] phase=evaluate iteration=1 metric=142.1 delta=-45.2 delta_pct=-24.1
[EXPERIMENT_STEP_START] phase=decide iteration=1
[EXPERIMENT_STEP_DONE] phase=decide iteration=1 status=keep
[EXPERIMENT_STEP_DONE] phase=log iteration=1 metric=142.1 status=keep
[EXPERIMENT_STEP_DONE] phase=iterate iteration=1 action=continue reason=budget_remaining

[EXPERIMENT_STEP_START] phase=hypothesize iteration=2
  Hypothesis: convert sync file read to async stream
[EXPERIMENT_STEP_DONE] phase=hypothesize iteration=2 description=async-file-stream
[EXPERIMENT_STEP_START] phase=modify iteration=2
[EXPERIMENT_STEP_DONE] phase=modify iteration=2 commit=c3d4e5f files_changed=1
[EXPERIMENT_STEP_START] phase=evaluate iteration=2
  Metric: 155.8 ms (+13.7, +9.7% from best)
[EXPERIMENT_STEP_DONE] phase=evaluate iteration=2 metric=155.8 delta=+13.7 delta_pct=+9.7
[EXPERIMENT_STEP_START] phase=decide iteration=2
  Discarding: regression from best (142.1 ms)
[EXPERIMENT_STEP_DONE] phase=decide iteration=2 status=discard
[EXPERIMENT_STEP_DONE] phase=log iteration=2 metric=155.8 status=discard
[EXPERIMENT_STEP_DONE] phase=iterate iteration=2 action=continue reason=budget_remaining

[EXPERIMENT_STEP_START] phase=hypothesize iteration=3
  Hypothesis: batch database queries to reduce round trips
[EXPERIMENT_STEP_DONE] phase=hypothesize iteration=3 description=batch-db-queries
[EXPERIMENT_STEP_START] phase=modify iteration=3
[EXPERIMENT_STEP_DONE] phase=modify iteration=3 commit=d4e5f6g files_changed=1
[EXPERIMENT_STEP_START] phase=evaluate iteration=3
  Metric: 108.9 ms (-33.2, -23.4% from best)
[EXPERIMENT_STEP_DONE] phase=evaluate iteration=3 metric=108.9 delta=-33.2 delta_pct=-23.4
[EXPERIMENT_STEP_DONE] phase=decide iteration=3 status=keep
[EXPERIMENT_STEP_DONE] phase=log iteration=3 metric=108.9 status=keep
[EXPERIMENT_STEP_DONE] phase=iterate iteration=3 action=continue reason=budget_remaining

[EXPERIMENT_STEP_START] phase=hypothesize iteration=4
  Hypothesis: add connection pooling
[EXPERIMENT_STEP_DONE] phase=hypothesize iteration=4 description=connection-pooling
[EXPERIMENT_STEP_START] phase=modify iteration=4
[EXPERIMENT_STEP_DONE] phase=modify iteration=4 commit=e5f6g7h files_changed=2
[EXPERIMENT_STEP_FAILED] phase=evaluate iteration=4 error=crash
  Metric command crashed: syntax error in connection config
[EXPERIMENT_STEP_DONE] phase=decide iteration=4 status=crash
[EXPERIMENT_STEP_DONE] phase=log iteration=4 metric=0 status=crash
[EXPERIMENT_STEP_DONE] phase=iterate iteration=4 action=continue reason=budget_remaining

[EXPERIMENT_STEP_START] phase=hypothesize iteration=5
  Hypothesis: connection pooling with corrected config
[EXPERIMENT_STEP_DONE] phase=hypothesize iteration=5 description=connection-pooling-fixed
[EXPERIMENT_STEP_START] phase=modify iteration=5
[EXPERIMENT_STEP_DONE] phase=modify iteration=5 commit=f6g7h8i files_changed=1
[EXPERIMENT_STEP_DONE] phase=evaluate iteration=5 metric=95.1 delta=-13.8 delta_pct=-12.7
[EXPERIMENT_STEP_DONE] phase=decide iteration=5 status=keep
[EXPERIMENT_STEP_DONE] phase=log iteration=5 metric=95.1 status=keep
[EXPERIMENT_STEP_DONE] phase=iterate iteration=5 action=stop reason=goal_reached

  Goal reached: 95.1 ms <= 100 ms

[EXPERIMENT_SUMMARY] result=goal_reached iterations=5 metric_start=187.3 metric_end=95.1 delta=-92.2 kept=3 discarded=1 crashed=1 duration_ms=312400
```

## CI Parsing Examples

### Extract metric delta

```bash
grep '^\[EXPERIMENT_SUMMARY\]' experiment-output.log | grep -o 'delta=[^ ]*'
# Output: delta=-92.2
```

### Detect failed phases

```bash
grep '^\[EXPERIMENT_STEP_FAILED\]' experiment-output.log | awk '{print $2, $3}'
# Output: phase=evaluate iteration=4
```

### Check result

```bash
result=$(grep '^\[EXPERIMENT_SUMMARY\]' experiment-output.log | grep -o 'result=[^ ]*' | cut -d= -f2)
if [ "$result" != "goal_reached" ]; then
  echo "Experiment did not reach goal: $result"
  exit 1
fi
```

### GitLab CI job example

```yaml
experiment:
  stage: test
  script:
    - claude-code "/experiment src/api/ --metric 'npm run bench' --minimize --goal 100 --status-protocol" 2>&1 | tee experiment-output.log
    - |
      # Extract summary values for artifacts
      result=$(grep '^\[EXPERIMENT_SUMMARY\]' experiment-output.log | grep -o 'result=[^ ]*' | cut -d= -f2)
      delta=$(grep '^\[EXPERIMENT_SUMMARY\]' experiment-output.log | grep -o 'delta=[^ ]*' | cut -d= -f2)
      kept=$(grep '^\[EXPERIMENT_SUMMARY\]' experiment-output.log | grep -o 'kept=[^ ]*' | cut -d= -f2)
      crashed=$(grep '^\[EXPERIMENT_SUMMARY\]' experiment-output.log | grep -o 'crashed=[^ ]*' | cut -d= -f2)

      echo "EXPERIMENT_RESULT=$result" >> experiment-metrics.env
      echo "EXPERIMENT_DELTA=$delta" >> experiment-metrics.env
      echo "EXPERIMENT_KEPT=$kept" >> experiment-metrics.env
      echo "EXPERIMENT_CRASHED=$crashed" >> experiment-metrics.env

      # Fail the job if experiment did not reach goal
      if [ "$result" != "goal_reached" ]; then exit 1; fi
  artifacts:
    reports:
      dotenv: experiment-metrics.env
    paths:
      - experiment-output.log
    when: always
```

The `experiment-metrics.env` artifact makes `$EXPERIMENT_RESULT`, `$EXPERIMENT_DELTA`, `$EXPERIMENT_KEPT`, and `$EXPERIMENT_CRASHED` available to downstream jobs (e.g. for MR comments or Slack notifications).

## Extending the Protocol

To add custom keys for plugin-specific phases:

1. **Use the existing event types.** Do not invent new `[EXPERIMENT_*]` prefixes. Add keys to `STEP_START`, `STEP_DONE`, or `STEP_FAILED` instead.

2. **Namespace custom keys** with a prefix to avoid collisions:
   ```
   [EXPERIMENT_STEP_DONE] phase=evaluate iteration=3 metric=108.9 delta=-33.2 myplug_gpu_util=87
   ```

3. **Follow the value rules.** No spaces, no quotes, numeric values unquoted, lists comma-separated.

4. **Document new keys** in this file under the relevant phase table.

5. **Never remove existing keys** from a phase -- only add. Downstream parsers may depend on them.

6. **Custom phases** can be added as new sub-phases (e.g. `phase=my_custom_phase`). The phase name must contain only lowercase letters, digits, underscores, and hyphens. Register the phase in the events-per-phase table above.
