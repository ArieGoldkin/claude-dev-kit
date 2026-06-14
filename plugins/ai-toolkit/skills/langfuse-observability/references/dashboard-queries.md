# Monitoring Dashboard Queries

## Table of Contents

- [Cost Analysis](#cost-analysis)
  - [Top 10 Most Expensive Traces (Last 7 Days)](#top-10-most-expensive-traces-last-7-days)
  - [Average Cost by Agent Type](#average-cost-by-agent-type)
  - [Daily Cost Trend](#daily-cost-trend)
- [Quality Metrics](#quality-metrics)
  - [Quality Scores Trend](#quality-scores-trend)
  - [Low-Quality Traces (Scores < 0.7)](#low-quality-traces-scores--07)
- [Performance Metrics](#performance-metrics)
  - [Slowest Traces (P95 Latency)](#slowest-traces-p95-latency)
  - [Error Rate by Trace Type](#error-rate-by-trace-type)
- [Token Usage](#token-usage)
  - [Token Usage by Model](#token-usage-by-model)
  - [Prompt Version Comparison](#prompt-version-comparison)

SQL queries for Langfuse analytics and monitoring dashboards.

## Cost Analysis

### Top 10 Most Expensive Traces (Last 7 Days)

```sql
SELECT
    name,
    user_id,
    calculated_total_cost,
    input_tokens,
    output_tokens
FROM traces
WHERE timestamp > NOW() - INTERVAL '7 days'
ORDER BY calculated_total_cost DESC
LIMIT 10;
```

### Average Cost by Agent Type

```sql
SELECT
    metadata->>'agent_type' as agent,
    COUNT(*) as traces,
    AVG(calculated_total_cost) as avg_cost,
    SUM(calculated_total_cost) as total_cost
FROM traces
WHERE metadata->>'agent_type' IS NOT NULL
GROUP BY agent
ORDER BY total_cost DESC;
```

### Daily Cost Trend

```sql
SELECT
    DATE(timestamp) as date,
    COUNT(*) as trace_count,
    SUM(calculated_total_cost) as total_cost,
    AVG(calculated_total_cost) as avg_cost
FROM traces
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date;
```

## Quality Metrics

### Quality Scores Trend

```sql
SELECT
    DATE(timestamp) as date,
    AVG(value) FILTER (WHERE name = 'relevance') as avg_relevance,
    AVG(value) FILTER (WHERE name = 'depth') as avg_depth,
    AVG(value) FILTER (WHERE name = 'factuality') as avg_factuality
FROM scores
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date;
```

### Low-Quality Traces (Scores < 0.7)

```sql
SELECT
    t.id,
    t.name,
    t.user_id,
    s.name as score_name,
    s.value as score_value
FROM traces t
JOIN scores s ON t.id = s.trace_id
WHERE s.value < 0.7
  AND t.timestamp > NOW() - INTERVAL '7 days'
ORDER BY s.value ASC
LIMIT 20;
```

## Performance Metrics

### Slowest Traces (P95 Latency)

```sql
SELECT
    name,
    COUNT(*) as count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as p50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99
FROM traces
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY name
ORDER BY p95 DESC;
```

### Error Rate by Trace Type

```sql
SELECT
    name,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'error') as errors,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'error') / COUNT(*), 2) as error_rate
FROM traces
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY name
HAVING COUNT(*) > 10
ORDER BY error_rate DESC;
```

## Token Usage

### Token Usage by Model

```sql
SELECT
    model,
    COUNT(*) as generations,
    SUM(input_tokens) as total_input,
    SUM(output_tokens) as total_output,
    AVG(input_tokens) as avg_input,
    AVG(output_tokens) as avg_output
FROM generations
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY model
ORDER BY total_output DESC;
```

### Prompt Version Comparison

```sql
SELECT
    metadata->>'prompt_version' as version,
    COUNT(*) as traces,
    AVG(calculated_total_cost) as avg_cost,
    AVG(s.value) as avg_score
FROM traces t
LEFT JOIN scores s ON t.id = s.trace_id AND s.name = 'relevance'
WHERE metadata->>'prompt_version' IS NOT NULL
  AND t.timestamp > NOW() - INTERVAL '7 days'
GROUP BY version
ORDER BY version;
```
