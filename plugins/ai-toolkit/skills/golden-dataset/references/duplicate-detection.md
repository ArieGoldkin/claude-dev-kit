# Duplicate Detection Reference

## Table of Contents

- [Semantic Similarity Check](#semantic-similarity-check)
- [URL Duplicate Check](#url-duplicate-check)
- [Similarity Thresholds](#similarity-thresholds)

Patterns for detecting duplicate content in golden datasets.

## Semantic Similarity Check

```python
import numpy as np
from typing import Optional

async def check_duplicate(
    new_content: str,
    existing_embeddings: list[tuple[str, np.ndarray]],
    embedding_service,
    threshold: float = 0.85,
) -> Optional[tuple[str, float]]:
    """Check if content is duplicate of existing document.

    Args:
        new_content: Content to check
        existing_embeddings: List of (doc_id, embedding) tuples
        embedding_service: Service to generate embeddings
        threshold: Similarity threshold for duplicate warning

    Returns:
        (doc_id, similarity) if duplicate found, None otherwise
    """
    # Generate embedding for new content
    new_embedding = await embedding_service.generate_embedding(
        text=new_content[:8000],  # Truncate for embedding
        normalize=True,
    )
    new_vec = np.array(new_embedding)

    # Compare against existing
    max_similarity = 0.0
    most_similar_doc = None

    for doc_id, existing_vec in existing_embeddings:
        # Cosine similarity (vectors are normalized)
        similarity = np.dot(new_vec, existing_vec)

        if similarity > max_similarity:
            max_similarity = similarity
            most_similar_doc = doc_id

    if max_similarity >= threshold:
        return (most_similar_doc, max_similarity)

    return None
```

## URL Duplicate Check

```python
def check_url_duplicate(
    new_url: str,
    source_url_map: dict[str, str],
) -> Optional[str]:
    """Check if URL already exists in dataset.

    Returns document ID if duplicate found.
    """
    # Normalize URL
    normalized = normalize_url(new_url)

    for doc_id, existing_url in source_url_map.items():
        if normalize_url(existing_url) == normalized:
            return doc_id

    return None

def normalize_url(url: str) -> str:
    """Normalize URL for comparison."""
    from urllib.parse import urlparse, urlunparse

    parsed = urlparse(url.lower())

    # Remove trailing slashes, www prefix
    netloc = parsed.netloc.replace("www.", "")
    path = parsed.path.rstrip("/")

    # Remove common tracking parameters
    # (simplified - real implementation would parse query string)

    return urlunparse((
        parsed.scheme,
        netloc,
        path,
        "",  # params
        "",  # query (stripped)
        "",  # fragment
    ))
```

## Similarity Thresholds

| Similarity | Action |
|------------|--------|
| >= 0.90 | **Block** - Content too similar (likely duplicate) |
| 0.80 - 0.89 | **Warn** - Review for potential overlap |
| < 0.80 | **Pass** - Sufficiently distinct |
