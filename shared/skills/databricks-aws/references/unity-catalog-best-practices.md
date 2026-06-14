# Unity Catalog Best Practices

## Table of Contents

- [Metastore Strategy](#metastore-strategy)
  - [One Metastore Per Region](#one-metastore-per-region)
  - [Metastore Isolation](#metastore-isolation)
- [Identity Management](#identity-management)
  - [Account-Level Identity](#account-level-identity)
  - [IdP Integration](#idp-integration)
  - [Service Principals](#service-principals)
- [Catalog Organization](#catalog-organization)
  - [By Domain](#by-domain)
  - [By Environment (Less Common)](#by-environment-less-common)
- [Grants Strategy](#grants-strategy)
  - [Principle of Least Privilege](#principle-of-least-privilege)
  - [Privilege Hierarchy](#privilege-hierarchy)
  - [Deny Patterns](#deny-patterns)
- [Storage Credentials](#storage-credentials)
  - [Separate Credentials by Use Case](#separate-credentials-by-use-case)
  - [External Location Granularity](#external-location-granularity)
- [Data Lineage](#data-lineage)
  - [Enable Lineage Tracking](#enable-lineage-tracking)
  - [Best Practices](#best-practices)
- [Monitoring](#monitoring)
  - [System Tables (Preview)](#system-tables-preview)
  - [Information Schema](#information-schema)
- [Migration Checklist](#migration-checklist)

Governance patterns for Databricks Unity Catalog on AWS.

## Metastore Strategy

### One Metastore Per Region

Unity Catalog requires exactly one metastore per region. This metastore is shared across all workspaces in that region.

```
Region: us-east-1
├── Metastore: company-metastore-us-east-1
│   ├── Workspace: analytics-prod
│   ├── Workspace: analytics-dev
│   └── Workspace: ml-platform
```

**Why?**
- Cross-workspace data sharing
- Consistent governance
- Single source of truth for data assets

### Metastore Isolation

For strict isolation (e.g., compliance requirements), create separate metastores:

```
├── Metastore: prod-us-east-1 (Production data)
│   └── Workspace: prod-analytics
└── Metastore: dev-us-east-1 (Development/test data)
    └── Workspace: dev-analytics
```

## Identity Management

### Account-Level Identity

**Always provision identity at account level**, not workspace level:

```hcl
# CORRECT: Account-level group
resource "databricks_group" "data_engineers" {
  provider     = databricks.account
  display_name = "data-engineers"
}

# INCORRECT: Workspace-level group (avoid)
# resource "databricks_group" "data_engineers" {
#   provider     = databricks.workspace
#   display_name = "data-engineers"
# }
```

### IdP Integration

Sync groups from your identity provider (Okta, Azure AD, etc.):

1. Configure SCIM provisioning at account level
2. Groups sync automatically to all workspaces
3. Use synced groups for grants

### Service Principals

Use service principals for all automation:

```hcl
# Create at account level
resource "databricks_service_principal" "etl" {
  provider     = databricks.account
  display_name = "etl-automation"
}

# Generate OAuth credentials (preferred over PAT)
resource "databricks_service_principal_secret" "etl" {
  provider             = databricks.account
  service_principal_id = databricks_service_principal.etl.id
}
```

**Never use:**
- User tokens for scheduled jobs
- Shared credentials across teams
- Long-lived PATs for automation

## Catalog Organization

### By Domain

```
analytics (catalog)
├── raw (schema) - Landing zone
├── silver (schema) - Cleaned/conformed
├── gold (schema) - Business aggregates
└── reporting (schema) - BI-ready views

ml (catalog)
├── features (schema)
├── models (schema)
└── experiments (schema)
```

### By Environment (Less Common)

```
prod (catalog)
├── sales
└── marketing

dev (catalog)
├── sales
└── marketing
```

**Prefer domain-based** - Environment isolation through workspace separation.

## Grants Strategy

### Principle of Least Privilege

```hcl
# Analysts: Read-only access to gold layer
resource "databricks_grants" "analysts_gold" {
  schema = "${databricks_catalog.analytics.name}.gold"

  grant {
    principal  = "data-analysts"
    privileges = ["USE_SCHEMA", "SELECT"]
  }
}

# Engineers: Full access to silver/gold
resource "databricks_grants" "engineers_silver" {
  schema = "${databricks_catalog.analytics.name}.silver"

  grant {
    principal  = "data-engineers"
    privileges = ["USE_SCHEMA", "SELECT", "MODIFY", "CREATE_TABLE"]
  }
}
```

### Privilege Hierarchy

```
CATALOG
├── USE_CATALOG (required to see catalog)
├── CREATE_SCHEMA
└── [inheritable to schemas]
    SCHEMA
    ├── USE_SCHEMA (required to see schema)
    ├── CREATE_TABLE
    ├── CREATE_VIEW
    ├── CREATE_FUNCTION
    └── [inheritable to objects]
        TABLE/VIEW
        ├── SELECT
        ├── MODIFY (INSERT, UPDATE, DELETE)
        └── REFRESH (for materialized views)
```

### Deny Patterns

Use deny grants sparingly - prefer not granting:

```hcl
# Only use deny when explicitly blocking inherited permissions
resource "databricks_grants" "deny_pii" {
  table = "${databricks_catalog.analytics.name}.gold.customers_pii"

  grant {
    principal  = "data-analysts"
    privileges = []  # Empty = no grants (preferred over DENY)
  }
}
```

## Storage Credentials

### Separate Credentials by Use Case

```hcl
# Credential for raw data ingestion
resource "databricks_storage_credential" "raw_data" {
  name = "raw-data-ingest"
  aws_iam_role { role_arn = aws_iam_role.raw_data.arn }
}

# Credential for curated data
resource "databricks_storage_credential" "curated" {
  name = "curated-data"
  aws_iam_role { role_arn = aws_iam_role.curated.arn }
}
```

### External Location Granularity

```
storage-credential: raw-data-ingest
├── external-location: raw-landing (s3://data-lake/raw/)
└── external-location: raw-archive (s3://data-lake/archive/)

storage-credential: curated-data
├── external-location: silver (s3://data-lake/silver/)
└── external-location: gold (s3://data-lake/gold/)
```

## Data Lineage

### Enable Lineage Tracking

Unity Catalog automatically tracks lineage when:
- Using Delta tables
- Running in Databricks notebooks/jobs
- Using supported languages (SQL, Python, Scala)

### Best Practices

1. **Use Delta tables** - Full lineage support
2. **Avoid external writes** - Writes outside Databricks break lineage
3. **Name jobs meaningfully** - Job names appear in lineage
4. **Use Unity Catalog tables** - Not external tables

## Monitoring

### System Tables (Preview)

Query usage and audit logs:

```sql
-- Table access audit
SELECT
  event_time,
  user_identity.email,
  request_params.full_name_arg as table_name,
  action_name
FROM system.access.audit
WHERE action_name IN ('getTable', 'createTable')
  AND event_date >= current_date - 7;

-- Storage usage
SELECT
  catalog_name,
  schema_name,
  table_name,
  total_size_bytes / 1024 / 1024 / 1024 as size_gb
FROM system.storage.tables
ORDER BY total_size_bytes DESC
LIMIT 20;
```

### Information Schema

```sql
-- List all tables with grants
SELECT
  t.table_catalog,
  t.table_schema,
  t.table_name,
  p.grantee,
  p.privilege_type
FROM information_schema.tables t
JOIN information_schema.table_privileges p
  ON t.table_catalog = p.table_catalog
  AND t.table_schema = p.table_schema
  AND t.table_name = p.table_name
WHERE t.table_catalog = 'analytics';
```

## Migration Checklist

When migrating to Unity Catalog:

1. [ ] Create metastore with S3 storage
2. [ ] Configure IAM role with trust policy
3. [ ] Assign metastore to workspaces
4. [ ] Sync IdP groups via SCIM
5. [ ] Create catalogs and schemas
6. [ ] Migrate tables (use SYNC command)
7. [ ] Configure grants
8. [ ] Update jobs to use service principals
9. [ ] Test lineage tracking
10. [ ] Enable system tables for monitoring
