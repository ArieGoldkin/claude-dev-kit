# Gating Checklists

Mode-specific critical unknowns checklists for Phase 0 (Erotetic-Lite Gating).

## How to Use

1. Select the checklist matching the detected mode
2. For each item, mark as: **Known** (have clear answer), **Unknown** (need to resolve), or **N/A**
3. Count unknowns and assess overall complexity (1-5)
4. Apply blocking rule: unknowns > 3 AND complexity >= 3 → BLOCK

## Greenfield Checklist (5 unknowns)

New feature built from scratch. All foundation questions matter.

| # | Critical Unknown | Question to Resolve |
|---|-----------------|---------------------|
| 1 | Tech stack | What languages, frameworks, and tools will be used? Are there existing patterns to follow? |
| 2 | Data model | What entities, relationships, and storage mechanisms are needed? Database tables? |
| 3 | Auth method | How will authentication and authorization work? Existing auth system? New roles needed? |
| 4 | Integrations | What external services, APIs, or internal systems must this connect to? |
| 5 | API consumers | Who will consume this? Frontend? Other services? External partners? What contract do they need? |

**Complexity factors:** Number of new entities (1 = low, 5+ = high), cross-service communication,
new infrastructure requirements, sensitive data handling.

## Brownfield Checklist (5 unknowns)

Changes to existing code. Impact and compatibility questions dominate.

| # | Critical Unknown | Question to Resolve |
|---|-----------------|---------------------|
| 1 | Affected files | Which files and modules will be modified? What's the blast radius? |
| 2 | Test coverage | What's the current test coverage of affected code? Are there existing tests to update? |
| 3 | API contract changes | Will any API contracts change? Are there consumers that will break? |
| 4 | DB migration | Are database schema changes needed? Migration strategy? |
| 5 | Backwards compatibility | Can this be deployed without breaking existing functionality? Feature flags needed? |

**Complexity factors:** Number of affected files (1-3 = low, 10+ = high), API contract changes,
database migrations, multi-service coordination.

## Bugfix Checklist (3 unknowns)

Bug fix with focused scope. Reproduction and severity are key.

| # | Critical Unknown | Question to Resolve |
|---|-----------------|---------------------|
| 1 | Repro steps | Can the bug be reliably reproduced? What are the exact steps? |
| 2 | Error messages | What error messages, stack traces, or logs are available? |
| 3 | Severity | What's the impact? How many users affected? Is there a workaround? |

**Complexity factors:** Reproducibility (intermittent = high), number of potential root causes,
cross-service involvement, data corruption risk.

## Refactor Checklist (4 unknowns)

Safe code transformation. Behavior preservation is the priority.

| # | Critical Unknown | Question to Resolve |
|---|-----------------|---------------------|
| 1 | What's improving | What specific code quality issue is being addressed? (duplication, complexity, coupling, etc.) |
| 2 | Pain points | What concrete problems does the current code cause? (slow development, frequent bugs, etc.) |
| 3 | Acceptance criteria | How will we know the refactor succeeded? What metrics improve? |
| 4 | Test coverage | Is the code being refactored well-tested? Can we verify behavior preservation? |

**Complexity factors:** Scope of change (single file = low, cross-module = high), test coverage
of affected code, number of callers/dependents.

## Complexity Scale

| Score | Label | Description |
|-------|-------|-------------|
| 1 | Trivial | Single file, well-understood change, strong test coverage |
| 2 | Low | 2-3 files, clear approach, adequate tests |
| 3 | Medium | Multiple files, some design decisions needed, partial test coverage |
| 4 | High | Cross-module, significant design decisions, weak test coverage |
| 5 | Very High | Cross-service, architectural implications, minimal test coverage |

## Blocking Decision Matrix

| Unknowns | Complexity 1-2 | Complexity 3-5 |
|----------|---------------|----------------|
| 0-3 | PASS | PASS |
| 4+ | WARN (note risks) | BLOCK (resolve unknowns first) |

When **BLOCKED**: List each unknown as a numbered question the user must answer.
When **WARNED**: List unknowns as risks, recommend resolving before proceeding but allow continuation.
When **PASSED**: Briefly note what's known and proceed.
