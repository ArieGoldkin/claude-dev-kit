# Multi-Environment Strategy

## Table of Contents

- [Environment Types](#environment-types)
- [tfvars Organization](#tfvars-organization)
- [Configuration Differences](#configuration-differences)
  - [Production vs Development](#production-vs-development)
  - [Sample Configurations](#sample-configurations)
- [State Isolation](#state-isolation)
  - [Option 1: State Per Environment (Recommended)](#option-1-state-per-environment-recommended)
  - [Option 2: Workspaces](#option-2-workspaces)
- [Promotion Workflow](#promotion-workflow)
  - [CI/CD Implementation](#cicd-implementation)
- [Personal Environments](#personal-environments)
  - [Template for New Developers](#template-for-new-developers)
  - [Naming Convention](#naming-convention)
  - [Cleanup Script](#cleanup-script)
- [Preview Environments](#preview-environments)
- [Cost Management](#cost-management)
  - [Budget Alerts](#budget-alerts)
  - [Auto-Shutdown for Non-Production](#auto-shutdown-for-non-production)

Patterns for managing multiple environments with Terraform.

## Environment Types

| Environment | Purpose | Lifespan | Cost Profile |
|-------------|---------|----------|--------------|
| **production** | Live traffic | Permanent | High availability |
| **staging** | Pre-production testing | Permanent | Production-like |
| **dev** | Integration testing | Permanent | Minimal |
| **personal** | Developer sandboxes | Temporary | Minimal |
| **preview** | PR-based environments | Ephemeral | On-demand |

## tfvars Organization

```
terraform/
└── vars/
    ├── production.tfvars     # Production configuration
    ├── staging.tfvars        # Staging configuration
    ├── dev.tfvars            # Development configuration
    └── personal/             # Developer environments
        ├── alice.tfvars
        ├── bob.tfvars
        └── template.tfvars   # Template for new devs
```

## Configuration Differences

### Production vs Development

| Setting | Production | Development |
|---------|------------|-------------|
| `use_aurora` | `true` | `false` |
| `instance_class` | `db.r6g.large` | `db.t3.micro` |
| `deletion_protection` | `true` | `false` |
| `skip_final_snapshot` | `false` | `true` |
| `multi_az` | `true` | `false` |
| `enable_waf` | `true` | `false` |
| `log_retention_days` | `365` | `7` |

### Sample Configurations

**production.tfvars**:
```hcl
environment = "production"

# Compute
lambda_memory  = 1024
lambda_timeout = 30

# Database
use_aurora     = true
instance_class = "db.r6g.large"
enable_deletion_protection = true
skip_final_snapshot        = false

# Security
enable_waf = true
cors_origins = [
  "https://app.example.com"
]

# Monitoring
log_retention_days = 365
```

**dev.tfvars**:
```hcl
environment = "dev"

# Compute
lambda_memory  = 256
lambda_timeout = 30

# Database
use_aurora     = false
instance_class = "db.t3.micro"
enable_deletion_protection = false
skip_final_snapshot        = true

# Security
enable_waf = false
cors_origins = [
  "http://localhost:3000",
  "https://dev.example.com"
]

# Monitoring
log_retention_days = 7
```

## State Isolation

### Option 1: State Per Environment (Recommended)

```
states/
├── production/terraform.tfstate
├── staging/terraform.tfstate
└── dev/terraform.tfstate
```

**GitLab HTTP Backend**:
```yaml
# In CI, dynamically set state name
variables:
  TF_STATE_NAME: ${CI_PROJECT_NAME}-${TF_ENV}
```

### Option 2: Workspaces

```bash
terraform workspace new production
terraform workspace new staging
terraform workspace select production
terraform apply -var-file=vars/production.tfvars
```

**Note**: Workspaces share the same backend configuration, which can be limiting.

## Promotion Workflow

```
dev → staging → production
```

### CI/CD Implementation

```yaml
# .gitlab-ci.yml
stages:
  - plan
  - apply:dev
  - apply:staging
  - apply:production

apply:dev:
  stage: apply:dev
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  script:
    - terraform apply -var-file=vars/dev.tfvars -auto-approve

apply:staging:
  stage: apply:staging
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  script:
    - terraform apply -var-file=vars/staging.tfvars -auto-approve
  needs:
    - apply:dev

apply:production:
  stage: apply:production
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
  script:
    - terraform apply -var-file=vars/production.tfvars
  when: manual
  needs:
    - apply:staging
```

## Personal Environments

### Template for New Developers

```hcl
# vars/personal/template.tfvars
# Copy to your-name.tfvars and customize

environment = "YOURNAME"  # Replace with your name

# Use minimal resources
lambda_memory  = 256
instance_class = "db.t3.micro"
use_aurora     = false

# Disable protection for easy cleanup
enable_deletion_protection = false
skip_final_snapshot        = true

# Personal CORS origins
cors_origins = [
  "http://localhost:3000"
]
```

### Naming Convention

Personal resources use developer name:
- Lambda: `myapp-api-alice`
- RDS: `myapp-alice`
- S3: `myapp-alice-123456789012`

### Cleanup Script

```bash
#!/bin/bash
# scripts/destroy-personal-env.sh
DEVELOPER=${1:-$(whoami)}
terraform destroy -var-file=vars/personal/${DEVELOPER}.tfvars
```

## Preview Environments

Ephemeral environments for pull requests:

```yaml
# .gitlab-ci.yml
preview:apply:
  stage: preview
  rules:
    - if: $CI_MERGE_REQUEST_IID
  script:
    - export TF_VAR_environment="pr-${CI_MERGE_REQUEST_IID}"
    - terraform apply -auto-approve
  environment:
    name: preview/pr-${CI_MERGE_REQUEST_IID}
    on_stop: preview:destroy

preview:destroy:
  stage: preview
  rules:
    - if: $CI_MERGE_REQUEST_IID
      when: manual
  script:
    - export TF_VAR_environment="pr-${CI_MERGE_REQUEST_IID}"
    - terraform destroy -auto-approve
  environment:
    name: preview/pr-${CI_MERGE_REQUEST_IID}
    action: stop
```

## Cost Management

### Budget Alerts

```hcl
resource "aws_budgets_budget" "environment" {
  name         = "${var.app_name}-${var.environment}"
  budget_type  = "COST"
  limit_amount = var.monthly_budget
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Environment$${var.environment}"]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_email_addresses = var.alert_emails
  }
}
```

### Auto-Shutdown for Non-Production

Schedule Lambda to stop dev resources overnight:

```hcl
resource "aws_cloudwatch_event_rule" "stop_dev" {
  count               = var.environment == "dev" ? 1 : 0
  name                = "${var.app_name}-dev-stop"
  schedule_expression = "cron(0 22 ? * MON-FRI *)"  # 10 PM weekdays
}
```
