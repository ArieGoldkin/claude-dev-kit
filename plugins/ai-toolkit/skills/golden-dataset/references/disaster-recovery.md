# Disaster Recovery Scenarios

Recovery procedures for common golden dataset failures.

## Scenario 1: Accidental Deletion

```bash
# Oh no! Someone ran DELETE FROM analyses WHERE 1=1

# 1. Restore from backup
poetry run python scripts/backup_golden_dataset.py restore --replace

# 2. Verify
poetry run python scripts/backup_golden_dataset.py verify

# 3. Run tests
poetry run pytest tests/integration/test_retrieval_quality.py
```

## Scenario 2: Database Migration Gone Wrong

```bash
# Migration corrupted data

# 1. Rollback migration
alembic downgrade -1

# 2. Restore from backup
poetry run python scripts/backup_golden_dataset.py restore --replace

# 3. Re-run migration (fixed)
alembic upgrade head
```

## Scenario 3: New Environment Setup

```bash
# Fresh dev environment, need golden dataset

# 1. Clone repo (includes backup)
git clone https://your-repo.example.com/your-project
cd your-project

# 2. Setup DB
docker compose up -d postgres
alembic upgrade head

# 3. Restore golden dataset
poetry run python scripts/backup_golden_dataset.py restore

# 4. Verify
poetry run pytest tests/integration/test_retrieval_quality.py
```

## Scenario 4: Embedding Model Change

When upgrading the embedding model:

```bash
# 1. Backup current state (for rollback)
poetry run python scripts/backup_golden_dataset.py backup

# 2. Update embedding model in config
# config.py: EMBEDDING_MODEL = "text-embedding-3-large"

# 3. Restore (regenerates all embeddings with new model)
poetry run python scripts/backup_golden_dataset.py restore --replace

# 4. Run retrieval quality tests
poetry run pytest tests/integration/test_retrieval_quality.py

# 5. Compare metrics (should improve or stay same)
```

## Scenario 5: Partial Data Corruption

```bash
# Some analyses have corrupted chunks

# 1. Identify corrupted records
poetry run python scripts/backup_golden_dataset.py verify
# Output: Found 3 chunks without embeddings

# 2. Delete corrupted and restore
poetry run python scripts/backup_golden_dataset.py restore --replace

# 3. Or fix incrementally (keep existing, add missing)
poetry run python scripts/backup_golden_dataset.py restore
```

## Recovery Checklist

- [ ] Identify scope of data loss
- [ ] Check backup freshness (last backup date)
- [ ] Choose restore strategy (--replace vs incremental)
- [ ] Notify team before restore
- [ ] Run restore in staging first
- [ ] Verify with automated tests
- [ ] Run manual spot checks
- [ ] Document incident and update procedures
