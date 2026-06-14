# Cluster Configuration Guide

## Table of Contents

- [Cluster Types](#cluster-types)
  - [All-Purpose Clusters](#all-purpose-clusters)
  - [Job Clusters](#job-clusters)
  - [SQL Warehouses](#sql-warehouses)
- [Sizing Guidelines](#sizing-guidelines)
  - [Memory-Optimized (r5, r6i)](#memory-optimized-r5-r6i)
  - [Compute-Optimized (c5, c6i)](#compute-optimized-c5-c6i)
  - [General Purpose (m5, m6i)](#general-purpose-m5-m6i)
- [Autoscaling Configuration](#autoscaling-configuration)
  - [Interactive Clusters](#interactive-clusters)
  - [Job Clusters](#job-clusters-1)
- [Spot Instance Strategy](#spot-instance-strategy)
  - [SPOT_WITH_FALLBACK (Recommended)](#spot_with_fallback-recommended)
  - [Pure Spot (Batch Jobs)](#pure-spot-batch-jobs)
  - [On-Demand (Critical Jobs)](#on-demand-critical-jobs)
- [Instance Pools](#instance-pools)
  - [Workspace-Scoped Pool with Tags](#workspace-scoped-pool-with-tags)
- [Cluster Policies](#cluster-policies)
  - [Development Policy](#development-policy)
  - [Production Policy](#production-policy)
- [Spark Configuration](#spark-configuration)
  - [Memory Tuning](#memory-tuning)
  - [Delta Lake Optimization](#delta-lake-optimization)
- [Cost Optimization](#cost-optimization)
  - [Quick Wins](#quick-wins)
  - [Cost Monitoring](#cost-monitoring)
- [Troubleshooting](#troubleshooting)
  - [Slow Cluster Startup](#slow-cluster-startup)
  - [Out of Memory](#out-of-memory)
  - [Spot Interruptions](#spot-interruptions)

Sizing, policies, and best practices for Databricks clusters on AWS.

## Cluster Types

### All-Purpose Clusters

Interactive development and exploration:
- Manual or auto-scaling
- Persists between sessions
- Higher cost (no job discounts)

**Use for:** Notebooks, ad-hoc queries, development

### Job Clusters

Ephemeral clusters for automated workloads:
- Created at job start, terminated at end
- Automatic scaling
- Lower cost (job compute pricing)

**Use for:** Scheduled jobs, production ETL

### SQL Warehouses

Optimized for BI and SQL workloads:
- Serverless or classic
- Instant startup
- Photon acceleration

**Use for:** BI tools, dashboards, SQL analytics

## Sizing Guidelines

### Memory-Optimized (r5, r6i)

Best for:
- Large shuffles
- Caching datasets
- Memory-intensive UDFs

```
r5.xlarge:  4 vCPU, 32 GB RAM
r5.2xlarge: 8 vCPU, 64 GB RAM
r6i.xlarge: 4 vCPU, 32 GB RAM
```

### Compute-Optimized (c5, c6i)

Best for:
- CPU-intensive transformations
- ML training
- Compression-heavy workloads

```
c5.xlarge:  4 vCPU, 8 GB RAM
c5.2xlarge: 8 vCPU, 16 GB RAM
c6i.xlarge: 4 vCPU, 8 GB RAM
```

### General Purpose (m5, m6i)

Best for:
- Balanced workloads
- Unknown requirements
- Mixed operations

```
m5.xlarge:  4 vCPU, 16 GB RAM
m5.2xlarge: 8 vCPU, 32 GB RAM
m6i.xlarge: 4 vCPU, 16 GB RAM
```

## Autoscaling Configuration

### Interactive Clusters

```hcl
new_cluster {
  autoscale {
    min_workers = 1
    max_workers = 8
  }
  spark_version = "13.3.x-scala2.12"
  node_type_id  = "m6i.xlarge"

  # Aggressive scale-down for cost
  spark_conf = {
    "spark.databricks.cluster.scaling.autoScaleDownThreshold" = "0.3"
  }
}
```

### Job Clusters

```hcl
new_cluster {
  autoscale {
    min_workers = 2
    max_workers = 20
  }

  # Job clusters should scale up quickly
  spark_conf = {
    "spark.databricks.cluster.scaling.autoScaleUpThreshold" = "0.7"
  }
}
```

## Spot Instance Strategy

### SPOT_WITH_FALLBACK (Recommended)

```hcl
aws_attributes {
  availability           = "SPOT_WITH_FALLBACK"
  spot_bid_price_percent = 100
  first_on_demand        = 1  # Driver on-demand for stability
  zone_id                = "auto"
}
```

### Pure Spot (Batch Jobs)

```hcl
aws_attributes {
  availability           = "SPOT"
  spot_bid_price_percent = 100
  zone_id                = "auto"
}
```

### On-Demand (Critical Jobs)

```hcl
aws_attributes {
  availability = "ON_DEMAND"
}
```

## Instance Pools

Pre-warm instances for faster cluster startup:

```hcl
resource "databricks_instance_pool" "main" {
  instance_pool_name = "main-pool"
  min_idle_instances = 2
  max_capacity       = 50
  node_type_id       = "m6i.xlarge"

  idle_instance_autotermination_minutes = 10

  aws_attributes {
    availability           = "SPOT_WITH_FALLBACK"
    spot_bid_price_percent = 100
  }

  # Pre-load runtime for faster startup
  preloaded_spark_versions = ["13.3.x-scala2.12"]
}

# Use pool in cluster
resource "databricks_cluster" "fast_start" {
  instance_pool_id = databricks_instance_pool.main.id
  # ...
}
```

**Benefits:**
- Cluster startup in ~30 seconds (vs 3-5 minutes)
- Spot instances already acquired
- Runtime pre-loaded

### Workspace-Scoped Pool with Tags

When managing pools through Terraform with an explicit workspace provider:

```hcl
resource "databricks_instance_pool" "main" {
  provider                  = databricks.workspace
  instance_pool_name        = "main-pool"
  min_idle_instances        = 2
  max_capacity              = 20
  node_type_id              = "m6i.xlarge"
  idle_instance_autotermination_minutes = 10

  aws_attributes {
    availability           = "SPOT_WITH_FALLBACK"
    spot_bid_price_percent = 100
  }

  preloaded_spark_versions = ["13.3.x-scala2.12"]

  custom_tags = {
    Pool = "main"
  }
}
```

## Cluster Policies

### Development Policy

```json
{
  "spark_version": {
    "type": "fixed",
    "value": "13.3.x-scala2.12"
  },
  "node_type_id": {
    "type": "allowlist",
    "values": ["m5.large", "m5.xlarge"]
  },
  "num_workers": {
    "type": "range",
    "minValue": 1,
    "maxValue": 4
  },
  "autotermination_minutes": {
    "type": "range",
    "minValue": 10,
    "maxValue": 30,
    "defaultValue": 15
  },
  "aws_attributes.availability": {
    "type": "fixed",
    "value": "SPOT"
  }
}
```

### Production Policy

```json
{
  "spark_version": {
    "type": "regex",
    "pattern": "13\\.[0-9]+\\.x-scala.*"
  },
  "node_type_id": {
    "type": "allowlist",
    "values": ["m6i.xlarge", "m6i.2xlarge", "r6i.xlarge", "r6i.2xlarge"]
  },
  "autoscale.min_workers": {
    "type": "range",
    "minValue": 2,
    "maxValue": 10
  },
  "autoscale.max_workers": {
    "type": "range",
    "minValue": 4,
    "maxValue": 50
  },
  "aws_attributes.availability": {
    "type": "fixed",
    "value": "SPOT_WITH_FALLBACK"
  },
  "aws_attributes.first_on_demand": {
    "type": "fixed",
    "value": 1
  }
}
```

## Spark Configuration

### Memory Tuning

```hcl
spark_conf = {
  # Increase shuffle partitions for large data
  "spark.sql.shuffle.partitions" = "200"

  # Enable adaptive query execution
  "spark.sql.adaptive.enabled" = "true"
  "spark.sql.adaptive.coalescePartitions.enabled" = "true"

  # Memory fraction tuning
  "spark.memory.fraction" = "0.8"
  "spark.memory.storageFraction" = "0.3"
}
```

### Delta Lake Optimization

```hcl
spark_conf = {
  # Auto-optimize writes
  "spark.databricks.delta.optimizeWrite.enabled" = "true"
  "spark.databricks.delta.autoCompact.enabled" = "true"

  # Caching
  "spark.databricks.io.cache.enabled" = "true"
}
```

## Cost Optimization

### Quick Wins

1. **Auto-termination** - Never disable; set to 10-30 min
2. **Spot instances** - Use SPOT_WITH_FALLBACK always
3. **Right-size workers** - Start small, scale up
4. **Instance pools** - Reduce startup time and costs
5. **Job clusters** - Use for production workloads

### Cost Monitoring

```sql
-- Query cluster usage (requires admin)
SELECT
  cluster_name,
  SUM(dbu_count) as total_dbus,
  SUM(dbu_count * dbu_rate) as estimated_cost
FROM system.billing.usage
WHERE usage_date >= current_date - 30
GROUP BY cluster_name
ORDER BY total_dbus DESC;
```

## Troubleshooting

### Slow Cluster Startup

- Use instance pools
- Pre-load Spark version
- Check Spot capacity in zone

### Out of Memory

- Increase worker memory (r5/r6i types)
- Add more workers
- Tune spark.memory.fraction
- Check for data skew

### Spot Interruptions

- Switch to SPOT_WITH_FALLBACK
- Use first_on_demand = 1
- Diversify availability zones
