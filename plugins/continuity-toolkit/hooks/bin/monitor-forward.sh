#!/bin/sh
# Forward hook events to session monitor via HTTP (silent on failure)
#
# Uses curl instead of Claude Code's native "type: http" to control error
# handling — no ECONNREFUSED noise when the monitor isn't running.
#
# Configure the endpoint:
#   CONTINUITY_MONITOR_URL=https://monitor.example.com/events  (production)
#   CONTINUITY_MONITOR_URL=http://localhost:3117/events         (local dev)
#   unset / empty = disabled, no HTTP call made
#
MONITOR_URL="${CONTINUITY_MONITOR_URL:-}"

# Skip silently if no URL configured
[ -z "$MONITOR_URL" ] && exit 0

# POST stdin (hook payload) to monitor — silent on any failure
curl -sf -o /dev/null --max-time 2 -X POST \
  -H "Content-Type: application/json" \
  "$MONITOR_URL" -d @- 2>/dev/null
exit 0
