# AWS Budget Alerts with SNS Notifications
# Creates monthly cost budget with forecasted and actual spend alerts

locals {
  budget_name = "${var.project}-${var.environment}-budget"
  alert_emails = var.alert_emails
}

# SNS Topic for budget alerts
resource "aws_sns_topic" "budget_alerts" {
  name = "${local.budget_name}-alerts"

  # Encrypt the topic at rest. "alias/aws/sns" is the AWS-managed key;
  # use a customer-managed CMK in production for key-rotation control.
  # Budget alerts are low-sensitivity, but encrypting all SNS topics by
  # default avoids a per-topic risk judgment and satisfies CIS/kics checks.
  kms_master_key_id = "alias/aws/sns"

  tags = {
    Purpose = "Budget Alerts"
    Project = var.project
  }
}

# Email subscriptions
resource "aws_sns_topic_subscription" "email" {
  for_each = toset(local.alert_emails)

  topic_arn = aws_sns_topic.budget_alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

# Monthly cost budget - Overall
resource "aws_budgets_budget" "monthly_total" {
  name              = "${local.budget_name}-monthly"
  budget_type       = "COST"
  limit_amount      = var.monthly_budget_limit
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-01-01_00:00"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Environment$${var.environment}"]
  }

  # 80% forecasted alert
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }

  # 100% forecasted alert
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }

  # 90% actual spend alert
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 90
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }

  # 100% actual spend alert
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
  }
}

# Per-service budgets
resource "aws_budgets_budget" "service" {
  for_each = var.service_budgets

  name              = "${local.budget_name}-${each.key}"
  budget_type       = "COST"
  limit_amount      = each.value
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-01-01_00:00"

  cost_filter {
    name   = "Service"
    values = [each.key]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.budget_alerts.arn]
  }
}

# Variables
variable "project" {
  description = "Project name for tagging"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "monthly_budget_limit" {
  description = "Monthly budget limit in USD"
  type        = string
  default     = "1000"
}

variable "alert_emails" {
  description = "List of email addresses for budget alerts"
  type        = list(string)
  default     = []
}

variable "service_budgets" {
  description = "Map of service names to monthly budget limits"
  type        = map(string)
  default = {
    "Amazon Elastic Compute Cloud - Compute" = "500"
    "Amazon Relational Database Service"     = "300"
    "Amazon Simple Storage Service"          = "100"
  }
}

# Outputs
output "sns_topic_arn" {
  description = "ARN of the budget alerts SNS topic"
  value       = aws_sns_topic.budget_alerts.arn
}

output "budget_names" {
  description = "Names of created budgets"
  value = concat(
    [aws_budgets_budget.monthly_total.name],
    [for b in aws_budgets_budget.service : b.name]
  )
}
