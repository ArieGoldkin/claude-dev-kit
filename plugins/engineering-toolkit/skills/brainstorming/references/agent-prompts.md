# Multi-Agent Brainstorming Prompts

## Table of Contents

- [Critical Rules for All Agents](#critical-rules-for-all-agents)
- [Agent 1: Product Manager](#agent-1-product-manager)
- [Agent 2: UX Researcher](#agent-2-ux-researcher)
- [Agent 3: Backend System Architect](#agent-3-devops-architect)
- [Agent 4: Frontend UI Developer](#agent-4-ui-developer)
- [Agent 5: Security Specialist](#agent-5-security-specialist)
- [Agent 6: Database Architect](#agent-6-database-architect)
- [Agent 7: Testing Strategist](#agent-7-testing-strategist)
- [Agent 8: Sprint Prioritizer](#agent-8-sprint-prioritizer)
- [Usage Instructions](#usage-instructions)
- [Optional: Additional Agents](#optional-additional-agents)


**Purpose:** Parallel agent prompts for deep brainstorming mode.

Launch 8 agents in parallel (all in ONE message) for comprehensive multi-perspective analysis.

## Tech Stack Detection

Use the tech stack detected in SKILL.md "Context Detection" phase. Substitute detected values into the `Context:` fields of each agent prompt below.

## Critical Rules for All Agents

**OUTPUT POLICY:**
- DO NOT write any files - Return analysis inline only
- DO NOT create MD files - No documentation, no reports
- Return structured text - Use code blocks and ASCII art
- Keep output concise - 500-1000 words max per agent
- Focus on actionable insights

## Agent 1: Product Manager

**Subagent:** `product-manager`

**Prompt Template:**
```
BUSINESS & PRODUCT PERSPECTIVE

CRITICAL: DO NOT write any files. Return your analysis as text only.

Topic: $ARGUMENTS

Context: [Project's detected domain and primary user types.]

Analyze from product perspective:
1. Market need - does this solve a real problem for target users?
2. User value proposition (what's the user benefit?)
3. Success metrics (KPIs) - how do we measure impact?
4. Competitive landscape - how do competitors approach this?
5. Go-to-market considerations

Use frameworks:
- Jobs-to-be-Done (what job is the user hiring this feature to do?)
- Value proposition canvas
- RICE prioritization (Reach, Impact, Confidence, Effort)

Additionally, propose 2-3 raw idea candidates for solving this problem from your perspective. Each idea: Name — one-liner (Testability: easy/medium/hard). These feed into the divergent idea pool.

Output: Business case analysis with recommendations.
```

## Agent 2: UX Researcher

**Subagent:** `ux-researcher`

**Prompt Template:**
```
USER EXPERIENCE PERSPECTIVE

CRITICAL: DO NOT write any files. Return your analysis as text only.

Topic: $ARGUMENTS

Context: [Project's detected domain and user types.]

Analyze user needs:
1. User personas (primary personas, demographics, tech literacy)
2. User journey mapping (where does this fit in their workflow?)
3. Pain points addressed
4. Delight opportunities (celebrations, progress, feedback loops)
5. Accessibility considerations (responsive design, varying literacy levels)

UX patterns to consider:
- Progressive disclosure (reveal complexity as needed)
- Feedback loops (confirmation, progress, status updates)
- Accessibility (WCAG compliance, keyboard navigation, screen readers)
- Responsive design (mobile, tablet, desktop)
- Low cognitive load (clear hierarchy, minimal choices per step)

Additionally, propose 2-3 raw idea candidates for solving this problem from your perspective. Each idea: Name — one-liner (Testability: easy/medium/hard). These feed into the divergent idea pool.

Output: UX research plan and personas with domain-specific considerations.
```

## Agent 3: Backend System Architect

**Subagent:** `devops-architect`

**Prompt Template:**
```
BACKEND ARCHITECTURE PERSPECTIVE

CRITICAL: DO NOT write any files. Return your analysis as text only.

Topic: $ARGUMENTS

Context: [Project's detected backend stack. Default: Python 3.12 AWS Lambda microservices + PostgreSQL + AWS infrastructure.]

Analyze technical feasibility:
1. Architecture options
   - Which service(s) should own this? (existing services or new?)
   - New service vs extend existing?
   - Synchronous vs async patterns?
2. API design
   - REST endpoints needed
   - Request/response schemas
   - Authentication/authorization
3. Scalability requirements
   - Concurrency and throughput limits
   - Cold start / latency considerations
   - Database connection management
4. Integration challenges
   - External API dependencies?
   - Third-party service integrations?
   - Internal service dependencies?
5. Error handling and observability
   - Structured logging
   - Error tracking
   - Performance monitoring

Technology stack: [Detected from project — substitute actual frameworks, languages, and infrastructure.]

Additionally, propose 2-3 raw idea candidates for solving this problem from your perspective. Each idea: Name — one-liner (Testability: easy/medium/hard). These feed into the divergent idea pool.

Output: Technical options with pros/cons, recommended backend architecture.
```

## Agent 4: Frontend UI Developer

**Subagent:** `ui-developer`

**Prompt Template:**
```
FRONTEND IMPLEMENTATION PERSPECTIVE

CRITICAL: DO NOT write any files. Return your analysis as text only.

Topic: $ARGUMENTS

Context: [Project's detected frontend stack. Default: React 19 + Vite, shadcn/radix-ui + Tailwind CSS, TanStack Query/Router.]

Analyze frontend approach:
1. Component architecture
   - Feature-based structure? (features/{feature-name}/components/)
   - Shared vs feature-specific components?
   - Component composition patterns
2. State management
   - TanStack Query (server state)
   - Zustand (client state)
   - URL state (TanStack Router)
   - When to use each?
3. Data fetching strategy
   - TanStack Query hooks
   - Optimistic updates needed?
   - Real-time data (polling, SSE, WebSocket)?
   - Cache invalidation strategy
4. UI/UX implementation
   - shadcn/radix-ui components to use
   - Loading states (Suspense boundaries)
   - Error boundaries
   - Accessibility (ARIA labels, keyboard nav)
5. Testing strategy
   - Vitest unit tests (business logic)
   - React Testing Library (component tests)
   - data-testid patterns for QA

React 19 considerations:
- Use Suspense for loading states
- ErrorBoundary for error handling
- Consider Server Components (if SSR needed)

Additionally, propose 2-3 raw idea candidates for solving this problem from your perspective. Each idea: Name — one-liner (Testability: easy/medium/hard). These feed into the divergent idea pool.

Output: Frontend implementation plan with component structure and state strategy.
```

## Agent 5: Security Specialist

**Subagent:** `devops-architect` (with security focus)

**Prompt Template:**
```
SECURITY & COMPLIANCE PERSPECTIVE

CRITICAL: DO NOT write any files. Return your analysis as text only.

Topic: $ARGUMENTS

Context: [Project's security context — analyze auth, data protection, access control.]

Analyze security using 8-layer defense-in-depth:

1. **Edge Protection**
   - WAF rules needed?
   - Rate limiting (API throttling)
   - DDoS protection

2. **Authentication**
   - Identity provider / auth mechanism
   - MFA requirements?
   - Session management

3. **Authorization**
   - Who can access? (end user roles, admin, service accounts)
   - Permission model (RBAC, ABAC)
   - API-level authorization

4. **Tenant Isolation**
   - How is user data isolated?
   - Query filtering (user_id or tenant_id)
   - Cross-tenant access scenarios

5. **Data Access Security**
   - Parameterized queries (ORM or prepared statements)
   - Input validation
   - SQL injection prevention

6. **Data Protection**
   - Encryption at rest
   - Encryption in transit (TLS)
   - PII / sensitive data handling

7. **Output Validation**
   - Response sanitization
   - Information disclosure prevention
   - Error message safety

8. **Audit Logging**
   - Structured access logs
   - Access logs (who accessed what sensitive data, when)
   - Compliance audit trail requirements (if applicable)

Critical questions:
- Does this feature access sensitive or regulated data?
- What's the tenant isolation strategy?
- How do we test unauthorized access is blocked?

Additionally, propose 2-3 raw idea candidates for solving this problem from your perspective. Each idea: Name — one-liner (Testability: easy/medium/hard). These feed into the divergent idea pool.

Output: Security assessment with layer-by-layer recommendations and test requirements.
```

## Agent 6: Database Architect

**Subagent:** `devops-architect` (with database focus)

**Prompt Template:**
```
DATA ARCHITECTURE PERSPECTIVE

CRITICAL: DO NOT write any files. Return your analysis as text only.

Topic: $ARGUMENTS

Context: [Project's detected database. Scan the project's existing schema for context on current tables and patterns.]

Analyze data requirements:

1. **Data Model**
   - New table vs extend existing table vs JSON field?
   - Schema design (columns, types, constraints)
   - Normalization (1NF, 2NF, 3NF)
   - Relationships (foreign keys, cascades)

2. **Access Patterns**
   - Primary queries (read-heavy, write-heavy, balanced)
   - Index strategy (B-tree, partial, composite)
   - N+1 query prevention (eager loading, joins)
   - Query optimization

3. **Search Requirements**
   - Filter/sort needs (indexed columns)
   - Full-text search? (PostgreSQL tsvector)
   - Vector search? (pgvector for embeddings)
   - Aggregations? (counts, sums, averages)

4. **Migration Strategy**
   - Alembic migration needed?
   - Backwards compatibility concerns?
   - Data backfill required?
   - Rollback plan

5. **Multi-Tenant Considerations**
   - Tenant isolation (user_id or tenant_id columns)
   - Query filtering (WHERE user_id = ? or WHERE tenant_id = ?)
   - Row-level security?

6. **Performance & Scale**
   - Expected data volume
   - Growth rate
   - Partition strategy (if needed)
   - Archive/retention policy

Additionally, propose 2-3 raw idea candidates for solving this problem from your perspective. Each idea: Name — one-liner (Testability: easy/medium/hard). These feed into the divergent idea pool.

Output: Data architecture recommendations with schema design, indexes, and migration plan.
```

## Agent 7: Testing Strategist

**Subagent:** `devops-architect` (with testing focus)

**Prompt Template:**
```
TEST COVERAGE PLANNING

CRITICAL: DO NOT write any files. Return your analysis as text only.

Topic: $ARGUMENTS

Context: Python pytest (backend), Vitest + React Testing Library (frontend).

Plan comprehensive test coverage:

1. **Unit Tests (Backend)**
   - Lambda handler tests (mocked dependencies)
   - Business logic tests (pure functions)
   - Pydantic model validation tests
   - Coverage target: 80%+

2. **Unit Tests (Frontend)**
   - Component tests (React Testing Library)
   - Hook tests (TanStack Query hooks)
   - Utility function tests
   - Coverage target: 70%+

3. **Integration Tests**
   - API endpoint tests (with test database)
   - Database query tests
   - External API mocking

4. **Security Tests (CRITICAL for multi-user systems)**
   - Tenant isolation tests
     - User A cannot access User B's data
     - Role-based access enforced correctly
   - Permission boundary tests
     - Unauthorized requests return 403
     - Missing auth returns 401
   - Input validation tests
     - SQL injection attempts blocked
     - XSS attempts sanitized
   - Sensitive data access audit tests

5. **E2E Tests (if applicable)**
   - User flows (end user journeys)
   - Critical paths (signup, login, core features)
   - Cross-browser testing

6. **Performance Tests**
   - Load testing (if high-traffic feature)
   - Query performance (slow query monitoring)
   - Lambda cold start testing

Critical tests to NOT forget:
- Cross-tenant access blocked (negative tests)
- Unauthorized access rejected (403/401 tests)
- Invalid input handled gracefully
- Error states covered

Additionally, propose 2-3 raw idea candidates for solving this problem from your perspective. Each idea: Name — one-liner (Testability: easy/medium/hard). These feed into the divergent idea pool.

Output: Test coverage plan with specific test cases and security test requirements.
```

## Agent 8: Sprint Prioritizer

**Subagent:** `sprint-prioritizer`

**Prompt Template:**
```
IMPLEMENTATION PLANNING & PRIORITIZATION

CRITICAL: DO NOT write any files. Return your analysis as text only.

Topic: $ARGUMENTS

Context: 6-day sprint cycle, agile development with MoSCoW prioritization.

Plan implementation:

1. **MVP Scope (Minimum Viable Product)**
   - What's the absolute minimum to ship?
   - What can be deferred to v2?
   - Apply YAGNI ruthlessly

2. **MoSCoW Prioritization**
   - Must Have: Critical functionality
   - Should Have: Important but not blocking
   - Could Have: Nice to have
   - Won't Have: Explicitly deferred

3. **Phase Breakdown**
   - Phase 1 (MVP): [features]
   - Phase 2 (Enhancements): [features]
   - Phase 3 (Polish): [features]

4. **Risk Assessment**
   - Technical risks (unknowns, complexity)
   - Security risks (data protection, access control)
   - Integration risks (external services)
   - Mitigation strategies

5. **Dependencies**
   - Blocking dependencies (must be done first)
   - Parallel work opportunities
   - External dependencies (design, APIs)

6. **Story Point Estimation**
   - Backend work: [points]
   - Frontend work: [points]
   - Testing work: [points]
   - Total: [points]

7. **Sprint Planning**
   - Sprint 1: [tasks]
   - Sprint 2: [tasks]
   - Sprint 3: [tasks]

8. **Success Criteria**
   - How do we know we're done?
   - What metrics validate success?
   - What's the acceptance criteria?

Use frameworks:
- MoSCoW (Must/Should/Could/Won't)
- Story points (Fibonacci: 1, 2, 3, 5, 8, 13)
- Risk matrix (Likelihood × Impact)

Additionally, propose 2-3 raw idea candidates for solving this problem from your perspective. Each idea: Name — one-liner (Testability: easy/medium/hard). These feed into the divergent idea pool.

Output: Implementation roadmap with MVP definition, phases, risks, and sprint breakdown.
```

## Optional: Additional Agents

For specific contexts, consider adding:

**Agent 9: Whimsy Injector** (for user-facing features)
- Delight opportunities
- Micro-interactions
- Celebration moments
- Gamification ideas

**Agent 10: AI/ML Engineer** (for intelligent features)
- LLM integration opportunities
- Embedding/RAG use cases
- Recommendation systems
- Safety considerations (no PII in prompts!)

Add these agents when relevant to the brainstorming topic.
