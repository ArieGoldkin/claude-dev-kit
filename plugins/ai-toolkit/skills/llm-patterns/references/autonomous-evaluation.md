# Autonomous Evaluation Loop

Iterate on evaluator quality using `/experiment` to systematically improve judge prompts, scoring rubrics, and evaluator functions against golden datasets.

## Table of Contents

- [Overview](#overview)
- [Core Pattern](#core-pattern)
- [Target Scope](#target-scope)
- [Readonly Constraints](#readonly-constraints)
- [Integration Points](#integration-points)
- [Worked Example](#worked-example)
- [Cross-References](#cross-references)

## Overview

Use `/experiment` to autonomously iterate on evaluator quality. The agent modifies judge prompts and scoring rules, measures agreement with human-labeled golden datasets via the Langfuse Experiments API, and converges on higher-quality evaluators without manual intervention.

**Metric**: Average evaluation score (agreement with human labels) across a golden dataset, tracked as a Langfuse experiment score.

## Core Pattern

```
metric = mean(evaluator(item) == human_label for item in golden_dataset)
```

Each `/experiment` iteration:
1. Run evaluator function against all golden dataset items
2. Compare evaluator outputs to human-annotated labels
3. Compute agreement score via Langfuse Experiments API
4. Agent analyzes disagreements, hypothesizes improvements
5. Agent modifies evaluator components and re-runs

## Target Scope

The agent is allowed to modify these files during iteration:

| Component | Description | Example |
|-----------|-------------|---------|
| Evaluator function | The code that runs the judge | `evaluator.py`, `judge.ts` |
| Judge prompt template | System/user prompts for LLM-as-judge | `prompts/judge.txt` |
| Scoring rubric | Criteria definitions and score mappings | `rubrics/code_review.yaml` |

## Readonly Constraints

These must NOT be modified during experiment iterations:

- **Test data**: Input samples used for evaluation
- **Golden dataset items**: Human-annotated labels and expected scores
- **Langfuse configuration**: Tracing and experiment tracking setup

The golden dataset is the ground truth. Changing it invalidates the metric.

## Integration Points

### Golden Dataset Skill

Use `golden-dataset` skill for dataset lifecycle:
- `/golden-dataset-management` for backup/restore before experiment runs
- `/golden-dataset-validation` to verify dataset integrity
- `/golden-dataset-curation` for adding new labeled examples post-experiment

### Langfuse Observability

Use `langfuse-observability` skill for experiment tracking:
- Each iteration creates a Langfuse experiment run
- Scores are logged per-item and aggregated
- Trace comparisons show which prompt changes improved agreement
- Cost per iteration is tracked automatically

## Worked Example

**Goal**: Improve a code review evaluator from 72% to 88% agreement with human reviewers.

### Experiment Configuration

```yaml
# config.yaml
experiment:
  name: code-review-evaluator-v2
  metric: human_agreement_rate
  target: 0.88
  max_iterations: 8
  golden_dataset: datasets/code-review-golden-50.jsonl

target_files:
  - prompts/code-review-judge.txt
  - src/scoring/rubric.yaml
  - src/evaluator.ts

readonly:
  - datasets/
  - langfuse.config.ts
```

### Iteration Log

| Iter | Agreement | Key Change |
|------|-----------|------------|
| 0 | 72% | Baseline: generic judge prompt, 3-point scale |
| 1 | 76% | Added concrete examples of each score level to rubric |
| 2 | 79% | Split "correctness" into "logic errors" and "style issues" |
| 3 | 81% | Added chain-of-thought reasoning requirement to judge prompt |
| 4 | 84% | Refined edge case handling for partial fixes |
| 5 | 86% | Added severity weighting to scoring rubric |
| 6 | 88% | Calibrated score thresholds using disagreement analysis |

### Key Improvements

1. **Concrete rubric examples** (iter 1): Generic descriptions like "good code" replaced with specific patterns ("handles null input", "uses early returns"). +4% agreement.

2. **Dimension decomposition** (iter 2): Splitting a single "correctness" score into sub-dimensions reduced ambiguity in edge cases. +3% agreement.

3. **Chain-of-thought judging** (iter 3): Requiring the judge to explain reasoning before scoring reduced inconsistent ratings. +2% agreement.

4. **Disagreement-driven calibration** (iter 6): Analyzing the remaining 14% disagreements revealed threshold sensitivity. Adjusting score boundaries from equal thirds to empirical quartiles closed the gap. +2% agreement.

## Cross-References

- `${CLAUDE_SKILL_DIR}/references/evaluation.md` - LLM-as-judge patterns and scoring dimensions
- `golden-dataset` skill - Dataset management, validation, and curation
- `langfuse-observability` skill - Experiment tracking and score logging
- `/experiment` command - Autonomous iteration loop
- `agent-loops` skill - ReAct patterns for agentic evaluation workflows
