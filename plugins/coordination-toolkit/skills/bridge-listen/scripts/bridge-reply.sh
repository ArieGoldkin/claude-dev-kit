#!/usr/bin/env bash
# bridge-reply.sh — Send a reply message to a peer session via the coordination bridge.
# Usage: bridge-reply.sh <recipient-session-id> <reply-content> <original-message-id>
set -euo pipefail

if [ $# -lt 3 ]; then
  echo "Usage: $0 <recipient-session-id> <reply-content> <original-message-id>"
  echo "  \$1 = recipient session ID (the 'from' field of the received message)"
  echo "  \$2 = reply content text"
  echo "  \$3 = original message ID (for inReplyTo field)"
  exit 1
fi

RECIPIENT="$1"
CONTENT="$2"
IN_REPLY_TO="$3"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
OUTBOX="$PROJECT_DIR/.claude/coordination/messages"
SESSION_ID="${CLAUDE_SESSION_ID:-unknown-$$}"

mkdir -p "$OUTBOX"

# Generate unique message ID from timestamp + random nonce
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NONCE=$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')
MSG_ID="msg-${NONCE}"

MSG_FILE="$OUTBOX/${MSG_ID}.json"

cat > "$MSG_FILE" <<JSONEOF
{"id":"${MSG_ID}","from":"${SESSION_ID}","to":"${RECIPIENT}","content":"${CONTENT}","timestamp":"${TIMESTAMP}","read":false,"type":"response","inReplyTo":"${IN_REPLY_TO}"}
JSONEOF

echo "Reply sent: ${MSG_FILE}"
