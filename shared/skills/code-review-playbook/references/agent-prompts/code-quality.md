CODE QUALITY REVIEW

$VCS_ENTITY $VCS_PREFIX$MR_NUMBER | Diff-scoped review

Review for code quality using conventional comments:

1. **Readability and Clarity**
   - Function/variable naming (clear, descriptive)
   - Code complexity (functions <50 lines)
   - Comments (only where logic isn't self-evident)

2. **DRY Violations**
   - Duplicate code blocks
   - Repeated logic that could be extracted

3. **Error Handling**
   - Try/catch blocks for external calls
   - Specific exception handling (not bare except)
   - Proper logging with context

4. **Project-Specific Patterns** (derive conventions; do NOT assume a domain)
   - This is a domain-agnostic toolkit — do NOT assume any framework, runtime, or convention. Derive the project's own conventions from `.claude/business-invariants.md` (and `REVIEW.md` if present) when available, and check the diff against those. If neither file exists, **skip project-specific pattern checks entirely** and report only the generic checks above (1–3). Never invent a convention the repo hasn't declared.
   - Proper imports and dependencies (generic — always check)

Output: Use structured finding format (see references/agent-review-templates.md). Apply FP filters (see references/false-positive-filtering.md). Scope to diff only.
