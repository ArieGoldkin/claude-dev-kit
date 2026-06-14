# AWS IAM Role for GitLab CI OIDC Authentication
# This role allows GitLab CI pipelines to authenticate without static credentials

variable "gitlab_url" {
  description = "GitLab instance URL"
  type        = string
  default     = "https://gitlab.com"
}

variable "gitlab_project_path" {
  description = "GitLab project path (e.g., myorg/myrepo)"
  type        = string
}

variable "allowed_branches" {
  description = "Branches allowed to assume the role"
  type        = list(string)
  default     = ["main", "master"]
}

variable "allowed_environments" {
  description = "GitLab environments allowed to assume the role"
  type        = list(string)
  default     = ["production", "staging", "dev"]
}

# OIDC Provider for GitLab (create once per AWS account)
resource "aws_iam_openid_connect_provider" "gitlab" {
  url = var.gitlab_url

  client_id_list = [
    var.gitlab_url,
  ]

  # GitLab's OIDC thumbprint
  thumbprint_list = [
    "b3dd7606d2b5a8b4a13771dbecc9ee1cecafa38a"
  ]

  tags = {
    Name        = "gitlab-oidc"
    ManagedBy   = "terraform"
    Description = "GitLab CI OIDC provider"
  }
}

# IAM Role for Terraform operations
resource "aws_iam_role" "gitlab_terraform" {
  name = "gitlab-terraform-${replace(var.gitlab_project_path, "/", "-")}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.gitlab.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(var.gitlab_url, "https://", "")}:aud" = var.gitlab_url
          }
          StringLike = {
            # Allow specific project path
            "${replace(var.gitlab_url, "https://", "")}:sub" = "project_path:${var.gitlab_project_path}:*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "gitlab-terraform"
    ManagedBy   = "terraform"
    GitLabProject = var.gitlab_project_path
  }
}

# Policy for Terraform operations
# Adjust permissions based on what Terraform needs to manage
resource "aws_iam_role_policy" "terraform_permissions" {
  name = "terraform-permissions"
  role = aws_iam_role.gitlab_terraform.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EC2FullAccess"
        Effect = "Allow"
        Action = [
          "ec2:*",
        ]
        Resource = "*"
      },
      {
        Sid    = "RDSFullAccess"
        Effect = "Allow"
        Action = [
          "rds:*",
        ]
        Resource = "*"
      },
      {
        Sid    = "LambdaFullAccess"
        Effect = "Allow"
        Action = [
          "lambda:*",
        ]
        Resource = "*"
      },
      {
        Sid    = "IAMPassRole"
        Effect = "Allow"
        Action = [
          "iam:PassRole",
          "iam:GetRole",
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
        ]
        Resource = "*"
      },
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:*",
        ]
        Resource = "*"
      },
      {
        Sid    = "SecretsManagerRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        Resource = "*"
      }
    ]
  })
}

output "role_arn" {
  description = "ARN of the IAM role for GitLab CI"
  value       = aws_iam_role.gitlab_terraform.arn
}

output "oidc_provider_arn" {
  description = "ARN of the GitLab OIDC provider"
  value       = aws_iam_openid_connect_provider.gitlab.arn
}
