/**
 * SessionEnd Hook - Mark session as cleanly ended
 *
 * This hook is called by Claude Code when a session ends (clear, logout, exit).
 * It updates shared-context.json to mark the session as cleanly ended,
 * preventing false "stale session" warnings on the next session start.
 *
 * Input sources: 'clear', 'logout', 'prompt_input_exit', 'bypass_permissions_disabled', 'other'
 *
 * @module lifecycle/session-end
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONTINUITY_DIRS, formatTimestamp } from '../lib/continuity.js';
import { acquireLock, releaseLock } from '../lib/lock.js';
import { logDebug, logError, logInfo } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'session-end';

/**
 * Maximum lock attempts for SessionEnd (20 × 100ms = 2 s).
 * Shorter than session-loader since SessionEnd has tighter time constraints.
 */
const MAX_LOCK_ATTEMPTS = 20;

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * SessionEnd hook - marks session as cleanly ended in shared-context.json.
 *
 * Updates:
 * - session_heartbeat.was_cleanly_ended = true
 * - session_heartbeat.last_activity = current timestamp
 *
 * Always returns outputSilentSuccess() -- SessionEnd hooks cannot block.
 *
 * @param input - Hook input from Claude Code (source field indicates end reason)
 * @returns HookResult (always silent success)
 */
export async function sessionEnd(input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';
  const source = input.source || 'unknown';

  logDebug(HOOK_NAME, `Session ending, source: ${source}`);

  const contextFile = path.join(projectDir, CONTINUITY_DIRS.context, 'shared-context.json');

  if (!fs.existsSync(contextFile)) {
    logDebug(HOOK_NAME, 'No context file found, nothing to update');
    return outputSilentSuccess();
  }

  const lockDir = `${contextFile}.lock`;

  if (!(await acquireLock(lockDir, MAX_LOCK_ATTEMPTS))) {
    logError(HOOK_NAME, 'Failed to acquire lock, skipping context update');
    return outputSilentSuccess();
  }

  try {
    const raw = fs.readFileSync(contextFile, 'utf8');
    let context: Record<string, unknown>;

    try {
      context = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      logError(HOOK_NAME, 'Context file contains invalid JSON, skipping update');
      return outputSilentSuccess();
    }

    const timestamp = formatTimestamp();

    // Update session heartbeat
    const heartbeat = (context['session_heartbeat'] as Record<string, unknown>) || {};
    heartbeat['was_cleanly_ended'] = true;
    heartbeat['last_activity'] = timestamp;
    context['session_heartbeat'] = heartbeat;

    // Write atomically using temp file
    const tempFile = `${contextFile}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(context, null, 2)}\n`);
    fs.renameSync(tempFile, contextFile);

    logInfo(HOOK_NAME, `Session cleanly ended (source: ${source})`);
  } catch (error) {
    logError(HOOK_NAME, `Failed to update context file: ${error}`);
  } finally {
    releaseLock(lockDir);
  }

  return outputSilentSuccess();
}

export default sessionEnd;
