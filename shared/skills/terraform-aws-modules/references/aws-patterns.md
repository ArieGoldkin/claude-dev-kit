# AWS Implementation Patterns

Detailed Terraform configuration patterns for common AWS services used in serverless applications.

## Table of Contents

- [Aurora vs Standalone PostgreSQL](#aurora-vs-standalone-postgresql)
- [API Gateway with WAF](#api-gateway-with-waf)
- [SNS/SQS Event-Driven Architecture](#snssqs-event-driven-architecture)
- [Cross-Account IAM Role Assumption](#cross-account-iam-role-assumption)
- [KMS Encryption](#kms-encryption)

## Aurora vs Standalone PostgreSQL

Choose based on environment requirements. Use a boolean variable to switch between Aurora (production) and standalone RDS (dev/staging).

```hcl
variable "use_aurora" {
  description = "Use Aurora cluster (production) vs standalone RDS (dev)"
  type        = bool
  default     = false
}

# Aurora for production
resource "aws_rds_cluster" "aurora" {
  count                   = var.use_aurora ? 1 : 0
  cluster_identifier      = local.rds_identifier
  engine                  = "aurora-postgresql"
  engine_version          = "15.4"
  master_username         = var.db_username
  master_password         = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.database.id]
  deletion_protection     = var.enable_deletion_protection
  skip_final_snapshot     = var.environment != "production"
}

# Standalone for dev/staging
resource "aws_db_instance" "postgres" {
  count                   = var.use_aurora ? 0 : 1
  identifier              = local.rds_identifier
  engine                  = "postgres"
  engine_version          = "15.4"
  instance_class          = var.instance_class
  allocated_storage       = 20
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.database.id]
  deletion_protection     = var.enable_deletion_protection
  skip_final_snapshot     = var.environment != "production"
}
```

Also see `references/module-patterns.md` for the reusable database module version with outputs.

## API Gateway with WAF

HTTP API with WAF protection using AWS managed rule groups:

```hcl
resource "aws_apigatewayv2_api" "main" {
  name          = local.api_gateway_name
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.cors_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Authorization", "Content-Type"]
    max_age       = 86400
  }
}

# WAF Web ACL
resource "aws_wafv2_web_acl" "api" {
  name  = "${local.name_prefix}-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSet"
    }
  }
}

# Associate WAF with API Gateway
resource "aws_wafv2_web_acl_association" "api" {
  resource_arn = aws_apigatewayv2_stage.main.arn
  web_acl_arn  = aws_wafv2_web_acl.api.arn
}
```

## SNS/SQS Event-Driven Architecture

Fan-out pattern for async processing with dead-letter queue:

```hcl
# SNS Topic
resource "aws_sns_topic" "events" {
  name = "${local.name_prefix}-events"
  kms_master_key_id = aws_kms_key.main.id
}

# SQS Queue
resource "aws_sqs_queue" "processor" {
  name                       = "${local.name_prefix}-processor"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 1209600  # 14 days
  kms_master_key_id         = aws_kms_key.main.id

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}

# Dead Letter Queue
resource "aws_sqs_queue" "dlq" {
  name                      = "${local.name_prefix}-processor-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id        = aws_kms_key.main.id
}

# SNS to SQS Subscription
resource "aws_sns_topic_subscription" "processor" {
  topic_arn = aws_sns_topic.events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.processor.arn
}
```

## Cross-Account IAM Role Assumption

Access resources in other AWS accounts using role assumption with external ID:

```hcl
# In source account: role that can be assumed
resource "aws_iam_role" "cross_account" {
  name = "${local.name_prefix}-cross-account"

  assume_role_policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Principal = {
        AWS = "arn:aws:iam::${var.target_account_id}:root"
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "sts:ExternalId" = var.external_id
        }
      }
    }]
  })
}

# In target account: policy to assume the role
resource "aws_iam_policy" "assume_cross_account" {
  name = "${local.name_prefix}-assume-cross-account"

  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = "sts:AssumeRole"
      Resource = "arn:aws:iam::${var.source_account_id}:role/${var.cross_account_role_name}"
    }]
  })
}
```

## KMS Encryption

Customer-managed keys for encryption with key rotation and service-level access grants:

```hcl
resource "aws_kms_key" "main" {
  description             = "KMS key for ${local.name_prefix}"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Statement = [
      {
        Sid    = "RootAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "LambdaAccess"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name_prefix}"
  target_key_id = aws_kms_key.main.key_id
}
```
