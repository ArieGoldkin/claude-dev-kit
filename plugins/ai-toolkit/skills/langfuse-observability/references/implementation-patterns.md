# Implementation Patterns

Detailed setup, workflow integration, and cost tracking patterns for Langfuse in production applications.

## Setup

```python
# backend/app/shared/services/langfuse/client.py
from langfuse import Langfuse
from app.core.config import settings

langfuse_client = Langfuse(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY,
    host=settings.LANGFUSE_HOST  # Self-hosted or cloud
)
```

## Workflow Integration

```python
# backend/app/workflows/content_analysis.py
from langfuse.decorators import observe

@observe(name="content_analysis_workflow")
async def run_content_analysis(analysis_id: str, content: str):
    """Full workflow with automatic Langfuse tracing."""

    # Set global metadata
    langfuse_context.update_current_trace(
        user_id=f"analysis_{analysis_id}",
        metadata={
            "analysis_id": analysis_id,
            "content_length": len(content)
        }
    )

    # Each agent execution automatically creates nested spans
    results = []
    for agent in agents:
        result = await execute_agent(agent, content)  # @observe decorated
        results.append(result)

    return results
```

## Cost Tracking Per Analysis

```python
# After analysis completes
trace = langfuse.get_trace(trace_id)
total_cost = sum(
    gen.calculated_total_cost or 0
    for gen in trace.observations
    if gen.type == "GENERATION"
)

# Store in database
await analysis_repo.update(
    analysis_id,
    langfuse_trace_id=trace.id,
    total_cost_usd=total_cost
)
```
