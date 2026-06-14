/**
 * Handoff JSON Schema
 *
 * Defines the durable cross-session handoff structure. Written by the
 * PreCompact lifecycle hook before context compaction; read by the
 * SessionStart lifecycle hook on the next session.
 *
 * **HIPAA-aware**: the schema MUST NOT contain PHI. Free-text fields
 * are scrubbed against a blocklist of common PHI patterns (email,
 * phone, SSN-shaped, member-ID-shaped) before write, with detected
 * patterns redacted and a `phi_redacted` flag set.
 *
 * @module lib/handoff-schema
 */

import { logWarn } from './logging.js';

const HOOK_NAME = 'handoff-schema';

/**
 * Current schema version. Bumped only on breaking shape changes.
 */
export const HANDOFF_SCHEMA_VERSION = 1;

/**
 * Trigger that caused the handoff to be written.
 */
export type HandoffTrigger = 'pre-compact' | 'manual' | 'session-end';

/**
 * One row in the open-MR list. Kept minimal so the file stays small.
 */
export interface OpenMr {
  readonly id: string;
  readonly title?: string;
  readonly status?: string;
}

/**
 * The full handoff document written to `.claude/continuity/handoffs/handoff-latest.json`.
 *
 * Designed for machine consumption first (SessionStart reads it) and
 * human-readable second. Free-text fields are explicitly bounded.
 */
export interface HandoffJson {
  readonly schema_version: number;
  readonly session_id: string | null;
  readonly timestamp: string;
  readonly branch: string | null;
  readonly worktree: string;
  readonly dirty_files: ReadonlyArray<string>;
  readonly open_mrs: ReadonlyArray<OpenMr>;
  readonly next_steps: ReadonlyArray<string>;
  readonly blockers: ReadonlyArray<string>;
  readonly compaction_trigger: HandoffTrigger;
  /** Set to true if scrubPHI redacted any field during write. */
  readonly phi_redacted: boolean;
}

/**
 * PHI patterns matched against any free-text field. Each match is
 * redacted with `[REDACTED-<label>]`.
 *
 * Conservative: prefer false positives (over-redact) to false negatives
 * (durable PHI leak across sessions).
 */
const PHI_PATTERNS: ReadonlyArray<{ regex: RegExp; label: string }> = [
  { regex: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, label: 'EMAIL' },
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, label: 'SSN' },
  { regex: /\b\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, label: 'PHONE' },
  { regex: /\bMBR[-_]?\d{4,}\b/gi, label: 'MEMBER-ID' },
  { regex: /\bmember[-_]?id[=:]\s*\S+/gi, label: 'MEMBER-ID' },
  { regex: /\bpatient[-_]?id[=:]\s*\S+/gi, label: 'PATIENT-ID' },
  // 16-digit credit-card-shaped sequences (skip 7-15 to avoid false positives on git hashes etc.)
  { regex: /\b\d{16}\b/g, label: 'CARD' },
];

/**
 * Scrub PHI from a single free-text string. Returns the scrubbed text
 * AND a flag indicating whether any redaction occurred.
 *
 * Stateless and side-effect-free except for the warning log on detection.
 */
export function scrubPHIFromString(value: string): { value: string; redacted: boolean } {
  let scrubbed = value;
  let redacted = false;
  for (const { regex, label } of PHI_PATTERNS) {
    if (regex.test(scrubbed)) {
      redacted = true;
      // Reset lastIndex because we just called test() with a /g regex
      regex.lastIndex = 0;
      scrubbed = scrubbed.replace(regex, `[REDACTED-${label}]`);
    }
  }
  return { value: scrubbed, redacted };
}

/**
 * Scrub PHI from every string-valued field in a handoff. Returns a new
 * handoff with `phi_redacted` set to true if any scrubbing occurred.
 *
 * Walks the arrays (`dirty_files`, `next_steps`, `blockers`,
 * `open_mrs.title|status`) and the scalars (`session_id`, `branch`,
 * `worktree`). Never mutates the input.
 */
export function scrubPHI(handoff: HandoffJson): HandoffJson {
  let anyRedacted = false;

  const scrubArr = (arr: ReadonlyArray<string>): string[] =>
    arr.map((s) => {
      const r = scrubPHIFromString(s);
      if (r.redacted) anyRedacted = true;
      return r.value;
    });

  const scrubMaybe = (s: string | null): string | null => {
    if (s === null) return null;
    const r = scrubPHIFromString(s);
    if (r.redacted) anyRedacted = true;
    return r.value;
  };

  const open_mrs = handoff.open_mrs.map((mr) => {
    const title = mr.title ? scrubPHIFromString(mr.title) : undefined;
    const status = mr.status ? scrubPHIFromString(mr.status) : undefined;
    if (title?.redacted || status?.redacted) anyRedacted = true;
    return {
      id: mr.id,
      ...(title !== undefined && { title: title.value }),
      ...(status !== undefined && { status: status.value }),
    };
  });

  const worktreeScrub = scrubPHIFromString(handoff.worktree);
  if (worktreeScrub.redacted) anyRedacted = true;

  const result: HandoffJson = {
    schema_version: handoff.schema_version,
    session_id: scrubMaybe(handoff.session_id),
    timestamp: handoff.timestamp,
    branch: scrubMaybe(handoff.branch),
    worktree: worktreeScrub.value,
    dirty_files: scrubArr(handoff.dirty_files),
    open_mrs,
    next_steps: scrubArr(handoff.next_steps),
    blockers: scrubArr(handoff.blockers),
    compaction_trigger: handoff.compaction_trigger,
    phi_redacted: anyRedacted || handoff.phi_redacted,
  };

  if (anyRedacted) {
    logWarn(HOOK_NAME, 'PHI patterns detected in handoff content and redacted before write');
  }

  return result;
}

/**
 * Build a handoff document from primitive inputs. Applies PHI scrubbing
 * before returning. Use this rather than constructing the object literal
 * by hand so the scrub step can't be skipped.
 */
export function buildHandoff(input: {
  session_id?: string | null;
  branch?: string | null;
  worktree: string;
  dirty_files?: ReadonlyArray<string>;
  open_mrs?: ReadonlyArray<OpenMr>;
  next_steps?: ReadonlyArray<string>;
  blockers?: ReadonlyArray<string>;
  compaction_trigger: HandoffTrigger;
  timestamp?: string;
}): HandoffJson {
  const raw: HandoffJson = {
    schema_version: HANDOFF_SCHEMA_VERSION,
    session_id: input.session_id ?? null,
    timestamp: input.timestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    branch: input.branch ?? null,
    worktree: input.worktree,
    dirty_files: input.dirty_files ?? [],
    open_mrs: input.open_mrs ?? [],
    next_steps: input.next_steps ?? [],
    blockers: input.blockers ?? [],
    compaction_trigger: input.compaction_trigger,
    phi_redacted: false,
  };
  return scrubPHI(raw);
}

/**
 * Lightweight validator. Returns the handoff if shape is correct, or
 * null if any required field is missing or wrong-typed. Used by
 * SessionStart to defend against corrupted / hand-edited handoff files.
 */
export function validateHandoff(value: unknown): HandoffJson | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Partial<HandoffJson> & Record<string, unknown>;
  if (typeof v.schema_version !== 'number') return null;
  if (v.schema_version > HANDOFF_SCHEMA_VERSION) return null;
  if (typeof v.timestamp !== 'string') return null;
  if (typeof v.worktree !== 'string') return null;
  if (!Array.isArray(v.dirty_files)) return null;
  if (!Array.isArray(v.open_mrs)) return null;
  if (!Array.isArray(v.next_steps)) return null;
  if (!Array.isArray(v.blockers)) return null;
  if (typeof v.compaction_trigger !== 'string') return null;
  if (typeof v.phi_redacted !== 'boolean') return null;
  return v as unknown as HandoffJson;
}

/**
 * Format a handoff into a compact, human-readable summary for the
 * SessionStart hook's additionalContext block. Single string, ~10 lines.
 */
export function formatHandoffSummary(handoff: HandoffJson): string {
  const lines = ['Last session handoff:'];
  lines.push(`  saved: ${handoff.timestamp} (${handoff.compaction_trigger})`);
  if (handoff.branch) lines.push(`  branch: ${handoff.branch}`);
  if (handoff.dirty_files.length > 0) {
    lines.push(`  dirty: ${handoff.dirty_files.length} file(s)`);
  }
  if (handoff.open_mrs.length > 0) {
    lines.push(`  open MRs: ${handoff.open_mrs.map((m) => m.id).join(', ')}`);
  }
  if (handoff.next_steps.length > 0) {
    lines.push('  next steps:');
    for (const step of handoff.next_steps.slice(0, 3)) {
      lines.push(`    - ${step}`);
    }
  }
  if (handoff.blockers.length > 0) {
    lines.push('  blockers:');
    for (const b of handoff.blockers.slice(0, 3)) {
      lines.push(`    - ${b}`);
    }
  }
  if (handoff.phi_redacted) {
    lines.push('  note: PHI patterns redacted at write — verify intended content.');
  }
  return lines.join('\n');
}
