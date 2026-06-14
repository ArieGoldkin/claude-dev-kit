# Reusable Lambda Module for Container Images
# Usage:
#   module "lambda" {
#     source = "./modules/lambda-function"
#     app_name = "myapp"
#     function_name = "api-handler"
#     environment = "production"
#     ecr_repository_url = module.ecr.repository_url
#     image_tag = "v1.0.0"
#   }

variable "app_name" {
  description = "Application name"
  type        = string
}

variable "function_name" {
  description = "Lambda function name"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, production)"
  type        = string
}

variable "ecr_repository_url" {
  description = "ECR repository URL"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "memory_size" {
  description = "Lambda memory in MB"
  type        = number
  default     = 512
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "Environment variables for Lambda"
  type        = map(string)
  default     = {}
}

variable "vpc_enabled" {
  description = "Enable VPC configuration"
  type        = bool
  default     = false
}

variable "subnet_ids" {
  description = "Subnet IDs for VPC configuration"
  type        = list(string)
  default     = []
}

variable "security_group_ids" {
  description = "Security group IDs for VPC configuration"
  type        = list(string)
  default     = []
}

variable "reserved_concurrency" {
  description = "Reserved concurrent executions (-1 for unreserved)"
  type        = number
  default     = -1
}

variable "xray_enabled" {
  description = "Enable X-Ray tracing"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

locals {
  function_full_name = "${var.app_name}-${var.function_name}-${var.environment}"

  default_tags = {
    Application = var.app_name
    Function    = var.function_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  tags = merge(local.default_tags, var.tags)
}

# IAM Role
resource "aws_iam_role" "lambda" {
  name = "${local.function_full_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = local.tags
}

# Basic execution policy (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# VPC execution policy (conditional)
resource "aws_iam_role_policy_attachment" "vpc_execution" {
  count      = var.vpc_enabled ? 1 : 0
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# X-Ray policy (conditional)
resource "aws_iam_role_policy_attachment" "xray" {
  count      = var.xray_enabled ? 1 : 0
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.function_full_name}"
  retention_in_days = var.environment == "production" ? 90 : 30

  tags = local.tags
}

# Lambda Function
resource "aws_lambda_function" "main" {
  function_name = local.function_full_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${var.ecr_repository_url}:${var.image_tag}"

  memory_size = var.memory_size
  timeout     = var.timeout

  reserved_concurrent_executions = var.reserved_concurrency >= 0 ? var.reserved_concurrency : null

  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }

  dynamic "vpc_config" {
    for_each = var.vpc_enabled ? [1] : []
    content {
      subnet_ids         = var.subnet_ids
      security_group_ids = var.security_group_ids
    }
  }

  dynamic "tracing_config" {
    for_each = var.xray_enabled ? [1] : []
    content {
      mode = "Active"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_iam_role_policy_attachment.basic_execution,
  ]

  tags = local.tags
}

# Outputs
output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.main.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.main.arn
}

output "invoke_arn" {
  description = "Lambda invoke ARN (for API Gateway)"
  value       = aws_lambda_function.main.invoke_arn
}

output "role_arn" {
  description = "Lambda IAM role ARN"
  value       = aws_iam_role.lambda.arn
}

output "role_name" {
  description = "Lambda IAM role name"
  value       = aws_iam_role.lambda.name
}

output "log_group_name" {
  description = "CloudWatch Log Group name"
  value       = aws_cloudwatch_log_group.lambda.name
}
