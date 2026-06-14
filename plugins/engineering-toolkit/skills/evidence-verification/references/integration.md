# Integration with Other Systems

How evidence verification integrates with the broader development workflow.

## Table of Contents

- [Context System Integration](#context-system-integration)
- [Quality Gates Integration](#quality-gates-integration)
- [Squad Mode Integration](#squad-mode-integration)

---

## Context System Integration

Evidence is automatically tracked in shared context:

```typescript
// Context structure includes:
{
  quality_evidence?: {
    tests_run: boolean;
    test_exit_code?: number;
    coverage_percent?: number;
    build_success?: boolean;
    linter_errors?: number;
    timestamp: string;
  }
}
```

## Quality Gates Integration

Evidence collection feeds into quality gates:
- Quality gates check if evidence exists
- Block task completion if evidence missing
- Escalate if evidence shows failures

## Squad Mode Integration

In parallel execution:
- Each agent collects evidence independently
- Orchestrator validates evidence before sync
- Blocked tasks don't waste parallel cycles
