---
name: databricks-aws
description: >
  Databricks workspace and Unity Catalog setup on AWS with Terraform. Use when provisioning
  Databricks workspaces, configuring Unity Catalog metastores, setting up storage credentials
  and external locations, managing access control with grants, defining cluster policies,
  or creating Databricks job workflows. Covers service principal authentication,
  multi-workspace governance, and Terraform module patterns for Databricks on AWS.
effort: low
paths:
  - "terraform/**"
  - "databricks/**"
  - "*.tf"
---

# Databricks on AWS

Terraform patterns for Databricks workspace provisioning and Unity Catalog governance.

## Quick Start

### 1. Provider Configuration

```hcl
# Account-level provider (for Unity Catalog, workspaces)
provider "databricks" {
  alias      = "account"
  host       = "https://accounts.cloud.databricks.com"
  account_id = var.databricks_account_id

  # Prefer OIDC or OAuth over PATs
  client_id     = var.databricks_client_id
  client_secret = var.databricks_client_secret
}

# Workspace-level provider
provider "databricks" {
  alias = "workspace"
  host  = databricks_mws_workspaces.main.workspace_url

  client_id     = var.databricks_client_id
  client_secret = var.databricks_client_secret
}
```

### 2. Create Unity Catalog Metastore

One metastore per region, shared across workspaces. Requires S3 bucket, IAM role with Databricks trust policy, and metastore assignment.

See `${CLAUDE_SKILL_DIR}/references/unity-catalog-setup.md` for full Terraform (S3 bucket, IAM role/policy, metastore resource, workspace assignment).

### 3. Create Storage Credential

```hcl
resource "databricks_storage_credential" "external" {
  provider = databricks.workspace
  name     = "external-data-credential"

  aws_iam_role {
    role_arn = aws_iam_role.external_data.arn
  }

  comment = "Credential for external data locations"
}

# Grant usage to data team
resource "databricks_grants" "storage_credential" {
  provider           = databricks.workspace
  storage_credential = databricks_storage_credential.external.id

  grant {
    principal  = "data-engineers"
    privileges = ["CREATE_EXTERNAL_LOCATION"]
  }
}
```

### 4. Create External Location

```hcl
resource "databricks_external_location" "data_lake" {
  provider        = databricks.workspace
  name            = "data-lake"
  url             = "s3://${aws_s3_bucket.data_lake.id}/"
  credential_name = databricks_storage_credential.external.name

  comment = "Main data lake storage"
}

resource "databricks_grants" "external_location" {
  provider          = databricks.workspace
  external_location = databricks_external_location.data_lake.id

  grant {
    principal  = "data-engineers"
    privileges = ["CREATE_EXTERNAL_TABLE", "READ_FILES", "WRITE_FILES"]
  }
}
```

## Unity Catalog Hierarchy

```
Metastore (one per region)
├── Catalog (logical database)
│   ├── Schema (namespace)
│   │   ├── Table
│   │   ├── View
│   │   └── Function
│   └── Schema
└── External Location (S3 paths)
```

### Create Catalog and Schema

```hcl
resource "databricks_catalog" "analytics" {
  provider = databricks.workspace
  name     = "analytics"
  comment  = "Analytics catalog for BI and reporting"

  properties = {
    purpose = "analytics"
  }
}

resource "databricks_schema" "gold" {
  provider     = databricks.workspace
  catalog_name = databricks_catalog.analytics.name
  name         = "gold"
  comment      = "Curated datasets for consumption"
}

# Grants at catalog level
resource "databricks_grants" "catalog" {
  provider = databricks.workspace
  catalog  = databricks_catalog.analytics.name

  grant {
    principal  = "data-analysts"
    privileges = ["USE_CATALOG", "USE_SCHEMA", "SELECT"]
  }

  grant {
    principal  = "data-engineers"
    privileges = ["USE_CATALOG", "USE_SCHEMA", "SELECT", "MODIFY", "CREATE_TABLE"]
  }
}
```

## Access Control

### Identity Management

```hcl
# Sync IdP group to Databricks account
resource "databricks_group" "data_engineers" {
  provider     = databricks.account
  display_name = "data-engineers"
}

# Add users to group
resource "databricks_group_member" "engineers" {
  provider  = databricks.account
  for_each  = toset(var.data_engineer_emails)
  group_id  = databricks_group.data_engineers.id
  member_id = databricks_user.engineers[each.key].id
}

# Assign group to workspace
resource "databricks_mws_permission_assignment" "data_engineers" {
  provider     = databricks.account
  workspace_id = databricks_mws_workspaces.main.workspace_id
  principal_id = databricks_group.data_engineers.id
  permissions  = ["USER"]
}
```

### Service Principal for Jobs

Account-level service principals with OAuth secrets for automated workloads.

See `${CLAUDE_SKILL_DIR}/references/service-principal-automation.md` for full setup (create SP, generate secret, assign to workspace, grant catalog access).

## Clusters

### Cluster Policy (Cost Control)

```hcl
resource "databricks_cluster_policy" "cost_controlled" {
  provider = databricks.workspace
  name     = "Cost-Controlled Policy"

  definition = jsonencode({
    "spark_version" : {
      "type" : "regex",
      "pattern" : "13\\.[0-9]+\\.x-scala.*"
    },
    "node_type_id" : {
      "type" : "allowlist",
      "values" : ["m5.xlarge", "m5.2xlarge", "m6i.xlarge", "m6i.2xlarge"]
    },
    "autotermination_minutes" : {
      "type" : "range",
      "minValue" : 10,
      "maxValue" : 60,
      "defaultValue" : 20
    },
    "custom_tags.Team" : {
      "type" : "fixed",
      "value" : "data-platform"
    },
    "aws_attributes.availability" : {
      "type" : "fixed",
      "value" : "SPOT_WITH_FALLBACK"
    }
  })
}

# Grant policy to group
resource "databricks_permissions" "cluster_policy" {
  provider          = databricks.workspace
  cluster_policy_id = databricks_cluster_policy.cost_controlled.id

  access_control {
    group_name       = "data-engineers"
    permission_level = "CAN_USE"
  }
}
```

### Instance Pool

Pre-warmed instance pools for faster cluster startup (~30s vs 3-5 min).

See `${CLAUDE_SKILL_DIR}/references/cluster-configuration.md` -- Instance Pools section.

## Jobs & Workflows

Multi-task job definitions, DAG dependencies, scheduling, and notifications.

See `${CLAUDE_SKILL_DIR}/references/job-workflow-templates.md` for full Terraform examples.

## Templates

| Template | Purpose |
|----------|---------|
| `${CLAUDE_SKILL_DIR}/templates/unity-catalog-setup.tf` | Complete UC bootstrap |
| `${CLAUDE_SKILL_DIR}/templates/storage-credential.tf` | S3 credential with IAM |
| `${CLAUDE_SKILL_DIR}/templates/cluster-policy.tf` | Cost-controlled policy |
| `${CLAUDE_SKILL_DIR}/templates/job-workflow.tf` | Multi-task job example |

## References

- `${CLAUDE_SKILL_DIR}/references/unity-catalog-best-practices.md` - Identity, metastore, grants
- `${CLAUDE_SKILL_DIR}/references/unity-catalog-setup.md` - Full metastore bootstrap Terraform
- `${CLAUDE_SKILL_DIR}/references/cluster-configuration.md` - Cluster sizing, pools, and policies
- `${CLAUDE_SKILL_DIR}/references/service-principal-automation.md` - SP creation, OAuth, workspace assignment
- `${CLAUDE_SKILL_DIR}/references/job-workflow-templates.md` - Multi-task jobs, scheduling, notifications

## Key Patterns

1. **One metastore per region** - Share across workspaces
2. **Account-level identity** - Manage users/groups at account, not workspace
3. **Service principals for jobs** - Never use user tokens for automation
4. **OAuth over PATs** - More secure, rotatable credentials
5. **Grants over ACLs** - Use Unity Catalog grants for data access
6. **Cluster policies** - Enforce cost controls at policy level
