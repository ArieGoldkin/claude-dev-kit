/**
 * Stop Hook - Capture final session state on Claude stop
 *
 * When Claude stops (user interruption, natural end, or subagent completion),
 * captures the last_assistant_message and updates shared-context.json with
 * final session state. This provides a snapshot of what Claude was doing
 * when the session ended, useful for resume-session context.
 *
 * @module lifecycle/stop-state-saver
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONTINUITY_DIRS, formatTimestamp } from '../lib/continuity.js';
import { acquireLock, releaseLock } from '../lib/lock.js';
import { logDebug, logError, logInfo } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import { truncateForLLM } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'stop-state-saver';
const MAX_LOCK_ATTEMPTS = 20;

/**
 * Stop hook - captures last_assistant_message and updates session state.
 *
 * Updates:
 * - session_heartbeat.last_activity = current timestamp
 * - last_stop = { reason, last_message (truncated), timestamp }
 *
 * Always returns outputSilentSuccess(). Since CC v2.1.163 Stop hooks CAN
 * return hookSpecificOutput.additionalContext (see outputStopContext) to
 * feed Claude and continue the turn — deliberately unused here: this hook
 * is a silent state-saver and must never keep the turn alive.
 *
 * @param input - Hook input from Claude Code (includes last_assistant_message)
 * @returns HookResult (always silent success)
 */
export async function stopStateSaver(input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';
  const lastMessage = input.last_assistant_message || '';
  const source = input.source || 'unknown';

  logDebug(HOOK_NAME, `Stop event: reason=${source}, message_length=${lastMessage.length}`);

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
    heartbeat['last_activity'] = timestamp;
    context['session_heartbeat'] = heartbeat;

    // Record stop event with truncated last message
    context['last_stop'] = {
      source,
      last_message: lastMessage ? truncateForLLM(lastMessage, { maxChars: 500 }) : '',
      timestamp,
    };

    // Write atomically
    const tempFile = `${contextFile}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(context, null, 2)}\n`);
    fs.renameSync(tempFile, contextFile);

    logInfo(HOOK_NAME, `Stop state captured (reason: ${source})`);
  } catch (error) {
    logError(HOOK_NAME, `Failed to update context file: ${error}`);
  } finally {
    releaseLock(lockDir);
  }

  return outputSilentSuccess();
}

export default stopStateSaver;
