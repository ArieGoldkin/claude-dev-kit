# Synthesis & Coherence Agents

**Purpose:** Integrate multi-perspective analysis into unified recommendations.

Launch 3 synthesis agents in parallel (all in ONE message) after collecting all 8 primary agent perspectives.

## Table of Contents

- [Critical Rules](#critical-rules)
- [Synthesis Agent 1: Integration & Recommendations](#synthesis-agent-1-integration--recommendations)
- [Synthesis Agent 2: Socratic Questions](#synthesis-agent-2-socratic-questions)
- [Synthesis Agent 3: Coherence & Consistency Review](#synthesis-agent-3-coherence--consistency-review)
- [Usage Instructions](#usage-instructions)

## Critical Rules

**OUTPUT POLICY:**
- DO NOT write any files - Return analysis inline only
- Return structured text - Use tables, lists, ASCII art
- Keep output focused - 800-1200 words max per agent

## Synthesis Agent 1: Integration & Recommendations

**Subagent:** `product-manager`

**Prompt Template:**
```
SYNTHESIS: INTEGRATE ALL PERSPECTIVES

CRITICAL: DO NOT write any files. Return your analysis as text only.

Topic: $ARGUMENTS

Input: Results from 8 parallel agents:
1. Product Manager (business value)
2. UX Researcher (user needs)
3. Backend System Architect (Lambda, APIs)
4. Frontend UI Developer (React components)
5. Security Specialist (compliance if applicable)
6. Database Architect (PostgreSQL schema)
7. Testing Strategist (coverage plan)
8. Sprint Prioritizer (implementation roadmap)

Create unified analysis:

1. **Common Themes**
   - What do multiple agents agree on?
   - Where is there consensus?
   - Recurring recommendations across perspectives

2. **Conflicting Viewpoints**
   - Where do agents disagree?
   - Trade-offs identified
   - Resolution recommendations

3. **Critical Decisions Needed**
   - What must the user decide?
   - Options with pros/cons
   - Decision impact analysis

4. **Recommended Approach**
   - Synthesized recommendation
   - Why this approach over alternatives
   - Key principles guiding the recommendation

5. **Implementation Strategy**
   - Recommended phases (MVP → enhancements → polish)
   - Technical stack choices
   - Team coordination needs

6. **Risk Summary**
   - Top 3 risks identified across agents
   - Mitigation strategies
   - Go/no-go considerations

7. **Open Questions for User**
   - What needs clarification?
   - What assumptions need validation?
   - What decisions require user input?

Format as executive summary with clear decision points.

Use visual aids:
- Tables for trade-off comparisons
- Lists for prioritized recommendations
- ASCII diagrams for architecture overview
```

## Synthesis Agent 2: Socratic Questions

**Subagent:** `ux-researcher`

**Prompt Template:**
```
SOCRATIC QUESTIONING

CRITICAL: DO NOT write any files. Return your analysis as text only.

Topic: $ARGUMENTS

Input: All agent perspectives (product, UX, backend, frontend, security, data, testing, planning)

Generate thought-provoking questions to surface critical decisions:

1. **Clarifying Questions** (what's unclear?)
   - Ambiguous requirements identified by agents
   - Missing information needed for implementation
   - Assumptions that need validation
   - [3-5 specific questions]

2. **Challenging Questions** (what assumptions?)
   - Unstated assumptions agents are making
   - "What if..." scenarios not considered
   - Alternative approaches not explored
   - [3-5 specific questions]

3. **Trade-off Questions** (what sacrifices?)
   - Performance vs simplicity
   - Security vs usability
   - Speed vs quality
   - Cost vs features
   - [3-5 specific questions]

4. **Future Questions** (what might change?)
   - Scalability implications (10x growth?)
   - Extensibility considerations (new features?)
   - Maintenance burden (technical debt?)
   - Evolution path (roadmap alignment?)
   - [3-5 specific questions]

5. **Validation Questions** (how to test?)
   - Success metrics (how do we measure?)
   - User validation (how do we know users want this?)
   - Technical validation (feasibility proof?)
   - Risk validation (what could go wrong?)
   - [3-5 specific questions]

Goal: Surface the decisions the user needs to make before implementation.

Format as structured question categories with 3-5 questions each.

Example format:
```
## Clarifying Questions

1. **Data ownership**: Who owns this data - end user or administrator? How does that affect access patterns?

2. **Real-time requirements**: Do users need instant updates (<1s) or is eventual consistency (5-30s) acceptable?

[etc.]
```
```

## Synthesis Agent 3: Coherence & Consistency Review

**Subagent:** `quality-reviewer`

**Prompt Template:**
```
COHERENCE & CROSS-LAYER CONSISTENCY REVIEW

CRITICAL: DO NOT write any files. Return your analysis as text only.

Topic: $ARGUMENTS

Input: All agent proposals (architecture, database, frontend, backend, security, testing)

Review all proposals for cross-layer coherence:

## Coherence Matrix

Analyze each layer and check for consistency:

┌──────────────────────────────────────────────────────────────────┐
│ Layer      │ Types         │ Contracts    │ Tests      │ Status  │
├────────────┼───────────────┼──────────────┼────────────┼─────────┤
│ Database   │ SQLAlchemy    │ Schema       │ Unit       │ ✓ / ✗   │
│ Backend    │ Pydantic      │ API spec     │ Integration│ ✓ / ✗   │
│ Frontend   │ TypeScript    │ API client   │ E2E        │ ✓ / ✗   │
│ Security   │ Auth models   │ Permissions  │ Security   │ ✓ / ✗   │
└──────────────────────────────────────────────────────────────────┘

## Coherence Checks

1. **Type Consistency**
   - Do database models match Pydantic models?
   - Do Pydantic models match TypeScript types?
   - Are enums consistent across layers?
   - Are nullable fields handled consistently?

2. **API Contracts**
   - Do frontend and backend agree on API shape?
   - Are error responses consistent?
   - Is versioning strategy clear?
   - Are breaking changes identified?

3. **Security Consistency**
   - Do all layers enforce tenant isolation?
   - Are permission checks consistent (frontend + backend)?
   - Is sensitive data handling consistent across layers?
   - Are audit logs complete (all sensitive data access)?

4. **Testing Coherence**
   - Do tests cover all layers?
   - Are security tests at each layer?
   - Is tenant isolation tested?
   - Are integration tests aligned with architecture?

5. **Breaking Change Analysis**
   - Is this a breaking change to existing APIs?
   - Does it require database migration?
   - Does it affect existing frontend code?
   - What's the migration/rollout strategy?

6. **Migration Plan**
   - Database migrations needed (Alembic)?
   - API versioning needed?
   - Feature flags needed?
   - Backwards compatibility strategy?

## Gap Analysis

Identify gaps or inconsistencies:

**CRITICAL GAPS:**
- [List any critical misalignments between layers]

**MODERATE GAPS:**
- [List any moderate inconsistencies]

**MINOR GAPS:**
- [List any minor issues]

## Recommendations

1. **Type Alignment**: [specific actions to align types]
2. **Contract Clarity**: [specific actions for API contracts]
3. **Security Consistency**: [specific actions for security]
4. **Migration Path**: [specific actions for safe deployment]
5. **Testing Coverage**: [specific actions for comprehensive tests]

Output: Coherence assessment with gaps identified and remediation plan.

Format with clear sections and actionable recommendations.
```

## Usage Instructions

### Launching All 3 Synthesis Agents

**CRITICAL:** Launch ALL 3 agents in ONE message after primary agents complete.

```python
# Wait for all 8 primary agents to complete first!

# Then launch synthesis agents in parallel:
Task(subagent_type="product-manager", prompt="[Synthesis Agent 1 prompt]", run_in_background=true)
Task(subagent_type="ux-researcher", prompt="[Synthesis Agent 2 prompt]", run_in_background=true)
Task(subagent_type="quality-reviewer", prompt="[Synthesis Agent 3 prompt]", run_in_background=true)
```

See `deep-mode-phases.md` Phase 4 for presentation format and Phase 5 for refinement/iteration patterns.
