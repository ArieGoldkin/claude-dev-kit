---
name: pgvector-search
description: (Aspirational) Production hybrid search with PGVector + BM25 using Reciprocal Rank Fusion, metadata filtering, and performance optimization for semantic retrieval
effort: low
paths:
  - "**/migrations/**"
  - "**/models/**"
  - "**/*vector*"
  - "**/*embedding*"
keep-coding-instructions: true
---

> **Aspirational** — these patterns are not yet implemented in the reference platform.

# PGVector Hybrid Search

**Production-grade semantic + keyword search using PostgreSQL**

## Overview

Hybrid search combines **semantic similarity** (vector embeddings) with **keyword matching** (BM25) to achieve better retrieval than either alone.

**Architecture:**
```
Query
  ↓
[Generate embedding] → Vector Search (PGVector) → Top 30 results
  ↓
[Generate ts_query]  → Keyword Search (BM25)    → Top 30 results
  ↓
[Reciprocal Rank Fusion (RRF)] → Merge & re-rank → Top 10 final results
```

## Core Concepts

### 1. Semantic Search (Vector Similarity)

**How it works:**
1. Embed query: `"database indexing strategies"` → `[0.23, -0.15, ..., 0.42]` (1024 dims)
2. Find nearest neighbors: `ORDER BY embedding <=> query_embedding LIMIT 30`
3. Returns: Conceptually similar documents (even with different words)

**Example:**
- Query: "machine learning model training"
- Matches: "neural network optimization", "deep learning techniques"
- Misses: "ML model training" (different embeddings despite similar meaning)

**Strengths:**
- Captures semantic meaning
- Works across languages
- Handles synonyms ("car" matches "automobile")

**Weaknesses:**
- Slow for exact keyword matches
- Sensitive to embedding quality
- Doesn't handle rare technical terms well

---

### 2. Keyword Search (BM25)

**How it works:**
1. Tokenize query: `"database indexing"` → `database & indexing`
2. Full-text search: `WHERE content_tsvector @@ to_tsquery('database & indexing')`
3. Rank by BM25 score (TF-IDF + document length normalization)

**Example:**
- Query: "PostgreSQL B-tree index"
- Matches: Documents with exact phrase "PostgreSQL B-tree index"
- Misses: "Postgres tree-based indexing" (different words)

**Strengths:**
- Fast exact matches
- Handles technical terms well
- Works for rare/specific phrases

**Weaknesses:**
- No semantic understanding
- Requires exact word matches
- Sensitive to typos

---

### 3. Reciprocal Rank Fusion (RRF)

**The Problem:** How do you combine vector scores (0.85) with BM25 scores (42.7)?

**The Solution:** Use **rank** instead of score.

**Formula:** `rrf_score = 1 / (k + rank)` where k=60 (standard smoothing constant). Scores from each retriever are summed per document. Example: rank 3 in vector + rank 7 in BM25 = `1/(60+3) + 1/(60+7) = 0.0308`.

**Why it works:**
- **Rank-based:** Ignores absolute scores (no normalization needed)
- **Symmetric:** Treats both searches equally
- **Robust:** Top results from either search get high scores

**Detailed algorithm and implementation:** See [references/hybrid-search-rrf.md](${CLAUDE_SKILL_DIR}/references/hybrid-search-rrf.md)

---

## Acme's Hybrid Search Implementation

### Database Schema

```sql
-- Chunks table with vector and full-text search
CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES documents(id),
    content TEXT NOT NULL,

    -- Vector embedding (1024 dimensions for Voyage AI)
    embedding vector(1024),

    -- Pre-computed tsvector for full-text search
    content_tsvector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', content)
    ) STORED,

    -- Metadata
    section_title TEXT,
    section_path TEXT,
    chunk_index INT,
    content_type TEXT,  -- 'code_block', 'paragraph', 'list', etc.

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops);  -- Vector search

CREATE INDEX idx_chunks_content_tsvector ON chunks
    USING gin (content_tsvector);  -- Full-text search

CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_content_type ON chunks(content_type);
```

---

### Search Query

The `hybrid_search()` function in `chunk_repository.py` executes a 4-step pipeline via SQLAlchemy:

1. **Vector search** -- cosine distance nearest neighbors (top 30)
2. **Keyword search** -- BM25 via `ts_rank_cd` on pre-computed `content_tsvector` (top 30)
3. **RRF fusion** -- full outer join with `1/(60+rank)` scoring
4. **Fetch full chunks** -- join back to chunks table, return top k

Key design choices: 3x fetch multiplier for better RRF coverage, pre-computed tsvector column (5-10x faster), full outer join to include results from either retriever, and optional content type pre-filtering.

---

## Performance Optimizations

Key optimizations for production pgvector hybrid search pipelines:

- **Pre-computed tsvector column** -- `GENERATED ALWAYS AS` stored column with GIN index. 5-10x faster than computing `to_tsvector()` at query time.
- **HNSW index** (over IVFFlat) -- 10-100x faster queries, scales to millions of vectors. Typical config: `m=16, ef_construction=64`.
- **Iterative index scans** (pgvector 0.8.0) -- `SET hnsw.iterative_scan = 'relaxed_order'` ensures filtered queries return full result sets.
- **Metadata boosting** -- Section title (1.5x), document path (1.15x), and content type (1.2x) boosts applied after RRF. In production systems this improved MRR by ~6%.

**Detailed optimizations and index tuning:** See [references/indexing-strategies.md](${CLAUDE_SKILL_DIR}/references/indexing-strategies.md)
**Metadata filtering and boosting strategies:** See [references/metadata-filtering.md](${CLAUDE_SKILL_DIR}/references/metadata-filtering.md)

---

## Common Patterns

### Pattern 1: Filtered Search

```python
# Search only code blocks
results = await hybrid_search(
    query="binary search implementation",
    query_embedding=embedding,
    content_type_filter=["code_block"]
)
```

### Pattern 2: Similarity Threshold

```python
# Only return results above similarity threshold
MIN_SIMILARITY = 0.75

results = await hybrid_search(query, embedding, top_k=50)
filtered = [
    r for r in results
    if (1 - r.vector_distance) >= MIN_SIMILARITY
][:10]
```

### Pattern 3: Multi-Query Retrieval

```python
# Generate multiple query variations for better recall
queries = generate_query_variations("machine learning")
# ["machine learning", "ML algorithms", "neural networks"]

all_results = []
for q in queries:
    emb = embed(q)
    results = await hybrid_search(q, emb, top_k=5)
    all_results.extend(results)

# De-duplicate and re-rank
final_results = rerank_by_rrf(all_results, top_k=10)
```

---

## Testing Hybrid Search

Test hybrid search using golden dataset evaluation with pass rate and MRR metrics.

**Testing Patterns:** See [references/testing-evaluation.md](${CLAUDE_SKILL_DIR}/references/testing-evaluation.md)

---

## References

### PGVector Documentation
- [PGVector GitHub](https://github.com/pgvector/pgvector)
- [HNSW Index Guide](https://github.com/pgvector/pgvector#hnsw)

### Acme Implementation
- `backend/app/db/repositories/chunk_repository.py` - Hybrid search implementation
- `backend/app/shared/services/search/search_service.py` - Search service layer
- `backend/app/core/constants.py` - Search constants (fetch multiplier, boosting factors)

### Related Skills
- `ai-native-development` - Embeddings and vector concepts
- `database-schema-designer` - Schema design for vector search
- `performance-optimization` - Query optimization strategies

---

**Version:** 1.1.0 (January 2026)
**Status:** Production-ready patterns from Acme's 415-chunk golden dataset
**Updated:** pgvector 0.8.0 iterative scan support
