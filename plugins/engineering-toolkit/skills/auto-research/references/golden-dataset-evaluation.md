# Golden Dataset Evaluation

Route prompts and skills through `/experiment` using golden datasets as the quality metric.
This reference covers how to set up, curate, and evaluate against golden datasets for
autonomous prompt optimization.

## When to Use

- Optimizing system prompts for consistent quality
- Improving skill instructions against known-good outputs
- Regression testing prompts after modifications
- Finding the cheapest model/prompt combo that meets quality thresholds

## Golden Dataset Structure

A golden dataset is a curated set of input/expected-output pairs with quality scores.

```
.auto-research/golden-datasets/
├── {domain}/
│   ├── dataset.json          # The golden entries
│   ├── judge-prompt.md       # LLM-as-judge evaluation prompt
│   └── metadata.json         # Dataset info (version, author, last updated)
```

### Dataset Format

```json
{
  "name": "code-review-quality",
  "version": "1.0",
  "entries": [
    {
      "id": "cr-001",
      "input": "Review this function: [code]",
      "reference_output": "The function has an SQL injection vulnerability...",
      "quality_dimensions": {
        "security_detection": 9,
        "actionable_feedback": 8,
        "tone": 9,
        "completeness": 7
      },
      "tags": ["security", "sql", "critical"]
    }
  ]
}
```

### Judge Prompt

The LLM-as-judge prompt scores each generated output against the reference:

```markdown
# Evaluation Judge

Compare the GENERATED output against the REFERENCE output for this input.

Score each dimension 0-10:
- **Correctness**: Does it identify the same issues as the reference?
- **Actionability**: Are suggestions specific and implementable?
- **Completeness**: Does it cover all important points?
- **Conciseness**: Is it appropriately concise (no filler)?

Return JSON: {"correctness": N, "actionability": N, "completeness": N, "conciseness": N}
```

## Evaluation Pipeline

The metric command for `/experiment`:

1. Load golden dataset entries
2. For each entry: run the prompt/skill against the input
3. Score each output using the judge prompt
4. Average scores across all entries and dimensions
5. Return single numeric score

**Pseudocode:**
```python
scores = []
for entry in dataset["entries"]:
    output = run_skill(skill_content, entry["input"])
    score = judge(output, entry["reference_output"], judge_prompt)
    scores.append(mean(score.values()))
return mean(scores)  # Single number for /experiment
```

## Overfitting Prevention

| Technique | How |
|---|---|
| Train/holdout split | 70% optimization, 30% holdout. Report both scores. |
| Temperature variation | Evaluate at temperature > 0 to test robustness |
| Diversity check | Ensure test entries cover edge cases, not just happy paths |
| Max iterations | Cap at 5-7 rounds (diminishing returns observed after that) |
| Holdout gate | If optimization score improves but holdout drops, revert |

## Integration with /experiment

```
/experiment skills/{name}/SKILL.md \
  --metric "python3 scripts/evaluate-golden.py --dataset golden-datasets/code-review/" \
  --maximize \
  --goal 8.5 \
  --unit score \
  --iterations 5 \
  --readonly "golden-datasets/,scripts/evaluate-golden.py"
```

## Integration with Langfuse

If Langfuse observability is configured (see ai-toolkit langfuse-observability skill):

- Each evaluation run creates a Langfuse trace
- Scores logged per-entry and per-dimension
- Experiment iterations tracked as Langfuse experiments
- Compare runs visually in the Langfuse dashboard

## Creating a Golden Dataset

### Bootstrap approach (recommended)

1. Collect 15-20 real inputs for the prompt/skill being optimized
2. Run the current prompt against each input
3. Manually review and score each output (0-10 per dimension)
4. For the best outputs, save as reference_output
5. Split: 10-14 entries for optimization, 5-6 for holdout

### Quality criteria for entries

- **Diverse**: Cover different input types, edge cases, difficulty levels
- **Representative**: Match real-world usage patterns
- **Scored consistently**: Same scorer, same rubric, same session
- **Versioned**: Track dataset changes; re-evaluate when dataset updates

## Model-Prompt Pareto Search

A special application: find the cheapest model + prompt combo that meets quality:

1. Define quality threshold (e.g., score >= 7.5)
2. Create prompt variants: concise, detailed, few-shot
3. For each model (Haiku, Sonnet, Opus) × each prompt variant:
   - Evaluate against golden dataset
   - Record quality score AND cost (tokens × price)
4. Plot quality vs cost
5. Recommend the Pareto-optimal combination

This is not an iterative loop — it is a grid search that `/experiment` can automate by
treating model+prompt as the search space.
