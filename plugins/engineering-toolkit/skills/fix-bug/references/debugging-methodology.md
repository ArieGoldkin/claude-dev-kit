# Debugging Methodology Reference

Detailed reference for observation-driven debugging techniques. See the main SKILL.md for the core OHAOI loop.

## The Science of Debugging

Debugging is empirical investigation. The same principles that make scientific experiments reliable make debugging effective: observe carefully, form testable hypotheses, control variables, and record results.

### Why Guessing Fails

When developers skip straight to "trying fixes," they encounter several problems:

1. **Shotgun debugging**: Making multiple changes at once, then not knowing which one (if any) fixed the issue
2. **Cargo-cult fixes**: Copying solutions from Stack Overflow that address symptoms rather than causes
3. **Whack-a-mole**: Fixing one symptom while the root cause creates new symptoms elsewhere
4. **Confirmation bias**: Seeing evidence for your assumed cause while ignoring contradicting evidence

The OHAOI loop prevents these by requiring explicit hypothesis formation and validation.

---

## Advanced Observation Techniques

### Reading Stack Traces Effectively

1. **Start from the bottom**: The root cause is usually at the bottom of the stack trace (the first call)
2. **Find your code**: Skip framework/library frames and focus on frames in your codebase
3. **Check the boundary**: The bug is often at the boundary between your code and a library call
4. **Note the exception type**: The exception class itself narrows the hypothesis space significantly

### Log Analysis Patterns

When reviewing logs for debugging:

- **Correlation ID tracing**: Follow a request through its entire lifecycle using a trace/correlation ID
- **Timeline reconstruction**: Sort events chronologically to understand the sequence of operations
- **Diff against healthy**: Compare logs from a failing request with logs from a succeeding one
- **Volume anomalies**: Look for sudden spikes or drops in log frequency that correlate with the bug

### Reproduction Strategies

If you cannot reproduce the issue:

1. **Match the environment**: Same OS, same dependencies, same configuration
2. **Match the data**: Use the same (or equivalent) input data
3. **Match the timing**: Concurrent requests, load patterns, timeout values
4. **Match the state**: Database state, cache contents, session state
5. **Simplify progressively**: Start with the full reproduction case and remove variables until you find the minimal reproduction

---

## Hypothesis Formulation Strategies

### The Five Whys

When a hypothesis is confirmed, ask "why?" to go deeper:

```
Bug: User gets 500 error on checkout
Why? -> The payment service throws NullPointerException
Why? -> The card token is null when passed to the charge function
Why? -> The token extraction from the form response returns null
Why? -> The form response format changed in the latest SDK update
Why? -> We upgraded the payment SDK without checking for breaking changes

Root cause: Payment SDK upgrade introduced a breaking change in form response format
```

### Differential Diagnosis

Borrowed from medicine -- list all possible causes, then systematically rule them out:

```markdown
## Differential Diagnosis

| Possible Cause | Evidence For | Evidence Against | Status |
|---------------|-------------|-----------------|--------|
| Database timeout | Slow queries in logs | Error is not timeout-related | Ruled out |
| Missing validation | No input checks found | Error occurs with valid input too | Partially ruled out |
| Race condition | Intermittent failures | Fails under single-user load | Under investigation |
| Config mismatch | Recent deploy changed config | Config values look correct | Ruled out |
```

### Binary Search Debugging

When you cannot narrow down the location of the bug:

1. **git bisect**: Find the exact commit that introduced the regression
   ```bash
   git bisect start
   git bisect bad          # current commit is broken
   git bisect good v1.2.0  # this tag was working
   # git bisect will checkout commits for you to test
   ```

2. **Code path bisection**: Add a log/breakpoint at the midpoint of the suspected code path, then narrow to the half where behavior diverges from expectation

3. **Input bisection**: If a specific input triggers the bug, reduce the input by half repeatedly until you find the minimal triggering input

---

## Common Bug Categories and Investigation Approaches

### Off-by-One Errors
**Signals**: Wrong count, missing first/last element, array index out of bounds
**Investigation**: Check loop boundaries, array indexing (0-based vs 1-based), range endpoints (inclusive vs exclusive)

### Race Conditions
**Signals**: Intermittent failures, works in debugger but fails normally, timing-dependent
**Investigation**: Add logging with timestamps, look for shared mutable state, check for missing locks/synchronization, test under concurrent load

### Null/Undefined References
**Signals**: NullPointerException, "cannot read property of undefined", TypeError
**Investigation**: Trace the variable backward from the error to find where it should have been set, check all code paths (especially error paths) that reach this point

### State Corruption
**Signals**: Incorrect values that are not obviously wrong, cascading errors, inconsistent data
**Investigation**: Add assertions at state boundaries, log state transitions, check for unintended mutation (especially in shared/global state)

### Configuration Errors
**Signals**: Works in one environment but not another, fails after deployment
**Investigation**: Compare configurations between working and broken environments, check for environment-specific overrides, verify secrets/credentials

### Dependency Issues
**Signals**: Fails after upgrade, works with pinned versions, import errors
**Investigation**: Check changelog/release notes for breaking changes, compare lock files, test with previous dependency versions

---

## Debugging Tool Reference

### General Purpose
- **Print/log debugging**: Add strategic log statements to trace execution flow and variable values
- **Interactive debugger**: Step through code, inspect variables, set conditional breakpoints
- **git bisect**: Binary search through commit history to find the introducing commit
- **git blame**: Identify who last changed specific lines and why

### Language-Specific
- **Python**: `pdb`/`ipdb`, `logging` module, `traceback.print_exc()`, `pytest --pdb`
- **JavaScript/TypeScript**: `debugger` statement, Chrome DevTools, `console.trace()`, Node.js `--inspect`
- **Java**: IDE debugger, `jstack` for thread dumps, `-verbose:gc` for GC issues

### System-Level
- **Network**: `curl -v`, browser Network tab, `tcpdump`, `wireshark`
- **Database**: Query logs, `EXPLAIN` plans, connection pool metrics
- **OS**: `strace`/`dtrace`, `top`/`htop`, disk and memory monitoring

---

## Documenting Your Investigation

A well-documented investigation helps future developers (including yourself) understand why a fix was chosen. Include in your MR description:

```markdown
## Investigation Log

### Observation
[What was observed -- error, behavior, conditions]

### Hypotheses Tested
1. **[Theory 1]**: [Tested by doing X] -> [Disproven because Y]
2. **[Theory 2]**: [Tested by doing X] -> [Confirmed: root cause identified]

### Root Cause
[Clear explanation of what was wrong and why]

### Fix Rationale
[Why this specific fix addresses the root cause, and why alternatives were not chosen]
```

This log is especially valuable for:
- Code reviewers understanding the fix
- Future developers encountering similar issues
- Post-incident reviews
- Building team knowledge of the system's failure modes
