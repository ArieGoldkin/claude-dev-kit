# Naming Convention Helpers
# Provides consistent resource naming across the infrastructure
#
# Usage:
#   Copy this to your root module's locals.tf and customize as needed

variable "app_name" {
  description = "Application name (e.g., myapp, analytics)"
  type        = string
}

variable "service_name" {
  description = "Service name within the application (e.g., api, worker)"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, production)"
  type        = string
}

locals {
  # ============================================================================
  # BASE NAMING
  # ============================================================================

  # Standard prefix: {app}-{service}-{env}
  name_prefix = "${var.app_name}-${var.service_name}-${var.environment}"

  # Short prefix (when length limits apply): {app}{env_abbrev}
  env_abbrev = {
    dev        = "d"
    staging    = "s"
    production = "p"
  }
  name_prefix_short = "${var.app_name}${local.env_abbrev[var.environment]}"

  # ============================================================================
  # RESOURCE-SPECIFIC NAMES
  # ============================================================================

  # Lambda Functions
  lambda_function_name = local.name_prefix

  # API Gateway
  api_name = "${local.name_prefix}-api"

  # RDS/Aurora
  rds_identifier     = local.name_prefix
  rds_cluster_id     = "${local.name_prefix}-cluster"
  db_subnet_group    = "${local.name_prefix}-db-subnet"
  db_parameter_group = "${local.name_prefix}-db-params"

  # S3 Buckets (must be globally unique)
  # Append account ID for uniqueness
  s3_bucket_name = "${local.name_prefix}-${data.aws_caller_identity.current.account_id}"

  # SQS Queues
  sqs_queue_name = local.name_prefix
  sqs_dlq_name   = "${local.name_prefix}-dlq"

  # SNS Topics
  sns_topic_name = local.name_prefix

  # CloudWatch Log Groups
  log_group_name = "/aws/lambda/${local.lambda_function_name}"

  # IAM Roles
  lambda_role_name = "${local.name_prefix}-lambda-role"
  ecs_role_name    = "${local.name_prefix}-ecs-role"

  # Security Groups
  lambda_sg_name   = "${local.name_prefix}-lambda-sg"
  database_sg_name = "${local.name_prefix}-db-sg"
  alb_sg_name      = "${local.name_prefix}-alb-sg"

  # KMS Keys
  kms_alias = "alias/${local.name_prefix}"

  # Secrets Manager
  secret_name = "${local.name_prefix}/secrets"

  # ECR Repository
  ecr_repository_name = "${var.app_name}-${var.service_name}"

  # ============================================================================
  # HELPER FUNCTIONS
  # ============================================================================

  # Generate name with custom suffix
  # Usage: local.resource_name("handler")  => "app-service-env-handler"
  resource_name = {
    for suffix in ["handler", "processor", "scheduler", "worker"] :
    suffix => "${local.name_prefix}-${suffix}"
  }
}

# Required data source for S3 bucket naming
data "aws_caller_identity" "current" {}
