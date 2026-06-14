# Skill Self-Improvement

Route `improve-skill` uses `/experiment` to autonomously optimize SKILL.md files.
This is the most sensitive route — modifying the instructions that guide Claude's behavior
requires strict guardrails.

## How It Works

The autoresearch three-file pattern adapted for skills:

| Karpathy's pattern | Skill self-improvement |
|---|---|
| `program.md` (intent) | Auto-research goal: "improve the review skill" |
| `train.py` (agent-modified) | `skills/{name}/SKILL.md` (agent-modified) |
| `val_bpb` (metric) | Task completion quality against test cases |

## Prerequisites

Before running skill self-improvement:

1. **Test cases must exist.** Define 5-10 representative tasks the skill should handle well.
   Without test cases, there is no metric — the loop cannot run.
2. **Evaluation criteria must be defined.** What does "better" mean for this skill?
   Options: task completion rate, output quality score (LLM-as-judge), user satisfaction.
3. **Golden test set (holdout) recommended.** Split test cases 70/30: optimization set
   (the loop sees these) and holdout set (only checked at the end to detect overfitting).

## Test Case Format

Store test cases alongside the skill in a `benchmarks/` directory:

```
skills/{name}/
├── SKILL.md
├── references/
└── benchmarks/
    ├── test-cases.json       # Optimization set (70%)
    └── holdout-cases.json    # Holdout set (30%)
```

Each test case:
```json
{
  "id": "review-01",
  "description": "Review a PR with SQL injection vulnerability",
  "input": "Review this handler: [code snippet]",
  "expected_behavior": [
    "Identifies SQL injection risk",
    "Suggests parameterized query",
    "Does not approve without fix"
  ],
  "quality_dimensions": ["security_detection", "actionable_suggestion", "correctness"]
}
```

## Evaluation Metric

The metric command for `/experiment` should:

1. Run each test case against the current SKILL.md
2. Score each output on quality dimensions (0-10 per dimension via LLM-as-judge)
3. Return the average score

Example metric pipeline:
```bash
# Pseudocode — actual implementation depends on evaluation tooling
python3 scripts/evaluate-skill.py \
  --skill skills/{name}/SKILL.md \
  --test-cases skills/{name}/benchmarks/test-cases.json \
  --output-format score
# Outputs: 7.3 (average quality score)
```

## Mutation Boundaries

**What the agent MAY modify in SKILL.md:**
- Instruction text (wording, examples, explanations)
- Workflow step descriptions
- Prompt patterns and templates
- Section ordering

**What the agent MUST NOT modify:**
- Frontmatter (name, description) — changes here affect skill triggering
- Reference file paths — breaks skill loading
- Safety rules — cannot weaken its own guardrails
- Related skills section — affects skill discovery

**Readonly files (enforce via /experiment --readonly):**
- `benchmarks/test-cases.json` — the evaluation criteria
- `benchmarks/holdout-cases.json` — the holdout set
- `references/` — supporting documentation
- Any file outside `skills/{name}/SKILL.md`

## Iteration Guardrails

| Guardrail | Value | Rationale |
|---|---|---|
| Max iterations | 5 | Skill changes compound; 5 rounds is enough to find major improvements |
| Max SKILL.md growth | +20% lines | Prevent bloat; self-improvement should not double the file |
| Min improvement threshold | +0.5 score points | Reject marginal changes that add complexity |
| Holdout regression gate | Score must not drop | If holdout score drops, revert even if optimization score improves |
| Human review gate | Always | Skill changes are committed to a branch, never auto-merged to main |

## Workflow

1. Auto-research classifies goal as `improve-skill`
2. Identify which skill to improve
3. Check prerequisites: test cases exist? evaluation defined?
4. If prerequisites missing, help user create 5-10 test cases first
5. Configure `/experiment`:
   - Target: `skills/{name}/SKILL.md`
   - Metric: evaluation score against test cases
   - Direction: maximize
   - Readonly: benchmarks/, references/, everything outside the skill
   - Budget: 5 iterations / 30 minutes
6. Run with confirmation and heartbeat
7. After completion, run holdout set to check for overfitting
8. Present diff for human review
9. Commit to feature branch (never directly to main)

## Example

```
/auto-research improve the code-review-playbook skill

Phase 1 — Classify: improve-skill
Phase 2 — Plan:
  Skill to improve: code-review-playbook
  Test cases: skills/code-review-playbook/benchmarks/test-cases.json (8 cases)
  Metric: average quality score via LLM-as-judge
  Baseline: 6.2/10
  Budget: 5 iterations / 30 minutes

Phase 4 — Execute:
  Iteration 1: Added concrete examples for security review → 6.2 → 7.1 (keep)
  Iteration 2: Restructured checklist ordering → 7.1 → 7.4 (keep)
  Iteration 3: Added edge case handling for large PRs → 7.4 → 7.3 (discard)
  Iteration 4: Simplified language, removed redundancy → 7.4 → 7.8 (keep)
  Iteration 5: Added severity classification → 7.8 → 8.1 (keep)

Holdout check: 7.9/10 (no regression from 7.7 baseline) ✓

Phase 5 — Report:
  Baseline: 6.2 → Final: 8.1 (+1.9, +31%)
  Changes: concrete examples, restructured checklist, simplified language, severity classification
  Branch: feat/improve-code-review-playbook (ready for review)
```
