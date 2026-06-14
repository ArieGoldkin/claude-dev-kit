# Unity Catalog Metastore Setup

## Table of Contents

- [Prerequisites](#prerequisites)
- [S3 Bucket for Metastore Storage](#s3-bucket-for-metastore-storage)
- [IAM Role and Policy](#iam-role-and-policy)
- [Create Metastore](#create-metastore)
- [Assign Metastore to Workspace](#assign-metastore-to-workspace)
- [Notes](#notes)

Full Terraform configuration for bootstrapping a Unity Catalog metastore on AWS.

## Prerequisites

- Databricks account-level provider configured
- AWS provider with permissions to create S3 buckets and IAM roles
- `var.prefix`, `var.region`, `var.databricks_account_id` defined

## S3 Bucket for Metastore Storage

```hcl
resource "aws_s3_bucket" "unity_catalog" {
  bucket = "${var.prefix}-unity-catalog-${var.region}"

  tags = {
    Purpose = "Unity Catalog Metastore"
  }
}

resource "aws_s3_bucket_versioning" "unity_catalog" {
  bucket = aws_s3_bucket.unity_catalog.id
  versioning_configuration {
    status = "Enabled"
  }
}
```

## IAM Role and Policy

The IAM role uses Databricks' master role as the trusted principal, with the account ID as an external ID condition.

```hcl
resource "aws_iam_role" "unity_catalog" {
  name = "${var.prefix}-unity-catalog-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
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
    }]
  })
}

resource "aws_iam_role_policy" "unity_catalog" {
  name = "unity-catalog-access"
  role = aws_iam_role.unity_catalog.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          aws_s3_bucket.unity_catalog.arn,
          "${aws_s3_bucket.unity_catalog.arn}/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["sts:AssumeRole"]
        Resource = "arn:aws:iam::*:role/${var.prefix}-unity-catalog-*"
      }
    ]
  })
}
```

## Create Metastore

One metastore per region, shared across workspaces:

```hcl
resource "databricks_metastore" "main" {
  provider      = databricks.account
  name          = "${var.prefix}-metastore-${var.region}"
  region        = var.region
  storage_root  = "s3://${aws_s3_bucket.unity_catalog.id}/metastore"
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}
```

## Assign Metastore to Workspace

```hcl
resource "databricks_metastore_assignment" "main" {
  provider     = databricks.account
  workspace_id = databricks_mws_workspaces.main.workspace_id
  metastore_id = databricks_metastore.main.id
}
```

## Notes

- **One metastore per region** -- all workspaces in a region share the same metastore
- Enable `prevent_destroy` to avoid accidental deletion
- The IAM trust policy references Databricks' master role ARN (this is a Databricks-managed constant)
- The `sts:AssumeRole` permission enables self-assume for storage credential delegation
