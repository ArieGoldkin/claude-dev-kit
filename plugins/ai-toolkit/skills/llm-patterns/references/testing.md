# LLM Testing Patterns

Test AI applications with deterministic patterns.

## Quality Gate Testing

```python
@pytest.mark.asyncio
async def test_quality_gate_passes_above_threshold():
    state = create_state_with_findings(quality_score=0.85)

    result = await quality_gate_node(state)

    assert result["quality_passed"] is True

@pytest.mark.asyncio
async def test_quality_gate_fails_below_threshold():
    state = create_state_with_findings(quality_score=0.5)

    result = await quality_gate_node(state)

    assert result["quality_passed"] is False
    assert result["retry_reason"] is not None
```

## Template Rendering Tests

```python
from jinja2 import Environment, FileSystemLoader

@pytest.fixture
def jinja_env():
    return Environment(loader=FileSystemLoader("templates/"))

def test_template_handles_empty_data(jinja_env):
    template = jinja_env.get_template("artifact.j2")
    result = template.render(insights={"tldr": {}})

    assert "TL;DR" not in result  # Section skipped

def test_template_handles_none_values(jinja_env):
    template = jinja_env.get_template("artifact.j2")
    result = template.render(insights={
        "tldr": {"summary": None, "key_takeaways": []}
    })

    assert isinstance(result, str)  # No crash
```

## LLM-Specific Edge Cases

- **Very long inputs:** Truncation behavior near token limits
- **Partial responses:** Incomplete LLM outputs (stream interrupted)
- **Division by zero:** Empty list averaging in quality scores

## VCR.py for LLM APIs

```python
@pytest.fixture(scope="module")
def vcr_config():
    return {
        "cassette_library_dir": "tests/cassettes/llm",
        "filter_headers": ["authorization", "x-api-key"],
        "record_mode": "none" if os.environ.get("CI") else "once",
    }

@pytest.mark.vcr()
async def test_llm_completion():
    response = await llm_client.complete(
        model="claude-3-sonnet",
        messages=[{"role": "user", "content": "Say hello"}]
    )

    assert "hello" in response.content.lower()
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Mock vs VCR | VCR for integration, mock for unit |
| Timeout | Always test with < 1s timeout |
| Schema validation | Test both valid and invalid |
| Edge cases | Test all null/empty paths |
