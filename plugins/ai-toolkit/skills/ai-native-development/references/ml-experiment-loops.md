# ML Experiment Loops

- [Overview: The Karpathy Loop](#overview-the-karpathy-loop) | [program.md Pattern](#the-programmd-pattern) | [Metric Selection](#metric-selection-guide) | [Fixed-Budget Optimization](#fixed-budget-optimization)
- [ML Experiment Examples](#complete-ml-experiment-examples) | [Autoresearch vs AutoML vs AIDE](#autoresearch-vs-automl-vs-aide) | [/experiment Integration](#integration-with-experiment) | [Langfuse Integration](#integration-with-langfuse) | [Cross-References](#cross-references)

---

## Overview: The Karpathy Loop

Modify training code, run a fixed-budget experiment, evaluate a metric, keep or discard.

```
MODIFY ──> RUN (fixed budget) ──> EVALUATE metric ──> KEEP / DISCARD
  ^                                                        │
  └────────────────────────────────────────────────────────┘
```

**Principles:** one change per iteration (clear attribution), fixed compute budget per run (no runaway costs), single scalar metric (keep/discard decision), git-based safety (commit before evaluate, reset on regression), log every iteration to TSV.

---

## The program.md Pattern

A `program.md` is an agent instruction file defining the full ML experiment. Place at repo root or `.experiment/`.

```markdown
# Program: <experiment-name>
## Setup
- Install deps, verify GPU, locate baseline checkpoint
## Rules
### Modifiable: train.py, config.yaml
### Read-Only: data/, eval.py, tokenizer/
## Metric
- Command: `python eval.py --checkpoint latest --split val`
- Extract: last line, parse float after "val_bpb:"
- Direction: minimize | Unit: bpb
## The Loop
1. Read prior results and code
2. Hypothesize a single change
3. Modify only allowed files
4. Run: `python train.py --budget 5m`
5. Evaluate: `python eval.py --checkpoint latest --split val`
6. If improved: commit + keep. Otherwise: revert.
7. Log result. Return to step 1.
## Autonomy
Run autonomously. Stop on: budget exhausted, goal reached, 5 consecutive discards.
```

| Design Decision | Rationale |
|-----------------|-----------|
| Separate `train.py` from `eval.py` | Prevent agent from gaming the metric |
| Explicit read-only list | Agents cannot modify data or evaluation code |
| Fixed time budget per run | Prevents runaway GPU costs |
| Last-line output convention | Simple, parseable, no JSON required |

---

## Metric Selection Guide

| Metric | Domain | Direction | When to Use |
|--------|--------|-----------|-------------|
| `val_bpb` | Language models | minimize | LLM pretraining/fine-tuning; more stable than perplexity |
| Perplexity | Language models | minimize | Alternative to bpb; less stable for small deltas |
| Accuracy | Classification | maximize | Balanced datasets |
| F1 (macro) | Classification | maximize | Imbalanced datasets; precision-recall balance |
| BLEU | Translation | maximize | N-gram overlap with references |
| ROUGE-L | Summarization | maximize | Longest common subsequence with references |
| Validation loss | Any | minimize | General-purpose when no task-specific metric exists |
| MRR / MAP | Retrieval / RAG | maximize | Ranking quality for search systems |
| CER / WER | Speech / OCR | minimize | Character/word error rate |

**Rules of thumb:** Always evaluate on held-out validation data, never training data. Prefer task-specific metrics over generic loss. Use `val_bpb` for LLM pretraining.

---

## Fixed-Budget Optimization

| Budget Type | Default | Tradeoffs |
|-------------|---------|-----------|
| **Time** (wall-clock) | 5 min | Simple to enforce; varies by hardware |
| **Compute** (FLOPs) | task-dependent | Hardware-independent; harder to measure |
| **Token** (tokens seen) | task-dependent | Reproducible; requires instrumented loop |
| **Steps** (gradient updates) | task-dependent | Deterministic; requires known step cost |

**Time budget** is the recommended default. Enforce with `timeout 300 python train.py` or a `--budget-minutes 5` flag. Most changes show directional signal within 5 minutes on modern GPUs.

For compute/token budgets, instrument the training loop to track cumulative FLOPs or `batch["input_ids"].numel()` and break when the budget is reached.

---

## Complete ML Experiment Examples

### Example 1: LLM Training (val_bpb)

```bash
/experiment train.py \
  --metric "python eval.py --checkpoint latest --split val | tail -1 | awk '{print \$2}'" \
  --minimize --goal 1.05 --unit bpb --iterations 15 \
  --readonly "data/,eval.py,tokenizer/" --name llm-val-bpb \
  --hint "Try architecture changes (heads, FFN width) and hyperparams (LR, warmup, decay)"
```

Typical log: baseline 1.142 -> 1.128 (keep, wider FFN) -> 1.135 (discard, SwiGLU) -> 1.119 (keep, cosine LR) -> 1.108 (keep, more heads).

### Example 2: Classification Fine-Tuning (F1)

```bash
/experiment training_config.yaml \
  --metric "python evaluate.py --split val --format json | jq '.f1_macro'" \
  --maximize --goal 0.92 --unit F1 --iterations 12 \
  --readonly "data/,evaluate.py,model_base/" --name classification-f1 \
  --hint "Try learning rate (1e-5 to 5e-5), batch size, warmup ratio, class weights"
```

Typical log: baseline 0.847 -> 0.863 (keep, lower LR) -> 0.871 (keep, warmup) -> 0.868 (discard, label smoothing) -> 0.879 (keep, class weights) -> 0.891 (keep, cosine scheduler).

---

## Autoresearch vs AutoML vs AIDE

| Dimension | Autoresearch (Karpathy) | AutoML (Optuna, Ray Tune) | AIDE |
|-----------|-------------------------|---------------------------|------|
| **Search space** | Unbounded (code + config) | Config only (hyperparams) | Code + config |
| **Search method** | LLM reasoning | Bayesian / grid / random | LLM-guided tree search |
| **Can modify architecture** | Yes | No | Yes |
| **Cost per iteration** | LLM tokens + compute | Compute only | LLM tokens + compute |
| **Setup** | Write program.md | Define search space dict | Write problem statement |
| **Typical iterations** | 10-30 | 100-1000 | 20-100 |
| **Best for** | Novel exploration | Hyperparam tuning at scale | Kaggle competitions |

---

## Integration with /experiment

```yaml
# .experiment/config.yaml
name: llm-architecture-search
target: train.py
readonly: [data/, eval.py, tokenizer/]
metric:
  command: "python eval.py --checkpoint latest --split val"
  extract: "grep 'val_bpb' | awk '{print $2}'"
  direction: minimize
  unit: bpb
  goal: 1.05
budget:
  max_iterations: 20
  max_minutes: 120
  iteration_timeout_minutes: 7
  checkpoint_every: 5
hints:
  - "Try wider FFN layers before deeper networks"
  - "Do not change the tokenizer or vocab size"
```

**ML-specific tips:** Set `iteration_timeout_minutes` slightly above training budget. Put evaluation scripts in `readonly` to prevent metric gaming. Use `hints` to steer toward promising directions.

---

## Integration with Langfuse

Track ML experiments as Langfuse traces for cost monitoring and team visibility.

```python
from langfuse import Langfuse
langfuse = Langfuse()

# Log each iteration as a trace
trace = langfuse.trace(
    name=f"experiment:{name}",
    metadata={"iteration": i, "hypothesis": hyp, "status": status},
    tags=["ml-experiment", name],
)
trace.score(name="metric", value=metric_value)

# Compare via Experiments API
dataset = langfuse.create_dataset(name="experiment-baselines")
langfuse.create_dataset_run(
    dataset_name="experiment-baselines", run_name=f"{name}-iter-{i}",
    metadata={"commit": sha, "description": desc},
)
```

Dashboard filters: tag `ml-experiment`, name prefix `experiment:<name>`, sort by metric score.

---

## Cross-References

- **`/experiment`** -- Autonomous experiment loop with safety guardrails (`etk/skills/experiment/SKILL.md`)
- **`langfuse-observability`** -- Langfuse tracing, evaluation, prompt management (`atk/skills/langfuse-observability/SKILL.md`)
- **`golden-dataset`** -- Curate evaluation datasets for held-out validation (`atk/skills/golden-dataset/SKILL.md`)
- **`agent-loops`** -- Karpathy Loop as a named agentic pattern (`etk/skills/agent-loops/SKILL.md`)
- **`observability.md`** -- Cost tracking for LLM-powered agents (`${CLAUDE_SKILL_DIR}/references/observability.md`)
