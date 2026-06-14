# Review Process - Detailed Analysis Steps

Deep-dive review guidance for the detailed review phase (step 3 of the review process).

## 3. Detailed Review (20-45 min)

### Code Quality

- Readability: Clear variable/function names, focused functions (< 50 lines)
- DRY: No unnecessary duplication
- Error handling: Appropriate try/catch, specific exceptions
- Comments: Only where logic isn't self-evident

### Functionality

- Correct behavior for happy path
- Edge cases handled (null, empty, min/max values)
- Input validation and sanitization

### Testing

- New code has tests
- Edge cases covered
- Error paths tested
- **Security:** Tenant isolation tests, sensitive data access tests

### Security & Compliance

- No secrets in code
- Auth/authorization checks
- SQL injection / XSS prevented
- **Tenant isolation enforced** (all queries filtered by tenant/user ID)
- **Sensitive data not logged** (no emails, names, PII in logs)
- **Migration included** if database schema changed

## 4. Submit Review (2-5 min)

### Decision

- **Approve**: All checks passed, no blocking issues
- **Comment**: Feedback provided, no blocking issues
- **Request Changes**: Blocking issues must be fixed

### Use gh CLI (optional)

```bash
gh pr review <PR_NUMBER> --approve -b "Approved! [feedback]"
gh pr review <PR_NUMBER> --comment -b "Comments: [feedback]"
gh pr review <PR_NUMBER> --request-changes -b "Changes needed: [feedback]"
```
