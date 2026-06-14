# Multi-Agent Orchestration with Opus 4.7

## Table of Contents

- [When to Use Extended Thinking](#when-to-use-extended-thinking)
- [Orchestrator Pattern](#orchestrator-pattern)
- [Task Planning with Extended Thinking](#task-planning-with-extended-thinking)
- [Conflict Resolution](#conflict-resolution)
- [Adaptive Agent Selection](#adaptive-agent-selection)
- [Agent Communication Protocol](#agent-communication-protocol)
- [Best Practices](#best-practices)
  - [Orchestration](#orchestration)
  - [Agent Selection](#agent-selection)
  - [Communication](#communication)

Advanced multi-agent patterns leveraging Opus 4.5's extended thinking capabilities.

## When to Use Extended Thinking

- Coordinating 3+ specialized agents
- Complex dependency resolution between agent outputs
- Dynamic task allocation based on agent capabilities
- Conflict resolution when agents produce contradictory results

## Orchestrator Pattern

```typescript
interface AgentTask {
  id: string;
  type: 'research' | 'code' | 'review' | 'design';
  input: unknown;
  dependencies: string[]; // Task IDs that must complete first
}

interface AgentResult {
  taskId: string;
  output: unknown;
  confidence: number;
  reasoning: string;
}

async function orchestrateAgents(
  goal: string,
  availableAgents: Agent[]
): Promise<AgentResult[]> {
  // Step 1: Use extended thinking to decompose goal into tasks
  const taskPlan = await planTasks(goal, availableAgents);

  // Step 2: Build dependency graph
  const dependencyGraph = buildDependencyGraph(taskPlan.tasks);

  // Step 3: Execute tasks respecting dependencies
  const results: AgentResult[] = [];
  const completed = new Set<string>();

  while (completed.size < taskPlan.tasks.length) {
    // Find tasks with satisfied dependencies
    const ready = taskPlan.tasks.filter(task =>
      !completed.has(task.id) &&
      task.dependencies.every(dep => completed.has(dep))
    );

    // Execute ready tasks in parallel
    const batchResults = await Promise.all(
      ready.map(task => executeAgentTask(task, availableAgents))
    );

    // Validate results - use extended thinking for conflicts
    const validatedResults = await validateAndResolveConflicts(
      batchResults,
      results
    );

    results.push(...validatedResults);
    ready.forEach(task => completed.add(task.id));
  }

  return results;
}
```

## Task Planning with Extended Thinking

Based on [Anthropic's Extended Thinking documentation](https://platform.claude.com/docs/en/build-with-claude/extended-thinking):

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

async function planTasks(
  goal: string,
  agents: Agent[]
): Promise<{ tasks: AgentTask[]; rationale: string }> {
  // Opus 4.7 uses adaptive extended thinking — the model chooses when to think.
  // Fixed budget_tokens is deprecated in 4.7; steer depth via prompt language
  // ("Think carefully step-by-step" / "Prioritize responding quickly") instead.
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7', // Or claude-sonnet-4-6
    max_tokens: 16000,
    thinking: {
      type: 'enabled' // Adaptive: no fixed budget_tokens
    },
    messages: [{
      role: 'user',
      content: `
        Goal: ${goal}

        Available agents and their capabilities:
        ${agents.map(a => `- ${a.name}: ${a.capabilities.join(', ')}`).join('\n')}

        Decompose this goal into tasks. For each task, specify:
        1. Which agent should handle it
        2. What input it needs
        3. Which other tasks it depends on
        4. Expected output format

        Think carefully about:
        - Optimal parallelization opportunities
        - Potential conflicts between agent outputs
        - Information that needs to flow between tasks
      `
    }]
  });

  // Response contains thinking blocks followed by text blocks
  // content: [{ type: 'thinking', thinking: '...' }, { type: 'text', text: '...' }]
  return parseTaskPlan(response);
}
```

## Conflict Resolution

```typescript
async function validateAndResolveConflicts(
  newResults: AgentResult[],
  existingResults: AgentResult[]
): Promise<AgentResult[]> {
  // Check for conflicts with existing results
  const conflicts = detectConflicts(newResults, existingResults);

  if (conflicts.length === 0) {
    return newResults;
  }

  // Use extended thinking to resolve conflicts (adaptive in Opus 4.7)
  const resolution = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8000,
    thinking: {
      type: 'enabled' // Adaptive thinking; model chooses depth
    },
    messages: [{
      role: 'user',
      content: `
        The following agent outputs conflict:

        ${conflicts.map(c => `
          Conflict: ${c.description}
          Agent A (${c.agentA.name}): ${JSON.stringify(c.resultA)}
          Agent B (${c.agentB.name}): ${JSON.stringify(c.resultB)}
        `).join('\n\n')}

        Analyze each conflict and determine:
        1. Which output is more likely correct and why
        2. If both have merit, how to synthesize them
        3. What additional verification might be needed
      `
    }]
  });

  return applyResolutions(newResults, resolution);
}
```

## Adaptive Agent Selection

```typescript
async function selectOptimalAgent(
  task: AgentTask,
  agents: Agent[],
  context: ExecutionContext
): Promise<Agent> {
  // Score each agent based on:
  // - Capability match
  // - Current load
  // - Historical performance on similar tasks
  // - Cost (model tier)

  const scores = agents.map(agent => ({
    agent,
    score: calculateAgentScore(agent, task, context)
  }));

  // For complex tasks, use Opus; for simple tasks, use Haiku
  const complexity = assessTaskComplexity(task);

  if (complexity > 0.7) {
    // Filter to agents that can use Opus
    const opusCapable = scores.filter(s => s.agent.supportsOpus);
    return opusCapable.sort((a, b) => b.score - a.score)[0].agent;
  }

  return scores.sort((a, b) => b.score - a.score)[0].agent;
}
```

## Agent Communication Protocol

```typescript
interface AgentMessage {
  from: string;
  to: string | 'broadcast';
  type: 'request' | 'response' | 'update' | 'conflict';
  payload: unknown;
  timestamp: Date;
}

class AgentCommunicationBus {
  private messages: AgentMessage[] = [];
  private subscribers: Map<string, (msg: AgentMessage) => void> = new Map();

  send(message: AgentMessage): void {
    this.messages.push(message);

    if (message.to === 'broadcast') {
      this.subscribers.forEach(callback => callback(message));
    } else {
      this.subscribers.get(message.to)?.(message);
    }
  }

  subscribe(agentId: string, callback: (msg: AgentMessage) => void): void {
    this.subscribers.set(agentId, callback);
  }

  getHistory(agentId: string): AgentMessage[] {
    return this.messages.filter(
      m => m.from === agentId || m.to === agentId || m.to === 'broadcast'
    );
  }
}
```

## Best Practices

### Orchestration
- Start with extended thinking for task decomposition
- Use parallel execution where dependencies allow
- Implement conflict detection before result aggregation

### Agent Selection
- Match agent capabilities to task requirements
- Consider cost-performance trade-offs
- Use simpler models for straightforward tasks

### Communication
- Keep message payloads small and structured
- Use broadcast sparingly (high fan-out)
- Implement message history for debugging
