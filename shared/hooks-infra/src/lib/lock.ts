/**
 * Atomic file-locking utilities for the continuity plugin.
 *
 * Uses mkdir-based locking, which is atomic on POSIX systems. The lock
 * directory contains a `pid` file for stale-lock detection and debugging.
 *
 * Mutual-exclusion invariants (2026-06-10 audit P1):
 * - A fresh lock (younger than `maxAge`) is NEVER reclaimed, even when its
 *   pid file is missing — a missing pid on a fresh lock means the holder is
 *   mid-publication (between mkdir and the pid write), not crashed.
 * - An old lock is reclaimed only when the recorded holder is dead or never
 *   published a pid. An old-but-alive holder keeps the lock: over-waiting is
 *   safe, stealing a live lock is not.
 * - Stale removal re-checks the lock's mtime immediately before deletion so
 *   a lock cycled by another process inside the decision window survives.
 *
 * @module lib/lock
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Delay between lock-acquisition retries in milliseconds. */
const LOCK_RETRY_DELAY_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check whether a process with the given PID is alive.
 * Returns true if alive, false if dead or PID is invalid.
 */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a stale lock directory, but only if its mtime still matches the
 * value sampled when staleness was decided. A mismatch means another process
 * cycled the lock (released + re-acquired) inside the decision window — that
 * lock is fresh and must not be clobbered.
 *
 * @returns true if the lock is gone (removed or already absent), false if it
 *          was cycled and left in place
 */
function removeStaleLock(lockPath: string, expectedMtimeMs: number): boolean {
  try {
    const stat = fs.statSync(lockPath);
    if (stat.mtimeMs !== expectedMtimeMs) {
      return false;
    }
    fs.rmSync(lockPath, { recursive: true, force: true });
    return true;
  } catch {
    // Already gone (or unreadable) — let the next mkdir attempt decide
    return true;
  }
}

/**
 * Detect and clear a stale lock.
 *
 * A lock is stale only when BOTH hold: it is older than `maxAge` AND its
 * recorded holder is dead (or it never published a pid). Fresh locks are
 * never touched — this closes the mkdir→pid-write publication window where
 * a concurrent checker used to read "no pid" and steal a live lock.
 *
 * @returns true if the stale lock was removed, false if the lock is still valid
 */
function clearStaleLockIfNeeded(lockPath: string, maxAge: number): boolean {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(lockPath);
  } catch {
    // Lock directory disappeared — let the next mkdir attempt succeed
    return true;
  }

  const lockAgeMs = Date.now() - stat.mtimeMs;
  if (lockAgeMs <= maxAge) {
    // Fresh lock — never stale, even with a missing pid (mid-publication).
    return false;
  }

  // Old lock — read the recorded holder PID.
  let pid: number | null = null;
  try {
    const pidStr = fs.readFileSync(path.join(lockPath, 'pid'), 'utf-8').trim();
    const parsed = Number.parseInt(pidStr, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      pid = parsed;
    }
  } catch {
    // pid file missing/unreadable on an OLD lock — holder likely crashed
    // between mkdir and pid publication; eligible for reclaim below.
  }

  if (pid !== null && isPidAlive(pid)) {
    // Old but the holder is still alive — do NOT steal a live lock.
    return false;
  }

  return removeStaleLock(lockPath, stat.mtimeMs);
}

/**
 * Acquire a lock using mkdir (atomic on POSIX systems).
 *
 * Creates a lock directory at `lockPath`. If the directory already exists,
 * checks for a stale lock — older than `maxAge` AND held by a dead (or
 * unpublished) PID. If stale, removes it and retries immediately. Otherwise
 * waits 100ms and retries up to `maxAttempts` times (~100ms × maxAttempts).
 *
 * Note: after a holder crash, the lock is reclaimable only once it ages past
 * `maxAge` — recovery latency is bounded by `maxAge`, in exchange for never
 * stealing a live holder's lock.
 *
 * @param lockPath    - Path to the lock directory
 * @param maxAttempts - Maximum acquisition attempts (default 50 = 5 s)
 * @param maxAge      - Max lock age in ms before it is considered stale (default 10 000 ms)
 * @returns True if the lock was acquired, false on timeout
 */
export async function acquireLock(
  lockPath: string,
  maxAttempts = 50,
  maxAge = 10_000
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      fs.mkdirSync(lockPath);
    } catch {
      // Lock already held — check for staleness before sleeping
      if (clearStaleLockIfNeeded(lockPath, maxAge)) {
        // Stale lock removed; retry without consuming a sleep cycle
        continue;
      }
      await sleep(LOCK_RETRY_DELAY_MS);
      continue;
    }

    try {
      // `wx`: publication must CREATE the pid file — never overwrite a pid
      // raced in by another process on the same path.
      fs.writeFileSync(path.join(lockPath, 'pid'), String(process.pid), { flag: 'wx' });
      return true;
    } catch (err) {
      // Publication failed. ENOENT → our directory vanished in a race; just
      // retry. Anything else → the fresh-lock guard keeps other processes
      // off our directory, so it is ours to remove before retrying.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        try {
          fs.rmSync(lockPath, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
      await sleep(LOCK_RETRY_DELAY_MS);
    }
  }
  return false;
}

/**
 * Release a lock by removing the lock directory.
 *
 * Errors are silently ignored so callers never throw in finally blocks.
 *
 * @param lockPath - Path to the lock directory
 */
export function releaseLock(lockPath: string): void {
  try {
    fs.rmSync(lockPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}
