# Unity Catalog Bootstrap
# Complete setup for Unity Catalog metastore on AWS

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
  default     = "analytics"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "databricks_account_id" {
  description = "Databricks account ID"
  type        = string
  sensitive   = true
}

variable "workspace_id" {
  description = "Databricks workspace ID to assign metastore"
  type        = string
}

# Locals
locals {
  metastore_name = "${var.prefix}-metastore-${var.region}"
  bucket_name    = "${var.prefix}-unity-catalog-${var.region}"
  role_name      = "${var.prefix}-unity-catalog-role"
}

# S3 bucket for metastore storage
resource "aws_s3_bucket" "unity_catalog" {
  bucket = local.bucket_name

  tags = {
    Name      = local.bucket_name
    Purpose   = "Unity Catalog Metastore"
    ManagedBy = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "unity_catalog" {
  bucket = aws_s3_bucket.unity_catalog.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "unity_catalog" {
  bucket = aws_s3_bucket.unity_catalog.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "unity_catalog" {
  bucket = aws_s3_bucket.unity_catalog.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM role for Unity Catalog access
resource "aws_iam_role" "unity_catalog" {
  name = local.role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          # Databricks Unity Catalog AWS account
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
    Purpose   = "Unity Catalog"
    ManagedBy = "terraform"
  }
}

resource "aws_iam_role_policy" "unity_catalog_s3" {
  name = "unity-catalog-s3-access"
  role = aws_iam_role.unity_catalog.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3BucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:GetLifecycleConfiguration",
          "s3:PutLifecycleConfiguration"
        ]
        Resource = [
          aws_s3_bucket.unity_catalog.arn,
          "${aws_s3_bucket.unity_catalog.arn}/*"
        ]
      },
      {
        Sid      = "AssumeExternalRoles"
        Effect   = "Allow"
        Action   = "sts:AssumeRole"
        Resource = "arn:aws:iam::*:role/${var.prefix}-unity-catalog-*"
      }
    ]
  })
}

# Create Unity Catalog metastore
resource "databricks_metastore" "main" {
  name          = local.metastore_name
  region        = var.region
  storage_root  = "s3://${aws_s3_bucket.unity_catalog.id}/metastore"
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

# Configure metastore with IAM role
resource "databricks_metastore_data_access" "main" {
  metastore_id = databricks_metastore.main.id
  name         = "default-data-access"
  is_default   = true

  aws_iam_role {
    role_arn = aws_iam_role.unity_catalog.arn
  }
}

# Assign metastore to workspace
resource "databricks_metastore_assignment" "main" {
  workspace_id = var.workspace_id
  metastore_id = databricks_metastore.main.id
}

# Outputs
output "metastore_id" {
  description = "Unity Catalog metastore ID"
  value       = databricks_metastore.main.id
}

output "metastore_name" {
  description = "Unity Catalog metastore name"
  value       = databricks_metastore.main.name
}

output "storage_bucket" {
  description = "S3 bucket for metastore storage"
  value       = aws_s3_bucket.unity_catalog.id
}

output "iam_role_arn" {
  description = "IAM role ARN for Unity Catalog"
  value       = aws_iam_role.unity_catalog.arn
}
