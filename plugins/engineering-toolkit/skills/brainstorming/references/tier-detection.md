# Project Tier Detection

**Purpose:** Right-size brainstorming recommendations by detecting project complexity before exploring solutions.

## 3-Tier System

### FOCUSED (Small Change)
**Heuristics:** 1-5 files affected, <500 LOC estimated, single directory scope
**Ceiling:**
- No new abstractions, modules, or services
- Direct implementation using existing patterns
- No new dependencies
**YAGNI rule:** Reject new architectural patterns, new infrastructure

### MODERATE (Feature)
**Heuristics:** 5-15 files, 500-2000 LOC, 2-3 directories
**Ceiling:**
- One new module or service OK, must follow existing patterns
- New dependencies acceptable if well-justified
- Keep existing architecture, extend don't replace
**YAGNI rule:** Reject new architectural patterns, new infrastructure layers

### SIGNIFICANT (System Change)
**Heuristics:** 15+ files, 2000+ LOC, 4+ directories or new domain
**Ceiling:**
- New patterns and services justified, but propose incrementally
- Require phased delivery plan (MVP → iterate)
- New infrastructure acceptable with cost/benefit analysis
**YAGNI rule:** Reject big-bang rewrites, require incremental migration

## Detection Heuristics

### Automated Signals (scan working directory)
- **Directory depth**: Shallow (1-2 levels) → FOCUSED, Deep (4+) → MODERATE/SIGNIFICANT
- **Dependency count**: <10 deps → FOCUSED, 10-50 → MODERATE, 50+ → SIGNIFICANT
- **CI config complexity**: No CI → FOCUSED, Simple CI → MODERATE, Multi-stage CI → SIGNIFICANT
- **README keywords**: "monorepo", "microservices", "distributed" → SIGNIFICANT
- **Existing abstraction count**: Few/none → FOCUSED, Some → MODERATE, Many → SIGNIFICANT

### User Intent Signals
- "Quick fix" / "small change" / "tweak" → FOCUSED
- "New feature" / "add capability" / "implement" → MODERATE
- "Redesign" / "new system" / "architecture" / "migrate" → SIGNIFICANT

### Ambiguity Resolution
When signals conflict, prefer the lower tier to avoid over-engineering.
If uncertain, ask the user: "I'm detecting this as a [tier] change -- does that seem right?"

## YAGNI Gate (Post-Phase-2 Check)

After the user selects an approach in Phase 2, evaluate:

1. **Ceiling check**: Does the proposed approach exceed the tier ceiling?
   - FOCUSED: Proposing new service? → WARN
   - MODERATE: Proposing new architecture pattern? → WARN
   - SIGNIFICANT: Proposing big-bang rewrite? → WARN

2. **Simpler alternative**: Could a simpler approach work for this tier?
   - Present the simpler alternative alongside the proposed approach
   - Let the user choose, but make the trade-off explicit

3. **Escalation**: If the approach genuinely requires a higher tier:
   - Acknowledge: "This is more complex than initially scoped"
   - Suggest: "Consider /brainstorm --deep for comprehensive analysis" (if in Simple Mode)

**Format:**
```
YAGNI Check: [PASS / WARNING]
Detected tier: [FOCUSED / MODERATE / SIGNIFICANT]
Proposed approach complexity: [assessment]
Simpler alternative: [if applicable]
```
