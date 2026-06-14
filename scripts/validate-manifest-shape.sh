#!/usr/bin/env bash
# Reject top-level `themes` or `monitors` keys in plugin manifests.
#
# Claude Code v2.1.129 moved these keys under an `experimental` parent and
# silently drops them when they appear at the manifest root. This guard
# fails CI before a release ships with the keys in the wrong location.
#
# Usage:
#   scripts/validate-manifest-shape.sh                # scan all plugin manifests
#   scripts/validate-manifest-shape.sh <file.json>    # scan one file
#
# Exit codes:
#   0 — all manifests pass
#   1 — at least one manifest has a top-level themes/monitors key
#   2 — environment error (jq missing, file unreadable)

set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required but not installed" >&2
  exit 2
fi

FORBIDDEN_KEYS=(themes monitors)
FAIL=0
CHECKED=0

check_manifest() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "error: $file does not exist" >&2
    exit 2
  fi
  CHECKED=$((CHECKED + 1))
  for key in "${FORBIDDEN_KEYS[@]}"; do
    if jq -e --arg k "$key" 'has($k)' "$file" >/dev/null 2>&1; then
      echo "FAIL  $file: top-level \"$key\" found — must be nested under \"experimental\" (CC v2.1.129+)"
      FAIL=1
    fi
  done
}

if [ "$#" -gt 0 ]; then
  for arg in "$@"; do
    check_manifest "$arg"
  done
else
  shopt -s nullglob
  for manifest in plugins/*/.claude-plugin/plugin.json; do
    check_manifest "$manifest"
  done
  if [ "$CHECKED" -eq 0 ]; then
    echo "error: no plugin manifests found at plugins/*/.claude-plugin/plugin.json" >&2
    exit 2
  fi
fi

if [ "$FAIL" -eq 0 ]; then
  echo "OK    $CHECKED manifest(s) pass: no top-level themes/monitors"
fi
exit "$FAIL"
