/**
 * TeammateIdle Hook - Auto-save continuity state on teammate idle
 *
 * When a teammate agent goes idle, updates shared-context.json heartbeat
 * to prevent state loss if the session ends abruptly.
 *
 * @module lifecycle/teammate-idle-saver
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONTINUITY_DIRS, formatTimestamp } from '../lib/continuity.js';
import { acquireLock, releaseLock } from '../lib/lock.js';
import { logDebug, logError, logInfo } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'teammate-idle-saver';
const MAX_LOCK_ATTEMPTS = 20;

/**
 * TeammateIdle hook - updates shared-context.json heartbeat on teammate idle.
 *
 * Updates:
 * - session_heartbeat.last_activity = current timestamp
 * - last_agent_idle = { agent_id, timestamp }
 *
 * Always returns outputSilentSuccess() -- TeammateIdle hooks cannot block.
 *
 * @param input - Hook input from Claude Code
 * @returns HookResult (always silent success)
 */
export async function teammateIdleSaver(input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';
  const agentId = input.agent_id || 'unknown';
  const agentType = input.agent_type || 'unknown';

  logDebug(HOOK_NAME, `Teammate idle: agent_id=${agentId}, agent_type=${agentType}`);

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

    // Record last agent idle event
    context['last_agent_idle'] = {
      agent_id: agentId,
      agent_type: agentType,
      timestamp,
    };

    // Write atomically
    const tempFile = `${contextFile}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(context, null, 2)}\n`);
    fs.renameSync(tempFile, contextFile);

    logInfo(HOOK_NAME, `Heartbeat updated on teammate idle (agent: ${agentId})`);
  } catch (error) {
    logError(HOOK_NAME, `Failed to update context file: ${error}`);
  } finally {
    releaseLock(lockDir);
  }

  return outputSilentSuccess();
}

export default teammateIdleSaver;
