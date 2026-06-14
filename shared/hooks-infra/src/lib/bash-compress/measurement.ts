/**
 * Token-savings measurement spike.
 *
 * Append-only JSONL logger that records two event shapes:
 *
 *   1. Spike A validation — Read tool cache hits/misses with byte counts so
 *      we can quantify actual delta-cache savings in the field, not just
 *      "the hook fired" qualitative signals.
 *
 *   2. Spike B feasibility — Bash tool output sizes per command prefix so we
 *      can decide whether building bash output compression is worth it
 *      *before* writing the compression handlers.
 *
 * Storage: `~/.claude/cache/token-compress/<session-id>/measurements.jsonl`
 * Same directory tree as Spike A's reads.jsonl, so the existing 48h eviction
 * (in lib/read-cache/cache-store.ts) cleans both up.
 *
 * Privacy guarantees:
 *
 * - We never log full output content. Only byte counts.
 * - For Bash events: only the binary name (first whitespace-delimited token)
 *   is recorded as `commandPrefix`. Full command lines often carry secrets
 *   (`aws --profile prod ...`, `psql postgres://user:pass@host/db ...`).
 * - For Read events: only `basename + extension`, never the full path.
 * - Output is run through a credential pre-scan. If any line matches a
 *   credential pattern, we set `outputBytes: null` and `redacted: true` —
 *   the size itself can correlate with content under specific circumstances
 *   (e.g. a fixed-format token), so erring on the side of dropping the
 *   measurement is correct for high-signal credential lines.
 *
 * All write paths are best-effort. Logging failures must never break the
 * user's tool call: the cache directory may be missing, the disk may be
 * full, fs may be read-only — every error path swallows quietly.
 *
 * @module lib/bash-compress/measurement
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureSessionDir, getSessionDir } from '../read-cache/cache-store.js';

const MEASUREMENTS_FILE = 'measurements.jsonl';

/**
 * Credential patterns. Conservative — false positives just drop a measurement,
 * which is acceptable. False negatives could leak via correlated size signals
 * if we ever extend the schema to include first/last line, so prefer over-
 * triggering.
 */
const CREDENTIAL_PATTERNS: RegExp[] = [
  // KEY=long-base64-or-hex (env var leak)
  /(?:^|[\s'"`])[A-Z][A-Z0-9_]{3,}=[A-Za-z0-9+/_-]{20,}/m,
  // Bearer / Authorization
  /\b(?:Bearer|Authorization)\s+[A-Za-z0-9._~+/-]{20,}/i,
  // AWS access key (AKIA…) and secret key shapes
  /\bAKIA[0-9A-Z]{16}\b/,
  /\baws_secret_access_key\b\s*[:=]\s*\S{20,}/i,
  // Generic api/secret/token=…
  /\b(?:api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*['"]?\S{16,}/i,
  // Postgres / Mongo connection strings with embedded creds
  /(?:postgres|postgresql|mongodb)(?:\+srv)?:\/\/[^/\s:]+:[^@\s]+@/i,
  // Private key headers
  /-----BEGIN (?:RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/,
];

export type ReadEvent = {
  schemaVersion: 1;
  timestamp: string;
  tool: 'Read';
  outcome: 'cache_hit' | 'cache_miss';
  /** basename(filePath), e.g. "page.tsx" — never the full absolute path */
  basename: string;
  originalBytes: number;
  /** For cache_hit only: bytes of the diff (or full file if delta exceeded). */
  returnedBytes?: number;
  /** For cache_hit only: 0–100 integer percent saved. */
  savingsPct?: number;
};

export type BashEvent = {
  schemaVersion: 1;
  timestamp: string;
  tool: 'Bash';
  /** First whitespace-delimited token from the command, e.g. "git", "pytest" */
  commandPrefix: string;
  /** Bytes of the bash command string (input to the tool). */
  inputBytes: number;
  /** Bytes of stdout+stderr concatenated. `null` if the credential scan tripped. */
  outputBytes: number | null;
  /** True iff a credential pattern matched and we suppressed the size. */
  redacted: boolean;
  /** Tool execution duration in ms (from PostToolUse `duration_ms` if available). */
  durationMs?: number;
};

export type Measurement = ReadEvent | BashEvent;

/**
 * Returns the path to the measurements JSONL for the given session. Mirrors
 * the existing read-cache pattern so eviction picks it up.
 */
export function getMeasurementsPath(sessionId: string): string {
  return path.join(getSessionDir(sessionId), MEASUREMENTS_FILE);
}

/**
 * Extract the binary name from a bash command. Returns the first whitespace-
 * delimited token, stripped of any leading `sudo`, env-var-prefix, or path.
 *
 * - `sudo aws s3 ls` → `aws`
 * - `FOO=1 BAR=2 npm test` → `npm`
 * - `/usr/local/bin/python3 -m pytest` → `python3`
 * - `git status` → `git`
 */
export function extractCommandPrefix(command: string): string {
  if (!command) return '<empty>';
  const trimmed = command.trim();
  if (!trimmed) return '<empty>';

  // Walk past sudo / env-var prefixes.
  const tokens = trimmed.split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'sudo') {
      i += 1;
      continue;
    }
    // env-var assignment: KEY=value (value may be empty)
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t ?? '')) {
      i += 1;
      continue;
    }
    break;
  }

  const binToken = tokens[i] ?? '<empty>';
  // Strip any leading path: `/usr/local/bin/python3` → `python3`
  const basename = binToken.split('/').pop() ?? binToken;
  return basename;
}

/**
 * Returns true if the candidate text contains a credential pattern.
 */
export function containsCredential(text: string): boolean {
  if (!text) return false;
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Append a single measurement record to the per-session JSONL. Best-effort.
 * Any I/O error is swallowed — the caller must not be coupled to disk
 * availability.
 */
function appendMeasurement(sessionId: string, record: Measurement): void {
  if (!sessionId || sessionId === 'unknown') return;
  try {
    ensureSessionDir(sessionId);
    const line = `${JSON.stringify(record)}\n`;
    fs.appendFileSync(getMeasurementsPath(sessionId), line, { mode: 0o600 });
  } catch {
    // Silent. Measurement is opportunistic, never load-bearing.
  }
}

/**
 * Record a Read tool event. Caller passes raw byte counts; we compute the
 * savings percentage internally so the math is in one place.
 */
export function recordReadEvent(
  sessionId: string,
  filePath: string,
  outcome: 'cache_hit' | 'cache_miss',
  originalBytes: number,
  returnedBytes?: number
): void {
  const basename = path.basename(filePath || '<unknown>');
  const event: ReadEvent = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    tool: 'Read',
    outcome,
    basename,
    originalBytes: Math.max(0, originalBytes | 0),
  };
  if (outcome === 'cache_hit' && returnedBytes !== undefined && originalBytes > 0) {
    event.returnedBytes = Math.max(0, returnedBytes | 0);
    const saved = Math.max(0, originalBytes - event.returnedBytes);
    event.savingsPct = Math.min(100, Math.round((saved / originalBytes) * 100));
  }
  appendMeasurement(sessionId, event);
}

/**
 * Record a Bash tool event. The `output` is scanned for credential patterns;
 * if any match, the size is suppressed (set to null) and `redacted: true`.
 *
 * @param sessionId  - Current session id
 * @param command    - Full bash command string (used to derive prefix only)
 * @param output     - Full bash stdout+stderr (used to scan for creds + size)
 * @param durationMs - Optional duration from PostToolUse hook input
 */
export function recordBashEvent(
  sessionId: string,
  command: string,
  output: string,
  durationMs?: number
): void {
  const prefix = extractCommandPrefix(command);
  const inputBytes = Buffer.byteLength(command || '', 'utf8');
  const outputBytes = Buffer.byteLength(output || '', 'utf8');
  const redacted = containsCredential(output);

  const event: BashEvent = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    tool: 'Bash',
    commandPrefix: prefix,
    inputBytes,
    outputBytes: redacted ? null : outputBytes,
    redacted,
  };
  if (durationMs !== undefined && durationMs >= 0) {
    event.durationMs = durationMs | 0;
  }
  appendMeasurement(sessionId, event);
}
