---
name: langfuse-observability
description: "LLM observability with Langfuse — tracing, evaluation, prompt versioning, cost tracking, and LLM-as-judge scoring"
effort: low
paths:
  - "**/*langfuse*"
  - "**/*observability*"
  - "**/*trace*"
---

# Langfuse Observability

## Overview

**Langfuse** is the open-source LLM observability platform recommended for tracing, monitoring, evaluation, and prompt management. Unlike LangSmith (deprecated), Langfuse is self-hosted, free, and designed for production LLM applications.

---

## Core Features

### 1. Distributed Tracing

Track LLM calls across your application with automatic parent-child span relationships.

```python
from langfuse.decorators import observe, langfuse_context

@observe()  # Automatic tracing
async def analyze_content(content: str, agent_type: str):
    """Analyze content with automatic Langfuse tracing."""

    # Nested span for retrieval
    @observe(name="retrieval")
    async def retrieve_context():
        chunks = await vector_db.search(content)
        langfuse_context.update_current_observation(
            metadata={"chunks_retrieved": len(chunks)}
        )
        return chunks

    # Nested span for generation
    @observe(name="generation")
    async def generate_analysis(context):
        response = await llm.generate(
            prompt=f"Context: {context}\n\nAnalyze: {content}"
        )
        langfuse_context.update_current_observation(
            input=content[:500],
            output=response[:500],
            model="claude-sonnet-4-20250514",
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            }
        )
        return response

    context = await retrieve_context()
    return await generate_analysis(context)
```

**Result in Langfuse UI:**
```
analyze_content (2.3s, $0.045)
├── retrieval (0.1s)
│   └── metadata: {chunks_retrieved: 5}
└── generation (2.2s, $0.045)
    └── model: claude-sonnet-4-20250514
    └── tokens: 1500 input, 1000 output
```

### 2. Token & Cost Tracking

Automatic cost calculation based on model pricing, with a built-in pricing database for all major models and custom pricing support. See [references/cost-tracking.md](${CLAUDE_SKILL_DIR}/references/cost-tracking.md) for detailed patterns, dashboard queries, and best practices.

### 3. Prompt Management

Version control for prompts in production:

```python
# Fetch prompt from Langfuse
from langfuse import Langfuse, get_client

langfuse = Langfuse()

# Get latest version of security auditor prompt
prompt = langfuse.get_prompt("security_auditor", label="production")

# Use in LLM call
response = await llm.generate(
    messages=[
        {"role": "system", "content": prompt.compile()},
        {"role": "user", "content": user_input}
    ]
)
```

#### Linking Prompts to Generations (Issue #564 Pattern)

**CRITICAL:** To make the "Number of Observations" counter work in Langfuse Prompts UI, you MUST link the `TextPromptClient` object to the generation span:

```python
from langfuse import get_client

# Method 1: update_current_generation (preferred)
langfuse = get_client()
prompt = langfuse.get_prompt("security_auditor", label="production")

# Link prompt to current generation span
langfuse.update_current_generation(prompt=prompt)

# Method 2: Pass prompt when starting generation
with langfuse.start_as_current_generation(
    name="security-analysis",
    model="claude-sonnet-4-20250514",
    prompt=prompt  # Links automatically!
) as generation:
    response = await llm.generate(...)
    generation.update(output=response)
```

**Application Pattern (with caching):**
```python
# PromptManager returns both content AND TextPromptClient
prompt_content, prompt_client = await prompt_manager.get_prompt_with_langfuse_client(
    name="security-auditor",
    variables={"skill_instructions": "..."},
    label="production",
)

# Pass prompt_client through agent metadata
if prompt_client:
    agent = agent.with_config(metadata={"langfuse_prompt_client": prompt_client})

# In invoke_agent(), link prompt to generation
if prompt_client:
    langfuse.update_current_generation(prompt=prompt_client)
```

**Note:** Cache hits (L1/L2) return `None` for `prompt_client` - linkage only happens on L3 Langfuse fetches (~5% of calls). This is acceptable for analytics.

**Prompt Versioning in UI:**
```
security_auditor
├── v1 (Jan 15, 2025) - production
│   └── "You are a security auditor. Analyze code for..."
├── v2 (Jan 20, 2025) - staging
│   └── "You are an expert security auditor. Focus on..."
└── v3 (Jan 25, 2025) - draft
    └── "As a cybersecurity expert, thoroughly analyze..."
```

### 4. LLM Evaluation (Scores)

Score traces with custom quality metrics (relevance, factuality, coherence) and automate scoring with G-Eval. See [references/evaluation-scores.md](${CLAUDE_SKILL_DIR}/references/evaluation-scores.md) for scoring patterns, dashboard queries, and dataset-based evaluation.

### 5. Session & User Tracking

Group related traces into sessions via `session_id`, track per-user performance with `user_id`, and add custom metadata and tags for filtering. See [references/session-tracking.md](${CLAUDE_SKILL_DIR}/references/session-tracking.md) for detailed patterns and analytics queries.

---

## Implementation Patterns

Client setup, workflow integration with `@observe`, and per-task cost tracking. See [references/implementation-patterns.md](${CLAUDE_SKILL_DIR}/references/implementation-patterns.md) for detailed patterns.

---

## Advanced Features

CallbackHandler (LangChain), dataset-based evaluation, and A/B testing prompts. See [references/advanced-features.md](${CLAUDE_SKILL_DIR}/references/advanced-features.md) for detailed patterns.

---

## Monitoring Dashboard Queries

SQL queries for cost analysis, quality metrics, performance tracking, and token usage.

**Full Query Library:** See [references/dashboard-queries.md](${CLAUDE_SKILL_DIR}/references/dashboard-queries.md)

---

## Best Practices

1. **Always use @observe decorator** for automatic tracing
2. **Set user_id and session_id** for better analytics
3. **Add meaningful metadata** (content_type, analysis_id, etc.)
4. **Score all productions traces** for quality monitoring
5. **Use prompt management** instead of hardcoded prompts
6. **Monitor costs daily** to catch spikes early
7. **Create datasets** for regression testing
8. **Tag production vs staging** traces

---

## References

- [Langfuse Docs](https://langfuse.com/docs) | [Python SDK](https://langfuse.com/docs/sdk/python) | [GitHub](https://github.com/langfuse/langfuse)

---

## Migration from LangSmith

Langfuse is self-hosted, open-source, and free. Key differences: `@observe` (vs `@traceable`), built-in prompt management, no cloud lock-in. See [langfuse.com/docs](https://langfuse.com/docs) for migration details.
