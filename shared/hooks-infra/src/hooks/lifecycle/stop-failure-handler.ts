/**
 * StopFailure Hook - Log API errors that terminate a turn
 *
 * When Claude's turn ends due to an API error (rate limit, auth failure,
 * network error, server error), this hook logs the error type and updates
 * shared-context.json with the failure details.
 *
 * IMPORTANT: This hook must NEVER re-feed errors to Claude or return
 * blocking results. Doing so can cause an infinite loop (fixed in v2.1.78).
 * Always return outputSilentSuccess().
 *
 * @module lifecycle/stop-failure-handler
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONTINUITY_DIRS, formatTimestamp } from '../lib/continuity.js';
import { acquireLock, releaseLock } from '../lib/lock.js';
import { logError, logInfo, logWarn } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'stop-failure-handler';
const MAX_LOCK_ATTEMPTS = 20;

/**
 * StopFailure hook - logs API errors and updates session state.
 *
 * Updates shared-context.json with:
 * - last_api_error = { error_type, timestamp, session_id }
 * - session_heartbeat.last_activity = current timestamp
 *
 * Always returns outputSilentSuccess() -- StopFailure hooks cannot block.
 *
 * @param input - Hook input from Claude Code (StopFailure event)
 * @returns HookResult (always silent success)
 */
export async function stopFailureHandler(input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';
  const sessionId = input.session_id || 'unknown';
  const errorType = input.source || 'unknown';

  logWarn(HOOK_NAME, `API failure: type=${errorType}, session=${sessionId}`);

  const contextFile = path.join(projectDir, CONTINUITY_DIRS.context, 'shared-context.json');

  if (!fs.existsSync(contextFile)) {
    logInfo(HOOK_NAME, 'No context file found, logging failure without context update');
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

    // Record API error
    context['last_api_error'] = {
      error_type: errorType,
      session_id: sessionId,
      timestamp,
    };

    // Write atomically
    const tempFile = `${contextFile}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(context, null, 2)}\n`);
    fs.renameSync(tempFile, contextFile);

    logInfo(HOOK_NAME, `API failure recorded (type: ${errorType})`);
  } catch (error) {
    logError(HOOK_NAME, `Failed to update context file: ${error}`);
  } finally {
    releaseLock(lockDir);
  }

  return outputSilentSuccess();
}

export default stopFailureHandler;
