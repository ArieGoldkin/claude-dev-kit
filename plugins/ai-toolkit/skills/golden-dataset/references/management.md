# Golden Dataset Management

**Protect and maintain high-quality test datasets for AI/ML systems**

## Overview

A **golden dataset** is a curated collection of high-quality examples used for:
- **Regression testing:** Ensure new code doesn't break existing functionality
- **Retrieval evaluation:** Measure search quality (precision, recall, MRR)
- **Model benchmarking:** Compare different models/approaches
- **Reproducibility:** Consistent results across environments

## Example Golden Dataset

**Stats (Production):**
- **98 documents** (completed content analyses)
- **415 chunks** (embedded text segments)
- **203 test queries** (with expected results)
- **91.6% pass rate** (retrieval quality metric)

**Purpose:**
- Test hybrid search (vector + BM25 + RRF)
- Validate metadata boosting strategies
- Detect regressions in retrieval quality
- Benchmark new embedding models

---

## Core Concepts

### 1. Data Integrity Contracts

**The URL Contract:**

Golden dataset analyses MUST store **real canonical URLs**, not placeholders.

```python
# WRONG - Placeholder URL (breaks restore)
analysis.url = "https://example.placeholder.com/placeholder/123"

# CORRECT - Real canonical URL (enables re-fetch if needed)
analysis.url = "https://docs.python.org/3/library/asyncio.html"
```

**Why this matters:**
- Enables re-fetching content if embeddings need regeneration
- Allows validation that source content hasn't changed
- Provides audit trail for data provenance

**Verification:**
```python
# Check for placeholder URLs
def verify_url_contract(analyses: list[Analysis]) -> list[str]:
    """Find analyses with placeholder URLs."""
    invalid = []
    for analysis in analyses:
        if "example.placeholder.com" in analysis.url or "placeholder" in analysis.url:
            invalid.append(analysis.id)
    return invalid
```

---

### 2. Backup Strategies

#### Strategy 1: JSON Backup (Recommended)

**Pros:**
- Version controlled (commit to git)
- Human-readable (easy to inspect)
- Portable (works across DB versions)
- Incremental diffs (see what changed)

**Cons:**
- Must regenerate embeddings on restore
- Larger file size than SQL dump

**JSON backup is the recommended approach.**

#### Strategy 2: SQL Dump

**Pros:**
- Fast restore (includes embeddings)
- Exact replica (binary-identical)
- Native PostgreSQL format

**Cons:**
- Not version controlled (binary format)
- DB version dependent
- No easy inspection

**Use case:** Local snapshots, not version control.

---

### 3. Backup Format

```json
{
  "version": "1.0",
  "created_at": "2025-12-19T10:30:00Z",
  "metadata": {
    "total_analyses": 98,
    "total_chunks": 415,
    "total_artifacts": 98
  },
  "analyses": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://docs.python.org/3/library/asyncio.html",
      "content_type": "documentation",
      "status": "completed",
      "created_at": "2025-11-15T08:20:00Z",
      "findings": [
        {
          "agent": "security_agent",
          "category": "best_practices",
          "content": "Always use asyncio.run() for top-level entry point",
          "confidence": 0.92
        }
      ],
      "chunks": [
        {
          "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
          "content": "asyncio is a library to write concurrent code...",
          "section_title": "Introduction to asyncio",
          "section_path": "docs/python/asyncio/intro.md",
          "content_type": "paragraph",
          "chunk_index": 0
        }
      ],
      "artifact": {
        "id": "a1b2c3d4-e5f6-4a5b-8c7d-9e8f7a6b5c4d",
        "summary": "Comprehensive guide to asyncio...",
        "key_findings": ["..."],
        "metadata": {}
      }
    }
  ]
}
```

**Key Design Decisions:**
- Embeddings excluded (regenerate on restore with current model)
- Nested structure (analyses -> chunks -> artifacts)
- Metadata for validation
- ISO timestamps for reproducibility

---

## Backup Implementation

Exports completed analyses, chunks, and artifacts to JSON (excluding embeddings).
Writes both a full backup file and a metadata summary for quick stats.

**Full script and serialization code:** See [backup-restore.md](backup-restore.md#detailed-implementation-from-skillmd)

---

## Restore Implementation

### Process Overview

1. **Load JSON backup**
2. **Validate structure** (version, required fields)
3. **Create analyses** (without embeddings yet)
4. **Create chunks** (without embeddings yet)
5. **Generate embeddings** (using current embedding model)
6. **Create artifacts**
7. **Verify integrity** (counts, URL contract)

### Key Challenge: Regenerating Embeddings

On restore, embeddings are regenerated using the current model rather than stored from the backup. This ensures consistency with production and keeps backup files small.

**Full restore code with embedding regeneration:** See [backup-restore.md](backup-restore.md#restore-regenerating-embeddings)

---

## Validation

### Validation Checklist

Verification performs four checks: count validation, URL contract enforcement, embedding completeness, and orphan detection.

**Full validation code:** See [validation-contracts.md](validation-contracts.md#detailed-validation-checklist-from-skillmd)

---

## CLI Usage

```bash
cd backend

# Backup golden dataset
poetry run python scripts/backup_golden_dataset.py backup

# Verify backup integrity
poetry run python scripts/backup_golden_dataset.py verify

# Restore from backup (WARNING: Deletes existing data)
poetry run python scripts/backup_golden_dataset.py restore --replace

# Restore without deleting (adds to existing)
poetry run python scripts/backup_golden_dataset.py restore
```

---

## CI/CD Integration

Automate golden dataset backups with GitLab CI pipelines.

**Detailed Implementation:** See [ci-cd-automation.md](ci-cd-automation.md)

---

## Best Practices

1. **Version control backups** - Commit JSON backups to git with descriptive messages
2. **Validate before deployment** - Run `verify` command in pre-deployment checks
3. **Test restore in staging first** - Never test restore directly in production
4. **Document changes** - Track additions/removals in metadata.json changelog

---

## Disaster Recovery

Recovery procedures for accidental deletion, migration failures, and environment setup.

**Detailed Scenarios:** See [disaster-recovery.md](disaster-recovery.md)

---

## References

### Example Implementation
- `scripts/backup_golden_dataset.py` - Main backup script
- `data/golden_dataset_backup.json` - JSON backup (version controlled)
- `data/golden_dataset_metadata.json` - Quick stats
