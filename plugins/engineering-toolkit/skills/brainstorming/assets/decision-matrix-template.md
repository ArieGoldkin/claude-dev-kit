# Decision Matrix: [Decision Name]

**Date:** YYYY-MM-DD
**Decision Maker:** [Name/Team]

---

## Options Being Considered

1. **Option 1:** [Brief description]
2. **Option 2:** [Brief description]
3. **Option 3:** [Brief description]

---

## Evaluation Dimensions (Fixed 5-Dimension Scale)

All options are scored across 5 standard dimensions on a 0-10 scale.

| Dimension | Scale | Description |
|-----------|-------|-------------|
| Feasibility | 0-10 | Can we build this with current team, skills, and infrastructure? |
| Complexity | 0-10 (inverted) | 10 = trivially simple, 0 = extremely complex to implement/maintain |
| Testability | 0-10 | How easy to write comprehensive automated tests? |
| Security | 0-10 | Auth, data protection, sensitive data handling, tenant isolation |
| Fit | 0-10 | How well does it match stated requirements and constraints? |

---

## Detailed Comparison

### Option 1: [Name]

**Pros:**
- Advantage 1
- Advantage 2
- Advantage 3

**Cons:**
- Disadvantage 1
- Disadvantage 2
- Disadvantage 3

**Test Strategy (1-liner):** [e.g., "Unit test core logic + integration test API endpoint"]

**Score:**
| Dimension | Score (0-10) | Notes |
|-----------|:------------:|-------|
| Feasibility | 8 | Straightforward with existing stack |
| Complexity | 7 | Some edge cases in error handling |
| Testability | 9 | Pure functions, easy to mock |
| Security | 6 | Needs additional auth layer |
| Fit | 8 | Covers 90% of requirements |
| **Total** | **38/50** | |

---

### Option 2: [Name]

**Pros:**
- Advantage 1
- Advantage 2
- Advantage 3

**Cons:**
- Disadvantage 1
- Disadvantage 2
- Disadvantage 3

**Test Strategy (1-liner):** [e.g., "Integration test with real DB + mock external services"]

**Score:**
| Dimension | Score (0-10) | Notes |
|-----------|:------------:|-------|
| Feasibility | 6 | Requires learning new framework |
| Complexity | 4 | Multiple moving parts |
| Testability | 5 | Hard to mock dependencies |
| Security | 9 | Built-in security features |
| Fit | 7 | Covers core requirements |
| **Total** | **31/50** | |

---

### Option 3: [Name]

**Pros:**
- Advantage 1
- Advantage 2
- Advantage 3

**Cons:**
- Disadvantage 1
- Disadvantage 2
- Disadvantage 3

**Test Strategy (1-liner):** [e.g., "E2E test critical paths + unit test business logic"]

**Score:**
| Dimension | Score (0-10) | Notes |
|-----------|:------------:|-------|
| Feasibility | 9 | Uses familiar patterns |
| Complexity | 9 | Very straightforward |
| Testability | 7 | Some integration complexity |
| Security | 5 | Needs manual security review |
| Fit | 6 | Covers 70% of requirements |
| **Total** | **36/50** | |

---

## Score Comparison

| Option | Feasibility | Complexity | Testability | Security | Fit | **Total** |
|--------|:-----------:|:----------:|:-----------:|:--------:|:---:|:---------:|
| Option 1 | 8 | 7 | 9 | 6 | 8 | **38/50** |
| Option 2 | 6 | 4 | 5 | 9 | 7 | **31/50** |
| Option 3 | 9 | 9 | 7 | 5 | 6 | **36/50** |

**Highest score indicates recommended option**, but use judgment -- a low Security score may be a dealbreaker regardless of total.

---

## Decision

**Chosen Option:** Option 2

**Rationale:**
- Why this option was selected
- Which trade-offs were accepted
- What risks are being taken
- How to mitigate the cons

**Test Strategy:** [Chosen option's testing approach]

**Alternatives Considered:**
- Why Option 1 was rejected: [Reason]
- Why Option 3 was rejected: [Reason]

---

## Implementation Notes

- Key considerations for implementation
- Dependencies to address
- Timeline implications

---

## Revisit Criteria

This decision should be revisited if:
- Condition 1 changes (e.g., user count grows >10x)
- Condition 2 occurs (e.g., new technology becomes available)
- Condition 3 happens (e.g., cost becomes prohibitive)

**Review date:** YYYY-MM-DD

---

## Stakeholder Sign-off

| Name | Role | Approval | Date |
|------|------|----------|------|
| [Name] | Engineering Lead | ☐ Approved | YYYY-MM-DD |
| [Name] | Product Manager | ☐ Approved | YYYY-MM-DD |
| [Name] | Tech Lead | ☐ Approved | YYYY-MM-DD |
