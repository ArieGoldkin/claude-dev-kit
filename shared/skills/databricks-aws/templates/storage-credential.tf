# Storage Credential for External Data
# Creates IAM role and Databricks storage credential for S3 access

terraform {
  required_providers {
    databricks = {
      source  = "databricks/databricks"
      version = "~> 1.50"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "databricks_account_id" {
  description = "Databricks account ID"
  type        = string
  sensitive   = true
}

variable "external_bucket_arns" {
  description = "List of S3 bucket ARNs to grant access"
  type        = list(string)
}

variable "credential_name" {
  description = "Name for the storage credential"
  type        = string
  default     = "external-data"
}

# Locals
locals {
  role_name = "${var.prefix}-storage-credential-${var.credential_name}"

  # Build resource list for IAM policy
  bucket_resources = flatten([
    for arn in var.external_bucket_arns : [
      arn,
      "${arn}/*"
    ]
  ])
}

# Get current Unity Catalog metastore info
data "databricks_current_metastore" "this" {}

# IAM role for storage credential
resource "aws_iam_role" "storage_credential" {
  name = local.role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::414351767826:role/unity-catalog-prod-UCMasterRole-14S5ZJVKOTYTL"
        }
        Action = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            "sts:ExternalId" = var.databricks_account_id
          }
        }
      }
    ]
  })

  tags = {
    Name      = local.role_name
    Purpose   = "Storage Credential for ${var.credential_name}"
    ManagedBy = "terraform"
  }
}

resource "aws_iam_role_policy" "storage_credential" {
  name = "s3-access"
  role = aws_iam_role.storage_credential.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = local.bucket_resources
      }
    ]
  })
}

# Optional: KMS access if buckets use CMK encryption
resource "aws_iam_role_policy" "storage_credential_kms" {
  count = length(var.kms_key_arns) > 0 ? 1 : 0
  name  = "kms-access"
  role  = aws_iam_role.storage_credential.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "KMSAccess"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = var.kms_key_arns
      }
    ]
  })
}

variable "kms_key_arns" {
  description = "List of KMS key ARNs for encrypted buckets"
  type        = list(string)
  default     = []
}

# Create storage credential in Databricks
resource "databricks_storage_credential" "this" {
  name = var.credential_name

  aws_iam_role {
    role_arn = aws_iam_role.storage_credential.arn
  }

  comment = "Credential for accessing external data in ${join(", ", var.external_bucket_arns)}"

  # Wait for IAM role to be assumable
  depends_on = [aws_iam_role_policy.storage_credential]
}

# Outputs
output "credential_name" {
  description = "Name of the storage credential"
  value       = databricks_storage_credential.this.name
}

output "credential_id" {
  description = "ID of the storage credential"
  value       = databricks_storage_credential.this.id
}

output "iam_role_arn" {
  description = "ARN of the IAM role"
  value       = aws_iam_role.storage_credential.arn
}

# Example: Create external location using this credential
# resource "databricks_external_location" "data" {
#   name            = "my-data-location"
#   url             = "s3://my-bucket/data/"
#   credential_name = databricks_storage_credential.this.name
# }
