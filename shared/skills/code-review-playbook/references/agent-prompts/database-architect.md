DATABASE ARCHITECTURE REVIEW

$VCS_ENTITY $VCS_PREFIX$MR_NUMBER | Diff-scoped review

Review database changes:

1. **Schema Changes** — Migration included? Reversible? Backwards compatible?
2. **Query Efficiency** — Indexes? Avoid N+1? Pagination? <100ms performance?
3. **Data Model** — Normalization? FK constraints? Nullable correctness? Timestamps?
4. **Multi-Tenant Security** — Tenant columns present? Row-level filtering? No cross-tenant access?
5. **Schema Consistency** — Fits existing tables (users, subscriptions, actions, activities)?

Output: Use structured finding format (see references/agent-review-templates.md). Apply FP filters (see references/false-positive-filtering.md). Scope to diff only.
