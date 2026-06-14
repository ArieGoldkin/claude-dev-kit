# Testing Hybrid Search

## Table of Contents

- [Golden Dataset Evaluation](#golden-dataset-evaluation)
- [Key Metrics](#key-metrics)
- [MRR Calculation](#mrr-calculation)
- [Test Categories](#test-categories)
  - [Basic Tests](#basic-tests)
  - [Filtered Search Tests](#filtered-search-tests)
  - [Edge Case Tests](#edge-case-tests)
- [Regression Testing](#regression-testing)

Testing patterns and golden dataset evaluation for hybrid search.

## Golden Dataset Evaluation

```python
# backend/tests/integration/test_hybrid_search.py
import pytest
from app.db.repositories.chunk_repository import hybrid_search
from app.shared.services.embeddings import embed_text

@pytest.mark.asyncio
async def test_hybrid_search_golden_dataset():
    """Test hybrid search against golden queries."""

    golden_queries = load_golden_queries()  # 98 queries

    results = []
    for query_data in golden_queries:
        query = query_data["query"]
        expected_chunks = query_data["expected_chunk_ids"]

        # Perform search
        embedding = await embed_text(query)
        retrieved = await hybrid_search(query, embedding, top_k=10)
        retrieved_ids = {c.id for c in retrieved}

        # Check if expected chunks are in top 10
        found = len(expected_chunks & retrieved_ids)
        results.append({
            "query": query,
            "expected": len(expected_chunks),
            "found": found,
            "pass": found == len(expected_chunks)
        })

    # Calculate metrics
    pass_rate = sum(r["pass"] for r in results) / len(results)
    mrr = calculate_mrr(results)

    print(f"Pass Rate: {pass_rate:.1%}")
    print(f"MRR: {mrr:.3f}")

    assert pass_rate >= 0.90, f"Pass rate {pass_rate:.1%} below 90% threshold"
```

## Key Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Pass Rate** | % of queries with all expected chunks in top 10 | >= 90% |
| **MRR** | Mean Reciprocal Rank (position of first match) | >= 0.6 |
| **Recall@10** | % of relevant docs in top 10 | >= 85% |

## MRR Calculation

```python
def calculate_mrr(results: list[dict]) -> float:
    """Calculate Mean Reciprocal Rank."""
    reciprocal_ranks = []

    for result in results:
        # Find position of first expected chunk
        for i, chunk_id in enumerate(result["retrieved_ids"], start=1):
            if chunk_id in result["expected_chunk_ids"]:
                reciprocal_ranks.append(1 / i)
                break
        else:
            reciprocal_ranks.append(0)

    return sum(reciprocal_ranks) / len(reciprocal_ranks)
```

## Test Categories

### Basic Tests
```python
@pytest.mark.asyncio
async def test_hybrid_search_basic():
    """Test basic hybrid search functionality."""
    query = "Python asyncio coroutines"
    embedding = await embed_text(query)

    results = await hybrid_search(query, embedding, top_k=10)

    assert len(results) > 0
    assert len(results) <= 10
```

### Filtered Search Tests
```python
@pytest.mark.asyncio
async def test_hybrid_search_with_filter():
    """Test hybrid search with content type filter."""
    results = await hybrid_search(
        query="binary search",
        query_embedding=embedding,
        content_type_filter=["code_block"]
    )

    for chunk in results:
        assert chunk.content_type == "code_block"
```

### Edge Case Tests
```python
@pytest.mark.asyncio
async def test_hybrid_search_empty_query():
    """Test behavior with empty query."""
    results = await hybrid_search("", [], top_k=10)
    assert results == []

@pytest.mark.asyncio
async def test_hybrid_search_no_matches():
    """Test behavior when no results match."""
    results = await hybrid_search(
        "xyz123nonexistent456abc",
        embedding,
        top_k=10
    )
    # Should return empty or partial results
```

## Regression Testing

Run after any search-related changes:

```bash
# Full golden dataset evaluation
poetry run pytest tests/integration/test_hybrid_search.py -v

# Quick smoke test
poetry run pytest tests/integration/test_hybrid_search.py::test_hybrid_search_basic -v
```
