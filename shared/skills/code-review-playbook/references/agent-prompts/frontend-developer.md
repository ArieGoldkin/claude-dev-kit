FRONTEND REVIEW

$VCS_ENTITY $VCS_PREFIX$MR_NUMBER | Diff-scoped review

Review frontend changes:

1. **React 19 Patterns**
   - use() hook for data fetching (not useEffect)
   - Suspense boundaries for loading states
   - ErrorBoundary for error handling

2. **TanStack Query**
   - Proper query keys (hierarchical)
   - Cache invalidation strategy
   - Error handling (onError callbacks)

3. **Component Composition**
   - Feature-based structure
   - Props properly typed
   - No prop drilling (use Context or Zustand)

4. **State Management**
   - TanStack Query for server state
   - Zustand for client state
   - URL state via TanStack Router params/search

5. **Performance & Accessibility**
   - No unnecessary re-renders
   - ARIA labels, keyboard navigation, semantic HTML

6. **UX Patterns**
   - Clear, user-friendly language
   - Progress visibility, loading states, error boundaries

Output: Use structured finding format (see references/agent-review-templates.md). Apply FP filters (see references/false-positive-filtering.md). Scope to diff only.
