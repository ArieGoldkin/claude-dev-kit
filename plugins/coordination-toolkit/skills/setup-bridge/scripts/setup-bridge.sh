#!/usr/bin/env bash
# setup-bridge.sh — Initialize the coordination bridge directories and marker file.
# Creates the required directory structure and ensures .gitignore excludes coordination data.
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
COORD_DIR="$PROJECT_DIR/.claude/coordination"

# 1. Create required directories
mkdir -p "$COORD_DIR/messages"
mkdir -p "$COORD_DIR/outbox"

# 2. Create bridge-enabled marker
touch "$COORD_DIR/.bridge-enabled"

# 3. Add .claude/coordination/ to .gitignore if not already present
GITIGNORE="$PROJECT_DIR/.gitignore"
if [ -f "$GITIGNORE" ]; then
  if ! grep -qF '.claude/coordination/' "$GITIGNORE"; then
    echo "" >> "$GITIGNORE"
    echo "# Coordination toolkit runtime data" >> "$GITIGNORE"
    echo ".claude/coordination/" >> "$GITIGNORE"
  fi
else
  echo "# Coordination toolkit runtime data" > "$GITIGNORE"
  echo ".claude/coordination/" >> "$GITIGNORE"
fi

echo "Bridge setup complete."
echo "  Messages dir: $COORD_DIR/messages/"
echo "  Outbox dir:   $COORD_DIR/outbox/"
echo "  Marker:       $COORD_DIR/.bridge-enabled"
echo "  .gitignore:   .claude/coordination/ entry ensured"
