# Deep Mode Phases

**Purpose:** Detailed phase-by-phase instructions for deep brainstorming mode (--deep flag).

Deep mode uses parallel multi-agent analysis to produce comprehensive design recommendations for complex features, architectural decisions, and cross-functional problems.

**Token budget:** ~20-40k tokens, 15-30 minutes

## Table of Contents

- [Phase 0: System Design Interrogation](#phase-0-system-design-interrogation)
- [Phase 1: Codebase Context](#phase-1-codebase-context-optional)
- [Phase 1.5: Divergent Idea Generation](#phase-15-divergent-idea-generation)
- [Phase 2: Multi-Perspective Analysis](#phase-2-multi-perspective-analysis-8-parallel-agents)
- [Phase 3: Synthesis & Coherence](#phase-3-synthesis--coherence-3-parallel-agents)
- [Phase 4: Presentation & Decision Points](#phase-4-presentation--decision-points)
- [Phase 5: Interactive Refinement](#phase-5-interactive-refinement)
- [Checkpoint Resume](#checkpoint-resume)

---

## Phase 0: System Design Interrogation

**Task Tracking:** Create parent task "Brainstorm: [topic]". Create subtask "Phase 0: System Design Interrogation" and set to in_progress. Complete subtask at end of phase.

**Structured 5-dimension assessment** (not conversational like simple mode).

Read `system-design-interrogation.md` for the full framework.

Present formal assessment:

```
+-------------------------------------------------------------+
|  SYSTEM DESIGN INTERROGATION: [Topic]                       |
+-------------------------------------------------------------+
|                                                             |
|  [ ] SCALE        Users? Data volume? Growth?               |
|  [ ] DATA         Storage? Access pattern? Search?          |
|  [ ] SECURITY     Access? Isolation? Sensitive data?         |
|  [ ] UX           Latency? Feedback? Errors?                |
|  [ ] COHERENCE    Layers? Types? Breaking?                  |
|                                                             |
+-------------------------------------------------------------+
```

Ask all 5 dimensions systematically. Document answers before proceeding.

### Prior Decision Probe

Before proceeding to Phase 1, check for prior context:

1. **MCP Memory** (if available): Query for prior brainstorming sessions or architectural decisions related to the topic
2. **Local ADRs**: Search `docs/*/adr/` for related decision records
3. **Brainstorm State**: Check `.claude/context/brainstorm-state.json` for prior sessions

If prior decisions found, present briefly: "Found prior context on [topic]. Build on it or start fresh?"
Do NOT block on memory unavailability — this is purely additive.

### Tier Detection

Scan working directory and classify project tier (FOCUSED/MODERATE/SIGNIFICANT).
Display detected tier in the assessment header. See `tier-detection.md` for heuristics.

---

## Phase 1: Codebase Context (Optional)

**Task Tracking:** Create subtask "Phase 1: Codebase Context", set to in_progress. Complete at phase end. If skipped, mark as completed immediately.

If the topic relates to existing code:
- Search for existing patterns in the working directory
- Check ADRs (`docs/*/adr/`)
- Review relevant architectural decisions

Skip if greenfield feature.

---

## Phase 1.5: Divergent Idea Generation

**Goal:** Generate a wide pool of raw ideas before the structured multi-agent analysis narrows the field.

**Process:**
1. Based on Phase 0 constraints and Phase 1 codebase findings, braindump 8-12 raw ideas
2. Each idea: **Name** — one-liner description (Testability: easy/medium/hard)
3. No evaluation — divergent thinking only, quantity over quality
4. Present numbered list to user
5. Quick feasibility filter: ask user to flag any ideas that are clearly infeasible or off-scope
6. Reduce to 6-10 viable candidates that inform the agent prompts in Phase 2

**Format:**
```
1. **Idea Name** — Brief description (Testability: easy)
2. **Idea Name** — Brief description (Testability: medium)
...up to 8-12 ideas
```

**Feasibility Filter:**
After presenting, ask: "Any of these clearly off the table? I'll feed the remaining candidates into the 8-agent analysis."

Remove user-flagged ideas. Pass surviving candidates (6-10) as additional context to each agent prompt in Phase 2.

---

## Phase 2: Multi-Perspective Analysis (8 Parallel Agents)

Read `agent-prompts.md` for complete agent templates.

Launch ALL 8 agents in ONE message:

**Task Tracking:** Create subtask "Phase 2: Multi-Perspective Analysis (8 agents)", set to in_progress.

1. **Product Manager** - Business value, KPIs, market fit
2. **UX Researcher** - User needs, personas, UX patterns
3. **Backend System Architect** - Lambda, APIs, PostgreSQL, AWS
4. **Frontend UI Developer** - React 19, components, TanStack Query
5. **Security Specialist** - 8-layer defense-in-depth security analysis
6. **Database Architect** - Schema design, migrations, access patterns
7. **Testing Strategist** - Coverage plan, security tests, E2E
8. **Sprint Prioritizer** - MVP, phases, roadmap, MoSCoW

**Agent Instructions:**
```python
# Launch all 8 in parallel (all in ONE message):
Task(subagent_type="product-manager", prompt="[Agent 1 prompt from agent-prompts.md]", run_in_background=true)
Task(subagent_type="ux-researcher", prompt="[Agent 2 prompt]", run_in_background=true)
Task(subagent_type="devops-architect", prompt="[Agent 3 prompt]", run_in_background=true)
Task(subagent_type="ui-developer", prompt="[Agent 4 prompt]", run_in_background=true)
Task(subagent_type="devops-architect", prompt="[Agent 5 Security prompt]", run_in_background=true)
Task(subagent_type="devops-architect", prompt="[Agent 6 Database prompt]", run_in_background=true)
Task(subagent_type="devops-architect", prompt="[Agent 7 Testing prompt]", run_in_background=true)
Task(subagent_type="sprint-prioritizer", prompt="[Agent 8 prompt]", run_in_background=true)
```

Replace `$ARGUMENTS` in prompts with actual topic.

**Wait for all agents to complete** before proceeding.

**Checkpoint:** Write brainstorm state to `.claude/context/brainstorm-state.json` — add "2" to completed_phases, add one-sentence summary of agent consensus.

**Task Tracking:** Update Phase 2 subtask to completed.

### YAGNI Gate

Before synthesis, verify the emerging approach doesn't exceed the detected tier ceiling:
- **FOCUSED**: Agents suggesting new services or abstractions? → Flag for synthesis to simplify
- **MODERATE**: Agents suggesting new architecture patterns? → Flag for synthesis to constrain
- **SIGNIFICANT**: Agents suggesting big-bang rewrites? → Flag for incremental alternative

Pass any YAGNI flags to the synthesis agents so they factor tier constraints into recommendations.

---

## Phase 3: Synthesis & Coherence (3 Parallel Agents)

Read `synthesis-agents.md` for complete synthesis templates.

After collecting all 8 agent results, launch synthesis agents in parallel (all in ONE message):

**Task Tracking:** Create subtask "Phase 3: Synthesis & Coherence (3 agents)", set to in_progress.

1. **Integration Agent** (product-manager) - Synthesize perspectives, recommend approach
2. **Socratic Questioner** (ux-researcher) - Generate clarifying questions
3. **Coherence Reviewer** (quality-reviewer) - Check cross-layer consistency

**Synthesis Instructions:**
```python
# Wait for Phase 2 agents first!

# Then launch synthesis (all 3 in ONE message):
Task(subagent_type="product-manager", prompt="[Synthesis Agent 1 prompt from synthesis-agents.md]", run_in_background=true)
Task(subagent_type="ux-researcher", prompt="[Synthesis Agent 2 prompt]", run_in_background=true)
Task(subagent_type="quality-reviewer", prompt="[Synthesis Agent 3 prompt]", run_in_background=true)
```

**Wait for all synthesis agents to complete.**

**Checkpoint:** Update brainstorm state — add "3" to completed_phases, add one-sentence synthesis summary.

**Task Tracking:** Update Phase 3 subtask to completed.

---

## Phase 4: Presentation & Decision Points

**Task Tracking:** Create subtask "Phase 4: Presentation", set to in_progress. Complete at end of presentation.

Present synthesized findings to user:

```markdown
# Brainstorm Results: [Topic]

## Executive Summary
[From Integration Agent - unified recommendation]

### Recommended Approach
[Synthesized approach with rationale]

### Critical Decisions Needed
1. [Decision 1]
2. [Decision 2]
3. [Decision 3]

## Key Questions to Consider
[From Socratic Questioner]

### Clarifying Questions
- [Question 1]
- [Question 2]

### Trade-off Questions
- [Question 1]
- [Question 2]

## Technical Coherence Review
[From Coherence Reviewer]

### Gaps Identified
- [Gap 1]
- [Gap 2]

### Migration Requirements
[Migration plan]

## Security & Compliance Review
[From Security agent — include if design involves sensitive data:]
- **Data Classification**: [what data is sensitive]
- **Access Control**: [role-based permissions]
- **Encryption**: [at-rest and in-transit status]
- **Audit Trail**: [logging strategy]

[Skip if no sensitive data involved]
```

---

## Phase 5: Interactive Refinement

**Task Tracking:** Create subtask "Phase 5: Interactive Refinement", set to in_progress.

Use AskUserQuestion to present key decisions:

```python
AskUserQuestion(questions=[
  {
    "header": "Approach",
    "question": "Which implementation approach resonates most?",
    "options": [
      {"label": "MVP First (Recommended)", "description": "Ship minimal version quickly, iterate based on feedback"},
      {"label": "Full Build", "description": "Complete implementation upfront with all features"},
      {"label": "Spike First", "description": "Technical proof-of-concept to validate feasibility"}
    ],
    "multiSelect": false
  },
  {
    "header": "Priorities",
    "question": "What matters most for this feature?",
    "options": [
      {"label": "Security", "description": "Compliance, data protection, audit logging"},
      {"label": "Speed", "description": "Ship fast with core features, iterate later"},
      {"label": "Quality", "description": "Comprehensive testing, polish, robustness"},
      {"label": "Scalability", "description": "Build for 10x growth from day one"}
    ],
    "multiSelect": true
  }
])
```

### Refinement Loop

After user answers, evaluate the impact:

**IF answers change fundamental assumptions** (different scale tier, new security requirement, changed data model):
1. Identify which Phase 2 agents are affected (use mapping below)
2. Re-run ONLY those agents with updated constraints (do NOT re-run all 8)
3. Re-run synthesis (Phase 3) with updated agent outputs
4. Present updated design sections only

**Agent-to-change-type mapping:**
| Change Type | Agents to Re-run |
|-------------|-----------------|
| Scale/performance | Backend Architect, Database Architect, Testing Strategist |
| Security/compliance | Security Specialist, Backend Architect, Testing Strategist |
| UX/workflow | UX Researcher, Frontend Developer, Product Manager |
| Data model | Database Architect, Backend Architect, Coherence Reviewer |
| Scope/priority | Sprint Prioritizer, Product Manager |

**IF answers are minor refinements** (priority reordering, MVP scope adjustment):
1. Synthesize changes inline without re-running agents
2. Present updated recommendation

### Exit Criteria

The refinement loop exits when ANY of:
- User explicitly approves the design ("yes", "approve", "looks good", "let's go")
- 2 refinement rounds have completed (present final design, ask for explicit approval)
- User says "stop" or "pause" (save checkpoint, exit gracefully)

### Completion

On exit:
1. TaskUpdate Phase 5 subtask to completed
2. TaskUpdate parent task to completed
3. Delete `.claude/context/brainstorm-state.json` (cleanup)
4. Present final design summary

---

## Checkpoint Resume

**State file:** `.claude/context/brainstorm-state.json`

**On skill start (Deep Mode):**
1. Check if state file exists
2. If exists and topic matches: offer to resume from last completed phase
3. If exists and topic differs: ask user — discard old session or start new?
4. If `--resume` flag with no topic: read topic from state file

**Write checkpoint after:** Phase 1.5, Phase 2, Phase 3 (the expensive phases)

**Checkpoint contents:**
```json
{
  "topic": "string",
  "started": "ISO 8601",
  "mode": "deep",
  "status": "in_progress",
  "completed_phases": ["0", "1", "1.5"],
  "current_phase": "2",
  "phase_summaries": { "0": "one sentence", "1": "one sentence" },
  "refinement_count": 0
}
```

Keep total checkpoint size under 2KB. Phase summaries are single sentences, not full outputs.

**Cleanup:** Delete state file after Phase 5 completion or user explicit discard.

---

## Related References

- `system-design-interrogation.md` — Full 5-dimension framework (Phase 0)
- `agent-prompts.md` — 8 parallel agent prompt templates (Phase 2)
- `synthesis-agents.md` — 3 synthesis agent prompt templates (Phase 3)
- `tier-detection.md` — Project tier detection and YAGNI gate
