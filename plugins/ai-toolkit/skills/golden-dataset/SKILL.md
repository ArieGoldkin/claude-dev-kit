---
name: golden-dataset
description: "Golden dataset curation, backup/restore, validation with schema checks, duplicate detection, and coverage analysis"
effort: medium
paths:
  - "**/*golden*"
  - "**/*dataset*"
  - "**/*evaluation*"
  - "tests/data/**"
---

# Golden Dataset

**Curate, manage, and validate high-quality test datasets for AI/ML systems**

## Overview

A **golden dataset** is a curated collection of high-quality examples used for regression testing, retrieval evaluation, model benchmarking, and reproducibility. This skill covers the full lifecycle: curating new entries with quality analysis, managing backup/restore operations, and validating data integrity.

### Example Golden Dataset Metrics

| Metric | Value |
|--------|-------|
| Documents | 98 completed |
| Chunks | 415 embedded segments |
| Test queries | 203 with expected results |
| Pass rate | 91.6% retrieval quality |

**Purpose:** Test hybrid search (vector + BM25 + RRF), validate metadata boosting, detect retrieval regressions, benchmark embedding models.

---

## Curation

Quality criteria, workflows, and multi-agent analysis patterns for evaluating and adding documents to the golden dataset.

**Key areas:**
- **Content type classification** -- article, tutorial, research paper, documentation, video transcript, code repository
- **Difficulty stratification** -- trivial, easy, medium, hard, adversarial (based on semantic complexity)
- **Quality dimensions** -- accuracy (0.25), coherence (0.20), depth (0.25), relevance (0.30)
- **Multi-agent pipeline** -- parallel evaluation with Quality Evaluator, Difficulty Classifier, Domain Tagger, Query Generator
- **Duplicate prevention** -- URL check + semantic similarity > 80% threshold

**Detailed patterns:** [references/curation.md](${CLAUDE_SKILL_DIR}/references/curation.md)
**Multi-agent pipeline:** [references/multi-agent-pipeline.md](${CLAUDE_SKILL_DIR}/references/multi-agent-pipeline.md)

---

## Management

Backup, restore, and lifecycle operations for protecting golden dataset integrity.

**Key areas:**
- **Data integrity contracts** -- real canonical URLs required, no placeholders
- **JSON backup strategy** -- version-controlled, human-readable, portable; embeddings excluded and regenerated on restore
- **Restore process** -- load JSON, validate structure, create analyses/chunks, regenerate embeddings, verify integrity
- **CLI usage** -- `poetry run python scripts/backup_golden_dataset.py backup|verify|restore`
- **CI/CD automation** -- GitLab CI pipeline integration for scheduled backups

**Detailed patterns:** [references/management.md](${CLAUDE_SKILL_DIR}/references/management.md)
**Backup/restore code:** [references/backup-restore.md](${CLAUDE_SKILL_DIR}/references/backup-restore.md)
**CI/CD automation:** [references/ci-cd-automation.md](${CLAUDE_SKILL_DIR}/references/ci-cd-automation.md)
**Disaster recovery:** [references/disaster-recovery.md](${CLAUDE_SKILL_DIR}/references/disaster-recovery.md)
**Validation contracts:** [references/validation-contracts.md](${CLAUDE_SKILL_DIR}/references/validation-contracts.md)

---

## Validation

Schema checks, duplicate detection, and coverage analysis for ensuring every entry meets quality standards.

**Key areas:**
- **Schema validation** -- document schema v2.0 (id, title, source_url, content_type, sections) and query schema (id, query, difficulty, expected_chunks, min_score)
- **Validation rules** -- no placeholder URLs, unique IDs, referential integrity, content quality, difficulty distribution
- **Duplicate detection** -- semantic similarity via embeddings + URL normalization
- **Coverage analysis** -- content type balance, difficulty distribution, domain spread

**Detailed patterns:** [references/validation.md](${CLAUDE_SKILL_DIR}/references/validation.md)
**Validation rules:** [references/validation-rules.md](${CLAUDE_SKILL_DIR}/references/validation-rules.md)
**Duplicate detection:** [references/duplicate-detection.md](${CLAUDE_SKILL_DIR}/references/duplicate-detection.md)
**Validation workflows:** [references/validation-workflows.md](${CLAUDE_SKILL_DIR}/references/validation-workflows.md)

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backup format | JSON (not SQL dump) | Version-controllable, human-readable, portable across DB versions |
| Embeddings in backup | Excluded | Regenerated on restore with current model; keeps backups small |
| URL contract | Real canonical URLs only | Enables re-fetch, source validation, audit trail |
| Quality threshold | Minimum 0.70 score | Balance between quality and coverage |
| Minimum metadata | 2 tags, 3 test queries | Ensures searchability and testability |
| Difficulty levels | 5 tiers (trivial to adversarial) | Comprehensive retrieval evaluation at all complexity levels |
| Duplicate threshold | 80% semantic similarity | Prevents near-duplicates while allowing related content |

---

## Example Implementation Files

| File | Purpose |
|------|---------|
| `scripts/backup_golden_dataset.py` | Main backup script |
| `data/golden_dataset_backup.json` | JSON backup (version controlled) |
| `data/golden_dataset_metadata.json` | Quick stats |
| `documents_expanded.json` | Expanded document data |
| `queries.json` | Test queries with expected results |
| `source_url_map.json` | URL deduplication index |

---

## Related Skills

- `langfuse-observability` -- tracing patterns for curation pipeline
- `pgvector-search` -- retrieval evaluation and duplicate detection
- `ai-native-development` -- embedding generation for restore
- `devops-deployment` -- CI/CD backup automation

---

**Version:** 1.0.0 (December 2025)
**Issue:** #599
