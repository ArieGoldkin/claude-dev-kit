/**
 * Tests for atomic mkdir-based lock utilities.
 *
 * @module tests/lib/lock
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acquireLock, releaseLock } from '../../src/lib/lock.js';

// =============================================================================
// HELPERS
// =============================================================================

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function lockPath(name = 'test.lock'): string {
  return path.join(tmpDir, name);
}

// =============================================================================
// acquireLock
// =============================================================================

describe('acquireLock', () => {
  it('returns true on successful acquire', async () => {
    const result = await acquireLock(lockPath());
    expect(result).toBe(true);
  });

  it('creates a directory at the lock path', async () => {
    const lp = lockPath();
    await acquireLock(lp);
    expect(fs.existsSync(lp)).toBe(true);
    expect(fs.statSync(lp).isDirectory()).toBe(true);
  });

  it('writes a pid file inside the lock directory', async () => {
    const lp = lockPath();
    await acquireLock(lp);
    const pidFile = path.join(lp, 'pid');
    expect(fs.existsSync(pidFile)).toBe(true);
    const contents = fs.readFileSync(pidFile, 'utf-8');
    expect(contents).toBe(String(process.pid));
  });

  it('returns false when lock is already held (contention)', async () => {
    const lp = lockPath();
    await acquireLock(lp);
    // Second acquire should fail immediately (maxAttempts=1 for speed)
    const result = await acquireLock(lp, 1);
    expect(result).toBe(false);
  });

  it('respects maxAttempts=1 by failing without excessive retries', async () => {
    const lp = lockPath();
    await acquireLock(lp); // hold the lock

    const start = Date.now();
    const result = await acquireLock(lp, 1);
    const elapsed = Date.now() - start;

    expect(result).toBe(false);
    // Should have only slept ~100ms (one retry delay), not 5 seconds
    expect(elapsed).toBeLessThan(500);
  });
});

// =============================================================================
// releaseLock
// =============================================================================

describe('releaseLock', () => {
  it('removes the lock directory on release', async () => {
    const lp = lockPath();
    await acquireLock(lp);
    releaseLock(lp);
    expect(fs.existsSync(lp)).toBe(false);
  });

  it('does not throw when called on a non-existent path', () => {
    const lp = lockPath('never-acquired.lock');
    expect(() => releaseLock(lp)).not.toThrow();
  });

  it('allows a subsequent acquire after release', async () => {
    const lp = lockPath();
    await acquireLock(lp);
    releaseLock(lp);
    const result = await acquireLock(lp, 1);
    expect(result).toBe(true);
  });
});

// =============================================================================
// stale lock detection
// =============================================================================

describe('stale lock detection', () => {
  /**
   * Simulate a lock left behind by a dead process:
   * write a pid file containing a PID that is definitely not alive.
   */
  function createStaleLock(lp: string, pid = 999999999): void {
    fs.mkdirSync(lp);
    fs.writeFileSync(path.join(lp, 'pid'), String(pid));
  }

  /**
   * Back-date the mtime of `lp` so it appears older than `ageMs`.
   */
  function backdateLock(lp: string, ageMs: number): void {
    const oldTime = new Date(Date.now() - ageMs - 1000);
    fs.utimesSync(lp, oldTime, oldTime);
  }

  it('acquires an OLD lock held by a dead PID (stale lock is broken)', async () => {
    const lp = lockPath('old-dead-pid.lock');
    createStaleLock(lp); // PID 999999999 — guaranteed not to exist
    backdateLock(lp, 15_000); // 15 s old

    const result = await acquireLock(lp, 5, 10_000); // maxAge = 10 s
    expect(result).toBe(true);
  });

  it('does NOT break a FRESH lock held by a dead PID (audit P1: isOld && pidDead)', async () => {
    const lp = lockPath('fresh-dead-pid.lock');
    createStaleLock(lp); // dead PID, but lock is brand new

    const result = await acquireLock(lp, 2, 60_000);
    expect(result).toBe(false);
    expect(fs.existsSync(lp)).toBe(true); // lock was not clobbered
  });

  it('does NOT break an OLD lock held by a LIVING PID (audit P1: no live-holder steal)', async () => {
    const lp = lockPath('old-alive.lock');
    fs.mkdirSync(lp);
    fs.writeFileSync(path.join(lp, 'pid'), String(process.pid)); // alive: us
    backdateLock(lp, 15_000); // 15 s old — past maxAge

    const result = await acquireLock(lp, 2, 10_000);
    expect(result).toBe(false);
    expect(fs.existsSync(path.join(lp, 'pid'))).toBe(true); // holder untouched

    releaseLock(lp);
  });

  it('does NOT break a lock held by a living PID when lock is fresh', async () => {
    const lp = lockPath('fresh-alive.lock');
    // Write the current process's own PID — definitely alive
    fs.mkdirSync(lp);
    fs.writeFileSync(path.join(lp, 'pid'), String(process.pid));

    // maxAttempts=2, maxAge=60 s → should NOT remove our own fresh lock
    const result = await acquireLock(lp, 2, 60_000);
    expect(result).toBe(false);

    releaseLock(lp);
  });

  it('does NOT steal a FRESH lock whose pid file is missing (mid-publication window)', async () => {
    const lp = lockPath('fresh-no-pid.lock');
    fs.mkdirSync(lp); // no pid file written — simulates holder between mkdir and pid write

    const result = await acquireLock(lp, 2, 60_000);
    expect(result).toBe(false);
    expect(fs.existsSync(lp)).toBe(true); // mid-publication lock survived
  });

  it('acquires an OLD lock whose pid file is missing (holder crashed mid-publication)', async () => {
    const lp = lockPath('old-no-pid.lock');
    fs.mkdirSync(lp); // no pid file written
    backdateLock(lp, 15_000);

    const result = await acquireLock(lp, 5, 10_000);
    expect(result).toBe(true);
  });

  it('acquires an OLD lock whose pid file contains garbage (treated as unpublished)', async () => {
    const lp = lockPath('old-bad-pid.lock');
    fs.mkdirSync(lp);
    fs.writeFileSync(path.join(lp, 'pid'), 'not-a-number');
    backdateLock(lp, 15_000);

    const result = await acquireLock(lp, 5, 10_000);
    expect(result).toBe(true);
  });
});

// =============================================================================
// concurrency
// =============================================================================

describe('concurrent acquisition', () => {
  it('exactly one of N concurrent acquirers wins a contested lock', async () => {
    const lp = lockPath('contested.lock');
    const results = await Promise.all(
      Array.from({ length: 8 }, () => acquireLock(lp, 1, 10_000))
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    // Winner published its pid
    expect(fs.readFileSync(path.join(lp, 'pid'), 'utf-8')).toBe(String(process.pid));
    releaseLock(lp);
  });
});

// =============================================================================
// acquire + release cycle
// =============================================================================

describe('acquire/release cycle', () => {
  it('completes a full acquire → release → acquire cycle', async () => {
    const lp = lockPath();

    expect(await acquireLock(lp)).toBe(true);
    releaseLock(lp);
    expect(fs.existsSync(lp)).toBe(false);

    expect(await acquireLock(lp)).toBe(true);
    expect(fs.existsSync(lp)).toBe(true);
    releaseLock(lp);
  });

  it('multiple independent locks do not interfere', async () => {
    const lp1 = lockPath('lock-a.lock');
    const lp2 = lockPath('lock-b.lock');

    expect(await acquireLock(lp1)).toBe(true);
    expect(await acquireLock(lp2)).toBe(true);

    releaseLock(lp1);
    releaseLock(lp2);

    expect(fs.existsSync(lp1)).toBe(false);
    expect(fs.existsSync(lp2)).toBe(false);
  });
});
