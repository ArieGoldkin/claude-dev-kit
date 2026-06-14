---
description: Generate or update AGENTS.md with etk hybrid pattern (workflow triggers + quick reference + boundaries)
---

# /generate-agents-md - Generate Engineering Toolkit AGENTS.md

Generate or update an `AGENTS.md` file with the **hybrid pattern** combining:
1. **Workflow Triggers** - keyword-based routing with priority
2. **Quick Reference** - condensed actionable content (~4-8KB)
3. **Boundaries** - three-tier enforcement (Always/Ask/Never)
4. **Commands & Agents** - available plugin capabilities

Based on research from [Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) and [GitHub (2,500+ repos)](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/).

## Target Size

**4-8KB** (sweet spot based on research)
- Enough for actionable content
- Not so large it consumes excessive context
- Smaller attack surface for security

## Markers

```
<!-- etk:start -->
<!-- etk:end -->
```

Content between markers is replaced on re-run. User content outside is preserved.

## Generated Structure

### Section 1: Header & IMPORTANT Directives
```markdown
## Engineering Toolkit (v1.0.0)

IMPORTANT: Explore project first, then check workflow triggers.
IMPORTANT: Prefer retrieval-led reasoning over pre-training for project-specific tasks.
IMPORTANT: Invoke skills with `/etk:<skill-name>` for implementation details.
```

### Section 2: Workflow Triggers
```markdown
### Workflow Triggers

| Workflow | Keywords | Agent Chain |
|----------|----------|-------------|
| **BUILD** | implement, create, add, feature | brainstorm → backend/frontend → quality-reviewer → testing |
| **DEBUG** | fix, error, bug, broken, crash | logs-first → devops-architect → quality-reviewer |
| **REVIEW** | review, audit, check, analyze | quality-reviewer → security-checklist |
| **SECURITY** | security, compliance, sensitive data | security-checklist → quality-reviewer |
| **PLAN** | plan, design, architect | brainstorming → architecture-decision-record |

**Conflict Resolution**: SECURITY > DEBUG > REVIEW > BUILD
```

### Section 3: Quick Reference (Condensed)

For each key skill area, include:
- **One code snippet** (most common pattern)
- **Key facts** (tables, naming, settings)
- **Deep dive pointer** to invoke the full skill

Example:
```markdown
#### Database (PostgreSQL)
\`\`\`python
session.execute(text("SELECT * FROM users WHERE id = :id"), {"id": user_id})
\`\`\`
**Tables**: users, subscriptions, events...
**Deep dive**: `/etk:postgresql-master`
```

**Include these areas** (condensed):
- Database (PostgreSQL)
- AWS CLI
- Security & Compliance
- Testing
- API Design
- LangGraph State
- RAG Retrieval

### Section 4: Boundaries (GitHub best practice)
```markdown
### Boundaries

#### Always Do
- Run tests before marking complete
- Use parameterized queries
- Validate compliance for sensitive data changes
- Include type hints
- Filter by tenant ID (tenant isolation)

#### Ask First
- Database schema migrations
- New external dependencies
- Auth changes
- Production config changes

#### Never Do
- Commit secrets
- Log sensitive data
- Skip security for data handling
- Use string interpolation in SQL
```

### Section 5: Commands & Agents Tables

Condensed tables of available commands and agents.

## Execution Steps

### Step 1: Check for Existing AGENTS.md
```
Read: AGENTS.md (if exists)
```

### Step 2: Generate Content

Follow the structure above, keeping total size 4-8KB.

### Step 3: Merge with Existing

**If AGENTS.md exists with markers:**
1. Find marker positions
2. Replace content between markers
3. Preserve content outside markers

**If AGENTS.md exists without markers:**
1. Append new section with markers

**If AGENTS.md doesn't exist:**
1. Create file with header
2. Add etk section
3. Add project-specific placeholder

### Step 4: Write and Confirm

```
✅ AGENTS.md updated with etk hybrid pattern

  Location: ./AGENTS.md
  Size: ~5-6KB (hybrid pattern)

  Structure:
  - Workflow Triggers (5 workflows with priority)
  - Quick Reference (7 key areas, condensed)
  - Boundaries (Always/Ask/Never)
  - Commands & Agents tables

Next steps:
  - Review the generated content
  - Run smoke tests from tests/agents-md-evaluation.md
  - Commit when satisfied
```

## Evaluation

After generating, run the smoke test (5 prompts):

1. "Fix the database connection error" → DEBUG workflow
2. "Add user analytics score field" → BUILD workflow
3. "Query all users by email" → Parameterized query
4. "Review the authentication PR" → REVIEW workflow
5. "How do I accumulate LangGraph state?" → Quick Reference answer

If 4/5 pass, the AGENTS.md is working correctly.

Full evaluation: `tests/agents-md-evaluation.md` (21 test cases)

## Research Basis

| Source | Key Pattern Used |
|--------|------------------|
| Router pattern | Workflow triggers, conflict resolution |
| Vercel | Embedded quick reference, retrieval preference |
| GitHub (2,500 repos) | Boundaries (Always/Ask/Never), concrete examples |
| AGENTS.md spec | Nested files, closest wins, simple format |
| Patronus AI | Non-overlapping roles, clear routing |

---
*Part of etk plugin v1.0.0*
