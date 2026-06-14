# Cost Allocation Tags Enforcement
# Implements tag policy for AWS Organizations and Terraform defaults

# Required tags definition
locals {
  required_tags = {
    Environment = {
      description    = "Deployment environment"
      allowed_values = ["dev", "staging", "prod"]
    }
    Team = {
      description    = "Owning team for chargeback"
      allowed_values = ["platform", "data", "ml", "devops"]
    }
    CostCenter = {
      description = "Finance cost center code"
      pattern     = "CC-\\d{4}"
    }
    Project = {
      description = "Project or initiative name"
      pattern     = ".+"
    }
  }

  # Services to enforce tags on
  enforced_services = [
    "ec2:instance",
    "ec2:volume",
    "rds:db",
    "rds:cluster",
    "lambda:function",
    "ecs:service",
    "ecs:task-definition",
    "s3:bucket",
    "elasticache:cluster",
    "opensearch:domain"
  ]
}

# Tag Policy for AWS Organizations
resource "aws_organizations_policy" "tag_policy" {
  name        = "required-cost-allocation-tags"
  description = "Enforces required tags for cost allocation"
  type        = "TAG_POLICY"

  content = jsonencode({
    tags = {
      Environment = {
        tag_key = {
          "@@assign" = "Environment"
        }
        tag_value = {
          "@@assign" = local.required_tags.Environment.allowed_values
        }
        enforced_for = {
          "@@assign" = local.enforced_services
        }
      }
      Team = {
        tag_key = {
          "@@assign" = "Team"
        }
        tag_value = {
          "@@assign" = local.required_tags.Team.allowed_values
        }
        enforced_for = {
          "@@assign" = local.enforced_services
        }
      }
      CostCenter = {
        tag_key = {
          "@@assign" = "CostCenter"
        }
        enforced_for = {
          "@@assign" = local.enforced_services
        }
      }
      Project = {
        tag_key = {
          "@@assign" = "Project"
        }
        enforced_for = {
          "@@assign" = local.enforced_services
        }
      }
    }
  })
}

# Attach policy to organizational units
resource "aws_organizations_policy_attachment" "tag_policy" {
  for_each = toset(var.organizational_unit_ids)

  policy_id = aws_organizations_policy.tag_policy.id
  target_id = each.value
}

# SCP to deny untagged resource creation (optional, stricter enforcement)
resource "aws_organizations_policy" "require_tags_scp" {
  count       = var.enable_scp_enforcement ? 1 : 0
  name        = "require-cost-tags-scp"
  description = "Denies creation of resources without required tags"
  type        = "SERVICE_CONTROL_POLICY"

  content = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyEC2WithoutTags"
        Effect    = "Deny"
        Action    = ["ec2:RunInstances"]
        Resource  = ["arn:aws:ec2:*:*:instance/*"]
        Condition = {
          Null = {
            "aws:RequestTag/Environment" = "true"
            "aws:RequestTag/Team"        = "true"
            "aws:RequestTag/CostCenter"  = "true"
            "aws:RequestTag/Project"     = "true"
          }
        }
      },
      {
        Sid       = "DenyRDSWithoutTags"
        Effect    = "Deny"
        Action    = ["rds:CreateDBInstance", "rds:CreateDBCluster"]
        Resource  = "*"
        Condition = {
          Null = {
            "aws:RequestTag/Environment" = "true"
            "aws:RequestTag/Team"        = "true"
          }
        }
      }
    ]
  })
}

# Terraform provider default tags (add to your provider config)
# provider "aws" {
#   default_tags {
#     tags = {
#       Environment = var.environment
#       Team        = var.team
#       CostCenter  = var.cost_center
#       Project     = var.project
#       ManagedBy   = "terraform"
#     }
#   }
# }

# Variables
variable "organizational_unit_ids" {
  description = "List of OU IDs to attach tag policy"
  type        = list(string)
  default     = []
}

variable "enable_scp_enforcement" {
  description = "Enable SCP-based tag enforcement (stricter)"
  type        = bool
  default     = false
}

# Outputs
output "tag_policy_id" {
  description = "ID of the tag policy"
  value       = aws_organizations_policy.tag_policy.id
}

output "required_tags" {
  description = "Map of required tags and their constraints"
  value       = local.required_tags
}
