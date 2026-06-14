---
name: langgraph
description: "LangGraph workflow patterns for stateful multi-step LLM workflows. State schemas (TypedDict/Pydantic), conditional routing, parallel fan-out/fan-in, human-in-the-loop gates, checkpointing, and supervisor agents. Use when: building LangGraph workflows, adding approval steps, coordinating agents, or persisting state. Triggers on: LangGraph, workflow graph, conditional routing, human-in-loop, checkpointing, supervisor agent, state machine, fan-out"
effort: low
paths:
  - "**/*graph*"
  - "**/*langgraph*"
  - "**/*workflow*"
keep-coding-instructions: true
---

# LangGraph Patterns

LangGraph is a framework for building stateful, multi-step workflows with LLMs. It models
workflows as directed graphs where nodes are functions and edges define control flow. Use it
when you need conditional routing, parallel execution, human approval gates, or persistent
state across workflow steps.

## Quick Reference

| Pattern | Description | Reference |
|---------|-------------|-----------|
| State Management | TypedDict/Pydantic schemas, reducers, MessagesState | [references/state-management.md](${CLAUDE_SKILL_DIR}/references/state-management.md) |
| Conditional Routing | Branching, retry loops, quality gates, END fallbacks | [references/routing.md](${CLAUDE_SKILL_DIR}/references/routing.md) |
| Parallel Execution | Fan-out/fan-in, Send API, map-reduce, error isolation | [references/parallel-execution.md](${CLAUDE_SKILL_DIR}/references/parallel-execution.md) |
| Human-in-the-Loop | Interrupt points, approval gates, feedback loops, API integration | [references/human-in-loop.md](${CLAUDE_SKILL_DIR}/references/human-in-loop.md) |
| Checkpoints | MemorySaver, PostgresSaver, Store, crash recovery, debugging | [references/checkpoints.md](${CLAUDE_SKILL_DIR}/references/checkpoints.md) |
| Supervisor | Coordinator agents, round-robin/priority dispatch, LLM-based routing | [references/supervisor.md](${CLAUDE_SKILL_DIR}/references/supervisor.md) |

## Pattern Summaries

### State Management

Design workflow state with TypedDict (lightweight, internal) or Pydantic (validated, boundaries).
Use `Annotated[list, add]` for accumulating results across nodes and `MessagesState` for chat workflows.
See [references/state-management.md](${CLAUDE_SKILL_DIR}/references/state-management.md).

### Conditional Routing

Route execution dynamically with `add_conditional_edges`. Patterns include quality gates
(pass/fail/retry), retry loops with max attempts, and state-based routers. Always include an
END fallback. See [references/routing.md](${CLAUDE_SKILL_DIR}/references/routing.md).

### Parallel Execution

Run independent nodes concurrently with fan-out/fan-in or the `Send` API for dynamic
parallelism. Use `asyncio.gather` with `return_exceptions=True` for error isolation and
per-branch timeouts. See [references/parallel-execution.md](${CLAUDE_SKILL_DIR}/references/parallel-execution.md).

### Human-in-the-Loop

Pause workflows for human review using `interrupt_before`. Resume with `update_state` after
approval. Supports multiple approval points, feedback loops with retry, and API endpoints for
external review systems. See [references/human-in-loop.md](${CLAUDE_SKILL_DIR}/references/human-in-loop.md).

### Checkpoints

Persist workflow state with MemorySaver (dev) or PostgresSaver (prod). Use thread IDs for
resume/recovery. Store provides cross-thread long-term memory (user preferences, learned facts)
separate from thread-scoped checkpoints. See [references/checkpoints.md](${CLAUDE_SKILL_DIR}/references/checkpoints.md).

### Supervisor

Coordinate multiple specialist agents through a central supervisor node. Supports round-robin,
priority-based, and LLM-based routing with structured output. Workers always return to the
supervisor for next assignment. See [references/supervisor.md](${CLAUDE_SKILL_DIR}/references/supervisor.md).

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| State type | TypedDict internally, Pydantic at boundaries |
| Messages | Use `MessagesState` or `add_messages` reducer |
| Accumulators | `Annotated[list, add]` for multi-agent results |
| Routing functions | Keep pure, no side effects |
| Retry limits | 2-3 for LLM calls, always have END fallback |
| Parallel limit | 5-10 concurrent branches |
| Error isolation | `return_exceptions=True`, per-branch timeouts (30-60s) |
| Human review timeout | 24-48h, auto-reject after timeout |
| Dev checkpointer | MemorySaver (fast, no setup) |
| Prod checkpointer | PostgresSaver (shared, durable) |
| Long-term memory | Store (cross-thread, namespaced) |
| Supervisor routing | Round-robin for uniform, priority for critical-first |
| Agent count | 3-8 specialists per supervisor |

## Examples

See [examples/](${CLAUDE_SKILL_DIR}/examples/) for complete workflow implementations:
- `supervisor-workflow.md` -- End-to-end supervisor workflow

## Related Skills

- `multi-agent-orchestration` -- Fan-out/fan-in and synthesis patterns
- `agent-loops` -- Single agent ReAct loop patterns
- `type-safety-validation` -- Pydantic patterns
- `api-design-framework` -- Review API design
- `database-schema-designer` -- PostgreSQL setup
