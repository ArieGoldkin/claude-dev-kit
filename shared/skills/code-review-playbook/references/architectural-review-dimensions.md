# Architectural Review Dimensions

5-dimension assessment for MRs touching >3 files. Used by Agent 5 (Backend Architect) to provide a structured architectural score.

## Scoring Rubric

Each dimension is scored 0-2. Total: /10.

### 1. Scalability (0-2)

| Score | Criteria |
|-------|----------|
| 0 | No scalability concerns; isolated feature, single handler, no new queries |
| 1 | Introduces queries without pagination, adds synchronous calls that could bottleneck, or creates new DB connections |
| 2 | N+1 queries, unbounded loops over DB results, missing connection pooling, or synchronous fan-out without queuing |

**SaaS examples**:
- 0: Adds a new field to the user profile response
- 1: New endpoint queries activities without limit/offset
- 2: Loop creating new DB connections per record in a batch handler

### 2. Data Integrity (0-2)

| Score | Criteria |
|-------|----------|
| 0 | No data model changes; existing constraints preserved |
| 1 | Schema change with migration, but missing rollback or partial constraint coverage |
| 2 | Schema change without migration, nullable FK without default, or direct column assignment bypassing business logic (e.g., state machine) |

**SaaS examples**:
- 0: Read-only endpoint, no model changes
- 1: Migration adds column but `downgrade()` is `pass`
- 2: Direct `entity.status = 'cancelled'` instead of using a state transition function

### 3. Security Posture (0-2)

| Score | Criteria |
|-------|----------|
| 0 | No auth/access changes; existing security patterns followed |
| 1 | New endpoint with auth but missing tenant filtering, or new query without tenant_id filter |
| 2 | Missing authorization entirely, cross-tenant data access possible, or sensitive data exposed in logs/errors |

**SaaS examples**:
- 0: Frontend component change, no API calls
- 1: New API endpoint filters by tenant_id but missing negative test
- 2: Query returns all users regardless of tenant assignment

### 4. Operational Readiness (0-2)

| Score | Criteria |
|-------|----------|
| 0 | No deployment concerns; standard handler/frontend change |
| 1 | New handler missing observability decorators, or new endpoint without monitoring alarms |
| 2 | Missing error handling for external calls, no retry/DLQ for async workflows, or DB connections inside request handler |

**SaaS examples**:
- 0: Bug fix with existing error handling
- 1: New queue handler without per-record error isolation
- 2: New handler missing logging/tracing decorators

### 5. Coherence (0-2)

| Score | Criteria |
|-------|----------|
| 0 | Change follows established patterns; consistent with surrounding code |
| 1 | Minor deviations (different naming convention, novel pattern in one place) |
| 2 | Introduces fundamentally different approach from existing codebase (new ORM, different state management, custom auth) |

**SaaS examples**:
- 0: New handler follows existing API handler pattern
- 1: Uses `raw SQL` in one query while rest of service uses ORM
- 2: Introduces Redux in a Zustand codebase, or adds a different web framework alongside the existing one

## Aggregate Score

| Total | Grade | Interpretation |
|-------|-------|---------------|
| 0-2 | Excellent | Clean architecture, no concerns |
| 3-4 | Good | Minor items, non-blocking |
| 5-6 | Fair | Notable gaps, address before merge |
| 7-8 | Concerning | Significant architectural issues |
| 9-10 | Critical | Fundamental problems, redesign needed |

## When to Apply

- Only for MRs touching **>3 files** (smaller changes rarely have architectural implications)
- Skip for documentation-only, test-only, or config-only changes
- Always include in **deep mode** reviews regardless of file count

## Output Format

```
## Architectural Assessment (X/10)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Scalability | X/2 | [brief note] |
| Data Integrity | X/2 | [brief note] |
| Security Posture | X/2 | [brief note] |
| Operational Readiness | X/2 | [brief note] |
| Coherence | X/2 | [brief note] |
| **Total** | **X/10** | **[grade]** |
```
