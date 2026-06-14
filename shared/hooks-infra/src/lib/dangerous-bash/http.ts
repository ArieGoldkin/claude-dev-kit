/**
 * Destructive-HTTP bash patterns.
 *
 * Closes the gap exposed by the lifeof_jer/Railway incident (2026-04-25) where
 * a Cursor agent issued `curl -X DELETE` against a production API and Cursor's
 * destructive-command guard didn't match it.
 *
 * Scope (intentional):
 *   - curl with -X / --request and a destructive verb (DELETE/PUT/PATCH)
 *   - wget with --method=DELETE/PUT/PATCH
 *   - http / httpie with verb as first positional arg
 *
 * Out of scope:
 *   - `node -e "fetch(..., {method: 'DELETE'})"` and similar inline scripts —
 *     too many forms, low signal-to-noise. A future MR may add a tighter rule.
 *
 * Patterns reuse the same `(?:^|[;&|]\s*|sudo\s+)` anchor as the filesystem
 * category so compound bash and sudo wrappers are caught.
 *
 * @module lib/dangerous-bash/http
 */

import type { Pattern } from './types.js';

export const HTTP_PATTERNS: Pattern[] = [
  // Remote content piped straight into a shell — the canonical supply-chain
  // RCE (`curl … | sh`). Matches any later pipe segment so `| sudo bash`
  // and flagged forms (`bash -s -- …`) are caught too.
  {
    regex: /\b(?:curl|wget)\b[^\n]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|dash|ksh)\b/i,
    category: 'http',
    description: 'remote content piped to a shell (curl|sh supply-chain RCE)',
  },
  // Remote content piped into an interpreter's stdin-as-code form (bare or
  // `-`). Argument forms (`python -m json.tool`, `python script.py`) read
  // stdin as data, not code, and stay allowed.
  {
    regex:
      /\b(?:curl|wget)\b[^\n]*\|\s*(?:sudo\s+)?(?:python3?|perl|ruby|node)(?:\s+-)?\s*(?:[;&|]|$)/i,
    category: 'http',
    description: 'remote content piped to an interpreter as code (curl|python RCE)',
  },
  // curl with -X / --request followed by a destructive verb. Tolerates the
  // glued (`-XDELETE`) and equals (`--request=DELETE`) forms.
  {
    regex:
      /(?:^|[;&|]\s*|sudo\s+)curl\b[^\n]*?\s+(?:-X\s*|--request[\s=]\s*)(?:DELETE|PUT|PATCH)\b/i,
    category: 'http',
    description:
      'curl with destructive HTTP verb (DELETE/PUT/PATCH) — blocks agent-driven API mutations',
  },
  // wget --method=DELETE/PUT/PATCH
  {
    regex: /(?:^|[;&|]\s*|sudo\s+)wget\b[^\n]*?\s+--method=(?:DELETE|PUT|PATCH)\b/i,
    category: 'http',
    description: 'wget with destructive HTTP verb (DELETE/PUT/PATCH)',
  },
  // httpie: `http DELETE ...` or `httpie PUT ...`
  {
    regex: /(?:^|[;&|]\s*|sudo\s+)(?:http|httpie)\s+(?:DELETE|PUT|PATCH)\b/i,
    category: 'http',
    description: 'httpie with destructive HTTP verb (DELETE/PUT/PATCH)',
  },
];
