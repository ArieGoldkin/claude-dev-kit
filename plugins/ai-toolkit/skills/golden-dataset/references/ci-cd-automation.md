# CI/CD Integration for Golden Dataset

Automated backup and validation pipelines for golden dataset management.

## GitLab CI Pipeline

```yaml
# .gitlab-ci.yml
backup-golden-dataset:
  stage: maintenance
  image: python:3.11-slim
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"  # Weekly schedule
    - if: $CI_PIPELINE_SOURCE == "web"       # Manual trigger
  variables:
    DATABASE_URL: $PROD_DATABASE_URL
  before_script:
    - cd backend
    - pip install poetry
    - poetry install --only main
  script:
    - poetry run python scripts/backup_golden_dataset.py backup
    - poetry run python scripts/backup_golden_dataset.py verify
  artifacts:
    paths:
      - backend/data/golden_dataset_backup.json
      - backend/data/golden_dataset_metadata.json
    expire_in: 30 days

# Scheduled backup (configure in GitLab CI/CD > Schedules)
# Cron: 0 2 * * 0 (Weekly on Sunday at 2am)
```

## Validation in MR Pipeline

```yaml
validate-golden-dataset:
  stage: test
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes:
        - backend/data/golden_dataset_backup.json
  script:
    - cd backend
    - poetry run python scripts/backup_golden_dataset.py verify
    - poetry run pytest tests/integration/test_retrieval_quality.py
```

## Commit Automation

After successful backup, commit changes:

```yaml
commit-backup:
  stage: deploy
  needs: [backup-golden-dataset]
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
  script:
    - git config user.name "GitLab CI"
    - git config user.email "ci@example.com"
    - git add backend/data/golden_dataset_backup.json
    - git add backend/data/golden_dataset_metadata.json
    - |
      if git diff --staged --quiet; then
        echo "No changes to commit"
      else
        git commit -m "chore: automated golden dataset backup"
        git push https://oauth2:${GITLAB_TOKEN}@${CI_SERVER_HOST}/${CI_PROJECT_PATH}.git HEAD:main
      fi
```

## Environment-Specific Backups

```yaml
backup-staging:
  extends: .backup-template
  environment: staging
  variables:
    DATABASE_URL: $STAGING_DATABASE_URL

backup-production:
  extends: .backup-template
  environment: production
  variables:
    DATABASE_URL: $PROD_DATABASE_URL
  when: manual  # Require manual trigger for production
```
