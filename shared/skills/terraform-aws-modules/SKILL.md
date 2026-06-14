---
name: terraform-aws-modules
description: |
  Generic AWS module patterns for serverless applications with Terraform. Use when organizing
  multi-environment deployments with tfvars, implementing naming conventions and tagging
  standards, configuring Aurora vs standalone PostgreSQL, setting up API Gateway with WAF,
  or building SNS/SQS event-driven architectures. Covers cross-account IAM role assumption,
  KMS encryption patterns, and module composition. Includes templates for naming helpers,
  tagging locals, and environment file organization.
effort: low
paths:
  - "terraform/**"
  - "infra/**"
  - "*.tf"
  - "*.tfvars"
---

# Terraform AWS Modules Skill

Generic AWS module patterns for serverless applications using Terraform.

## Project Structure

```
terraform/
├── main.tf                 # Root module, module calls
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── versions.tf             # Provider and Terraform versions
├── backend.tf              # State backend configuration
├── locals.tf               # Naming and tagging helpers
├── modules/                # Reusable modules
│   ├── lambda-function/
│   ├── api-gateway/
│   ├── rds/
│   ├── s3-bucket/
│   └── sns-sqs/
└── vars/                   # Environment-specific variables
    ├── dev.tfvars
    ├── staging.tfvars
    ├── production.tfvars
    └── personal/           # Developer environments
        ├── alice.tfvars
        └── bob.tfvars
```

## Key Concepts

### Naming Conventions

Consistent naming across all resources:

```hcl
locals {
  # Base naming pattern: {app}-{service}-{env}
  name_prefix = "${var.app_name}-${var.service_name}-${var.environment}"

  # Resource-specific names
  lambda_name     = "${local.name_prefix}-handler"
  api_gateway_name = "${local.name_prefix}-api"
  rds_identifier  = "${local.name_prefix}-db"
  s3_bucket_name  = "${local.name_prefix}-${var.aws_account_id}"
}
```

**Naming rules**:
- Lowercase with hyphens
- Include environment suffix
- S3 buckets: append account ID for uniqueness
- Max 63 characters for most resources

> See `${CLAUDE_SKILL_DIR}/templates/naming-locals.tf` for complete helper

### Tagging Standards

Consistent tags for cost allocation and management:

```hcl
locals {
  common_tags = {
    Application = var.app_name
    Service     = var.service_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Team        = var.team_name
    CostCenter  = var.cost_center
  }
}

# Usage in resources
resource "aws_lambda_function" "main" {
  # ...
  tags = merge(local.common_tags, {
    Function = "api-handler"
  })
}
```

**Required tags**:
- `Application`: Top-level application name
- `Environment`: dev/staging/production
- `ManagedBy`: terraform (for drift detection)

> See `${CLAUDE_SKILL_DIR}/templates/tags-locals.tf` for tagging helper

### Multi-Environment with tfvars

Separate configuration per environment:

```hcl
# vars/dev.tfvars
environment       = "dev"
instance_class    = "db.t3.micro"
lambda_memory     = 256
enable_deletion_protection = false

# vars/production.tfvars
environment       = "production"
instance_class    = "db.r6g.large"
lambda_memory     = 1024
enable_deletion_protection = true
```

**Usage**:
```bash
terraform plan -var-file=vars/dev.tfvars
terraform apply -var-file=vars/production.tfvars
```

> See `${CLAUDE_SKILL_DIR}/templates/tfvars-example.tfvars` and `${CLAUDE_SKILL_DIR}/references/environment-strategy.md`

### AWS Service Patterns

For detailed implementation patterns with full code examples covering Aurora/RDS database selection, API Gateway with WAF, SNS/SQS event-driven architecture, cross-account IAM role assumption, and KMS encryption, see [references/aws-patterns.md](${CLAUDE_SKILL_DIR}/references/aws-patterns.md).

### Module Composition

Root module composition wires child modules together by passing outputs as inputs. For patterns and examples, see [references/module-patterns.md](${CLAUDE_SKILL_DIR}/references/module-patterns.md).

## Templates Reference

| Template | Purpose |
|----------|---------|
| `naming-locals.tf` | Naming convention helpers |
| `tags-locals.tf` | Standard tagging locals |
| `tfvars-example.tfvars` | Environment file template |

## References

- `${CLAUDE_SKILL_DIR}/references/aws-patterns.md` - Aurora/RDS, WAF, SNS/SQS, IAM, KMS patterns
- `${CLAUDE_SKILL_DIR}/references/module-patterns.md` - Module design patterns
- `${CLAUDE_SKILL_DIR}/references/environment-strategy.md` - Multi-environment strategy
