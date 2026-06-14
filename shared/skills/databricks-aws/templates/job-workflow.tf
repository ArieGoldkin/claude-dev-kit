# Multi-Task Job Workflow
# ETL pipeline with task dependencies

terraform {
  required_providers {
    databricks = {
      source  = "databricks/databricks"
      version = "~> 1.50"
    }
  }
}

# Variables
variable "job_name" {
  description = "Name of the job"
  type        = string
  default     = "etl-pipeline"
}

variable "notebook_base_path" {
  description = "Base path for notebooks in workspace"
  type        = string
  default     = "/Repos/main/etl"
}

variable "spark_version" {
  description = "Spark runtime version"
  type        = string
  default     = "13.3.x-scala2.12"
}

variable "node_type_id" {
  description = "Instance type for job clusters"
  type        = string
  default     = "m6i.xlarge"
}

variable "schedule_cron" {
  description = "Cron expression for job schedule (empty to disable)"
  type        = string
  default     = "0 0 6 * * ?"  # 6 AM daily
}

variable "timezone" {
  description = "Timezone for schedule"
  type        = string
  default     = "America/New_York"
}

variable "alert_emails" {
  description = "Email addresses for job alerts"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags for the job"
  type        = map(string)
  default = {
    pipeline = "etl"
    team     = "data"
  }
}

# Job definition
resource "databricks_job" "etl_pipeline" {
  name = var.job_name

  # Job cluster definition (shared across tasks)
  job_cluster {
    job_cluster_key = "etl_cluster"
    new_cluster {
      num_workers   = 4
      spark_version = var.spark_version
      node_type_id  = var.node_type_id

      aws_attributes {
        availability           = "SPOT_WITH_FALLBACK"
        spot_bid_price_percent = 100
        first_on_demand        = 1  # 1 on-demand for driver stability
      }

      custom_tags = merge(var.tags, {
        JobName = var.job_name
      })
    }
  }

  # Smaller cluster for lightweight tasks
  job_cluster {
    job_cluster_key = "light_cluster"
    new_cluster {
      num_workers   = 1
      spark_version = var.spark_version
      node_type_id  = "m5.large"

      aws_attributes {
        availability = "SPOT"
      }
    }
  }

  # Task 1: Extract data from sources
  task {
    task_key = "extract_raw"

    notebook_task {
      notebook_path = "${var.notebook_base_path}/01_extract"
      base_parameters = {
        source_date = "{{job.start_time.iso_date}}"
      }
    }

    job_cluster_key = "etl_cluster"

    # Retry on failure
    retry_on_timeout = true
    max_retries      = 2
    min_retry_interval_millis = 60000  # 1 minute
  }

  # Task 2: Validate extracted data
  task {
    task_key = "validate_raw"

    depends_on {
      task_key = "extract_raw"
    }

    notebook_task {
      notebook_path = "${var.notebook_base_path}/02_validate"
    }

    job_cluster_key = "light_cluster"
  }

  # Task 3: Transform - Bronze to Silver
  task {
    task_key = "transform_silver"

    depends_on {
      task_key = "validate_raw"
    }

    notebook_task {
      notebook_path = "${var.notebook_base_path}/03_transform_silver"
    }

    job_cluster_key = "etl_cluster"
  }

  # Task 4: Transform - Silver to Gold
  task {
    task_key = "transform_gold"

    depends_on {
      task_key = "transform_silver"
    }

    notebook_task {
      notebook_path = "${var.notebook_base_path}/04_transform_gold"
    }

    job_cluster_key = "etl_cluster"
  }

  # Task 5: Run data quality checks
  task {
    task_key = "quality_checks"

    depends_on {
      task_key = "transform_gold"
    }

    notebook_task {
      notebook_path = "${var.notebook_base_path}/05_quality_checks"
    }

    job_cluster_key = "light_cluster"
  }

  # Task 6: Update downstream tables (can run in parallel with quality_checks)
  task {
    task_key = "update_downstream"

    depends_on {
      task_key = "transform_gold"
    }

    notebook_task {
      notebook_path = "${var.notebook_base_path}/06_update_downstream"
    }

    job_cluster_key = "light_cluster"
  }

  # Task 7: Send completion notification
  task {
    task_key = "notify_completion"

    depends_on {
      task_key = "quality_checks"
    }
    depends_on {
      task_key = "update_downstream"
    }

    notebook_task {
      notebook_path = "${var.notebook_base_path}/07_notify"
      base_parameters = {
        status = "success"
      }
    }

    job_cluster_key = "light_cluster"
  }

  # Schedule (optional)
  dynamic "schedule" {
    for_each = var.schedule_cron != "" ? [1] : []
    content {
      quartz_cron_expression = var.schedule_cron
      timezone_id            = var.timezone
      pause_status           = "UNPAUSED"
    }
  }

  # Email notifications
  dynamic "email_notifications" {
    for_each = length(var.alert_emails) > 0 ? [1] : []
    content {
      on_failure = var.alert_emails
      on_success = []  # Don't spam on success
    }
  }

  # Job-level settings
  max_concurrent_runs = 1
  timeout_seconds     = 7200  # 2 hour timeout

  tags = var.tags
}

# Grant job permissions
resource "databricks_permissions" "job" {
  job_id = databricks_job.etl_pipeline.id

  access_control {
    group_name       = "data-engineers"
    permission_level = "CAN_MANAGE_RUN"
  }

  access_control {
    group_name       = "data-analysts"
    permission_level = "CAN_VIEW"
  }
}

# Outputs
output "job_id" {
  description = "ID of the job"
  value       = databricks_job.etl_pipeline.id
}

output "job_url" {
  description = "URL to the job in Databricks UI"
  value       = databricks_job.etl_pipeline.url
}
