---
name: llm-patterns
description: "LLM application patterns for evaluation, streaming, and testing. Evaluation: LLM-as-judge, multi-dimension scoring, hallucination detection, Langfuse integration. Streaming: SSE, FastAPI endpoints, tool calls in streams, backpressure. Testing: mocking LLM responses, VCR.py recording, structured output validation. Use when: evaluating LLM quality, adding streaming, or testing AI features. Triggers on: LLM evaluation, LLM-as-judge, quality gate, streaming responses, SSE, test LLM, VCR, mock LLM"
effort: low
paths:
  - "**/*llm*"
  - "**/*evaluation*"
  - "**/*streaming*"
  - "**/*judge*"
keep-coding-instructions: true
---

# LLM Patterns

Patterns for building, evaluating, streaming, and testing LLM-powered applications.

## Evaluation

Quality assessment and validation of LLM outputs using LLM-as-judge, multi-dimension scoring, pairwise comparison, hallucination detection, and batch evaluation. Integrates with Langfuse for score tracking.

- Use a separate judge model (e.g., GPT-4o-mini, Claude Haiku) to avoid self-evaluation bias
- Score across 3-5 dimensions: relevance, accuracy, completeness, coherence
- Quality threshold: 0.7 for production, 0.6 for drafts

**Full patterns and code:** See [references/evaluation.md](${CLAUDE_SKILL_DIR}/references/evaluation.md)

### Autonomous Evaluation Loop

Use `/experiment` to autonomously iterate on evaluator quality (judge prompts, scoring rubrics) against golden datasets, tracking agreement via Langfuse Experiments API. See [references/autonomous-evaluation.md](${CLAUDE_SKILL_DIR}/references/autonomous-evaluation.md) for the full pattern and a worked example.

---

## Streaming

Real-time token delivery via Server-Sent Events (SSE) for better UX. Covers OpenAI sync/async streaming, FastAPI SSE endpoints, TypeScript frontend consumers, streaming with tool calls, and backpressure handling.

- Use SSE for web, WebSocket for bidirectional communication
- Buffer 50-200 tokens; set 30-60s timeouts for long responses
- Always close connections properly and handle stream errors

**Full patterns and code:** See [references/streaming.md](${CLAUDE_SKILL_DIR}/references/streaming.md)

---

## Testing

Deterministic testing patterns for non-deterministic LLM outputs. Covers quality gate tests, template rendering, edge cases (empty/long inputs, partial responses), and VCR.py for recording API responses in CI.

- Use VCR for integration tests, mocks for unit tests
- Always test with < 1s timeout; validate both valid and invalid schemas
- Record mode "none" in CI to avoid live API calls

**Full patterns and code:** See [references/testing.md](${CLAUDE_SKILL_DIR}/references/testing.md)

---

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Judge model | GPT-4o-mini or Claude Haiku (cost-effective) |
| Quality threshold | 0.7 production, 0.6 drafts |
| Evaluation dimensions | 3-5 most relevant to your use case |
| Streaming protocol | SSE for web, WebSocket for bidirectional |
| Buffer size | 50-200 tokens |
| Streaming timeout | 30-60s for long responses |
| Mock vs VCR | VCR for integration, mock for unit |
| Test timeout | Always < 1s |
| Schema validation | Test both valid and invalid |

## Related Skills

- `quality-gates` - Workflow quality control
- `langfuse-observability` - Tracking evaluation scores
- `agent-loops` - Self-correcting with evaluation, multi-step tool use
- `streaming-api-patterns` - SSE/WebSocket deep dive
- `function-calling` - Tool calls in streams
- `vcr-http-recording` - Record LLM responses
- `unit-testing` - Test fundamentals
- `/experiment` - Autonomous iteration on evaluator quality
