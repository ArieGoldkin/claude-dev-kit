# Pipeline Stages Reference

Detailed configuration for each Terraform pipeline stage.

## Stage Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           VALIDATE STAGE                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│  │  fmt check  │  │  validate   │  │   tflint    │  (optional)           │
│  └─────────────┘  └─────────────┘  └─────────────┘                       │
└──────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                             PLAN STAGE                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│  │    init     │  │    plan     │  │   artifact  │                       │
│  └─────────────┘  └─────────────┘  └─────────────┘                       │
└──────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            APPLY STAGE                                    │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │                     MANUAL APPROVAL GATE                         │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                │                                          │
│                                ▼                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│  │   verify    │  │    apply    │  │  update env │                       │
│  └─────────────┘  └─────────────┘  └─────────────┘                       │
└──────────────────────────────────────────────────────────────────────────┘
```

## Validate Stage

### Format Check

Ensures consistent code formatting:

```yaml
terraform:fmt:
  stage: validate
  script:
    - terraform fmt -check -recursive -diff
  allow_failure: false
```

**Flags**:
- `-check`: Don't modify, just check
- `-recursive`: Check subdirectories
- `-diff`: Show differences

### Validation

Syntax and configuration validation:

```yaml
terraform:validate:
  stage: validate
  script:
    - terraform init -backend=false
    - terraform validate
```

**Note**: Use `-backend=false` for validation-only to avoid needing credentials.

### TFLint (Optional)

Static analysis for Terraform:

```yaml
terraform:tflint:
  stage: validate
  image: ghcr.io/terraform-linters/tflint:latest
  script:
    - tflint --init
    - tflint --recursive
```

**Configuration** (`.tflint.hcl`):
```hcl
plugin "aws" {
  enabled = true
  version = "0.30.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

rule "terraform_naming_convention" {
  enabled = true
}

rule "terraform_documented_variables" {
  enabled = true
}
```

## Plan Stage

### Plan Generation

Creates execution plan:

```yaml
terraform:plan:
  stage: plan
  script:
    - terraform plan -var-file=vars/${TF_ENV}.tfvars -out=plan.tfplan
    # Generate human-readable output
    - terraform show plan.tfplan | tee plan.txt
    # Generate JSON for GitLab MR widget
    - terraform show -json plan.tfplan > plan.json
  artifacts:
    paths:
      - plan.tfplan
      - plan.txt
    reports:
      terraform: plan.json
    expire_in: 7 days
```

### Resource Group Locking

Prevent concurrent operations:

```yaml
terraform:plan:
  resource_group: terraform-${TF_ENV}
```

**Behavior**:
- Only one job per resource group runs at a time
- Queued jobs wait for the current job to complete
- Prevents state corruption from concurrent writes

### MR Plan Preview

GitLab displays plan in merge request:

```yaml
terraform:plan:
  artifacts:
    reports:
      terraform: plan.json
```

The MR widget shows:
- Resources to add/change/destroy
- Link to full plan output

## Apply Stage

### Manual Approval

Require human approval:

```yaml
terraform:apply:
  stage: apply
  when: manual
  allow_failure: false
```

**Options**:
- `when: manual` - Requires click to run
- `allow_failure: false` - Pipeline blocked until approved/run

### Environment Tracking

Link to GitLab environments:

```yaml
terraform:apply:
  environment:
    name: ${TF_ENV}
    action: start
    url: https://${TF_ENV}.example.com
```

**Benefits**:
- Track deployments per environment
- Rollback via environment history
- Environment-specific variables

### Apply with Saved Plan

Use the exact plan that was reviewed:

```yaml
terraform:apply:
  needs:
    - job: terraform:plan
      artifacts: true
  script:
    - terraform apply plan.tfplan
```

**Important**: Always apply the saved plan, never re-run `terraform plan` during apply.

## Destroy Stage

### Protected Destroy

Require explicit confirmation:

```yaml
terraform:destroy:
  stage: destroy
  script:
    - |
      if [ "$DESTROY_CONFIRMED" != "yes" ]; then
        echo "Set DESTROY_CONFIRMED=yes to enable destroy"
        exit 1
      fi
    - terraform destroy -auto-approve
  when: manual
  rules:
    - if: $DESTROY_CONFIRMED == "yes"
      when: manual
```

**Usage**:
1. Set variable `DESTROY_CONFIRMED=yes` in pipeline
2. Manually trigger destroy job

### Environment Cleanup

Mark environment as stopped:

```yaml
terraform:destroy:
  environment:
    name: ${TF_ENV}
    action: stop
```

## Advanced Patterns

### Parallel Environment Plans

```yaml
plan:
  parallel:
    matrix:
      - TF_ENV: [dev, staging]
```

### Conditional Staging

```yaml
apply:production:
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
      when: manual
  needs:
    - job: plan:production
      artifacts: true
    - job: apply:staging
```

### Cost Estimation (Infracost)

```yaml
infracost:
  stage: plan
  image: infracost/infracost:latest
  script:
    - infracost breakdown --path . --format json > infracost.json
    - infracost comment gitlab --path infracost.json --gitlab-token $GITLAB_TOKEN
```

### Drift Detection

Scheduled job to detect configuration drift:

```yaml
drift:check:
  stage: plan
  script:
    - terraform plan -detailed-exitcode -var-file=vars/${TF_ENV}.tfvars
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
  allow_failure: true
```

**Exit codes**:
- 0: No changes
- 1: Error
- 2: Changes detected (drift)
