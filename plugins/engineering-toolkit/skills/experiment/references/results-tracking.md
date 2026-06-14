# Results Tracking

TSV-based iteration logging for `/experiment` runs, enabling trend analysis, prior-result learning, and post-experiment reporting.

## Table of Contents

- [Overview](#overview)
- [TSV Schema](#tsv-schema)
- [Status Values](#status-values)
- [Directory Convention](#directory-convention)
- [Gitignore Recommendation](#gitignore-recommendation)
- [Example TSV](#example-tsv)
- [Trend Visualization](#trend-visualization)
- [Post-Experiment Analysis Patterns](#post-experiment-analysis-patterns)
- [Integration with Langfuse](#integration-with-langfuse)

## Overview

Every `/experiment` run logs each iteration to `.experiment/results/{name}.tsv`. This file serves three purposes:

1. **Live progress tracking** -- each row is appended as the iteration completes
2. **Prior-result learning** -- on subsequent runs with the same name, the agent reads prior results to avoid repeating failed approaches
3. **Post-experiment reporting** -- the final report aggregates TSV data into a summary with cumulative diffs and analysis

## TSV Schema

The header row and all data rows use tab-separated values. Fields must appear in this order:

| Field | Type | Description |
|-------|------|-------------|
| `iteration` | int | Zero-indexed iteration number; 0 is always the baseline |
| `commit` | sha7 | First 7 characters of the git commit SHA; `-` if no commit (crash/timeout) |
| `metric_value` | float | Measured metric value; `-` if measurement failed |
| `delta` | signed float | Change from current best value; `-` for baseline and failed measurements |
| `delta_pct` | signed string | Percentage change from baseline (e.g. `-24.1%`); `-` for baseline |
| `status` | enum | One of: `baseline`, `keep`, `discard`, `crash`, `timeout`, `constraint_violation` |
| `description` | string | One-line description of the change attempted |
| `duration_s` | float | Wall-clock seconds for the iteration (modify + evaluate + decide) |
| `timestamp` | ISO 8601 | When the iteration completed, e.g. `2026-03-28T10:05:00Z` |

All numeric fields use `.` as the decimal separator. String fields must not contain tabs or newlines.

## Status Values

| Status | Meaning | Commit Kept? | Metric Recorded? |
|--------|---------|--------------|------------------|
| `baseline` | Iteration 0 -- initial measurement before any modifications | N/A | Yes |
| `keep` | Metric improved relative to current best; commit retained | Yes | Yes |
| `discard` | Metric regressed or unchanged; commit reverted | No | Yes |
| `crash` | Metric command failed (non-zero exit, no numeric output) | No | No (`-`) |
| `timeout` | Metric command exceeded `iteration_timeout_minutes` | No | No (`-`) |
| `constraint_violation` | Modified a readonly or out-of-scope file; commit reverted | No | No (`-`) |

The `keep` status is only assigned when the metric strictly improves. For minimize direction, the new value must be lower than the current best. For maximize, it must be higher. Marginal improvements under 0.1% with large diffs are treated as `discard` (simplicity tiebreaker).

## Directory Convention

```
.experiment/
├── config.yaml              # Optional file-based experiment configuration
└── results/
    ├── reduce-api-latency.tsv
    ├── reduce-api-latency-report.md
    ├── improve-lighthouse.tsv
    └── improve-lighthouse-report.md
```

- One TSV file per experiment name
- The corresponding `-report.md` is generated at experiment completion
- Multiple experiments can coexist; each has its own TSV
- Prior results persist across runs -- restarting an experiment appends to the existing TSV

## Gitignore Recommendation

Add `.experiment/results/` to `.gitignore`. Results are machine-specific and session-specific -- they should not be committed:

```gitignore
# Experiment results (machine-specific, regenerated on each run)
.experiment/results/
```

The `.experiment/config.yaml` file **should** be committed -- it defines the experiment parameters and is useful for reproducibility.

## Example TSV

A realistic 8-iteration experiment minimizing API response time:

```
iteration	commit	metric_value	delta	delta_pct	status	description	duration_s	timestamp
0	a1b2c3d	187.3	-	-	baseline	initial measurement	2.1	2026-03-28T10:00:00Z
1	b2c3d4e	142.1	-45.2	-24.1%	keep	memoized expensive computation in getUser	45.3	2026-03-28T10:05:00Z
2	c3d4e5f	155.8	+13.7	+9.7%	discard	tried async prefetch but added overhead	62.1	2026-03-28T10:10:00Z
3	d4e5f6g	138.9	-3.2	-2.3%	keep	batched N+1 database queries	38.7	2026-03-28T10:14:00Z
4	-	-	-	-	crash	syntax error in template literal	5.2	2026-03-28T10:15:00Z
5	e5f6g7h	135.1	-3.8	-2.7%	keep	added connection pooling	51.4	2026-03-28T10:20:00Z
6	f6g7h8i	136.2	+1.1	+0.8%	discard	response compression added latency for small payloads	44.8	2026-03-28T10:25:00Z
7	g7h8i9j	133.8	-1.3	-1.0%	keep	inlined hot-path helper function	29.6	2026-03-28T10:29:00Z
8	h8i9j0k	133.5	-0.3	-0.2%	discard	switched to faster JSON serializer (under 0.1% gain, 40 lines)	55.1	2026-03-28T10:34:00Z
```

Reading this TSV: the experiment started at 187.3ms, achieved 4 successful improvements, discarded 2 regressions, had 1 crash, and ended at 133.8ms -- a 28.6% reduction. Iteration 8 was discarded despite a small improvement due to the simplicity tiebreaker (< 0.1% gain with a large diff).

## Trend Visualization

Use an ASCII chart to visualize metric progression across iterations. Plot only iterations where a metric was recorded (`baseline`, `keep`, `discard`). Mark `crash`/`timeout` as gaps.

```
 187.3 |*
       |  \
 155.8 |    x
       |
 142.1 |  *---------\
 138.9 |             *
 136.2 |               x
 135.1 |             *---\
 133.8 |                  *----*
 133.5 |                       x
       +--+--+--+--+--+--+--+--+--
        0  1  2  3  4  5  6  7  8
```

Legend:
- `*` = kept iteration (metric improved, commit retained)
- `x` = discarded iteration (metric regressed or unchanged)
- `-` = trend line connecting consecutive kept values
- `\` = descent from previous kept value to next data point
- Gap at iteration 4 = crash (no metric recorded)

The trend line connects kept values to show the effective optimization trajectory. Discarded values appear at their measured position but do not shift the trend.

## Post-Experiment Analysis Patterns

### Identify Biggest Wins

Sort kept iterations by absolute delta to find the most impactful changes:

| Rank | Iteration | Delta | Description |
|------|-----------|-------|-------------|
| 1 | 1 | -45.2 | memoized expensive computation in getUser |
| 2 | 5 | -3.8 | added connection pooling |
| 3 | 3 | -3.2 | batched N+1 database queries |
| 4 | 7 | -1.3 | inlined hot-path helper function |

Early iterations typically yield the largest gains. If the biggest win came late, earlier iterations may have been exploring the wrong part of the solution space.

### Diminishing Returns Detection

Track the magnitude of successive deltas to detect when further iteration is unlikely to help:

```
Iteration 1: -45.2  (large jump)
Iteration 3: -3.2   (moderate)
Iteration 5: -3.8   (moderate)
Iteration 7: -1.3   (small)
Iteration 8: -0.3   (negligible -- triggered simplicity tiebreaker)
```

When three consecutive kept deltas are each less than 1% of baseline, the experiment has likely hit diminishing returns. The agent should consider stopping or shifting strategy (e.g., from micro-optimization to architectural changes).

### What to Try Next

After an experiment completes, analyze the results to guide follow-up work:

1. **Review discarded attempts** -- they reveal constraints. If async prefetch added overhead, the bottleneck is not I/O wait.
2. **Look for unexplored categories** -- if all kept changes were caching-related, try algorithmic changes next.
3. **Check crash patterns** -- repeated crashes in similar areas suggest fragile code that needs refactoring before optimization.
4. **Consider architectural changes** -- if micro-optimizations yield diminishing returns, the next meaningful improvement may require restructuring (e.g., adding a cache layer, switching to streaming).
5. **Run a new experiment** -- use insights from the completed experiment as `hints` in a follow-up `.experiment/config.yaml`.

## Integration with Langfuse

For ML experiments (model tuning, prompt optimization, RAG pipeline improvements), cross-reference `/experiment` results with Langfuse traces for deeper observability:

1. **Tag Langfuse traces with experiment metadata** -- include the experiment name and iteration number as trace metadata so you can filter Langfuse dashboards by experiment run.

2. **Use Langfuse scores as the metric command** -- query Langfuse evaluation scores via API:
   ```
   /experiment src/prompts/ \
     --metric "curl -s 'http://localhost:3000/api/public/scores?name=relevance&limit=100' | jq '[.[].value] | add / length'" \
     --maximize --goal 0.95 --unit score
   ```

3. **Compare cost alongside quality** -- Langfuse tracks token usage and cost per trace. An iteration that improves quality by 2% but triples cost may not be worth keeping. Check the Langfuse cost dashboard after each experiment to validate the tradeoff.

4. **Trace lineage** -- Langfuse's `sessionId` field can hold the experiment name, making it easy to group all LLM calls from a single experiment run and compare token usage, latency, and quality across iterations.

See `atk:langfuse-observability` for Langfuse setup and instrumentation patterns.
