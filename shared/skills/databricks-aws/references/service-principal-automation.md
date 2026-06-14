# Service Principal Automation

Terraform patterns for creating and configuring Databricks service principals for automated workloads.

## Create Service Principal

Service principals should always be created at the **account level**, not workspace level:

```hcl
resource "databricks_service_principal" "etl" {
  provider     = databricks.account
  display_name = "etl-service-principal"
}
```

## Generate OAuth Secret

Prefer OAuth secrets over Personal Access Tokens (PATs) for automation:

```hcl
resource "databricks_service_principal_secret" "etl" {
  provider             = databricks.account
  service_principal_id = databricks_service_principal.etl.id
}
```

## Assign to Workspace

```hcl
resource "databricks_mws_permission_assignment" "etl_sp" {
  provider     = databricks.account
  workspace_id = databricks_mws_workspaces.main.workspace_id
  principal_id = databricks_service_principal.etl.id
  permissions  = ["USER"]
}
```

## Grant Catalog Access

```hcl
resource "databricks_grants" "etl_catalog" {
  provider = databricks.workspace
  catalog  = databricks_catalog.analytics.name

  grant {
    principal  = databricks_service_principal.etl.application_id
    privileges = ["USE_CATALOG", "USE_SCHEMA", "SELECT", "MODIFY"]
  }
}
```

## Best Practices

- **Account-level creation** -- Manage SPs at account level for cross-workspace reuse
- **OAuth over PATs** -- OAuth secrets are more secure and support rotation
- **Least privilege** -- Grant only the catalog/schema privileges the SP needs
- **Never use user tokens** for scheduled jobs or CI/CD pipelines
- **Separate SPs per concern** -- Use distinct service principals for ETL, ML, reporting, etc.
- **Store secrets securely** -- Write OAuth credentials to a secrets manager (e.g., AWS Secrets Manager), not Terraform state

## Using SP Credentials in Jobs

After creating the service principal and assigning it to a workspace, reference it as the job owner:

```hcl
resource "databricks_job" "etl_pipeline" {
  provider = databricks.workspace
  name     = "daily-etl-pipeline"

  # Run as the service principal
  run_as {
    service_principal_name = databricks_service_principal.etl.application_id
  }

  # ... task configuration ...
}
```
