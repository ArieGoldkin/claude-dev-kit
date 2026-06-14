SECURITY REVIEW

$VCS_ENTITY $VCS_PREFIX$MR_NUMBER | Diff-scoped review

CRITICAL SECURITY CHECKS:

1. **Secrets & Credentials**
   - No hardcoded API keys, passwords, tokens
   - Environment variables used correctly

2. **Input Validation**
   - All user inputs validated (schema/model validation)
   - SQL injection prevention (parameterized queries via ORM)
   - XSS prevention (React auto-escapes, check dangerouslySetInnerHTML)

3. **Authentication & Authorization**
   - API authorizers/middleware in place
   - Handlers check permissions
   - Users can only access their own data

4. **Tenant Isolation (CRITICAL)**
   - All queries filter by tenant ID or user ID
   - No cross-tenant data leakage
   - Tests verify isolation

5. **Sensitive Data Handling**
   - Sensitive data not logged to console/monitoring unnecessarily
   - Sensitive data encrypted in transit and at rest

Output: Use structured finding format (see references/agent-review-templates.md). Apply FP filters (see references/false-positive-filtering.md). Scope to diff only.
