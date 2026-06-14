/**
 * Tests for shared experiment leaderboard (#38) and distributed
 * experiment claim protocol (#39).
 *
 * @module tests/coordination/experiments
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendResult,
  claimHypothesis,
  getBestResult,
  getClaimedHypotheses,
  getLeaderboard,
} from '../../src/coordination/experiments.js';
import type { ExperimentClaim } from '../../src/coordination/experiments.js';

// =============================================================================
// HELPERS
// =============================================================================

let tmpDir: string;
const ORIGINAL_SESSION_ID = process.env['CLAUDE_SESSION_ID'];
const EXPERIMENT = 'perf-optimize';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiments-test-'));
  process.env['CLAUDE_SESSION_ID'] = 'session-A';
});

afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (ORIGINAL_SESSION_ID !== undefined) {
    process.env['CLAUDE_SESSION_ID'] = ORIGINAL_SESSION_ID;
  } else {
    delete process.env['CLAUDE_SESSION_ID'];
  }
});

function setSession(id: string): void {
  process.env['CLAUDE_SESSION_ID'] = id;
}

function getResultsFile(): string {
  return path.join(tmpDir, '.claude/coordination/experiments', EXPERIMENT, 'results.tsv');
}

// =============================================================================
// Leaderboard — appendResult (#38)
// =============================================================================

describe('appendResult', () => {
  it('creates TSV with header and row', async () => {
    await appendResult(tmpDir, EXPERIMENT, {
      description: 'baseline run',
      metric_name: 'latency_ms',
      metric_value: 150,
      kept: true,
    });

    const content = fs.readFileSync(getResultsFile(), 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('session_id\tdescription\tmetric_name\tmetric_value\tkept\ttimestamp');
    expect(lines[1]).toContain('session-A');
    expect(lines[1]).toContain('baseline run');
    expect(lines[1]).toContain('latency_ms');
    expect(lines[1]).toContain('150');
    expect(lines[1]).toContain('true');
  });

  it('appends to existing TSV', async () => {
    await appendResult(tmpDir, EXPERIMENT, {
      description: 'run 1',
      metric_name: 'latency_ms',
      metric_value: 150,
      kept: true,
    });

    await appendResult(tmpDir, EXPERIMENT, {
      description: 'run 2',
      metric_name: 'latency_ms',
      metric_value: 120,
      kept: true,
    });

    const content = fs.readFileSync(getResultsFile(), 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toContain('run 1');
    expect(lines[2]).toContain('run 2');
  });
});

// =============================================================================
// Leaderboard — getLeaderboard (#38)
// =============================================================================

describe('getLeaderboard', () => {
  it('returns results sorted by metric_value descending', async () => {
    await appendResult(tmpDir, EXPERIMENT, {
      description: 'slow',
      metric_name: 'score',
      metric_value: 30,
      kept: true,
    });
    await appendResult(tmpDir, EXPERIMENT, {
      description: 'fast',
      metric_name: 'score',
      metric_value: 95,
      kept: true,
    });
    await appendResult(tmpDir, EXPERIMENT, {
      description: 'medium',
      metric_name: 'score',
      metric_value: 60,
      kept: false,
    });

    const board = getLeaderboard(tmpDir, EXPERIMENT);
    expect(board).toHaveLength(3);
    expect(board[0]?.metric_value).toBe(95);
    expect(board[1]?.metric_value).toBe(60);
    expect(board[2]?.metric_value).toBe(30);
  });

  it('returns empty array when no results file exists', () => {
    const board = getLeaderboard(tmpDir, EXPERIMENT);
    expect(board).toEqual([]);
  });
});

// =============================================================================
// Leaderboard — getBestResult (#38)
// =============================================================================

describe('getBestResult', () => {
  it('returns top kept result', async () => {
    await appendResult(tmpDir, EXPERIMENT, {
      description: 'discarded best',
      metric_name: 'score',
      metric_value: 100,
      kept: false,
    });
    await appendResult(tmpDir, EXPERIMENT, {
      description: 'kept winner',
      metric_name: 'score',
      metric_value: 80,
      kept: true,
    });
    await appendResult(tmpDir, EXPERIMENT, {
      description: 'kept runner-up',
      metric_name: 'score',
      metric_value: 50,
      kept: true,
    });

    const best = getBestResult(tmpDir, EXPERIMENT);
    expect(best).not.toBeNull();
    expect(best?.description).toBe('kept winner');
    expect(best?.metric_value).toBe(80);
    expect(best?.kept).toBe(true);
  });

  it('returns null when no kept results exist', async () => {
    await appendResult(tmpDir, EXPERIMENT, {
      description: 'discarded',
      metric_name: 'score',
      metric_value: 99,
      kept: false,
    });

    const best = getBestResult(tmpDir, EXPERIMENT);
    expect(best).toBeNull();
  });
});

// =============================================================================
// Experiment Claims — claimHypothesis (#39)
// =============================================================================

describe('claimHypothesis', () => {
  it('creates claim file', () => {
    const result = claimHypothesis(tmpDir, EXPERIMENT, 'caching reduces latency');
    expect(result.success).toBe(true);

    const claimsDir = path.join(tmpDir, '.claude/coordination/experiments', EXPERIMENT, 'claims');
    const files = fs.readdirSync(claimsDir).filter((f) => f.endsWith('.json'));
    expect(files).toHaveLength(1);

    const content = JSON.parse(
      fs.readFileSync(path.join(claimsDir, files[0] ?? ''), 'utf8')
    ) as ExperimentClaim;
    expect(content.hypothesis).toBe('caching reduces latency');
    expect(content.claimed_by).toBe('session-A');
    expect(content.claimed_at).toBeTruthy();
    expect(content.expires_at).toBeTruthy();
  });

  it('rejects when claimed by another session', () => {
    setSession('session-A');
    claimHypothesis(tmpDir, EXPERIMENT, 'caching reduces latency');

    setSession('session-B');
    const result = claimHypothesis(tmpDir, EXPERIMENT, 'caching reduces latency');
    expect(result.success).toBe(false);
    expect(result.owner).toBe('session-A');
  });

  it('allows own reclaim', () => {
    setSession('session-A');
    claimHypothesis(tmpDir, EXPERIMENT, 'caching reduces latency');

    const result = claimHypothesis(tmpDir, EXPERIMENT, 'caching reduces latency');
    expect(result.success).toBe(true);
  });

  it('takes expired claims', () => {
    vi.useFakeTimers({ now: new Date('2026-04-04T10:00:00.000Z') });

    setSession('session-A');
    claimHypothesis(tmpDir, EXPERIMENT, 'caching reduces latency');

    // Advance past 10-minute TTL
    vi.setSystemTime(new Date('2026-04-04T10:10:01.000Z'));

    setSession('session-B');
    const result = claimHypothesis(tmpDir, EXPERIMENT, 'caching reduces latency');
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Experiment Claims — getClaimedHypotheses (#39)
// =============================================================================

describe('getClaimedHypotheses', () => {
  it('returns active claims and filters expired', () => {
    vi.useFakeTimers({ now: new Date('2026-04-04T10:00:00.000Z') });

    setSession('session-A');
    claimHypothesis(tmpDir, EXPERIMENT, 'hypothesis A');

    setSession('session-B');
    claimHypothesis(tmpDir, EXPERIMENT, 'hypothesis B');

    // Advance 5 minutes — both still active (TTL is 10 min)
    vi.setSystemTime(new Date('2026-04-04T10:05:00.000Z'));

    const claims = getClaimedHypotheses(tmpDir, EXPERIMENT);
    expect(claims).toHaveLength(2);
    const hypotheses = claims.map((c) => c.hypothesis).sort();
    expect(hypotheses).toEqual(['hypothesis A', 'hypothesis B']);

    // Advance past TTL — both expired
    vi.setSystemTime(new Date('2026-04-04T10:10:01.000Z'));

    const expiredClaims = getClaimedHypotheses(tmpDir, EXPERIMENT);
    expect(expiredClaims).toEqual([]);
  });

  it('returns empty array when claims directory does not exist', () => {
    const claims = getClaimedHypotheses(tmpDir, EXPERIMENT);
    expect(claims).toEqual([]);
  });
});
