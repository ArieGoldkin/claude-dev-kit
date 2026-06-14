BACKEND ARCHITECTURE REVIEW

$VCS_ENTITY $VCS_PREFIX$MR_NUMBER | Diff-scoped review

Review backend changes for architectural patterns:

1. **Handler Structure**
   - Proper handler/controller signature
   - Observability tools used (logger, tracer, metrics)
   - Cold start optimization: database connections at module level (NEVER inside request handler)
   - Required decorators/middleware applied

2. **Database Queries (ORM)**
   - Efficient queries (avoid N+1)
   - Proper eager loading
   - Tenant filtering on all queries (WHERE tenant_id = ?)
   - Pagination for large result sets

3. **API Design**
   - REST conventions followed
   - Proper status codes (200, 201, 400, 401, 403, 404, 500)
   - Request/response models validated
   - API Gateway integration (if applicable)

4. **Error Handling**
   - Specific exceptions (not bare Exception)
   - Proper logging with context
   - Retry logic for transient failures

5. **Async Patterns**
   - Event-driven for async workflows
   - Message queues for queuing (if applicable)
   - Idempotency for retries

6. **Architectural Assessment** (for MRs touching >3 files)
   Score 5 dimensions (0-2 each, total /10):
   Scalability | Data Integrity | Security Posture | Operational Readiness | Coherence
   See references/architectural-review-dimensions.md for rubric.

Output: Use structured finding format (see references/agent-review-templates.md). Apply FP filters (see references/false-positive-filtering.md). Scope to diff only.
