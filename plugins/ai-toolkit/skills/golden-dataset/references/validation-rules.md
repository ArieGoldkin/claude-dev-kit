# Validation Rules Reference

## Table of Contents

- [Rule 1: No Placeholder URLs](#rule-1-no-placeholder-urls)
- [Rule 2: Unique Identifiers](#rule-2-unique-identifiers)
- [Rule 3: Referential Integrity](#rule-3-referential-integrity)
- [Rule 4: Content Quality](#rule-4-content-quality)
- [Rule 5: Difficulty Distribution](#rule-5-difficulty-distribution)

Detailed validation rules for golden dataset integrity.

## Rule 1: No Placeholder URLs

```python
FORBIDDEN_URL_PATTERNS = [
    "example.placeholder.com",
    "placeholder",
    "example.com",
    "localhost",
    "127.0.0.1",
]

def validate_url(url: str) -> tuple[bool, str]:
    """Validate URL is not a placeholder."""
    for pattern in FORBIDDEN_URL_PATTERNS:
        if pattern in url.lower():
            return False, f"URL contains forbidden pattern: {pattern}"

    # Must be HTTPS (except for specific cases)
    if not url.startswith("https://"):
        if not url.startswith("http://arxiv.org"):  # arXiv redirects
            return False, "URL must use HTTPS"

    return True, "OK"
```

## Rule 2: Unique Identifiers

```python
def validate_unique_ids(documents: list[dict], queries: list[dict]) -> list[str]:
    """Ensure all IDs are unique across documents and queries."""
    errors = []

    # Document IDs
    doc_ids = [d["id"] for d in documents]
    if len(doc_ids) != len(set(doc_ids)):
        duplicates = [id for id in doc_ids if doc_ids.count(id) > 1]
        errors.append(f"Duplicate document IDs: {set(duplicates)}")

    # Query IDs
    query_ids = [q["id"] for q in queries]
    if len(query_ids) != len(set(query_ids)):
        duplicates = [id for id in query_ids if query_ids.count(id) > 1]
        errors.append(f"Duplicate query IDs: {set(duplicates)}")

    # Section IDs within documents
    for doc in documents:
        section_ids = [s["id"] for s in doc.get("sections", [])]
        if len(section_ids) != len(set(section_ids)):
            errors.append(f"Duplicate section IDs in document: {doc['id']}")

    return errors
```

## Rule 3: Referential Integrity

```python
def validate_references(documents: list[dict], queries: list[dict]) -> list[str]:
    """Ensure query expected_chunks reference valid section IDs."""
    errors = []

    # Build set of all valid section IDs
    valid_sections = set()
    for doc in documents:
        for section in doc.get("sections", []):
            valid_sections.add(section["id"])

    # Check query references
    for query in queries:
        for chunk_id in query.get("expected_chunks", []):
            if chunk_id not in valid_sections:
                errors.append(
                    f"Query {query['id']} references invalid section: {chunk_id}"
                )

    return errors
```

## Rule 4: Content Quality

```python
def validate_content_quality(document: dict) -> list[str]:
    """Validate document content meets quality standards."""
    warnings = []

    # Title length
    title = document.get("title", "")
    if len(title) < 10:
        warnings.append("Title too short (min 10 chars)")
    if len(title) > 200:
        warnings.append("Title too long (max 200 chars)")

    # Section content
    for section in document.get("sections", []):
        content = section.get("content", "")
        if len(content) < 50:
            warnings.append(f"Section {section['id']} content too short (min 50 chars)")
        if len(content) > 50000:
            warnings.append(f"Section {section['id']} content very long (>50k chars)")

    # Tags
    tags = document.get("tags", [])
    if len(tags) < 2:
        warnings.append("Too few tags (min 2)")
    if len(tags) > 10:
        warnings.append("Too many tags (max 10)")

    return warnings
```

## Rule 5: Difficulty Distribution

```python
def validate_difficulty_distribution(queries: list[dict]) -> list[str]:
    """Ensure balanced difficulty distribution."""
    warnings = []

    # Count by difficulty
    distribution = {}
    for query in queries:
        diff = query.get("difficulty", "unknown")
        distribution[diff] = distribution.get(diff, 0) + 1

    # Minimum requirements
    requirements = {
        "trivial": 3,
        "easy": 3,
        "medium": 5,  # Most common real-world case
        "hard": 3,
    }

    for level, min_count in requirements.items():
        actual = distribution.get(level, 0)
        if actual < min_count:
            warnings.append(
                f"Insufficient {level} queries: {actual}/{min_count}"
            )

    return warnings
```
