# AWS Cross-Reference for Sentry Investigation

Skip this entirely when `--skip-aws` is set or the error is purely client-side (JavaScript platform, no server tags).

## Identifying the Lambda

Extract Lambda function name from:
1. Sentry project slug (e.g., `event-publisher-production`)
2. Sentry tags (look for `server_name`, `function_name`, or `transaction`)
3. Stack trace module paths (e.g., `lambdas/core/event-publisher/`)

## CloudWatch Queries

Use the event time window from Sentry (`firstSeen` to `lastSeen`) for all queries.

### Duration metrics

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=$LAMBDA_NAME \
  --start-time $FIRST_SEEN \
  --end-time $LAST_SEEN \
  --period 3600 \
  --statistics Average Maximum p99
```

### Error count

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=$LAMBDA_NAME \
  --start-time $FIRST_SEEN \
  --end-time $LAST_SEEN \
  --period 3600 \
  --statistics Sum
```

### Lambda configuration

```bash
aws lambda get-function-configuration --function-name $LAMBDA_NAME
```

Key fields: `Timeout`, `MemorySize`, `Runtime`, `LastModified`.

## Timeout Analysis

When the Sentry error is a timeout:

1. Get client timeout value (from Sentry breadcrumbs, or known codebase constant)
2. Get server p99 duration from CloudWatch
3. Compute margin = client timeout / server p99
4. **If margin > 10x**: server is NOT the cause — the issue is client-side (auth refresh, backgrounded tab, network)
5. **If margin < 3x**: server latency may contribute — investigate cold starts, downstream calls

## Lambda Health Summary Format

```
| Setting      | Value |
| ------------ | ----- |
| Timeout      | {X} s |
| Memory       | {X} MB |
| Max mem used | ~{X} MB ({pct}%) |
| Max duration | {X} ms |
| Typical p99  | {range} ms |
| Cold start   | ~{X} s |
| Error rate   | {X} errors / {period} |
```
