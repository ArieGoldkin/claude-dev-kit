# Commit Message Reasoning - Detailed Examples

Examples of well-structured commit messages with reasoning context.

## Feature

```
feat: Add user progress tracking chart

WHY: Users requested visibility into their journey progress
DECISION: Chart.js for visualization (team familiarity)
ALTERNATIVES: Recharts (rejected: larger bundle), D3 (rejected: complexity)
```

## Bug Fix

```
fix: Prevent duplicate activity submissions

WHY: Users clicking submit button multiple times created duplicate records
DECISION: Disable button on submit + add optimistic UI
ALTERNATIVES: Debounce (rejected: poor UX), server-side dedup (rejected: complexity)
```

## Security Fix

```
fix(security): Add tenant isolation to activity queries

WHY: Queries were returning cross-tenant data (security vulnerability)
DECISION: Add tenant_id filter to all Activity queries
ALTERNATIVES: None - this was a critical security fix
```

**Note:** This reasoning is preserved in `shared-context.json` under `agent_decisions` for long-term reference.
