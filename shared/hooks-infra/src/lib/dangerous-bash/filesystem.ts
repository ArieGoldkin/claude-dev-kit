/**
 * Filesystem-destructive bash patterns.
 *
 * Extracted verbatim from the historical `DANGEROUS_COMMAND_PATTERNS` array in
 * `hooks/pretool/security-blocker.ts`. Order matches the original declaration
 * order so the first-matching-pattern semantics are preserved across the
 * registry refactor.
 *
 * @module lib/dangerous-bash/filesystem
 */

import type { Pattern } from './types.js';

export const FILESYSTEM_PATTERNS: Pattern[] = [
  // rm -rf / variants. Anchors tolerate compound bash ("cmd && rm -rf /"),
  // sudo, the `command` builtin wrapper, and absolute binary paths
  // ("/bin/rm -rf /") — the latter two escaped the original anchor (audit P1).
  {
    regex:
      /(?:^|[;&|]\s*|sudo\s+|command\s+)(?:\/(?:[\w.-]+\/)*)?rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive.*--force|-rf)\s+\//,
    category: 'filesystem',
    description: 'rm -rf on root / absolute path',
  },
  {
    regex:
      /(?:^|[;&|]\s*|sudo\s+|command\s+)(?:\/(?:[\w.-]+\/)*)?rm\s+(-[a-zA-Z]*f[a-zA-Z]*r|--force.*--recursive|-fr)\s+\//,
    category: 'filesystem',
    description: 'rm -fr on root / absolute path',
  },
  {
    regex:
      /(?:^|[;&|]\s*|sudo\s+|command\s+)(?:\/(?:[\w.-]+\/)*)?rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-rf)\s+~/,
    category: 'filesystem',
    description: 'rm -rf on home directory',
  },
  {
    regex:
      /(?:^|[;&|]\s*|sudo\s+|command\s+)(?:\/(?:[\w.-]+\/)*)?rm\s+(-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*|-fr)\s+~/,
    category: 'filesystem',
    description: 'rm -fr on home directory',
  },
  // rm with SPLIT recursive+force flags ("rm -r -f /", "rm --recursive
  // --force ~") — the combined-token patterns above never matched these
  // (audit P1: flag tokenization). Both flag orders, root or home target.
  {
    regex:
      /(?:^|[;&|]\s*|sudo\s+|command\s+)(?:\/(?:[\w.-]+\/)*)?rm\s+(?:--?[a-zA-Z][a-zA-Z-]*\s+)*-(?:[a-zA-Z]*r[a-zA-Z]*|-recursive)\s+(?:--?[a-zA-Z][a-zA-Z-]*\s+)*-(?:[a-zA-Z]*f[a-zA-Z]*|-force)\s+[/~]/,
    category: 'filesystem',
    description: 'rm with split recursive+force flags (e.g. rm -r -f /) on root or home',
  },
  {
    regex:
      /(?:^|[;&|]\s*|sudo\s+|command\s+)(?:\/(?:[\w.-]+\/)*)?rm\s+(?:--?[a-zA-Z][a-zA-Z-]*\s+)*-(?:[a-zA-Z]*f[a-zA-Z]*|-force)\s+(?:--?[a-zA-Z][a-zA-Z-]*\s+)*-(?:[a-zA-Z]*r[a-zA-Z]*|-recursive)\s+[/~]/,
    category: 'filesystem',
    description: 'rm with split force+recursive flags (e.g. rm -f -r /) on root or home',
  },
  // rmdir on system root / critical paths (CC v2.1.116 alignment).
  // CC's auto-allow previously bypassed dangerous-path check for rmdir; our
  // hook denies rmdir on root and critical paths defense-in-depth.
  {
    regex: /(?:^|[;&|]\s*|sudo\s+)rmdir\s+(-p\s+)?\/\s*$/,
    category: 'filesystem',
    description: 'rmdir on root',
  },
  {
    regex:
      /(?:^|[;&|]\s*|sudo\s+)rmdir\s+(-p\s+)?\/(?:private\/(?:etc|var|tmp|home)|etc|var|System|usr|bin|sbin|boot)/,
    category: 'filesystem',
    description: 'rmdir on critical system path',
  },
  // Direct device writes (compound-aware)
  {
    regex: /(?:^|[;&|]\s*|sudo\s+)dd\s+.*of=\/dev\//,
    category: 'filesystem',
    description: 'dd writing to a device file',
  },
  {
    regex: /(?:^|[;&|]\s*|sudo\s+)mkfs\./,
    category: 'filesystem',
    description: 'mkfs filesystem creation',
  },
  {
    regex: /(?:^|[;&|]\s*|sudo\s+)format\s+\/dev\//,
    category: 'filesystem',
    description: 'format on a device file',
  },
  // Fork bomb
  {
    regex: /:\(\)\{.*:\|:.*\};:/,
    category: 'filesystem',
    description: 'fork bomb pattern',
  },
  // Dangerous redirects/moves (compound-aware)
  {
    regex: /(?:^|[;&|]\s*|sudo\s+)mv\s+.*\s+\/dev\/null/,
    category: 'filesystem',
    description: 'mv to /dev/null (data destruction)',
  },
  // Dangerous permission changes (compound-aware). Target covers absolute
  // paths AND home (`chmod -R 777 ~`); anchor covers `command` + binary
  // paths like the rm patterns above (audit P1).
  {
    regex: /(?:^|[;&|]\s*|sudo\s+|command\s+)(?:\/(?:[\w.-]+\/)*)?chmod\s+-R\s+777\s+[/~]/,
    category: 'filesystem',
    description: 'chmod -R 777 on absolute path or home',
  },
  {
    regex: /chown\s+-R\s+root\s+\//,
    category: 'filesystem',
    description: 'chown -R root on absolute path',
  },
  // Direct disk writes
  {
    regex: />\s*\/dev\/sda/,
    category: 'filesystem',
    description: 'redirect to /dev/sda (disk overwrite)',
  },
  // Network redirects via /dev/tcp and /dev/udp (CC v2.1.98 alignment).
  // These bash pseudo-devices enable covert network connections:
  // exec 3<>/dev/tcp/host/port, cat < /dev/tcp/host/80, echo > /dev/udp/host/53
  {
    regex: /\/dev\/tcp\//,
    category: 'filesystem',
    description: '/dev/tcp pseudo-device (covert network connection)',
  },
  {
    regex: /\/dev\/udp\//,
    category: 'filesystem',
    description: '/dev/udp pseudo-device (covert network connection)',
  },
];
