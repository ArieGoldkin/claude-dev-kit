---
name: coaching-conversation-patterns
description: "AI coaching & conversational support — empathetic interactions, safety guardrails, motivational interviewing, SMART goals, crisis handling. Applicable to coaching, therapy, education, customer support."
effort: low
keep-coding-instructions: true
paths:
  - "**/*coach*"
  - "**/*conversation*"
  - "**/*chat*"
  - "prompts/**"
---

# Coaching & Conversational AI Patterns

## Overview

Patterns for building AI-powered conversational experiences that are empathetic, safe, and grounded in user context. Applicable to coaching (health, fitness, education, career), therapy adjuncts, customer support, and any user-facing AI where safety and empathy matter.

**Sensitive-domain note:** If your application handles health data, therapy content, or vulnerable users, pair this skill with `hipaa-compliance-checker` for safeguards around PHI and crisis escalation.

## Core Safety Principles (Non-Negotiable)

### The Three Nevers
1. **Never provide advice outside the system's scope** - No medical/legal/financial advice unless explicitly licensed
2. **Never dismiss safety concerns** - Always escalate crisis indicators to a human
3. **Never promise outcomes** - Avoid guarantees about results

### Safety Detection Pattern
```python
class SafetyCheck(BaseModel):
    passed: bool
    flags: list[str]
    severity: Literal["low", "medium", "high", "critical"]
    action: Literal["proceed", "rephrase", "escalate", "block"]

SAFETY_RULES = {
    "medical_advice": {"severity": "high", "action": "block"},
    "crisis_indicator": {"severity": "critical", "action": "escalate"},
    "harmful_suggestion": {"severity": "high", "action": "block"},
    "dismissive_language": {"severity": "medium", "action": "rephrase"}
}
```

**For complete safety implementation:** See [references/safety-guardrails.md](${CLAUDE_SKILL_DIR}/references/safety-guardrails.md)

---

## Empathetic Response Framework

### The EARS Pattern
- **E**mpathize - Acknowledge the feeling
- **A**ffirm - Validate their experience
- **R**eflect - Mirror understanding
- **S**upport - Offer gentle next step

```python
EARS_TEMPLATE = """
{empathize}  # "I hear that you're feeling frustrated..."
{affirm}     # "It makes sense to feel this way when..."
{reflect}    # "It sounds like what matters most to you is..."
{support}    # "One small step that might help is..."
"""
```

### Tone Calibration
| User State | Tone | Language Style |
|-------------|------|----------------|
| Discouraged | Warm, validating | "It's okay...", "This is hard..." |
| Motivated | Energetic, celebratory | "Amazing!", "You're crushing it!" |
| Anxious | Calm, grounding | "Let's take this one step at a time..." |
| Neutral | Supportive, curious | "How are things going with...?" |

**For response templates:** See [references/empathetic-responses.md](${CLAUDE_SKILL_DIR}/references/empathetic-responses.md)

---

## Coaching Methodologies

### Motivational Interviewing (MI)
Core techniques for behavior change conversations:
- **Open-ended questions** - "What would it mean for you to achieve this goal?"
- **Affirmations** - "You've shown real commitment by..."
- **Reflections** - "So what I'm hearing is..."
- **Summaries** - "Let me make sure I understand..."

### SMART Goal Framework
```python
class SMARTGoal(BaseModel):
    specific: str      # What exactly will you do?
    measurable: str    # How will you track progress?
    achievable: str    # Is this realistic given your situation?
    relevant: str      # Why does this matter to you?
    time_bound: str    # By when?
```

**For methodology details:** See [references/coaching-methodologies.md](${CLAUDE_SKILL_DIR}/references/coaching-methodologies.md)

---

## Conversation State Management

### State Schema
```python
class ConversationState(BaseModel):
    session_id: str
    user_id: str
    turns: list[Turn]
    current_topic: str | None
    sentiment_trajectory: list[str]  # Track sentiment over time
    goals_discussed: list[str]
    commitments_made: list[str]
    needs_human_review: bool
```

### Context Window Strategy
- **Short-term memory**: Last 5 conversation turns (always included)
- **Medium-term memory**: Session goals and commitments (summarized)
- **Long-term memory**: User profile and historical patterns (RAG retrieved)

**For state management patterns:** See [references/conversation-state.md](${CLAUDE_SKILL_DIR}/references/conversation-state.md)

---

## Response Generation Pipeline

```
User Message
     │
     ▼
┌─────────────────┐
│ 1. SAFETY CHECK │ → Crisis? → Escalate to human
│    (rule-based) │ → Out-of-scope? → Redirect response
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. CONTEXT      │ → RAG: user history, goals, progress
│    RETRIEVAL    │ → State: conversation context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. GENERATE     │ → Coaching persona prompt
│    RESPONSE     │ → Tone-appropriate template
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. VALIDATE     │ → Safety check (LLM)
│    & EVALUATE   │ → Empathy score ≥ 7
└────────┬────────┘
         │
         ▼
    Send Response
```

---

## Quality Evaluation

### Evaluation Dimensions
| Dimension | Weight | Threshold | Measurement |
|-----------|--------|-----------|-------------|
| Safety | 40% | = 10/10 | Rule-based + LLM |
| Empathy | 25% | ≥ 7/10 | LLM-as-judge |
| Relevance | 20% | ≥ 8/10 | Context match |
| Actionability | 15% | ≥ 6/10 | Clear next step |

### LLM-as-Judge Prompt
```python
EMPATHY_EVAL_PROMPT = """
Rate this coaching response for empathy (1-10):

User message: {user_message}
Coach response: {coach_response}

Criteria:
- Acknowledges user's feelings (0-3 points)
- Validates their experience (0-3 points)
- Uses warm, supportive language (0-2 points)
- Avoids dismissive or preachy tone (0-2 points)

Return: score (int), reasoning (str)
"""
```

---

## Quick Start

**For safety implementation:**
- Implement crisis detection from [references/safety-guardrails.md](${CLAUDE_SKILL_DIR}/references/safety-guardrails.md)

**For response generation:**
- Start with [templates/coaching-system-prompt.md](${CLAUDE_SKILL_DIR}/templates/coaching-system-prompt.md)
- Adapt tone using [references/empathetic-responses.md](${CLAUDE_SKILL_DIR}/references/empathetic-responses.md)

**For conversation state:**
- Use schema from [templates/conversation-state-schema.json](${CLAUDE_SKILL_DIR}/templates/conversation-state-schema.json)
- Follow patterns in [references/conversation-state.md](${CLAUDE_SKILL_DIR}/references/conversation-state.md)

**For implementation validation:**
- Complete [checklists/coaching-implementation-checklist.md](checklists/coaching-implementation-checklist.md)

---

## Common Mistakes

- **Over-promising**: "This will definitely solve your problem" → Use "many users find..."
- **Being preachy**: "You should try harder" → Use "what feels manageable for you?"
- **Ignoring context**: Generic responses without user history → Always retrieve context
- **Missing safety checks**: Skipping validation → Always run pre-send safety check
- **Robotic tone**: Template-sounding responses → Vary language, use user's name

---

## Related Skills

- `rag-retrieval` - Context retrieval for personalization
- `llm-patterns` - Evaluation, streaming, and testing patterns
- `hipaa-compliance-checker` - Health data security (use when handling PHI)
- `function-calling` - Structured coaching actions

---

**Remember**: Every coaching message may reach someone who is vulnerable. Prioritize safety, lead with empathy, and never replace human judgment for serious concerns.

---

**Skill Version**: 1.0.0
**Last Updated**: 2026-01-23
