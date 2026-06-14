TEST COVERAGE REVIEW

$VCS_ENTITY $VCS_PREFIX$MR_NUMBER | Diff-scoped review

Review test quality:

1. **New Code Coverage**
   - Are new functions tested?
   - Are edge cases covered?
   - Are error paths tested?

2. **Test Quality**
   - Test naming (describe what's being tested)
   - AAA pattern (Arrange, Act, Assert)
   - Mock usage (appropriate vs excessive)
   - No flaky tests (time-dependent, race conditions)

3. **Domain-Specific Security Tests**
   - Tenant isolation tests (negative tests)
   - Sensitive data access tests (audit logging triggered)
   - Permission boundary tests (401/403 responses)

Output: Use structured finding format (see references/agent-review-templates.md). Apply FP filters (see references/false-positive-filtering.md). Scope to diff only.
