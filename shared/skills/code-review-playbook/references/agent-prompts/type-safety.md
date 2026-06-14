TYPE SAFETY REVIEW

$VCS_ENTITY $VCS_PREFIX$MR_NUMBER | Diff-scoped review

Review type safety:

**TYPESCRIPT (Frontend):**
- No 'any' types (use unknown or specific types)
- Proper generics usage
- TanStack Query types (useQuery<DataType>)
- Null/undefined handling (optional chaining, nullish coalescing)
- Exhaustive type checking (switch statements)

**PYTHON (Backend):**
- Type hints on all function signatures
- Pydantic models for request/response
- SQLAlchemy model types
- No typing.Any without justification
- Proper Optional[T] usage

Output: Use structured finding format (see references/agent-review-templates.md). Apply FP filters (see references/false-positive-filtering.md). Scope to diff only.
