---
name: ai-native-development
description: "Build AI-first applications with RAG pipelines, embeddings, vector databases, agentic workflows (ReAct, multi-agent, Opus 4.5), LLM integration, prompt engineering, streaming, and cost optimization. Use when: building an AI feature, integrating an LLM, setting up vector search, or designing agent architectures. Triggers on: AI app, LLM integration, RAG, vector database, agentic, prompt engineering, AI-native, semantic search, multi-agent, embeddings pipeline, cost optimization"
effort: medium
paths:
  - "**/*ai*"
  - "**/*llm*"
  - "**/*agent*"
  - "**/*prompt*"
keep-coding-instructions: true
---

# AI-Native Development

## Core Concepts

### Embeddings & Vector Search

See `${CLAUDE_SKILL_DIR}/references/vector-databases.md` for embeddings setup, cosine similarity, chunking strategies, and vector database guides (Pinecone, Chroma, Weaviate, Qdrant).

### RAG (Retrieval-Augmented Generation)

See `${CLAUDE_SKILL_DIR}/references/rag-patterns.md` for basic and advanced RAG patterns, citation strategies, hybrid search with Reciprocal Rank Fusion, conversation memory patterns, and error handling.

### Function Calling & Tool Use

See `${CLAUDE_SKILL_DIR}/references/function-calling.md` for tool definition patterns (OpenAI and Anthropic), function calling loops, parallel and streaming tool execution, input validation with Zod, and error handling.

### Agentic Workflows

Enable LLMs to reason, plan, and take autonomous actions.

**Patterns:**
- **ReAct**: Reasoning + Acting loop with observations
- **Tree of Thoughts**: Explore multiple reasoning paths
- **Multi-Agent**: Specialized agents collaborating on complex tasks
- **Autonomous Agents**: Self-directed goal achievement
- **ML Experiment Loops**: Autonomous iteration on ML metrics using /experiment for hyperparameter tuning, evaluation improvement, and model selection. See `${CLAUDE_SKILL_DIR}/references/ml-experiment-loops.md` for patterns and worked examples.

**Detailed Implementation:** See `${CLAUDE_SKILL_DIR}/references/agentic-workflows.md` for:
- Complete ReAct loop implementation
- Tree of Thoughts exploration
- Multi-agent coordinator patterns
- Agent memory management
- Error recovery and safety guards

### Multi-Agent Orchestration (Opus 4.5)

Advanced multi-agent patterns leveraging Opus 4.5's extended thinking capabilities.

**When to Use Extended Thinking:**
- Coordinating 3+ specialized agents
- Complex dependency resolution between agent outputs
- Dynamic task allocation based on agent capabilities
- Conflict resolution when agents produce contradictory results

**Key Patterns:**
- Orchestrator with dependency graph execution
- Task planning with extended thinking budget
- Conflict detection and resolution
- Adaptive agent selection based on task complexity
- Agent communication bus for coordination

**Detailed Implementation:** See [references/multi-agent-opus.md](${CLAUDE_SKILL_DIR}/references/multi-agent-opus.md) for:
- Complete orchestrator pattern with code examples
- Extended thinking API usage for task planning
- Conflict resolution strategies
- Agent selection algorithms
- Communication protocol implementation

### Streaming Responses

See `../streaming-api-patterns/SKILL.md` for streaming patterns (SSE, backpressure, streaming with function calls).

### Cost Optimization

See `${CLAUDE_SKILL_DIR}/references/observability.md` for cost estimation, budget tracking, model selection strategies, and prompt caching patterns. Use `/experiment` to autonomously iterate on cost reduction strategies with measurable targets.

### Observability & Monitoring

See `${CLAUDE_SKILL_DIR}/references/observability.md` for LangSmith and LangFuse integration, custom logger implementation, performance monitoring, quality evaluation, and debugging.

---

## Templates

Use the provided templates for common AI patterns:

- **`${CLAUDE_SKILL_DIR}/templates/rag-pipeline.ts`** - Basic RAG implementation
- **`${CLAUDE_SKILL_DIR}/templates/agentic-workflow.ts`** - ReAct agent pattern

---

## Examples

### Complete RAG Chatbot

See `${CLAUDE_SKILL_DIR}/examples/chatbot-with-rag/` for a full-stack implementation:
- Vector database setup with document ingestion
- RAG query with citations
- Streaming chat interface
- Cost tracking and monitoring

---

## Common Patterns

### Semantic Caching

Reduce costs by caching similar queries:

```typescript
const cache = new Map<string, { embedding: number[]; response: string }>()

async function cachedRAG(query: string) {
  const queryEmbedding = await createEmbedding(query)

  // Check if similar query exists in cache
  for (const [cachedQuery, cached] of cache.entries()) {
    const similarity = cosineSimilarity(queryEmbedding, cached.embedding)
    if (similarity > 0.95) {
      return cached.response
    }
  }

  // Not cached, perform RAG
  const response = await ragQuery(query)
  cache.set(query, { embedding: queryEmbedding, response })
  return response
}
```

---

## Related Skills

- `streaming-api-patterns` - Real-time AI response streaming
- `llm-patterns` - Evaluation, testing, and streaming patterns
- `/experiment` - Autonomous ML experiment loops for cost optimization and metric improvement

## Next Steps

After mastering AI-Native Development:
1. Explore **Streaming API Patterns** skill for real-time AI responses
2. Use **Type Safety & Validation** skill for AI input/output validation
3. Apply **Edge Computing Patterns** skill for global AI deployment
4. Reference **Observability Patterns** for production monitoring
