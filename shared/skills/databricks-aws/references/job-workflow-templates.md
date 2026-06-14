# Jobs & Workflow Templates

## Table of Contents

- [Multi-Task Job](#multi-task-job)
- [Key Concepts](#key-concepts)
  - [Job Clusters vs All-Purpose Clusters](#job-clusters-vs-all-purpose-clusters)
  - [Task Dependencies](#task-dependencies)
  - [Schedule Patterns](#schedule-patterns)
  - [Email Notifications](#email-notifications)
- [Best Practices](#best-practices)

Terraform patterns for Databricks job workflows on AWS.

## Multi-Task Job

A complete ETL pipeline with extract, transform, and load stages running on a shared job cluster:

```hcl
resource "databricks_job" "etl_pipeline" {
  provider = databricks.workspace
  name     = "daily-etl-pipeline"

  job_cluster {
    job_cluster_key = "etl_cluster"
    new_cluster {
      num_workers   = 4
      spark_version = "13.3.x-scala2.12"
      node_type_id  = "m6i.xlarge"

      aws_attributes {
        availability = "SPOT_WITH_FALLBACK"
      }
    }
  }

  task {
    task_key = "extract"
    notebook_task {
      notebook_path = "/Repos/etl/extract"
    }
    job_cluster_key = "etl_cluster"
  }

  task {
    task_key = "transform"
    depends_on {
      task_key = "extract"
    }
    notebook_task {
      notebook_path = "/Repos/etl/transform"
    }
    job_cluster_key = "etl_cluster"
  }

  task {
    task_key = "load"
    depends_on {
      task_key = "transform"
    }
    notebook_task {
      notebook_path = "/Repos/etl/load"
    }
    job_cluster_key = "etl_cluster"
  }

  schedule {
    quartz_cron_expression = "0 0 6 * * ?"  # 6 AM daily
    timezone_id            = "America/New_York"
  }

  email_notifications {
    on_failure = ["data-alerts@example.com"]
  }

  tags = {
    pipeline = "etl"
    team     = "data"
  }
}
```

## Key Concepts

### Job Clusters vs All-Purpose Clusters

- **Job clusters** are created at job start and terminated at completion -- lower cost
- **All-purpose clusters** persist between runs -- use only for development
- Use `job_cluster` blocks to share a cluster across tasks within a job

### Task Dependencies

Tasks within a job can form a DAG using `depends_on`:

```
extract --> transform --> load
                     \--> validate
```

```hcl
task {
  task_key = "validate"
  depends_on {
    task_key = "transform"
  }
  # ...
}
```

### Schedule Patterns

```hcl
# Every 6 hours
schedule {
  quartz_cron_expression = "0 0 */6 * * ?"
  timezone_id            = "America/New_York"
}

# Weekdays at 8 AM
schedule {
  quartz_cron_expression = "0 0 8 ? * MON-FRI"
  timezone_id            = "America/New_York"
}

# First day of month at midnight
schedule {
  quartz_cron_expression = "0 0 0 1 * ?"
  timezone_id            = "America/New_York"
}
```

### Email Notifications

```hcl
email_notifications {
  on_start   = ["team@example.com"]
  on_success = ["team@example.com"]
  on_failure = ["alerts@example.com"]
}
```

## Best Practices

1. **Use job clusters** for production -- cheaper and isolated
2. **Use service principals** as job owners -- not user accounts
3. **Tag all jobs** with team and pipeline metadata for cost tracking
4. **Set email alerts** on failure at minimum
5. **Use SPOT_WITH_FALLBACK** for job cluster AWS availability
6. **Pin Spark versions** in production jobs to avoid surprise upgrades
