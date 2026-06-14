# Tagging Standards
# Provides consistent tags for all resources
#
# Usage:
#   Copy this to your root module's locals.tf
#   Reference local.common_tags in all resources

variable "team_name" {
  description = "Team responsible for the resources"
  type        = string
  default     = "engineering"
}

variable "cost_center" {
  description = "Cost center for billing allocation"
  type        = string
  default     = ""
}

variable "project_code" {
  description = "Project code for tracking"
  type        = string
  default     = ""
}

locals {
  # ============================================================================
  # COMMON TAGS
  # Applied to all resources
  # ============================================================================

  common_tags = {
    Application = var.app_name
    Service     = var.service_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Team        = var.team_name
    CostCenter  = var.cost_center != "" ? var.cost_center : null
    ProjectCode = var.project_code != "" ? var.project_code : null
  }

  # ============================================================================
  # RESOURCE-SPECIFIC TAGS
  # Merge with common_tags for specific resource types
  # ============================================================================

  # Lambda function tags
  lambda_tags = merge(local.common_tags, {
    ResourceType = "lambda"
  })

  # Database tags
  database_tags = merge(local.common_tags, {
    ResourceType = "database"
    Backup       = var.environment == "production" ? "enabled" : "disabled"
  })

  # Storage tags
  storage_tags = merge(local.common_tags, {
    ResourceType = "storage"
  })

  # Network tags
  network_tags = merge(local.common_tags, {
    ResourceType = "network"
  })

  # ============================================================================
  # TAG HELPER
  # Create resource-specific tags with custom additions
  # ============================================================================

  # Usage: merge(local.common_tags, { CustomTag = "value" })
}
