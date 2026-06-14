# Config Schema

Full field reference for `.experiment/config.yaml`, the project-level experiment definition file.

## Table of Contents

- [Overview](#overview)
- [Field Reference](#field-reference)
- [Field Details](#field-details)
- [Examples](#examples)
- [Validation Rules](#validation-rules)
- [Default Values](#default-values)

## Overview

`.experiment/config.yaml` defines a repeatable experiment configuration. Place it at the project root. Inline arguments override config file values; config file values override defaults.

```
.experiment/
  config.yaml          # Experiment definition (this schema)
  results/             # Auto-created by the experiment loop
    {name}.tsv         # Per-iteration results
    {name}-report.md   # Final report
```

## Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | -- | Unique experiment identifier. Used for results filenames. |
| `description` | string | no | -- | Human-readable description of the experiment goal. |
| `target` | glob | yes | -- | File or glob pattern to modify (e.g. `src/api/handler.ts`, `src/**/*.ts`). |
| `readonly` | list of globs | no | `[]` | Files the agent must not modify. Violations trigger immediate revert. |
| `metric.command` | string | yes | -- | Shell command that produces the metric value. |
| `metric.extract` | string | no | last stdout line | Post-processing expression applied to command output (jq, grep, awk). |
| `metric.direction` | `minimize` \| `maximize` | yes | -- | Whether to minimize or maximize the metric. |
| `metric.unit` | string | no | -- | Human-readable unit label (ms, KB, %, bpb). |
| `metric.goal` | number | no | -- | Stop when the metric reaches this value. |
| `budget.max_iterations` | number | no | `20` | Maximum number of modify-evaluate cycles. Hard cap: 100. |
| `budget.max_minutes` | number | no | `60` | Maximum wall-clock minutes. Hard cap: 480. |
| `budget.iteration_timeout_minutes` | number | no | -- | Kill the metric command if it exceeds this per-iteration limit. |
| `budget.checkpoint_every` | number | no | `0` (never) | Pause for human review every N iterations. 0 disables checkpoints. |
| `hints` | list of strings | no | `[]` | Guidance for the agent's optimization strategy. |

## Field Details

### name

Unique identifier for the experiment. Used as the stem for results files (`{name}.tsv`, `{name}-report.md`). Must be a valid filename: lowercase alphanumeric, hyphens, and underscores only.

```yaml
name: reduce-api-latency
```

### target

File path or glob pattern defining the modification scope. The agent may only edit files matching this pattern. Relative to the project root.

```yaml
target: src/api/handler.ts          # Single file
target: src/api/**/*.ts             # Glob pattern
target: src/pages/                  # Directory (all files within)
```

### readonly

List of glob patterns for files the agent must never modify. Checked via `git diff --name-only` after each modification. A match triggers immediate revert and logs `constraint_violation`.

```yaml
readonly:
  - src/api/types.ts
  - tests/
  - "*.config.*"
```

### metric.command

Shell command executed to measure the metric. Must exit 0 and produce parseable numeric output. Dry-run validated during setup phase.

```yaml
metric:
  command: "npm run bench -- --json"
```

### metric.extract

Post-processing expression applied to the command's stdout. Pipe syntax. When omitted, the last line of stdout is parsed as the metric value.

```yaml
metric:
  extract: "jq '.results[0].mean'"
  extract: "grep 'val_bpb' | awk '{print $NF}'"
```

### metric.direction

Determines whether improvement means a lower or higher value.

| Value | Improvement means |
|-------|-------------------|
| `minimize` | Metric decreases |
| `maximize` | Metric increases |

### metric.goal

Target metric value. The experiment stops when the metric meets or exceeds the goal in the configured direction. Omit to run until budget exhaustion.

### budget.max_iterations

Maximum modify-evaluate cycles. The experiment stops after this many iterations regardless of progress. Hard cap of 100 prevents runaway loops.

### budget.max_minutes

Maximum wall-clock time in minutes from the start of Phase 1. Hard cap of 480 (8 hours).

### budget.checkpoint_every

When set to a positive integer N, the experiment pauses every N iterations and presents a progress summary with continue/adjust/stop options. Set to 0 or omit to disable.

## Examples

### API Latency Optimization

Reduce mean response time of an API handler using a JSON benchmark suite.

```yaml
name: reduce-api-latency
description: Optimize the API handler to reduce mean response time
target: src/api/handler.ts
readonly:
  - src/api/types.ts
  - tests/

metric:
  command: "npm run bench -- --json"
  extract: "jq '.results[0].mean'"
  direction: minimize
  unit: ms
  goal: 100

budget:
  max_iterations: 15
  max_minutes: 60
  iteration_timeout_minutes: 5
  checkpoint_every: 5

hints:
  - "Consider connection pooling optimizations"
  - "The database query in lines 45-60 may be N+1"
  - "Do not change the public API signature"
```

### Test Coverage Improvement

Increase line coverage toward a target using vitest with coverage reporting.

```yaml
name: increase-coverage
description: Raise line coverage of the auth module to 90%
target: src/auth/
readonly:
  - src/auth/types.ts
  - src/auth/__snapshots__/

metric:
  command: "npx vitest run --coverage --reporter=json"
  extract: "jq '.coverageMap.total.lines.pct'"
  direction: maximize
  unit: "%"
  goal: 90

budget:
  max_iterations: 20
  max_minutes: 45
  checkpoint_every: 10
```

### ML Training Optimization

Minimize validation loss for an ML training script using grep extraction.

```yaml
name: reduce-val-bpb
description: Lower validation bits-per-byte by tuning hyperparameters
target: train.py
readonly:
  - data/
  - eval.py

metric:
  command: "uv run train.py --epochs 5 --eval"
  extract: "grep 'val_bpb' | awk '{print $NF}'"
  direction: minimize
  unit: bpb
  goal: 1.0

budget:
  max_iterations: 10
  max_minutes: 120
  iteration_timeout_minutes: 30
```

## Validation Rules

The experiment aborts during setup if any of these conditions are met:

| Rule | Condition |
|------|-----------|
| `name` is required | Missing or empty `name` field. |
| `name` format | Contains characters other than `[a-z0-9_-]`. |
| `target` is required | Missing or empty `target` field. |
| `target` must exist | No files match the target path or glob. |
| `target` must be in a git repo | The resolved target path is not inside a git working tree. |
| `metric.command` is required | Missing or empty `metric.command` field. |
| `metric.direction` is required | Missing or not one of `minimize` / `maximize`. |
| Metric dry-run must succeed | The metric command exits non-zero or produces non-numeric output during setup validation. |
| `budget.max_iterations` range | Value less than 1 or greater than 100. |
| `budget.max_minutes` range | Value less than 1 or greater than 480. |
| `budget.checkpoint_every` range | Negative value. |
| `metric.goal` direction mismatch | Goal is already met by the baseline value (nothing to optimize). |
| `readonly` overlap | A readonly pattern matches the target (would block all modifications). |

## Default Values

| Field | Default |
|-------|---------|
| `description` | *(none)* |
| `readonly` | `[]` |
| `metric.extract` | last line of stdout |
| `metric.unit` | *(none)* |
| `metric.goal` | *(none -- run until budget)* |
| `budget.max_iterations` | `20` |
| `budget.max_minutes` | `60` |
| `budget.iteration_timeout_minutes` | *(none -- no per-iteration timeout)* |
| `budget.checkpoint_every` | `0` (disabled) |
| `hints` | `[]` |
