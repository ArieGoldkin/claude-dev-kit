/**
 * Process liveness utilities for peer staleness detection.
 *
 * Uses process.kill(pid, 0) to check OS process status — same pattern
 * as shared/hooks-infra lock.ts but with PID reuse mitigation for
 * long-running coordination.
 *
 * @module coordination/process-utils
 */

/**
 * Maximum reasonable session age before treating a live PID as reused.
 * Claude Code sessions rarely last more than a few hours; 24 hours
 * is a conservative upper bound. macOS PID space is ~100K so reuse
 * within 24h for the same PID is extremely unlikely.
 */
export const MAX_REASONABLE_SESSION_AGE_MS = 86_400_000; // 24 hours

/**
 * Check whether a process with the given PID is alive.
 * Uses zero-signal probe (no signal is sent to the process).
 *
 * @param pid - The OS process ID to check
 * @returns true if the process exists, false if dead or invalid
 */
export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Determine whether a peer is still alive based on PID and registration time.
 *
 * Checks PID liveness first. If the process is alive, applies a sanity
 * check against started_at to mitigate PID reuse: if the peer registered
 * more than MAX_REASONABLE_SESSION_AGE_MS ago, treat it as a reused PID.
 *
 * @param pid - The OS process ID from the peer record
 * @param startedAt - ISO timestamp from peer's started_at field
 * @returns true if the peer is considered alive, false if stale
 */
export function isPeerAlive(pid: number, startedAt: string): boolean {
  if (!isProcessAlive(pid)) {
    return false;
  }

  // PID reuse mitigation: if the session is unreasonably old, assume PID reuse
  const age = Date.now() - new Date(startedAt).getTime();
  if (Number.isNaN(age) || age > MAX_REASONABLE_SESSION_AGE_MS) {
    return false;
  }

  return true;
}
