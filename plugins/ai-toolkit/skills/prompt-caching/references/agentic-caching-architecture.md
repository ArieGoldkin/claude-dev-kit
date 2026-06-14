# Agentic Prompt Caching Architecture

## Table of Contents

- [Core Principle](#core-principle)
- [The Layering Rule](#the-layering-rule)
- [Six Rules for Cache-Friendly Agents](#six-rules-for-cache-friendly-agents)
  - [Rule 1: Never Modify the System Prompt Mid-Conversation](#rule-1-never-modify-the-system-prompt-mid-conversation)
  - [Rule 2: Never Add or Remove Tools Mid-Conversation](#rule-2-never-add-or-remove-tools-mid-conversation)
  - [Rule 3: Never Switch Models Mid-Conversation](#rule-3-never-switch-models-mid-conversation)
  - [Rule 4: Don't Put Dynamic Data in the Static Prefix](#rule-4-dont-put-dynamic-data-in-the-static-prefix)
  - [Rule 5: Design Features as Tools, Not Prompt Modifications](#rule-5-design-features-as-tools-not-prompt-modifications)
  - [Rule 6: Use Lightweight Stubs for Optional Tools](#rule-6-use-lightweight-stubs-for-optional-tools)
- [Chat Agent: Cache-Friendly Architecture](#chat-agent-cache-friendly-architecture)
  - [Prompt Structure](#prompt-structure)
  - [Cost Impact (Estimated)](#cost-impact-estimated)
  - [Cache Preservation on Session Resumption](#cache-preservation-on-session-resumption)
  - [Compaction Strategy](#compaction-strategy)
- [Applicability Assessment](#applicability-assessment)
- [Key Takeaway](#key-takeaway)

> Source: ["Lessons from Building Claude Code: Prompt Caching Is Everything"](https://x.com/trq212/status/2024574133011673516) by Thariq Shihipar (Anthropic), Feb 2026
> Secondary: [TechTwitter analysis](https://www.techtwitter.com/articles/lessons-from-building-claude-code-prompt-caching-is-everything), [Simon Willison quote](https://simonwillison.net/2026/Feb/20/thariq-shihipar/)

## Core Principle

Long-running agentic products are made feasible by prompt caching, which reuses computation from previous roundtrips to significantly decrease latency and cost. Prompt caching is prefix-match based — the API caches everything from the start of the request up to each `cache_control` breakpoint. **The order you put things in matters enormously.**

## The Layering Rule

Static content first, dynamic content last. Each layer is a cache boundary:

```
Layer 1 — Globally cached (identical across all sessions):
├── System prompt: persona, safety rules, behavioral guidelines
├── Tool definitions: all tools, always present, never modified
│
Layer 2 — Project/user cached (stable per session):
├── Project context, user profile, domain data
│
Layer 3 — Session cached (stable within one conversation):
├── Session-specific state, injected system messages
│
Layer 4 — Volatile (changes every turn):
└── Conversation messages (user + assistant turns)
```

## Six Rules for Cache-Friendly Agents

### Rule 1: Never Modify the System Prompt Mid-Conversation

Inject updates as system messages in later turns, not by rewriting the prompt.

```python
# BAD — breaks the cached prefix every time
system_prompt = f"Today is {date}. You are an assistant for {user_name}..."

# GOOD — static prefix stays cached, dynamic data in messages
system_prompt = "You are a helpful AI assistant. Follow best practices..."
# Then inject per-session:
messages.append({
    "role": "system",
    "content": f"User: Jane. Context: project planning. Today: Feb 20."
})
```

### Rule 2: Never Add or Remove Tools Mid-Conversation

Tool definitions are part of the cached prefix. Changing them invalidates the entire conversation cache.

```python
# BAD — dynamically adding tools breaks cache
if crisis_detected:
    tools.append(escalate_to_human)

# GOOD — all tools always present, model decides when to use them
tools = [
    task_tracker,         # used every session
    data_lookup,          # used sometimes
    schedule_appointment, # used rarely
    escalate_to_human,    # used in emergencies only
]
```

### Rule 3: Never Switch Models Mid-Conversation

Caches are model-specific. Use subagents for model transitions.

```python
# BAD — switching models kills the cache
response = client.messages.create(model="claude-sonnet-4-6", ...)  # turn 1-5
response = client.messages.create(model="claude-opus-4-7", ...)    # turn 6 — cache gone

# GOOD — subagent with separate cache
main_session = SonnetSession(conversation)       # maintains its cache
summary = HaikuSubagent("Summarize data")  # separate API call, own cache
main_session.inject_message(summary.result)       # main cache intact
```

### Rule 4: Don't Put Dynamic Data in the Static Prefix

Timestamps, shuffled tool orders, and updated parameters in the system prompt break prefix matching.

```python
# BAD — timestamp in system prompt changes every minute
system = f"Current time: {datetime.now()}. You are a helpful assistant..."

# BAD — non-deterministic tool ordering
tools = random.shuffle(all_tools)

# GOOD — static prompt, timestamp injected as system message
system = "You are a helpful assistant..."  # never changes
messages.append({"role": "system", "content": f"Current time: {datetime.now()}"})
```

### Rule 5: Design Features as Tools, Not Prompt Modifications

State changes should be tool calls, not system prompt rewrites.

```
Example from Claude Code:
- EnterPlanMode and ExitPlanMode are TOOLS, not prompt modifications
- The tool definitions never change — only the model's behavior does
- This keeps the cached prefix stable

Applied to any agent:
- "Switch to planning mode" = tool call, not prompt rewrite
- "Enable escalation protocol" = always-present tool, not injected prompt
```

### Rule 6: Use Lightweight Stubs for Optional Tools

Send `defer_loading: true` stubs. Full schemas load only when the model selects them via a discovery tool (ToolSearch pattern).

```python
# Full tool definitions for core tools
tools = [task_tracker, data_lookup]

# Lightweight stubs for rarely-used tools
tools.append({
    "name": "send_notification",
    "defer_loading": True  # model calls ToolSearch to get full schema
})
```

## Chat Agent: Cache-Friendly Architecture

### Prompt Structure

```
┌─────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT (globally cached)                         │
│                                                         │
│ Persona: helpful AI assistant                           │
│ Method: structured problem-solving                      │
│ Safety: follow content policy guidelines                │
│ Escalation: route to human when confidence is low       │
│ Compliance: follow data handling requirements           │
│ Tone: professional, clear, supportive                   │
├─────────────────────────────────────────────────────────┤
│ TOOLS (globally cached, never modified)                 │
│                                                         │
│ task_tracker, data_lookup, schedule_appointment,        │
│ escalate_to_human, send_notification, progress_report   │
├─────────────────────────────────────────────────────────┤
│ USER CONTEXT (session-cached, injected as sys msg)      │
│                                                         │
│ Profile: Jane, project manager                          │
│ Goals: complete Q1 planning, review team capacity       │
│ History: 12 sessions, last check-in 3 days ago          │
│ Preferences: morning check-ins, prefers text            │
├─────────────────────────────────────────────────────────┤
│ CONVERSATION (volatile, changes every turn)             │
│                                                         │
│ User: "I finished two of the three tasks this week"     │
│ Assistant: "That's great progress! Two tasks is..."     │
│ User: "I couldn't get to the third one due to meetings" │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

### Cost Impact (Estimated)

```
30-turn chat session, ~3K token system prompt + tools:

Without caching:
  30 turns × 3K cached prefix = 90K redundant tokens processed
  At $3/MTok input = $0.27 wasted per session

With caching (90% hit rate):
  1 cache write (3K × 1.25x) + 29 cache reads (3K × 0.1x)
  = $0.01125 + $0.0087 = ~$0.02 for prefix across session
  Savings: ~$0.25 per session (93% reduction)

At 10,000 sessions/month:
  Without: $2,700/mo in redundant prefix processing
  With:    $200/mo
  Savings: $2,500/mo
```

### Cache Preservation on Session Resumption

When a user returns to continue a previous conversation:

```python
# Rebuild with IDENTICAL prefix (tools + system prompt)
# This reuses the globally cached prefix from any recent session
messages = [
    {"role": "system", "content": STATIC_SYSTEM_PROMPT},  # cached hit
]
# Then inject session context
messages.append({
    "role": "system",
    "content": f"Resuming session with {user.name}. Last topic: {summary}"
})
# Then replay or summarize prior conversation
messages.append({"role": "user", "content": prior_summary})
```

### Compaction Strategy

When conversation gets long, fork with preserved prefix:

```python
def compact_conversation(messages, system_prompt, tools):
    """Compact while preserving cached prefix."""
    # 1. Summarize old messages
    summary = summarize(messages[:-10])

    # 2. Rebuild with SAME system prompt and tools (cache hit)
    new_messages = [
        {"role": "system", "content": system_prompt},  # identical = cached
        {"role": "system", "content": f"Prior context: {summary}"},
        *messages[-10:]  # keep recent turns
    ]
    return new_messages
    # tools parameter unchanged = prefix still cached
```

## Applicability Assessment

| Lesson | Plugin Impact | Chat Agent Impact |
|--------|--------------|---------------------|
| Static prompt first | Low (CLAUDE.md already lean) | **High** — defines architecture |
| Don't modify tools | N/A (plugin doesn't control) | **High** — define all tools upfront |
| Don't switch models | N/A (Claude Code manages) | **High** — use subagents pattern |
| System messages for updates | Already doing (hooks) | **High** — user data injection |
| `defer_loading` stubs | Future (no plugin API yet) | **Medium** — for rarely-used tools |
| Monitor cache hit rates | N/A (no visibility) | **High** — critical cost metric |
| Compaction preserves prefix | Already doing (PreCompact) | **High** — session resumption |

## Key Takeaway

> "A high prompt cache hit rate decreases costs and helps create more generous rate limits for subscription plans. We run alerts on our prompt cache hit rate and declare SEVs if they're too low." — Thariq, Anthropic

For any long-running agentic product (chat assistants, workflow coordinators, customer support), caching architecture is not an optimization — it's a **feasibility requirement**.
