# Safety Guardrails

## Table of Contents
- [Overview](#overview)
- [Git Rollback Protocol](#git-rollback-protocol)
- [File Allowlists (Readonly)](#file-allowlists-readonly)
- [Correctness Gates](#correctness-gates)
- [Budget Limits](#budget-limits)
- [Stuck Detection](#stuck-detection)
- [Human Checkpoints](#human-checkpoints)
- [Cost Estimation](#cost-estimation)
- [Metric Tampering Prevention](#metric-tampering-prevention)
- [Multi-Metric Safety](#multi-metric-safety)

## Overview

Safety is non-negotiable for autonomous code modification. The experiment loop modifies code, runs external commands, and makes keep/discard decisions without human review. Every guardrail exists to ensure that no matter what happens -- regression, crash, timeout, interrupt, budget exhaustion -- the codebase is left in a clean, correct state. A failed experiment must never leave broken code on disk.

---

## Git Rollback Protocol

Git is the single source of truth for rollback. Every modification is committed before evaluation, ensuring a clean revert target always exists.

### Before evaluate

After modifying files in Phase 4 (Modify), immediately stage and commit:

```bash
git add -A
git commit -m "experiment: {name} iteration {N} -- {one-line description}"
```

This commit exists solely as a rollback anchor. If the metric regresses, the commit is erased entirely.

### After evaluate (keep)

The commit stays. The branch advances. The new metric value becomes the baseline for the next iteration. No additional git action is needed.

### After evaluate (discard)

The commit is erased:

```bash
git reset --hard HEAD~1
```

This restores the working tree to the state before the modification. The discarded commit is not preserved in history.

### On crash

If the metric command crashes (non-zero exit, unparseable output, timeout), treat identically to discard:

```bash
git reset --hard HEAD~1
```

Log the crash reason in the results TSV before reverting. The crash commit must not persist.

### Clean exit guarantee

On ANY exit path -- budget exhausted, stuck, error, user interrupt, or goal reached -- the git state must be clean. Specifically:

1. **Budget exhausted / goal reached / stuck**: Normal exit. The last kept commit (if any) is HEAD. No dangling uncommitted changes.
2. **Metric command error**: Revert the current iteration's commit, log the error, then check stopping conditions.
3. **Unexpected error** (agent crash, tool failure): The commit-before-evaluate pattern means at worst one extra commit exists. On resumption, detect and revert it.
4. **User interrupt at checkpoint**: The current iteration has already been decided (keep or discard) before the checkpoint fires. Git state is clean.

The invariant: after the experiment ends, `git status` shows a clean working tree and `git log` contains only kept iterations.

---

## File Allowlists (Readonly)

### Configuration

The `readonly` field in config accepts a list of glob patterns:

```yaml
readonly:
  - tests/**
  - src/api/types.ts
  - "*.lock"
  - .gitlab-ci.yml
```

### Default readonly files

Even without explicit configuration, the following are readonly by default:

- **Test files** (`tests/`, `__tests__/`, `*.test.*`, `*.spec.*`) -- prevents metric gaming by modifying assertions
- **Lock files** (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Gemfile.lock`, `poetry.lock`)
- **CI configuration** (`.gitlab-ci.yml`, `.github/workflows/`, `Jenkinsfile`)
- **The experiment config itself** (`.experiment/config.yaml`)

### Enforcement

Before committing in Phase 4, check the diff against the readonly list:

```bash
git diff --name-only HEAD
```

Compare each changed file against the readonly globs. If any match:

1. Revert all changes: `git checkout -- .`
2. Log the iteration as `constraint_violation` in the results TSV
3. Record which readonly file(s) were touched
4. Do NOT count this as a valid iteration (does not decrement budget, but does increment consecutive-discard counter)

### Scope containment

Beyond readonly files, modifications must stay within the declared `target` scope. If the target is `src/api/handler.ts`, changes to `src/db/connection.ts` are out-of-scope. Out-of-scope edits follow the same enforcement as readonly violations.

---

## Correctness Gates

### Test suite gate

After each modification (Phase 4) and before metric evaluation (Phase 5), run the full test suite if tests exist:

1. Detect test runner: look for `npm test`, `pytest`, `go test`, `cargo test`, etc.
2. Run the test suite
3. If tests fail: treat as a crash -- revert the commit, log as `crash` with reason "test suite failed", do NOT proceed to metric evaluation

This prevents "improvements" that break existing functionality. A metric can improve while the code is incorrect -- the test gate catches this.

### Optional gates

These are configurable and off by default:

| Gate | Config key | Behavior on failure |
|------|-----------|-------------------|
| Lint | `gates.lint: true` | Revert and log as `constraint_violation` |
| Typecheck | `gates.typecheck: true` | Revert and log as `constraint_violation` |

Optional gates run after the test suite gate and before metric evaluation. If any gate fails, the iteration is reverted without evaluating the metric.

---

## Budget Limits

Two budgets constrain the experiment. Whichever exhausts first wins.

| Budget | Default | Hard cap | Config key |
|--------|---------|----------|------------|
| Iterations | 20 | 100 | `budget.max_iterations` |
| Wall-clock time | 60 minutes | 480 minutes (8 hours) | `budget.max_minutes` |

### Iteration budget

Each completed iteration (keep, discard, crash, or constraint violation) decrements the iteration budget. When the budget reaches zero, the loop stops and reports `BUDGET_EXHAUSTED`.

Setting `max_iterations` above 100 is silently capped to 100. This prevents runaway experiments from consuming unbounded resources.

### Time budget

Wall-clock time is checked at the start of each iteration. If elapsed time exceeds `max_minutes`, the loop stops before starting a new iteration. An in-progress iteration is allowed to complete.

Setting `max_minutes` above 480 is silently capped to 480.

### Per-iteration timeout

Individual metric command executions can be time-bounded:

```yaml
budget:
  iteration_timeout_minutes: 5
```

If the metric command exceeds this timeout, it is killed. The iteration is logged as `timeout` and reverted.

---

## Stuck Detection

### Mechanism

Track consecutive iterations that do not produce a keep:

- `discard`, `crash`, `timeout`, `constraint_violation` all increment the consecutive-failure counter
- `keep` resets the counter to 0

### Default behavior (threshold: 5 + 1)

| Consecutive failures | Action |
|---------------------|--------|
| 5 | **Strategy reset**: log a warning, re-read all prior results, attempt a fundamentally different approach on the next iteration |
| 6 (5 + 1 more after reset) | **Stop**: report `STUCK` |

The one-iteration grace period after the strategy reset gives the agent a chance to recover with a fresh approach. If that also fails, the experiment is definitively stuck.

### Configuration

```yaml
budget:
  stuck_threshold: 5  # consecutive failures before strategy reset
```

### Stuck message

When stopping due to stuck detection:

```
Stuck after 6 consecutive discards. Best metric: {value} {unit}.
Consider a different approach, broader target scope, or adjusting the goal.
```

---

## Human Checkpoints

### Configuration

```yaml
budget:
  checkpoint_every: 5  # pause every 5 iterations (0 = never)
```

### Behavior

When the current iteration number is a multiple of `checkpoint_every`:

1. **Pause** the loop after the current iteration's decide phase completes (git state is clean)
2. **Present** a progress summary:
   - Iterations completed: N / max
   - Time elapsed: Xm / max
   - Metric: baseline -> current best (delta, delta%)
   - Last N iterations: one-line summaries
   - Kept / discarded / crashed counts
3. **Ask**: "Continue? (y / n / adjust)"

### Options

| Choice | Effect |
|--------|--------|
| **y** (continue) | Resume the loop from the next iteration |
| **n** (stop) | Stop the experiment, report `USER_STOPPED` |
| **adjust** | User can modify: target/goal, readonly list, budget (iterations or minutes), hints |

Adjustments take effect on the next iteration. Changing the readonly list does not retroactively revert kept changes.

---

## Cost Estimation

### Per-iteration token usage

| Phase | Approximate tokens |
|-------|--------------------|
| Hypothesize (read context + prior results) | 3K-6K |
| Modify (generate code changes) | 2K-4K |
| Evaluate (run command + parse output) | 1K-2K |
| Decide + Log | 0.5K-1K |
| **Total per iteration** | **~8K-15K** |

### Approximate cost at Opus pricing

| Iterations | Estimated cost |
|------------|----------------|
| 5 | $0.50-1.25 |
| 10 | $1.00-2.50 |
| 20 (default) | $2.00-5.00 |
| 50 | $5.00-12.50 |
| 100 (hard cap) | $10.00-25.00 |

These are rough estimates. Actual cost depends on target file size, metric command output length, and how much context is read per iteration.

### Cost-saving tips

- Start with a small budget (5-10 iterations) to validate the metric command works before committing to a long run
- Use `--hint` to guide the agent toward promising approaches, reducing wasted iterations
- Set `checkpoint_every: 5` to review progress and stop early if the approach is not productive

---

## Metric Tampering Prevention

Autonomous code modification creates a Goodhart's Law risk: the agent optimizes the metric rather than the underlying quality the metric is supposed to measure.

### Test files are readonly by default

The most common form of metric gaming is modifying test assertions to make tests pass or modifying test harnesses to report better numbers. Making test files readonly by default prevents this.

### External metric commands

When possible, use metric commands that the agent cannot influence by modifying source code alone:

| Metric source | Tamper risk | Recommendation |
|--------------|-------------|----------------|
| External benchmark tool | Low | Preferred -- agent cannot modify the tool |
| CI pipeline output | Low | Good -- pipeline runs in a separate environment |
| Test suite coverage | Medium | Keep test files readonly; watch for test deletion |
| In-repo benchmark script | High | Make the script readonly; consider moving to a separate repo |

### Goodhart's Law warning

If the metric command reads from files that the agent can modify (e.g., a benchmark script in the target directory), emit a warning at setup:

```
Warning: metric command reads from files within the target scope.
The agent could improve the metric by modifying the measurement rather than the code.
Consider making the metric source readonly or using an external measurement tool.
```

---

## Multi-Metric Safety

### Primary vs constraint metrics

An experiment optimizes one **primary metric** (e.g., latency) while ensuring **constraint metrics** do not regress (e.g., tests pass, lint clean, bundle size).

| Metric type | Role | Failure behavior |
|-------------|------|-----------------|
| **Primary** | What to optimize (minimize or maximize) | Regression -> discard |
| **Constraint** | What must NOT regress | ANY regression -> discard, even if primary improved |

### Configuration

```yaml
metric:
  command: "npm run bench -- --json"
  extract: "jq '.results[0].mean'"
  direction: minimize
  unit: ms

constraints:
  - name: tests
    command: "npm test"
    pass_condition: "exit_code == 0"
  - name: bundle_size
    command: "stat -f%z dist/bundle.js"
    direction: minimize
    max_regression: 1%  # allow up to 1% regression
```

### Evaluation order

1. Run constraint checks first (cheaper, fast-fail)
2. If any constraint fails -> discard immediately, do not run primary metric
3. If all constraints pass -> run primary metric and evaluate normally

### The cardinal rule

An iteration that improves the primary metric but regresses ANY constraint metric is **always discarded**. There are no exceptions. This prevents trading correctness for performance or trading one quality dimension for another without explicit human approval.
