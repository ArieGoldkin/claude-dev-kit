# Quality Standards & Best Practices

Quality standards and common pitfalls for evidence verification.

## Quality Standards

### Minimum Acceptable

- **Tests executed** with captured exit code
- **Timestamp** recorded
- **Evidence stored** in context

### Production-Grade

- **Tests pass** (exit code 0)
- **Coverage >= 70%** (or project standard)
- **Build succeeds** (exit code 0)
- **No critical linter errors**
- **Type checker passes**
- **Security scan** shows no critical issues

### Gold Standard

- All production-grade requirements
- **Coverage >= 80%**
- **No linter warnings**
- **Performance benchmarks** within thresholds
- **Accessibility audit** passes (WCAG 2.1 AA)
- **Integration tests** pass
- **Deployment verification** complete

---

## Common Pitfalls

### Don't Skip Evidence Collection

**Bad:**
```
"I've implemented the login feature. It should work correctly."
```

**Good:**
```
"I've implemented the login feature. Evidence:
- Tests: Exit code 0, 12 tests passed, 0 failed
- Build: Exit code 0, no errors
- Coverage: 89%
Task complete with verification."
```

### Don't Fake Evidence

**Bad:**
```
"Tests passed" (without actually running them)
```

**Good:**
```bash
# Actually run the tests
npm test
# Then report actual results
"Tests executed: Exit code 0, 45 passed, 0 failed"
```

### Don't Ignore Test Failures

**Bad:**
```
"Tests mostly passed, 2 failures but they're probably flaky"
```

**Good:**
```
"2 test failures detected:
- test_login_timeout: Expected timeout not hit
- test_session_expiry: Mock not configured

Investigating root cause before marking complete."
```

### Don't Skip Build Verification

**Bad:**
```
"Code looks correct, marking complete"
```

**Good:**
```
"Build verification:
- npm run build: Exit code 0
- Bundle size: 234 KB (within limits)
- No TypeScript errors
Marking complete with build evidence."
```

---

## When Evidence Fails

### Test Failures

1. **Investigate the failure** - Read test output
2. **Fix the underlying issue** - Don't just skip the test
3. **Re-run verification** - Confirm fix works
4. **Document the fix** - Note what was wrong

### Build Failures

1. **Read build errors carefully**
2. **Check recent changes** - What might have broken?
3. **Fix compilation issues**
4. **Verify dependencies** - Are all required packages installed?

### Linter/Type Errors

1. **Fix critical errors first**
2. **Document any intentional suppressions**
3. **Re-run after fixes**
4. **Note remaining warnings**

---

## Evidence Requirements by Task Type

| Task Type | Required Evidence |
|-----------|-------------------|
| Bug Fix | Tests pass, regression test added |
| New Feature | Tests pass, new tests added, build succeeds |
| Refactor | Tests pass, no behavior change, build succeeds |
| Config Change | Build succeeds, deployment verified |
| Documentation | N/A (review-based) |
