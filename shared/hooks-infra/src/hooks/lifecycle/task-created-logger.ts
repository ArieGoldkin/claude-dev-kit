/**
 * TaskCreated Hook - Log task creation events
 *
 * Appends task creation data to a JSONL metrics file for tracking
 * task creation patterns and agent task planning behavior.
 *
 * @module lifecycle/task-created-logger
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { formatTimestamp } from '../lib/continuity.js';
import { logDebug, logError, logInfo } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'task-created-logger';
const METRICS_DIR = '.claude/continuity/metrics';
const METRICS_FILE = 'tasks.jsonl';

/**
 * TaskCreated hook - logs task creation events to JSONL file.
 *
 * Appends one JSON line per task creation to `.claude/continuity/metrics/tasks.jsonl`.
 * Creates the metrics directory if it doesn't exist.
 *
 * Always returns outputSilentSuccess() -- TaskCreated hooks cannot block.
 *
 * @param input - Hook input from Claude Code
 * @returns HookResult (always silent success)
 */
export async function taskCreatedLogger(input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';
  const agentId = input.agent_id || 'unknown';
  const sessionId = input.session_id || process.env['CLAUDE_SESSION_ID'] || 'unknown';
  const toolUseId = input.tool_use_id || undefined;

  logDebug(HOOK_NAME, `Task created: agent_id=${agentId}, session_id=${sessionId}`);

  const metricsDir = path.join(projectDir, METRICS_DIR);
  const metricsFile = path.join(metricsDir, METRICS_FILE);

  try {
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }

    const entry = {
      event: 'created',
      timestamp: formatTimestamp(),
      agent_id: agentId,
      session_id: sessionId,
      ...(toolUseId && { tool_use_id: toolUseId }),
    };

    fs.appendFileSync(metricsFile, `${JSON.stringify(entry)}\n`);

    logInfo(HOOK_NAME, `Task creation logged for agent ${agentId}`);
  } catch (error) {
    logError(HOOK_NAME, `Failed to log task creation: ${error}`);
  }

  return outputSilentSuccess();
}

export default taskCreatedLogger;
