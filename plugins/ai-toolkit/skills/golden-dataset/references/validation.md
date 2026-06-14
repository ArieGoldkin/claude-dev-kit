# Golden Dataset Validation

**Ensure data integrity, prevent duplicates, and maintain quality standards**

## Overview

This reference provides comprehensive validation patterns for the golden dataset, ensuring every entry meets quality standards before inclusion.

## Schema Validation

### Document Schema (v2.0)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "title", "source_url", "content_type", "sections"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Unique kebab-case identifier"
    },
    "title": {
      "type": "string",
      "minLength": 10,
      "maxLength": 200
    },
    "source_url": {
      "type": "string",
      "format": "uri",
      "description": "Canonical source URL (NOT placeholder)"
    },
    "content_type": {
      "type": "string",
      "enum": ["article", "tutorial", "research_paper", "documentation", "video_transcript", "code_repository"]
    },
    "bucket": {
      "type": "string",
      "enum": ["short", "long"]
    },
    "language": {
      "type": "string",
      "default": "en"
    },
    "tags": {
      "type": "array",
      "items": {"type": "string"},
      "minItems": 2,
      "maxItems": 10
    },
    "sections": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "title", "content"],
        "properties": {
          "id": {"type": "string", "pattern": "^[a-z0-9-/]+$"},
          "title": {"type": "string"},
          "content": {"type": "string", "minLength": 50},
          "granularity": {"enum": ["coarse", "fine", "summary"]}
        }
      }
    }
  }
}
```

### Query Schema

```json
{
  "type": "object",
  "required": ["id", "query", "difficulty", "expected_chunks", "min_score"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^q-[a-z0-9-]+$"
    },
    "query": {
      "type": "string",
      "minLength": 5,
      "maxLength": 500
    },
    "modes": {
      "type": "array",
      "items": {"enum": ["semantic", "keyword", "hybrid"]}
    },
    "category": {
      "enum": ["specific", "broad", "negative", "edge", "coarse-to-fine"]
    },
    "difficulty": {
      "enum": ["trivial", "easy", "medium", "hard", "adversarial"]
    },
    "expected_chunks": {
      "type": "array",
      "items": {"type": "string"},
      "minItems": 1
    },
    "min_score": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    }
  }
}
```

---

## Validation Rules

See [validation-rules.md](validation-rules.md) for detailed rule implementations:
- Rule 1: No Placeholder URLs
- Rule 2: Unique Identifiers
- Rule 3: Referential Integrity
- Rule 4: Content Quality
- Rule 5: Difficulty Distribution

---

## Duplicate Detection

See [duplicate-detection.md](duplicate-detection.md) for:
- Semantic similarity checking using embeddings
- URL duplicate detection with normalization
- Similarity threshold guidelines

---

## Validation Workflows

See [validation-workflows.md](validation-workflows.md) for:
- Pre-addition validation workflow
- Full dataset validation
- Coverage analysis
- CLI integration
- Pre-commit hook setup
