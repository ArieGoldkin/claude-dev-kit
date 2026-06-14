# Final Report Template (Phase 6d)

The in-session report rendered after synthesis. Replace placeholders with actual values; remove rows / sections that don't apply (e.g., omit Database & Architecture if no DB agent was launched).

> All headings below use `###` (not `##`) so they nest correctly under Phase 6 in the SKILL.md flow when this template is materialized inline. Do not change to `##` — that breaks the section structure.

```markdown
# $VCS_ENTITY Review: $VCS_PREFIX$MR_NUMBER

**Title**: [MR Title]
**Author**: [Author]
**Files Changed**: X | **Lines**: +Y / -Z
**Domains**: [affected domains]
**Review Mode**: [Quick/Standard/Deep] [Incremental]

### Executive Summary

[1-2 sentence overview of changes and overall quality]

**MR Risk Score**: [X/10] ([Low/Moderate/High/Critical]) — Scope: [0-2], Cross-cutting: [0-2], Risk: [0-2], Unknowns: [0-2], Blast radius: [0-2]
**PR Description**: [Complete / Adequate / Incomplete — list missing items if any]

### Evidence Gate

| Check | Exit Code | Gate |
|-------|-----------|------|
| Secrets Scan | [0/1] | [PASS/BLOCK] |
| Python Lint | [0/1] | [PASS/WARN] |
| Frontend Lint | [0/1] | [PASS/WARN] |
| Type Check | [0/1] | [PASS/WARN] |
| Tests | [0/1] | [PASS/WARN] |

**Evidence Gate Status**: [CLEAR / BLOCKED]
[If BLOCKED: "Secrets scan failed — recommendation forced to REQUEST CHANGES"]

**Pipeline Acknowledgment**: [N/A | Acknowledged-expected: <reason> | Gating]
[If Acknowledged-expected: "Pipeline failure excluded from gating per author confirmation."]

### Quality Checks

| Check | Status | Notes |
|-------|--------|-------|
| Secrets Scan | PASS/FAIL | [result] |
| Python Lint | PASS/WARN/FAIL | [ruff result] |
| Frontend Lint | PASS/WARN/FAIL | [biome result] |
| Type Check | PASS/FAIL | [tsc result] |
| Tests | PASS/FAIL | [X passed, Y failed] |
| Sensitive Data Exposure | PASS/WARN | [potential issues?] |
| Tenant Isolation | PASS/WARN | [properly filtered?] |
| Migration | PASS/WARN/N/A | [present if needed?] |

### Strengths

- [Positive highlights from agents]
- [Good patterns observed]

### Code Quality

[Agent 1 feedback summary — findings with confidence >= threshold only]

### Security

[Agent 3 + Agent 7 (if launched) feedback summary]

**Security Status**: [Clear / Minor Issues / Critical Issues]
**Security Compliance**: [Compliant / Needs Review / Non-Compliant]

### Database & Architecture

[Agent 5 + Agent 8 (if launched) feedback summary]
[Include architectural assessment table if available]

### Testing

[Agent 4 feedback summary]

**Coverage**: [X% (before) → Y% (after)]

### Suggestions (Non-Blocking)

- [suggestion 1 with file:line reference]
- [suggestion 2]

### Blockers (Must Fix Before Merge)

- [blocker 1 if any]
- [blocker 2 if any]

### Composite Score

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| Quality Checks | 30% | [0-100] | [X] |
| Code Quality | 20% | [0-100] | [X] |
| Security | 25% | [0-100] | [X] |
| Testing | 15% | [0-100] | [X] |
| Architecture | 10% | [0-100] | [X] |
| **Total** | **100%** | | **[X/100]** |

**Grade**: [A/B/C/D/F]

[X findings filtered (confidence < {threshold})]

### Agents

**Launched**: [list with numbers and reasons]
**Skipped**: [list with reasons]

### Recommendation

**[APPROVE / REQUEST CHANGES / COMMENT]** (Grade: [X])

[Brief explanation of decision]
[If evidence gate BLOCKED: "Recommendation forced to REQUEST CHANGES due to secrets scan failure"]

---
Reviewed with Claude Code (Mode: [Quick/Standard/Deep] [Incremental])
Generated: [timestamp]
```

> **Reminder**: this is the in-session view only. The MR-bound artifacts are written by Phase 7 to `.claude/reviews/mr-${N}-findings.{yaml,md}`. Do NOT post this Final Report as a top-level MR note.
