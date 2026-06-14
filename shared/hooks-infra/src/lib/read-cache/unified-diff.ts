/**
 * Unified-diff renderer for the delta cache.
 *
 * Pure functions only — no I/O, no module-level state. Implements a
 * minimal Myers-style longest-common-subsequence (LCS) walk to produce
 * a diff envelope of the form:
 *
 *     @@ N lines changed (+A/-R) @@
 *      unchanged
 *     -removed
 *     +added
 *      unchanged
 *
 * The header carries only the change counts. The caller is responsible
 * for prepending file context (e.g. "in src/foo.ts:") before injection.
 *
 * Two budgets gate the output:
 *
 * - {@link MAX_DELTA_LINES} — max input length on either side. Past this
 *   we don't even attempt LCS; an O(N*M) walk on multi-megabyte files
 *   would burn too much CPU per hook call.
 * - {@link MAX_DELTA_CHARS} — max rendered diff length. Past this the
 *   caller should fall through to a full read; the diff has lost its
 *   token-savings purpose.
 *
 * @module lib/read-cache/unified-diff
 */

import type { DeltaResult } from './types.js';

/** Maximum number of lines on either side before we bail to `too-large`. */
export const MAX_DELTA_LINES = 2000;

/** Maximum rendered diff length in characters before we bail to `too-large`. */
export const MAX_DELTA_CHARS = 1500;

/** Context lines emitted around each change hunk (currently 1). */
const CONTEXT_LINES = 1;

/**
 * Split content into lines, preserving line endings as data-bearing.
 *
 * We intentionally do not normalize CRLF/LF — a trailing-newline change
 * or a line-ending flip is a real diff and must surface as such. The
 * splitter therefore breaks on `\n` and the consumer must remember that
 * a trailing empty string after a final `\n` represents "file ends with
 * newline".
 */
function splitLines(content: string): string[] {
  if (content.length === 0) {
    return [];
  }
  return content.split('\n');
}

/**
 * Compute the LCS table for two line arrays.
 *
 * Standard O(N*M) DP. The cell `table[i][j]` holds the LCS length for
 * `oldLines[0..i)` against `newLines[0..j)`. We size both dimensions to
 * `len+1` so the zero-row/zero-column form the base case.
 */
function computeLcsTable(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const table: number[][] = [];
  for (let i = 0; i <= m; i++) {
    table.push(new Array(n + 1).fill(0));
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const row = table[i];
      const prevRow = table[i - 1];
      // The fill above guarantees rows are present; the non-null assertions
      // satisfy `noUncheckedIndexedAccess` without runtime cost.
      if (!row || !prevRow) {
        continue;
      }
      if (oldLines[i - 1] === newLines[j - 1]) {
        row[j] = (prevRow[j - 1] ?? 0) + 1;
      } else {
        row[j] = Math.max(prevRow[j] ?? 0, row[j - 1] ?? 0);
      }
    }
  }

  return table;
}

/** Internal token used while back-walking the LCS table. */
type DiffOp =
  | { kind: 'eq'; line: string }
  | { kind: 'add'; line: string }
  | { kind: 'del'; line: string };

/** Mutable cursor used while back-walking the LCS table. */
interface LcsCursor {
  i: number;
  j: number;
}

/** Read the score from a (i, j) cell, treating out-of-bounds as -1. */
function cellScore(table: number[][], i: number, j: number): number {
  if (i < 0 || j < 0) return -1;
  return table[i]?.[j] ?? 0;
}

/**
 * Take one step of the back-walk and return the emitted op (if any).
 *
 * Splitting this out flattens the control flow in {@link walkLcsToOps}
 * — the outer loop becomes a simple "step until done" while each
 * possible action lives in its own branch here.
 */
function stepBackwalk(
  table: number[][],
  oldLines: string[],
  newLines: string[],
  cursor: LcsCursor
): DiffOp {
  const oldLine = cursor.i > 0 ? oldLines[cursor.i - 1] : undefined;
  const newLine = cursor.j > 0 ? newLines[cursor.j - 1] : undefined;

  // Equal cell — step diagonally and emit an `eq` op.
  if (cursor.i > 0 && cursor.j > 0 && oldLine === newLine && oldLine !== undefined) {
    cursor.i--;
    cursor.j--;
    return { kind: 'eq', line: oldLine };
  }

  // Choose the higher-score neighbour. Ties favour delete-first which
  // keeps the canonical "delete then add" ordering humans expect.
  const upScore = cellScore(table, cursor.i - 1, cursor.j);
  const leftScore = cellScore(table, cursor.i, cursor.j - 1);

  if (cursor.i > 0 && (cursor.j === 0 || upScore >= leftScore)) {
    cursor.i--;
    return { kind: 'del', line: oldLine ?? '' };
  }
  cursor.j--;
  return { kind: 'add', line: newLine ?? '' };
}

/**
 * Walk the LCS table backwards to produce the ordered op stream.
 *
 * The complex per-step logic lives in {@link stepBackwalk}; this loop
 * just iterates until both indices reach zero and reverses the result
 * to restore forward order.
 */
function walkLcsToOps(table: number[][], oldLines: string[], newLines: string[]): DiffOp[] {
  const ops: DiffOp[] = [];
  const cursor: LcsCursor = { i: oldLines.length, j: newLines.length };
  while (cursor.i > 0 || cursor.j > 0) {
    ops.push(stepBackwalk(table, oldLines, newLines, cursor));
  }
  ops.reverse();
  return ops;
}

/**
 * Mark ops within `CONTEXT_LINES` of any non-eq op as "to keep".
 *
 * Returns a parallel boolean array of length `ops.length`.
 */
function markKeep(ops: DiffOp[]): boolean[] {
  const keep = new Array<boolean>(ops.length).fill(false);
  for (let idx = 0; idx < ops.length; idx++) {
    if (ops[idx]?.kind === 'eq') continue;
    const start = Math.max(0, idx - CONTEXT_LINES);
    const end = Math.min(ops.length - 1, idx + CONTEXT_LINES);
    for (let k = start; k <= end; k++) {
      keep[k] = true;
    }
  }
  return keep;
}

/**
 * Trim a stream of ops down to context-only blocks around changes.
 *
 * For each contiguous run of `eq` ops between change blocks, we keep
 * `CONTEXT_LINES` lines on either side. Leading and trailing all-equal
 * ranges (no neighbouring change) are dropped entirely — they would
 * just inflate the diff with content the caller already had.
 */
function applyContext(ops: DiffOp[]): DiffOp[] {
  if (ops.length === 0) return ops;
  const keep = markKeep(ops);
  const result: DiffOp[] = [];
  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx];
    if (keep[idx] && op) {
      result.push(op);
    }
  }
  return result;
}

/**
 * Render an op stream into the final unified-diff text envelope.
 *
 * The header counts (`+A/-R`) reflect the entire op stream — not just
 * the rendered window after `applyContext` — so the user always sees
 * the full magnitude of the change even when we elided context.
 */
function renderDiff(ops: DiffOp[], totalAdded: number, totalRemoved: number): string {
  const totalChanged = totalAdded + totalRemoved;
  const header = `@@ ${totalChanged} lines changed (+${totalAdded}/-${totalRemoved}) @@`;
  const body = ops.map((op) => {
    switch (op.kind) {
      case 'eq':
        return ` ${op.line}`;
      case 'add':
        return `+${op.line}`;
      case 'del':
        return `-${op.line}`;
    }
  });
  return [header, ...body].join('\n');
}

/**
 * Compute the unified-diff delta between two strings.
 *
 * Returns:
 * - `{ kind: 'unchanged' }` if byte-identical (cheap fast path).
 * - `{ kind: 'too-large', reason: 'lines' }` if either side > {@link MAX_DELTA_LINES}.
 * - `{ kind: 'too-large', reason: 'chars' }` if rendered diff > {@link MAX_DELTA_CHARS}.
 * - `{ kind: 'delta', diff, oldHash: '' }` otherwise. Caller fills `oldHash`.
 *
 * `oldHash` is left empty here because the renderer is content-only —
 * the cache layer is the single source of truth for hashes.
 */
export function computeDelta(oldContent: string, newContent: string): DeltaResult {
  // Fast path: identical bytes, no diff computation needed.
  if (oldContent === newContent) {
    return { kind: 'unchanged' };
  }

  const oldLines = splitLines(oldContent);
  const newLines = splitLines(newContent);

  if (oldLines.length > MAX_DELTA_LINES || newLines.length > MAX_DELTA_LINES) {
    return { kind: 'too-large', reason: 'lines' };
  }

  const table = computeLcsTable(oldLines, newLines);
  const allOps = walkLcsToOps(table, oldLines, newLines);

  let added = 0;
  let removed = 0;
  for (const op of allOps) {
    if (op.kind === 'add') added++;
    else if (op.kind === 'del') removed++;
  }

  const windowed = applyContext(allOps);
  const diff = renderDiff(windowed, added, removed);

  if (diff.length > MAX_DELTA_CHARS) {
    return { kind: 'too-large', reason: 'chars' };
  }

  return { kind: 'delta', diff, oldHash: '' };
}
