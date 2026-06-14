---
description: Display review history statistics from the review-logger hook
---

# Review Stats

Read and display statistics from the review history log.

## Step 1: Read Log File

```bash
# Aggregate review history from all plugin log directories
REVIEW_LOGS=$(find "$HOME/.claude/logs" -name "review-history.jsonl" 2>/dev/null)

if [ -z "$REVIEW_LOGS" ]; then
  echo "No review history found in ~/.claude/logs/*/review-history.jsonl"
  echo "Run /review-mr to generate review data."
  exit 0
fi

# Merge all log files into a temp file for analysis
REVIEW_LOG=$(mktemp)
cat $REVIEW_LOGS > "$REVIEW_LOG"
trap "rm -f $REVIEW_LOG" EXIT
```

## Step 2: Compute Basic Stats

```bash
# Total reviews
TOTAL=$(wc -l < "$REVIEW_LOG" | tr -d ' ')

# Reviews by type
APPROVALS=$(grep -c '"command_type":"approve"' "$REVIEW_LOG" || echo 0)
NOTES=$(grep -c '"command_type":"note"' "$REVIEW_LOG" || echo 0)
# "discussion" is the type emitted when /etk:post-mr-comments posts inline-anchored
# comments via the GitLab discussions API (ctk review-logger 2.6.2+). This is the
# real posting path, so it is typically the dominant count.
DISCUSSIONS=$(grep -c '"command_type":"discussion"' "$REVIEW_LOG" || echo 0)

# Recent activity (last 7 and 30 days)
WEEK_AGO=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)
MONTH_AGO=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d)

LAST_7=$(awk -v d="$WEEK_AGO" '$0 ~ "\"timestamp\":\"" && substr($0, index($0,"\"timestamp\":\"")+14, 10) >= d' "$REVIEW_LOG" | wc -l | tr -d ' ')
LAST_30=$(awk -v d="$MONTH_AGO" '$0 ~ "\"timestamp\":\"" && substr($0, index($0,"\"timestamp\":\"")+14, 10) >= d' "$REVIEW_LOG" | wc -l | tr -d ' ')
```

## Step 3: Compute Advanced Stats (if jq available)

```bash
if command -v jq &>/dev/null; then
  UNIQUE_MRS=$(jq -r '.mr_number' "$REVIEW_LOG" | sort -u | wc -l | tr -d ' ')
  TOP_MRS=$(jq -r '.mr_number' "$REVIEW_LOG" | sort | uniq -c | sort -rn | head -5)
  RECENT=$(jq -r '[.timestamp[:10], "!", .mr_number, .command_type] | join(" ")' "$REVIEW_LOG" | tail -10 | tac)
fi
```

## Step 4: Output Report

```markdown
# Review History Stats

| Metric | Value |
|--------|-------|
| Total Reviews | $TOTAL |
| Inline Comments (discussions) | $DISCUSSIONS |
| Approvals | $APPROVALS |
| Review Comments (notes) | $NOTES |
| Unique MRs | $UNIQUE_MRS |
| Last 7 Days | $LAST_7 |
| Last 30 Days | $LAST_30 |

## Recent Reviews (Last 10)

| Date | MR | Action |
|------|----|--------|
[for each entry in $RECENT:]
| $date | !$mr_number | $command_type |

## Most Reviewed MRs

[for each in $TOP_MRS:]
| !$mr_number | $count reviews |

---
Source: ~/.claude/logs/*/review-history.jsonl
```
