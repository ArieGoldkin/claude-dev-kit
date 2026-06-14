# System Design Interrogation Framework

**Purpose:** Ask the right questions BEFORE exploring solutions.

Use this framework at the start of any brainstorming session to establish critical constraints and requirements.

## Core 5 Dimensions

### 1. SCALE
**Questions to ask:**
- How many users will use this feature?
- What's the expected data volume (records, requests/day)?
- What's the read/write ratio?
- What's the growth trajectory (6 months, 1 year)?

### 2. DATA
**Questions to ask:**
- Where does this data naturally belong? (existing table, new table, JSON field)
- What's the primary access pattern? (by user, by tenant, by date, full-text search)
- Is search capability needed? (filter/sort, full-text, vector similarity)
- Does this data have PII or sensitive data?
- What's the retention policy?

### 3. SECURITY
**Questions to ask:**
- Who can access this data/feature? (end users, admins, service accounts)
- How is tenant isolation enforced? (row-level, query filtering)
- What attack vectors exist? (injection, XSS, CSRF, unauthorized access)
- Is there PII or sensitive data involved? (names, emails, financial data)
- What audit logging is needed?

### 4. UX
**Questions to ask:**
- What's the acceptable latency? (<100ms, <500ms, <2s)
- What feedback does the user need? (loading states, progress, confirmation)
- What happens on failure? (retry, error message, fallback)
- Is this real-time or eventually consistent?
- What devices/contexts? (mobile, desktop, tablet)

### 5. COHERENCE
**Questions to ask:**
- Which layers does this touch? (database, backend API, frontend)
- What types/contracts change? (Pydantic models, TypeScript types)
- Is this a breaking change? (existing API, existing UI)
- What migration path is needed?
- Do tests cover all layers?

## Usage Patterns

### Simple Mode (Conversational)
Ask 5-8 dimension questions conversationally throughout Phase 1 (Understanding):
- "How many users do you expect to use this?"
- "Where should this data be stored?"
- "Who needs access to this feature?"

### Deep Mode (Structured Assessment)
Use formal structured assessment in Phase 0:
```
┌─────────────────────────────────────────────────────────────┐
│  SYSTEM DESIGN INTERROGATION: [Topic]                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  □ SCALE        Users? Data volume? Growth?                 │
│  □ DATA         Storage? Access pattern? Search?            │
│  □ SECURITY     Access? Isolation? Sensitive data?           │
│  □ UX           Latency? Feedback? Errors?                  │
│  □ COHERENCE    Layers? Types? Breaking?                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Output Format

Document answers in structured format:

```markdown
## System Design Assessment

**SCALE:** [answers]
**DATA:** [answers]
**SECURITY:** [answers]
**UX:** [answers]
**COHERENCE:** [answers]

### Critical Constraints Identified
1. [constraint 1]
2. [constraint 2]
3. [constraint 3]

### Open Questions
1. [question 1]
2. [question 2]
```

## When to Skip Dimensions

Not every dimension applies to every feature:
- **Non-user-facing features**: UX may be minimal
- **Read-only features**: SECURITY may be reduced
- **Internal admin tools**: SECURITY isolation may differ
- **UI-only changes**: DATA/COHERENCE may be limited

Use judgment to focus on relevant dimensions.
