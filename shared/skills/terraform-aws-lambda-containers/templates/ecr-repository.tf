# ECR Repository Module with Lifecycle Policies
# Usage:
#   module "ecr" {
#     source = "./modules/ecr-repository"
#     app_name = "myapp"
#     function_name = "api-handler"
#   }

variable "app_name" {
  description = "Application name"
  type        = string
}

variable "function_name" {
  description = "Function/service name"
  type        = string
}

variable "max_images" {
  description = "Maximum number of images to retain"
  type        = number
  default     = 10
}

variable "scan_on_push" {
  description = "Enable vulnerability scanning on push"
  type        = bool
  default     = true
}

variable "immutable_tags" {
  description = "Enable immutable tags (recommended for production)"
  type        = bool
  default     = false
}

variable "encryption_type" {
  description = "Encryption type (AES256 or KMS)"
  type        = string
  default     = "AES256"
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption (required if encryption_type is KMS)"
  type        = string
  default     = null
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

locals {
  repository_name = "${var.app_name}-${var.function_name}"

  default_tags = {
    Application = var.app_name
    Service     = var.function_name
    ManagedBy   = "terraform"
  }

  tags = merge(local.default_tags, var.tags)
}

# ECR Repository
resource "aws_ecr_repository" "main" {
  name                 = local.repository_name
  image_tag_mutability = var.immutable_tags ? "IMMUTABLE" : "MUTABLE"

  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  encryption_configuration {
    encryption_type = var.encryption_type
    kms_key         = var.encryption_type == "KMS" ? var.kms_key_arn : null
  }

  tags = local.tags
}

# Lifecycle Policy
resource "aws_ecr_lifecycle_policy" "main" {
  repository = aws_ecr_repository.main.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.max_images} images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.max_images
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Repository Policy (optional - for cross-account access)
# Uncomment and customize if needed
# resource "aws_ecr_repository_policy" "main" {
#   repository = aws_ecr_repository.main.name
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Sid    = "AllowPull"
#         Effect = "Allow"
#         Principal = {
#           AWS = "arn:aws:iam::OTHER_ACCOUNT_ID:root"
#         }
#         Action = [
#           "ecr:GetDownloadUrlForLayer",
#           "ecr:BatchGetImage",
#           "ecr:BatchCheckLayerAvailability"
#         ]
#       }
#     ]
#   })
# }

# Outputs
output "repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.main.repository_url
}

output "repository_arn" {
  description = "ECR repository ARN"
  value       = aws_ecr_repository.main.arn
}

output "repository_name" {
  description = "ECR repository name"
  value       = aws_ecr_repository.main.name
}

output "registry_id" {
  description = "ECR registry ID"
  value       = aws_ecr_repository.main.registry_id
}
