---
name: aws-cost-optimization
description: >
  FinOps practices and AWS cost management with Terraform automation. Covers Savings Plans,
  Reserved Instances, Spot instances, rightsizing with Compute Optimizer, AWS Budgets,
  cost allocation tags, and storage optimization. Provides actionable templates for budget
  alerts, tag enforcement, and cost analysis workflows.
paths:
  - "**/*cost*"
  - "**/*budget*"
  - "terraform/**"
  - "*.tf"
---

# AWS Cost Optimization

FinOps practices for reducing AWS spend while maintaining performance. Most organizations have 15-35% waste - this skill helps identify and eliminate it.

## Quick Start

### 1. Set Up Budget Alerts

Create AWS Budget with SNS notifications:

```hcl
resource "aws_budgets_budget" "monthly" {
  name              = "monthly-cost-budget"
  budget_type       = "COST"
  limit_amount      = "1000"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-01-01_00:00"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Environment$Production"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = ["finops@example.com"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }
}
```

### 2. Enforce Cost Allocation Tags

Required tags for cost visibility:

```hcl
variable "required_tags" {
  default = {
    Environment = "dev|staging|prod"
    Team        = "platform|data|ml"
    CostCenter  = "CC-\\d{4}"
    Project     = ".+"
  }
}

resource "aws_organizations_policy" "tag_policy" {
  name    = "required-cost-tags"
  type    = "TAG_POLICY"
  content = jsonencode({
    tags = {
      for tag, pattern in var.required_tags : tag => {
        tag_key = { "@@assign" = tag }
        enforced_for = { "@@assign" = ["ec2:instance", "rds:db", "lambda:function"] }
      }
    }
  })
}
```

### 3. Analyze Savings Plan Coverage

```bash
# Check current coverage
aws ce get-savings-plans-coverage \
  --time-period Start=2026-01-01,End=2026-01-31 \
  --metrics "CoveragePercentage,OnDemandCost"

# Get purchase recommendations
aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type COMPUTE_SP \
  --lookback-period-in-days SIXTY_DAYS \
  --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT
```

## Savings Plans vs Reserved Instances

### When to Use Savings Plans

| Type | Best For | Flexibility |
|------|----------|-------------|
| Compute SP | Variable workloads, Fargate, Lambda | Any instance family, size, region |
| EC2 Instance SP | Predictable EC2 workloads | Any size within family |

**Recommended strategy**: Start with Compute Savings Plans for flexibility, add RIs for stable, predictable baseline.

### Blended Approach

```
Total On-Demand Spend: $100,000/month

Layer 1: Compute Savings Plans (60% coverage)
  - Covers: EC2, Fargate, Lambda
  - Discount: ~20% average
  - Savings: $12,000/month

Layer 2: Reserved Instances (25% coverage)
  - Covers: Stable EC2 baseline
  - Discount: ~30-40%
  - Savings: $8,750/month

Layer 3: Spot Instances (10% of workloads)
  - Covers: Fault-tolerant batch jobs
  - Discount: ~70%
  - Savings: $7,000/month

Remaining On-Demand: 5% (buffer for spikes)
Total Monthly Savings: ~$27,750 (27.75%)
```

## Spot Instances

### Spot Fleet Configuration

```hcl
resource "aws_spot_fleet_request" "workers" {
  iam_fleet_role                      = aws_iam_role.spot_fleet.arn
  target_capacity                     = 10
  allocation_strategy                 = "capacityOptimized"
  instance_interruption_behaviour     = "stop"
  terminate_instances_with_expiration = true

  launch_template_config {
    launch_template_specification {
      id      = aws_launch_template.worker.id
      version = aws_launch_template.worker.latest_version
    }

    overrides {
      instance_type = "m6i.xlarge"
      subnet_id     = aws_subnet.private_a.id
    }
    overrides {
      instance_type = "m6a.xlarge"
      subnet_id     = aws_subnet.private_b.id
    }
    overrides {
      instance_type = "m5.xlarge"
      subnet_id     = aws_subnet.private_a.id
    }
  }
}
```

### Interruption Handling

```python
# Spot interruption handler (Lambda)
import boto3
import json

def handler(event, context):
    """Handle Spot interruption warnings (2 min notice)."""
    detail = event['detail']
    instance_id = detail['instance-id']

    ec2 = boto3.client('ec2')
    ssm = boto3.client('ssm')

    # Trigger graceful shutdown via SSM
    ssm.send_command(
        InstanceIds=[instance_id],
        DocumentName='AWS-RunShellScript',
        Parameters={'commands': [
            'systemctl stop worker',
            'aws s3 cp /var/checkpoint s3://checkpoints/'
        ]}
    )

    return {'statusCode': 200}
```

## Rightsizing

### Compute Optimizer Integration

```bash
# Enable Compute Optimizer
aws compute-optimizer update-enrollment-status --status Active

# Get EC2 recommendations
aws compute-optimizer get-ec2-instance-recommendations \
  --filters name=Finding,values=OVER_PROVISIONED \
  --query 'instanceRecommendations[*].[instanceArn,currentInstanceType,recommendationOptions[0].instanceType,recommendationOptions[0].estimatedMonthlySavings.value]' \
  --output table
```

### Graviton Migration (40% Price-Performance)

Priority order for Graviton migration:

1. **Lambda** - Change architecture, redeploy
2. **Fargate** - Update task definition CPU architecture
3. **RDS** - Modify instance class to `db.*.g` types
4. **EC2** - Requires ARM-compatible AMI

```hcl
# Graviton-based Lambda
resource "aws_lambda_function" "processor" {
  function_name = "data-processor"
  architectures = ["arm64"]  # Graviton2
  runtime       = "python3.12"
  # ...
}

# Graviton Fargate task
resource "aws_ecs_task_definition" "app" {
  family                   = "app"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 1024
  memory                   = 2048

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"  # Graviton
  }
  # ...
}
```

## Storage Optimization

### S3 Lifecycle Rules

```hcl
resource "aws_s3_bucket_lifecycle_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    id     = "transition-to-cheaper-storage"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 90
      storage_class = "GLACIER_IR"  # Instant Retrieval
    }
    transition {
      days          = 180
      storage_class = "DEEP_ARCHIVE"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER_IR"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}
```

### EBS Optimization

```bash
# Find unattached volumes
aws ec2 describe-volumes \
  --filters Name=status,Values=available \
  --query 'Volumes[*].[VolumeId,Size,CreateTime]' \
  --output table

# Find underutilized volumes (Compute Optimizer)
aws compute-optimizer get-ebs-volume-recommendations \
  --filters name=Finding,values=NotOptimized \
  --output table
```

## AWS Budgets with Terraform

See `${CLAUDE_SKILL_DIR}/templates/budget-alerts.tf` for complete example with:
- Monthly cost budget with forecasted alerts
- Per-service budgets (EC2, RDS, S3)
- Tag-based filtering
- SNS notifications with Lambda processing

## Cost Allocation Tags Strategy

### Required Tags

| Tag | Purpose | Example |
|-----|---------|---------|
| Environment | Filter by env | `prod`, `staging`, `dev` |
| Team | Chargeback | `platform`, `data`, `ml` |
| CostCenter | Finance mapping | `CC-1234` |
| Project | Initiative tracking | `app-v2` |

### Tag Enforcement

See `${CLAUDE_SKILL_DIR}/templates/cost-allocation-tags.tf` for:
- SCP-based tag requirements
- Tag policy for AWS Organizations
- Default tags in Terraform providers

## Monitoring & Alerts

### Cost Anomaly Detection

```hcl
resource "aws_ce_anomaly_monitor" "service" {
  name              = "service-cost-monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

resource "aws_ce_anomaly_subscription" "alerts" {
  name      = "cost-anomaly-alerts"
  frequency = "DAILY"

  monitor_arn_list = [aws_ce_anomaly_monitor.service.arn]

  subscriber {
    type    = "EMAIL"
    address = "finops@example.com"
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      values        = ["100"]
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }
}
```

## Templates

| Template | Purpose |
|----------|---------|
| `${CLAUDE_SKILL_DIR}/templates/budget-alerts.tf` | AWS Budget with SNS notifications |
| `${CLAUDE_SKILL_DIR}/templates/cost-allocation-tags.tf` | Tag enforcement with SCP |
| `${CLAUDE_SKILL_DIR}/templates/savings-plan-analysis.sh` | CLI commands for SP analysis |
| `${CLAUDE_SKILL_DIR}/templates/rightsizing-queries.md` | Compute Optimizer queries |

## References

- `${CLAUDE_SKILL_DIR}/references/savings-plans-strategy.md` - Deep dive on SP vs RI decisions
- `${CLAUDE_SKILL_DIR}/references/spot-patterns.md` - Spot instance best practices

## Key Takeaways

1. **Start with visibility** - Cost allocation tags first
2. **Layer commitments** - Compute SP (60%) + RI (25%) + Spot (10%)
3. **Graviton migration** - Highest ROI optimization (40% savings)
4. **Automate lifecycle** - S3 transitions, EBS cleanup, snapshot policies
5. **Monitor continuously** - Budget alerts + anomaly detection
