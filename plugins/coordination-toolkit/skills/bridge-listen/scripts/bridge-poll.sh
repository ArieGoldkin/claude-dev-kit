#!/usr/bin/env bash
# bridge-poll.sh — Poll for unread coordination messages addressed to this session.
# Checks .claude/coordination/messages/ every INTERVAL seconds.
# Exits 0 on message found, exits 1 on timeout.
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
INBOX="$PROJECT_DIR/.claude/coordination/messages"
SESSION_ID="${CLAUDE_SESSION_ID:-unknown-$$}"
INTERVAL=3
TIMEOUT=300

mkdir -p "$INBOX"
ELAPSED=0

while true; do
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "TIMEOUT: No messages received in ${TIMEOUT}s"
    exit 1
  fi

  for MSG_FILE in "$INBOX"/*.json; do
    [ -f "$MSG_FILE" ] || continue
    TO=$(cat "$MSG_FILE" | grep -o '"to":"[^"]*"' | head -1 | cut -d'"' -f4)
    READ=$(cat "$MSG_FILE" | grep -o '"read":[a-z]*' | head -1 | cut -d: -f2)
    [ "$TO" = "$SESSION_ID" ] || continue
    [ "$READ" = "false" ] || continue

    echo "MESSAGE_RECEIVED"
    cat "$MSG_FILE"

    # Mark as read atomically via temp file + mv
    TMP=$(mktemp "${MSG_FILE}.XXXXXX")
    sed 's/"read":false/"read":true/' "$MSG_FILE" > "$TMP"
    mv "$TMP" "$MSG_FILE"
    exit 0
  done

  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done
