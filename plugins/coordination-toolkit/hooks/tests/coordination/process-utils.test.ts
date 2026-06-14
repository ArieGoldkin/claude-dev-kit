/**
 * Tests for process liveness utilities.
 *
 * @module tests/coordination/process-utils
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_REASONABLE_SESSION_AGE_MS,
  isPeerAlive,
  isProcessAlive,
} from '../../src/coordination/process-utils.js';

// =============================================================================
// isProcessAlive
// =============================================================================

describe('isProcessAlive', () => {
  it('should return true for current process', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it('should return false for definitely-dead PID', () => {
    // PID 999999 is extremely unlikely to exist
    expect(isProcessAlive(999999)).toBe(false);
  });

  it('should return false for PID 0', () => {
    // PID 0 would send signal to process group — must be guarded
    expect(isProcessAlive(0)).toBe(false);
  });

  it('should return false for negative PID', () => {
    expect(isProcessAlive(-1)).toBe(false);
  });

  it('should return false for non-integer PID', () => {
    expect(isProcessAlive(3.14)).toBe(false);
    expect(isProcessAlive(Number.NaN)).toBe(false);
  });
});

// =============================================================================
// isPeerAlive
// =============================================================================

describe('isPeerAlive', () => {
  it('should return true when PID alive and started_at is recent', () => {
    const recentStart = new Date().toISOString();
    expect(isPeerAlive(process.pid, recentStart)).toBe(true);
  });

  it('should return false when PID is dead', () => {
    const recentStart = new Date().toISOString();
    expect(isPeerAlive(999999, recentStart)).toBe(false);
  });

  it('should return false when PID alive but started_at exceeds max age (PID reuse)', () => {
    // Simulate a peer registered 25 hours ago (past 24hr threshold)
    const oldStart = new Date(Date.now() - MAX_REASONABLE_SESSION_AGE_MS - 3_600_000).toISOString();
    expect(isPeerAlive(process.pid, oldStart)).toBe(false);
  });

  it('should return true when PID alive and started_at is at boundary', () => {
    // Just under 24 hours — should still be considered alive
    const boundaryStart = new Date(
      Date.now() - MAX_REASONABLE_SESSION_AGE_MS + 60_000
    ).toISOString();
    expect(isPeerAlive(process.pid, boundaryStart)).toBe(true);
  });

  it('should return false for invalid started_at string', () => {
    // NaN age from invalid date should be treated as stale
    expect(isPeerAlive(process.pid, 'not-a-date')).toBe(false);
  });

  it('should return false for empty started_at', () => {
    expect(isPeerAlive(process.pid, '')).toBe(false);
  });
});
