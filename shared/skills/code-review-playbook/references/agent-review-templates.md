# Agent Review Templates

Shared templates and rules for all review agents. Reference this file instead of inlining format rules in each agent prompt.

## Conventional Comment Format

```
<label> [decorations]: <subject>

<one or two sentences of context — what / where / why>

<concrete fix — code snippet or specific instruction>

_Reviewed with Claude Code._
```

**Labels**: praise, nitpick, suggestion, issue, question, security, bug, breaking
**Decorations**: [blocking], [non-blocking], [if-minor]
**Merge-blocking labels**: security, bug, breaking, issue [blocking]

### Length Budget: 2–4 lines per finding body

Comment bodies (excluding the structured-finding header fields) must fit in 2–4 lines. If a finding needs more, the finding probably wants to be **split** (two distinct concerns) or **bundled** (N occurrences of the same root cause — collapse to one consolidated comment with a file:line list in the body, see review-mr.md Phase 6a). A reviewer who has to scroll through a 12-line comment loses signal.

### Mandatory Footer

Every posted finding (top-level note OR inline comment) ends with `_Reviewed with Claude Code._` on its own line, italicized. This lets the author distinguish agent comments from human-reviewer comments at a glance — important when human reviewers respond to agent comments and threads start to interleave.

## Structured Finding Format

Every finding MUST include these fields:

```
- **Type**: <label> [decoration]
- **Confidence**: <0-100>
- **Blocking**: <yes/no>
- **File:Line**: <path:line>
- **Evidence**: <verification method and result>

<discussion — explain WHY this is a problem and HOW to fix it>
```

### Confidence Guidelines

| Range | Tier | When to use |
|-------|------|------------|
| 90-100 | Verified | Tool output confirms (grep match, test failure, lint error) |
| 70-89 | Pattern match | Clear violation of documented rule with code evidence |
| 50-69 | Suspicious | Looks wrong, no tool verification, may have hidden context |
| <50 | Speculative | Subjective observation, might be intentional |

See [structured-output-format.md](structured-output-format.md) for full examples.

## False Positive Prevention

Before reporting any finding, apply these three filters:

1. **Linter-catchable?** If Phase 3 ruff/biome/tsc already catches this → confidence 50
2. **Pre-existing?** If `git diff main...HEAD` shows the line was NOT modified → confidence 30
3. **Intentional?** If code has `# noqa`, `// @ts-ignore`, `# tenant-isolation-exempt` → confidence 40

**Exception**: security findings are NEVER filtered by rules 2-3.

See [false-positive-filtering.md](false-positive-filtering.md) for full rules and examples.

## Diff-Scoped Review

- **Primary scope**: Lines in the MR diff (output of `glab mr diff`)
- **Read full files** only when surrounding context is needed to understand the change
- **Never flag** lines that are not part of the diff (pre-existing issues → separate cleanup MR)
- Changed files list and diff content are provided in the agent prompt

## Output Structure

Each agent should produce output in this order:

```markdown
## [Agent Name] Review

### Findings

[findings sorted by confidence, highest first]

### Summary

- Total findings: X
- Blocking: Y
- Non-blocking: Z
- Praise: W

### Agent-Specific Metrics (if applicable)

[e.g., coverage %, architectural score, security layer assessment]
```

## Per-Agent Responsibilities

| Agent | Focus | Blocking Labels |
|-------|-------|----------------|
| #1 Code Quality | Readability, complexity, DRY, error handling | issue [blocking] |
| #2 Type Safety | TS/Python types, Pydantic, generics | issue [blocking] |
| #3 Security | OWASP, secrets, input validation, tenant isolation | security |
| #4 Test Coverage | Test quality, edge cases, coverage % | issue [blocking] |
| #5 Backend Architect | Architecture patterns, ORM, API design, architecture score | issue [blocking] |
| #6 Frontend Developer | React, components, state management, a11y | issue [blocking] |
| #7 Security Auditor | Defense-in-depth, sensitive data handling, audit logging | security |
| #8 Database Architect | Schema, migrations, queries, tenant isolation | issue [blocking] |
| #10 Business Context Reviewer | Project domain invariants from `.claude/business-invariants.md`, cited by rule ID | issue [blocking] |
