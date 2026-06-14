/**
 * SessionEnd/Stop/StopFailure Hook — Deregister peer and release all file claims.
 *
 * On Stop and SubagentStop events the hook also receives `background_tasks`
 * and `session_crons` arrays (CC v2.1.145+). When either is non-empty the
 * hook skips deregistration — the model has paused but in-flight work may
 * still mutate state under this peer's identity. On SessionEnd (true session
 * shutdown) the fields are absent and deregistration always proceeds.
 *
 * @module lifecycle/peer-deregister
 */

import { releaseAllClaims } from '../coordination/claims.js';
import { deregisterPeer } from '../coordination/peers.js';
import { logDebug, logInfo } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'peer-deregister';

/**
 * Check Stop/SubagentStop hook input for in-flight work that should block
 * deregistration. Returns a reason string when work is in flight (caller
 * should skip deregistration and log), or null when it's safe to proceed.
 *
 * Returns null on SessionEnd / StopFailure where the fields are absent —
 * those events represent real session termination and the peer record
 * should be cleaned up regardless of any pending work.
 */
export function inFlightWorkReason(input: HookInput): string | null {
  const event = input.hook_event_name;
  // Only Stop and SubagentStop carry these fields. SessionEnd and
  // StopFailure imply terminal shutdown — always cleanup.
  if (event !== 'Stop' && event !== 'SubagentStop') return null;

  const tasks = input.background_tasks ?? [];
  const crons = input.session_crons ?? [];
  if (tasks.length === 0 && crons.length === 0) return null;

  const parts: string[] = [];
  if (tasks.length > 0) parts.push(`${tasks.length} background task(s)`);
  if (crons.length > 0) parts.push(`${crons.length} scheduled cron(s)`);
  return parts.join(' + ');
}

export async function peerDeregister(input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';

  const blocker = inFlightWorkReason(input);
  if (blocker !== null) {
    logInfo(HOOK_NAME, `Skipping deregistration: in-flight work detected (${blocker})`);
    return outputSilentSuccess();
  }

  logDebug(HOOK_NAME, 'Deregistering peer on session end');

  try {
    releaseAllClaims(projectDir);
    deregisterPeer(projectDir);
    logInfo(HOOK_NAME, 'Peer deregistered and claims released');
  } catch (err) {
    // Non-fatal — best-effort cleanup
    logDebug(HOOK_NAME, `Cleanup error: ${err}`);
  }

  return outputSilentSuccess();
}
