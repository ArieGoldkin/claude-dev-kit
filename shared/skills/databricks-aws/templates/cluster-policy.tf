# Cluster Policy for Cost Control
# Enforces instance types, auto-termination, and tagging

terraform {
  required_providers {
    databricks = {
      source  = "databricks/databricks"
      version = "~> 1.50"
    }
  }
}

# Variables
variable "policy_name" {
  description = "Name of the cluster policy"
  type        = string
  default     = "cost-controlled-policy"
}

variable "allowed_node_types" {
  description = "List of allowed instance types"
  type        = list(string)
  default = [
    "m5.large",
    "m5.xlarge",
    "m5.2xlarge",
    "m6i.large",
    "m6i.xlarge",
    "m6i.2xlarge",
    "r5.large",
    "r5.xlarge"
  ]
}

variable "max_autotermination_minutes" {
  description = "Maximum auto-termination time in minutes"
  type        = number
  default     = 60
}

variable "default_autotermination_minutes" {
  description = "Default auto-termination time in minutes"
  type        = number
  default     = 20
}

variable "team_tag" {
  description = "Team tag value for cost allocation"
  type        = string
}

variable "user_groups" {
  description = "List of groups that can use this policy"
  type        = list(string)
  default     = []
}

# Cluster policy
resource "databricks_cluster_policy" "cost_controlled" {
  name = var.policy_name

  definition = jsonencode({
    # Spark version constraints
    "spark_version" : {
      "type" : "regex",
      "pattern" : "1[3-9]\\.[0-9]+\\.x-scala.*",
      "defaultValue" : "13.3.x-scala2.12"
    },

    # Node type restrictions
    "node_type_id" : {
      "type" : "allowlist",
      "values" : var.allowed_node_types,
      "defaultValue" : var.allowed_node_types[0]
    },
    "driver_node_type_id" : {
      "type" : "allowlist",
      "values" : var.allowed_node_types
    },

    # Worker count limits
    "num_workers" : {
      "type" : "range",
      "minValue" : 1,
      "maxValue" : 20,
      "defaultValue" : 2
    },
    "autoscale.min_workers" : {
      "type" : "range",
      "minValue" : 1,
      "maxValue" : 5,
      "defaultValue" : 1
    },
    "autoscale.max_workers" : {
      "type" : "range",
      "minValue" : 2,
      "maxValue" : 20,
      "defaultValue" : 4
    },

    # Auto-termination (required)
    "autotermination_minutes" : {
      "type" : "range",
      "minValue" : 10,
      "maxValue" : var.max_autotermination_minutes,
      "defaultValue" : var.default_autotermination_minutes
    },

    # Force Spot instances with fallback
    "aws_attributes.availability" : {
      "type" : "fixed",
      "value" : "SPOT_WITH_FALLBACK"
    },
    "aws_attributes.spot_bid_price_percent" : {
      "type" : "fixed",
      "value" : 100
    },

    # Required tags for cost allocation
    "custom_tags.Team" : {
      "type" : "fixed",
      "value" : var.team_tag
    },
    "custom_tags.ManagedBy" : {
      "type" : "fixed",
      "value" : "policy"
    },

    # Disable local disk encryption (use EBS encryption instead)
    "enable_local_disk_encryption" : {
      "type" : "fixed",
      "value" : false
    },

    # EBS configuration
    "aws_attributes.ebs_volume_type" : {
      "type" : "fixed",
      "value" : "GENERAL_PURPOSE_SSD"
    },
    "aws_attributes.ebs_volume_count" : {
      "type" : "range",
      "minValue" : 0,
      "maxValue" : 4,
      "defaultValue" : 1
    },
    "aws_attributes.ebs_volume_size" : {
      "type" : "range",
      "minValue" : 100,
      "maxValue" : 500,
      "defaultValue" : 100
    }
  })
}

# Grant policy usage to groups
resource "databricks_permissions" "policy" {
  cluster_policy_id = databricks_cluster_policy.cost_controlled.id

  dynamic "access_control" {
    for_each = var.user_groups
    content {
      group_name       = access_control.value
      permission_level = "CAN_USE"
    }
  }
}

# Outputs
output "policy_id" {
  description = "ID of the cluster policy"
  value       = databricks_cluster_policy.cost_controlled.id
}

output "policy_name" {
  description = "Name of the cluster policy"
  value       = databricks_cluster_policy.cost_controlled.name
}

# Example: More restrictive policy for development
resource "databricks_cluster_policy" "dev_restricted" {
  name = "${var.policy_name}-dev"

  definition = jsonencode({
    "spark_version" : {
      "type" : "fixed",
      "value" : "13.3.x-scala2.12"
    },
    "node_type_id" : {
      "type" : "fixed",
      "value" : "m5.large"
    },
    "num_workers" : {
      "type" : "fixed",
      "value" : 1
    },
    "autotermination_minutes" : {
      "type" : "fixed",
      "value" : 15
    },
    "aws_attributes.availability" : {
      "type" : "fixed",
      "value" : "SPOT"
    },
    "custom_tags.Environment" : {
      "type" : "fixed",
      "value" : "development"
    }
  })
}
