# Advanced Features

CallbackHandler integration, dataset-based evaluation, and A/B testing patterns for Langfuse.

## 1. CallbackHandler (LangChain Integration)

For LangChain/LangGraph applications:

```python
from langfuse.callback import CallbackHandler

langfuse_handler = CallbackHandler(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY
)

# Use with LangChain
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    callbacks=[langfuse_handler]
)

response = llm.invoke("Analyze this code...")  # Auto-traced!
```

## 2. Datasets for Evaluation

Create test datasets in Langfuse UI and run automated evaluations:

```python
# Fetch dataset
dataset = langfuse.get_dataset("security_audit_test_set")

# Run evaluation
for item in dataset.items:
    # Run LLM
    response = await llm.generate(item.input)

    # Create observation linked to dataset item
    langfuse.trace(
        name="evaluation_run",
        metadata={"dataset_item_id": item.id}
    ).generation(
        input=item.input,
        output=response,
        usage=response.usage
    )

    # Score
    score = await evaluate_response(item.expected_output, response)
    langfuse.score(
        trace_id=trace.id,
        name="accuracy",
        value=score
    )
```

## 3. Experimentation (A/B Testing Prompts)

```python
# Test two prompt versions
prompt_v1 = langfuse.get_prompt("security_auditor", version=1)
prompt_v2 = langfuse.get_prompt("security_auditor", version=2)

# Run A/B test
import random

for test_input in test_dataset:
    prompt = random.choice([prompt_v1, prompt_v2])

    response = await llm.generate(
        messages=[
            {"role": "system", "content": prompt.compile()},
            {"role": "user", "content": test_input}
        ]
    )

    # Track which version was used
    langfuse.trace(
        name="ab_test",
        metadata={"prompt_version": prompt.version}
    )

# Compare in Langfuse UI:
# - Filter by prompt_version
# - Compare average scores
# - Analyze cost differences
```
