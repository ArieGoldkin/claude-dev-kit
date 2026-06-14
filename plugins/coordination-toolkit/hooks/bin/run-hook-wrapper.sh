#!/bin/sh
# Coordination Plugin - Resilient Hook Wrapper
set -eu

SAFE_JSON='{"continue":true,"suppressOutput":true}'

if [ -z "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  CLAUDE_PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
  export CLAUDE_PLUGIN_ROOT
fi

export CLAUDE_PLUGIN_NAME="coordination"
export CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS="${CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS:-5000}"

# Stable session ID fallback: $PPID is the Claude Code process PID,
# consistent across all hook invocations from the same session.
# Without this, the fallback ${process.pid} in Node changes on every
# hook call since each is a new subprocess.
if [ -z "${CLAUDE_SESSION_ID:-}" ]; then
  export CLAUDE_SESSION_ID="$PPID"
fi

HOOK_NAME="${1:-}"

if [ -z "$HOOK_NAME" ]; then
  echo "$SAFE_JSON"
  exit 0
fi

# Fast-path: skip Node entirely for bridge-message-checker when bridge is not enabled.
# This avoids process startup overhead on every PostToolUse when the feature is off.
if [ "$HOOK_NAME" = "posttool/bridge-message-checker" ]; then
  BRIDGE_MARKER="${CLAUDE_PROJECT_DIR:-.}/.claude/coordination/.bridge-enabled"
  if [ ! -f "$BRIDGE_MARKER" ]; then
    echo "$SAFE_JSON"
    exit 0
  fi
fi

HOOK_RUNNER="$CLAUDE_PLUGIN_ROOT/hooks/dist/bin/run-hook.js"
if [ ! -f "$HOOK_RUNNER" ]; then
  echo '{"continue":true,"systemMessage":"⚠ coordination-toolkit: compiled hooks not found. Run: cd hooks && npm run build"}'
  exit 0
fi

# Resolve node binary — probe common locations when not on bare PATH
resolve_node() {
  if [ -n "${CLAUDE_NODE_PATH:-}" ] && [ -x "$CLAUDE_NODE_PATH" ]; then echo "$CLAUDE_NODE_PATH"; return 0; fi
  if command -v node >/dev/null 2>&1; then command -v node; return 0; fi
  for p in /usr/local/bin/node /usr/bin/node /opt/homebrew/bin/node; do [ -x "$p" ] && echo "$p" && return 0; done
  for nvm_dir in "${NVM_DIR:-$HOME/.nvm}" "$HOME/.nvm" "/usr/local/share/nvm"; do
    if [ -d "$nvm_dir/versions/node" ]; then
      latest=$(ls -1 "$nvm_dir/versions/node" 2>/dev/null | sort -V | tail -1)
      [ -n "$latest" ] && [ -x "$nvm_dir/versions/node/$latest/bin/node" ] && echo "$nvm_dir/versions/node/$latest/bin/node" && return 0
    fi
  done
  if [ -d "${FNM_DIR:-$HOME/.fnm}/node-versions" ]; then
    latest=$(ls -1 "${FNM_DIR:-$HOME/.fnm}/node-versions" 2>/dev/null | sort -V | tail -1)
    [ -n "$latest" ] && [ -x "${FNM_DIR:-$HOME/.fnm}/node-versions/$latest/installation/bin/node" ] && echo "${FNM_DIR:-$HOME/.fnm}/node-versions/$latest/installation/bin/node" && return 0
  fi
  [ -x "${VOLTA_HOME:-$HOME/.volta}/bin/node" ] && echo "${VOLTA_HOME:-$HOME/.volta}/bin/node" && return 0
  return 1
}
NODE_BIN=$(resolve_node) || NODE_BIN=""
if [ -z "$NODE_BIN" ]; then
  WARN_MARKER="/tmp/.claude-plugin-node-warn-${PPID:-0}"
  if [ ! -f "$WARN_MARKER" ]; then
    echo '{"continue":true,"systemMessage":"⚠ coordination-toolkit: node not found. Install Node.js or set CLAUDE_NODE_PATH in settings.json env. Checked: PATH, /usr/local/bin, nvm, fnm, volta."}'
    touch "$WARN_MARKER" 2>/dev/null || true
  else echo "$SAFE_JSON"; fi
  exit 0
fi

INPUT=""
if [ ! -t 0 ]; then
  INPUT=$(cat)
fi

OUTPUT=""
if [ -n "$INPUT" ]; then
  OUTPUT=$(printf '%s' "$INPUT" | "$NODE_BIN" "$HOOK_RUNNER" "$HOOK_NAME" 2>/dev/null) || true
else
  OUTPUT=$("$NODE_BIN" "$HOOK_RUNNER" "$HOOK_NAME" 2>/dev/null) || true
fi

if [ -n "$OUTPUT" ] && printf '%s\n' "$OUTPUT" | head -1 | grep -q '^{'; then
  printf '%s\n' "$OUTPUT" | grep '^{' | tail -1
else
  echo "$SAFE_JSON"
fi

exit 0
