# Review Feedback Patterns

Guidelines for providing effective, constructive code review feedback.

## Review Metrics & Warning Signs

### Target Metrics

| Metric | Target | Purpose |
|--------|--------|---------|
| **Review Time** | < 24 hours | Fast feedback cycle |
| **PR Size** | < 400 lines | Manageable review size |
| **Comments per PR** | 3-10 | Engaged, thorough review |
| **Approval Rate (first)** | 20-40% | Balance quality/speed |

### Warning Signs

- PRs unreviewed > 3 days (bottleneck)
- 90%+ first-review approval (rubber-stamping)
- Average PR > 800 lines (too large, request split)
- Zero comments on complex PR (superficial review)
- Security issues in PRs (need more training)

## Good Feedback Example

```
issue [blocking]: Missing tenant isolation filter

Line 78: session.query(Activity).all()

**Problem**: This returns ALL activities across all users, causing a cross-tenant data breach.

**Fix**:
```python
session.query(Activity).filter_by(user_id=user_id).all()
```

**Test**:
```python
def test_tenant_isolation():
    activity_a = create_activity(user_id="A")
    response = client.get("/activities", headers=auth_for_user_b())
    assert activity_a.id not in [a["id"] for a in response.json()]
```
```

**Why it's good:**
- Specific location (line 78)
- Explains impact (cross-tenant breach)
- Provides fix with code
- Includes test to prevent regression

## Bad Feedback Example

```
This is wrong. Fix it.
```

**Why it's bad:**
- Not specific (what's wrong? where?)
- Not helpful (how to fix?)
- Harsh tone (not constructive)

## Feedback Principles

### Be Specific
- Point to exact lines (file:line format)
- Explain *why* changes are needed
- Suggest concrete improvements with code examples

### Be Kind
- Review code, not the person
- Assume positive intent
- Praise good solutions

### Be Actionable
- Provide code snippets for fixes
- Include test examples when relevant
- Distinguish must-fix from nice-to-have

## Comment Templates

### Security Issue
```
security [blocking]: [Brief description]

Line [X]: [Code snippet]

**Problem**: [What's wrong and why it matters]

**Fix**:
```[language]
[Fixed code]
```

**Test**:
```[language]
[Test to verify fix]
```
```

### Sensitive Data Exposure
```
security [blocking]: Sensitive data [type] being [action]

Line [X]: [Code snippet]

Sensitive data must not be [action]. Use [alternative] instead:
```[language]
[Fixed code]
```
```

### Suggestion (Non-blocking)
```
suggestion [non-blocking]: Consider [improvement]

This pattern [appears/repeats] in [context]. Could be:
```[language]
[Improved code]
```
```

### Praise
```
praise: [What's good about it]

[Brief explanation of why this approach is good]
```
