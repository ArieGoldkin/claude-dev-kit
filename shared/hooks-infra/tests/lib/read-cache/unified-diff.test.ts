/**
 * Tests for read-cache unified-diff renderer.
 *
 * @module tests/lib/read-cache/unified-diff
 */

import { describe, expect, it } from 'vitest';
import {
  computeDelta,
  MAX_DELTA_CHARS,
  MAX_DELTA_LINES,
} from '../../../src/lib/read-cache/unified-diff.js';

describe('computeDelta - identical content', () => {
  it('returns unchanged for byte-identical strings', () => {
    const result = computeDelta('hello\nworld\n', 'hello\nworld\n');
    expect(result.kind).toBe('unchanged');
  });

  it('returns unchanged for two empty strings', () => {
    const result = computeDelta('', '');
    expect(result.kind).toBe('unchanged');
  });
});

describe('computeDelta - delta cases', () => {
  it('renders a delta for a single-line replacement', () => {
    const oldContent = 'line1\nline2\nline3\n';
    const newContent = 'line1\nLINE2\nline3\n';
    const result = computeDelta(oldContent, newContent);

    expect(result.kind).toBe('delta');
    if (result.kind !== 'delta') return;
    expect(result.diff).toContain('@@');
    expect(result.diff).toContain('+LINE2');
    expect(result.diff).toContain('-line2');
    expect(result.oldHash).toBe(''); // caller fills this
  });

  it('header reports correct +/- counts for a single replacement', () => {
    const result = computeDelta('a\nb\nc\n', 'a\nB\nc\n');
    expect(result.kind).toBe('delta');
    if (result.kind !== 'delta') return;
    expect(result.diff.split('\n')[0]).toBe('@@ 2 lines changed (+1/-1) @@');
  });

  it('renders multi-line additions with + markers', () => {
    const oldContent = 'a\nb\n';
    const newContent = 'a\nb\nc\nd\ne\n';
    const result = computeDelta(oldContent, newContent);
    expect(result.kind).toBe('delta');
    if (result.kind !== 'delta') return;
    const lines = result.diff.split('\n');
    expect(lines[0]).toBe('@@ 3 lines changed (+3/-0) @@');
    expect(result.diff).toContain('+c');
    expect(result.diff).toContain('+d');
    expect(result.diff).toContain('+e');
  });

  it('renders multi-line deletions with - markers', () => {
    const oldContent = 'a\nb\nc\nd\ne\n';
    const newContent = 'a\ne\n';
    const result = computeDelta(oldContent, newContent);
    expect(result.kind).toBe('delta');
    if (result.kind !== 'delta') return;
    expect(result.diff).toContain('-b');
    expect(result.diff).toContain('-c');
    expect(result.diff).toContain('-d');
  });

  it('emits 1 line of context around changes', () => {
    const oldContent = 'a\nb\nc\nd\ne\nf\ng\n';
    const newContent = 'a\nb\nc\nD\ne\nf\ng\n';
    const result = computeDelta(oldContent, newContent);
    expect(result.kind).toBe('delta');
    if (result.kind !== 'delta') return;
    // Context line 'c' (before change) and 'e' (after change) should appear with leading space.
    expect(result.diff).toContain(' c');
    expect(result.diff).toContain(' e');
    // Far-away unchanged lines 'a' and 'g' must NOT be included.
    expect(result.diff).not.toContain(' a');
    expect(result.diff).not.toContain(' g');
  });
});

describe('computeDelta - too-large by lines', () => {
  it('returns too-large when old content has > MAX_DELTA_LINES lines', () => {
    const big = Array.from({ length: MAX_DELTA_LINES + 1 }, (_, i) => `line${i}`).join('\n');
    const small = 'small';
    const result = computeDelta(big, small);
    expect(result.kind).toBe('too-large');
    if (result.kind !== 'too-large') return;
    expect(result.reason).toBe('lines');
  });

  it('returns too-large when new content has > MAX_DELTA_LINES lines', () => {
    const small = 'small';
    const big = Array.from({ length: MAX_DELTA_LINES + 1 }, (_, i) => `line${i}`).join('\n');
    const result = computeDelta(small, big);
    expect(result.kind).toBe('too-large');
    if (result.kind !== 'too-large') return;
    expect(result.reason).toBe('lines');
  });

  it('does NOT bail at exactly MAX_DELTA_LINES on either side', () => {
    // Exactly MAX_DELTA_LINES is allowed; only > triggers bail.
    const exactly = Array.from({ length: MAX_DELTA_LINES }, (_, i) => `l${i}`).join('\n');
    // Compare exactly-sized content against itself with a single-line tweak so we
    // get a delta result and exercise the "exactly at limit" boundary.
    const tweaked = exactly.replace('l0', 'L0');
    const result = computeDelta(exactly, tweaked);
    // Should be a delta or too-large by chars — but NOT too-large by lines.
    if (result.kind === 'too-large') {
      expect(result.reason).not.toBe('lines');
    } else {
      expect(result.kind).toBe('delta');
    }
  });
});

describe('computeDelta - too-large by chars', () => {
  it('returns too-large when rendered diff would exceed MAX_DELTA_CHARS', () => {
    // Build content that produces a long diff but stays within the line budget.
    // 200 lines, each ~50 chars, all changed → diff renders ~200 +/- pairs of
    // lines plus header, well over MAX_DELTA_CHARS (1500).
    const lineCount = 200;
    const oldLines: string[] = [];
    const newLines: string[] = [];
    for (let i = 0; i < lineCount; i++) {
      oldLines.push(`old-line-${i}-${'x'.repeat(20)}`);
      newLines.push(`new-line-${i}-${'y'.repeat(20)}`);
    }
    const result = computeDelta(oldLines.join('\n'), newLines.join('\n'));
    expect(result.kind).toBe('too-large');
    if (result.kind !== 'too-large') return;
    expect(result.reason).toBe('chars');
  });

  it('exposes MAX_DELTA_CHARS as a positive integer', () => {
    expect(MAX_DELTA_CHARS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_DELTA_CHARS)).toBe(true);
  });

  it('exposes MAX_DELTA_LINES as a positive integer', () => {
    expect(MAX_DELTA_LINES).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_DELTA_LINES)).toBe(true);
  });
});

describe('computeDelta - empty <-> non-empty', () => {
  it('empty -> non-empty renders as delta with all + lines', () => {
    const result = computeDelta('', 'a\nb\nc\n');
    expect(result.kind).toBe('delta');
    if (result.kind !== 'delta') return;
    // Header should report only additions.
    expect(result.diff).toMatch(/\(\+\d+\/-0\)/);
    expect(result.diff).toContain('+a');
  });

  it('non-empty -> empty renders as delta with all - lines', () => {
    const result = computeDelta('a\nb\nc\n', '');
    expect(result.kind).toBe('delta');
    if (result.kind !== 'delta') return;
    expect(result.diff).toMatch(/\(\+0\/-\d+\)/);
    expect(result.diff).toContain('-a');
  });
});

describe('computeDelta - newline / line-ending preservation', () => {
  it('counts a trailing-newline difference as a delta', () => {
    const oldContent = 'a\nb\nc';
    const newContent = 'a\nb\nc\n';
    const result = computeDelta(oldContent, newContent);
    expect(result.kind).toBe('delta');
  });

  it('does not collapse CRLF into LF', () => {
    const oldContent = 'a\nb\n';
    const newContent = 'a\r\nb\r\n';
    const result = computeDelta(oldContent, newContent);
    // CRLF flip is a real change — must surface as a delta.
    expect(result.kind).toBe('delta');
  });
});
