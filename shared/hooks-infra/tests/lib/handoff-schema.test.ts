/**
 * Tests for handoff-schema lib
 *
 * @module tests/lib/handoff-schema
 */

import { describe, expect, it } from 'vitest';
import {
  buildHandoff,
  formatHandoffSummary,
  HANDOFF_SCHEMA_VERSION,
  scrubPHI,
  scrubPHIFromString,
  validateHandoff,
} from '../../src/lib/handoff-schema.js';
import type { HandoffJson } from '../../src/lib/handoff-schema.js';

describe('scrubPHIFromString', () => {
  it('returns input unchanged when no PHI detected', () => {
    const r = scrubPHIFromString('plain dirty file: src/foo.ts');
    expect(r.value).toBe('plain dirty file: src/foo.ts');
    expect(r.redacted).toBe(false);
  });

  it('redacts email addresses', () => {
    const r = scrubPHIFromString('reach me at alice@example.com please');
    expect(r.value).toBe('reach me at [REDACTED-EMAIL] please');
    expect(r.redacted).toBe(true);
  });

  it('redacts SSN-shaped values', () => {
    const r = scrubPHIFromString('SSN is 123-45-6789');
    expect(r.value).toContain('[REDACTED-SSN]');
    expect(r.redacted).toBe(true);
  });

  it('redacts US phone numbers (multiple formats)', () => {
    expect(scrubPHIFromString('call 555-123-4567').value).toContain('[REDACTED-PHONE]');
    expect(scrubPHIFromString('call (555) 123-4567').value).toContain('[REDACTED-PHONE]');
    expect(scrubPHIFromString('call 555.123.4567').value).toContain('[REDACTED-PHONE]');
  });

  it('redacts member-ID-shaped identifiers', () => {
    expect(scrubPHIFromString('member MBR-12345 enrolled').value).toContain(
      '[REDACTED-MEMBER-ID]'
    );
    expect(scrubPHIFromString('member_id=abc-123 enrolled').value).toContain(
      '[REDACTED-MEMBER-ID]'
    );
  });

  it('redacts patient-id-shaped identifiers', () => {
    expect(scrubPHIFromString('patient_id=xyz789').value).toContain('[REDACTED-PATIENT-ID]');
  });

  it('redacts 16-digit credit-card-shaped sequences', () => {
    const r = scrubPHIFromString('card 4111111111111111 stored');
    expect(r.value).toContain('[REDACTED-CARD]');
  });

  it('does not redact short numeric sequences (git short hashes, etc.)', () => {
    const r = scrubPHIFromString('commit abc1234 on 2026-05-11');
    expect(r.redacted).toBe(false);
  });

  it('redacts multiple PHI patterns in the same string', () => {
    const r = scrubPHIFromString('alice@example.com SSN 123-45-6789');
    expect(r.value).toContain('[REDACTED-EMAIL]');
    expect(r.value).toContain('[REDACTED-SSN]');
    expect(r.redacted).toBe(true);
  });

  it('is case-insensitive for MBR / member_id labels', () => {
    expect(scrubPHIFromString('mbr_123456').value).toContain('[REDACTED-MEMBER-ID]');
    expect(scrubPHIFromString('MEMBER_ID: foo').value).toContain('[REDACTED-MEMBER-ID]');
  });
});

describe('scrubPHI (whole handoff)', () => {
  const baseHandoff: HandoffJson = {
    schema_version: 1,
    session_id: null,
    timestamp: '2026-05-11T10:00:00Z',
    branch: 'feat/foo',
    worktree: '/Users/x/repo',
    dirty_files: [],
    open_mrs: [],
    next_steps: [],
    blockers: [],
    compaction_trigger: 'pre-compact',
    phi_redacted: false,
  };

  it('returns same shape with phi_redacted=false when no PHI', () => {
    const out = scrubPHI(baseHandoff);
    expect(out.phi_redacted).toBe(false);
    expect(out.next_steps).toEqual([]);
  });

  it('redacts PHI in next_steps and sets phi_redacted=true', () => {
    const out = scrubPHI({
      ...baseHandoff,
      next_steps: ['email alice@example.com', 'call 555-123-4567'],
    });
    expect(out.phi_redacted).toBe(true);
    expect(out.next_steps[0]).toContain('[REDACTED-EMAIL]');
    expect(out.next_steps[1]).toContain('[REDACTED-PHONE]');
  });

  it('redacts PHI in blockers', () => {
    const out = scrubPHI({
      ...baseHandoff,
      blockers: ['waiting on MBR-99999 access'],
    });
    expect(out.phi_redacted).toBe(true);
    expect(out.blockers[0]).toContain('[REDACTED-MEMBER-ID]');
  });

  it('redacts PHI in open_mrs titles', () => {
    const out = scrubPHI({
      ...baseHandoff,
      open_mrs: [{ id: '!1', title: 'fix login for alice@example.com' }],
    });
    expect(out.phi_redacted).toBe(true);
    expect(out.open_mrs[0]?.title).toContain('[REDACTED-EMAIL]');
  });

  it('preserves open_mrs.id unchanged (id is not PHI)', () => {
    const out = scrubPHI({
      ...baseHandoff,
      open_mrs: [{ id: '!12345', title: 'clean title' }],
    });
    expect(out.open_mrs[0]?.id).toBe('!12345');
  });

  it('redacts PHI in worktree path (defensive — paths can contain user names)', () => {
    const out = scrubPHI({
      ...baseHandoff,
      worktree: '/Users/alice@example.com/repo',
    });
    expect(out.phi_redacted).toBe(true);
    expect(out.worktree).toContain('[REDACTED-EMAIL]');
  });

  it('preserves phi_redacted=true if input already had it set', () => {
    const out = scrubPHI({ ...baseHandoff, phi_redacted: true });
    expect(out.phi_redacted).toBe(true);
  });

  it('does not mutate the input handoff', () => {
    const input: HandoffJson = {
      ...baseHandoff,
      next_steps: ['email alice@example.com'],
    };
    const out = scrubPHI(input);
    expect(input.next_steps[0]).toBe('email alice@example.com');
    expect(out.next_steps[0]).not.toBe(input.next_steps[0]);
  });
});

describe('buildHandoff', () => {
  it('constructs a handoff with current schema version', () => {
    const h = buildHandoff({
      worktree: '/Users/x/repo',
      compaction_trigger: 'pre-compact',
    });
    expect(h.schema_version).toBe(HANDOFF_SCHEMA_VERSION);
    expect(h.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(h.session_id).toBeNull();
    expect(h.branch).toBeNull();
    expect(h.dirty_files).toEqual([]);
    expect(h.phi_redacted).toBe(false);
  });

  it('applies PHI scrub even when caller did not opt in', () => {
    const h = buildHandoff({
      worktree: '/repo',
      compaction_trigger: 'pre-compact',
      next_steps: ['email alice@example.com'],
    });
    expect(h.phi_redacted).toBe(true);
    expect(h.next_steps[0]).toContain('[REDACTED-EMAIL]');
  });

  it('honors a provided timestamp', () => {
    const h = buildHandoff({
      worktree: '/repo',
      compaction_trigger: 'manual',
      timestamp: '2026-05-11T11:11:11Z',
    });
    expect(h.timestamp).toBe('2026-05-11T11:11:11Z');
  });
});

describe('validateHandoff', () => {
  const valid: HandoffJson = {
    schema_version: 1,
    session_id: 'abc',
    timestamp: '2026-05-11T10:00:00Z',
    branch: 'main',
    worktree: '/repo',
    dirty_files: [],
    open_mrs: [],
    next_steps: [],
    blockers: [],
    compaction_trigger: 'pre-compact',
    phi_redacted: false,
  };

  it('accepts a well-formed handoff', () => {
    expect(validateHandoff(valid)).not.toBeNull();
  });

  it('rejects null / non-object', () => {
    expect(validateHandoff(null)).toBeNull();
    expect(validateHandoff('a string')).toBeNull();
    expect(validateHandoff(42)).toBeNull();
  });

  it('rejects missing required fields', () => {
    const cases: unknown[] = [
      { ...valid, schema_version: undefined },
      { ...valid, timestamp: undefined },
      { ...valid, worktree: undefined },
      { ...valid, dirty_files: undefined },
      { ...valid, open_mrs: undefined },
      { ...valid, next_steps: undefined },
      { ...valid, blockers: undefined },
      { ...valid, compaction_trigger: undefined },
      { ...valid, phi_redacted: undefined },
    ];
    for (const c of cases) {
      expect(validateHandoff(c)).toBeNull();
    }
  });

  it('rejects a schema_version newer than known', () => {
    expect(validateHandoff({ ...valid, schema_version: 999 })).toBeNull();
  });

  it('rejects wrong-typed required fields', () => {
    expect(validateHandoff({ ...valid, worktree: 42 })).toBeNull();
    expect(validateHandoff({ ...valid, dirty_files: 'not an array' })).toBeNull();
  });
});

describe('formatHandoffSummary', () => {
  const base: HandoffJson = {
    schema_version: 1,
    session_id: null,
    timestamp: '2026-05-11T10:00:00Z',
    branch: 'feat/x',
    worktree: '/repo',
    dirty_files: ['a.ts', 'b.ts'],
    open_mrs: [{ id: '!1' }, { id: '!2' }],
    next_steps: ['ship X', 'review Y'],
    blockers: [],
    compaction_trigger: 'pre-compact',
    phi_redacted: false,
  };

  it('produces a multi-line summary with key fields', () => {
    const out = formatHandoffSummary(base);
    expect(out).toContain('Last session handoff:');
    expect(out).toContain('saved: 2026-05-11T10:00:00Z (pre-compact)');
    expect(out).toContain('branch: feat/x');
    expect(out).toContain('dirty: 2 file(s)');
    expect(out).toContain('open MRs: !1, !2');
    expect(out).toContain('ship X');
  });

  it('omits empty sections cleanly', () => {
    const out = formatHandoffSummary({
      ...base,
      dirty_files: [],
      open_mrs: [],
      next_steps: [],
    });
    expect(out).not.toContain('dirty:');
    expect(out).not.toContain('open MRs:');
    expect(out).not.toContain('next steps:');
  });

  it('caps next_steps and blockers at 3 entries', () => {
    const out = formatHandoffSummary({
      ...base,
      next_steps: ['1', '2', '3', '4', '5'],
      blockers: ['a', 'b', 'c', 'd'],
    });
    expect(out).toContain('- 1');
    expect(out).toContain('- 3');
    expect(out).not.toContain('- 4');
    expect(out).toContain('- a');
    expect(out).toContain('- c');
    expect(out).not.toContain('- d');
  });

  it('shows phi_redacted note when flag is set', () => {
    const out = formatHandoffSummary({ ...base, phi_redacted: true });
    expect(out).toContain('PHI patterns redacted');
  });

  it('omits phi_redacted note when flag is false', () => {
    const out = formatHandoffSummary({ ...base, phi_redacted: false });
    expect(out).not.toContain('PHI patterns redacted');
  });
});
