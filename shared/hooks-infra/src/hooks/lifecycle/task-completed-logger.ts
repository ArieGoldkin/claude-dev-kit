/**
 * TaskCompleted Hook - Log task completion metrics
 *
 * Appends task completion data to a JSONL metrics file for tracking
 * agent task throughput and patterns.
 *
 * @module lifecycle/task-completed-logger
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { formatTimestamp } from '../lib/continuity.js';
import { logDebug, logError, logInfo } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'task-completed-logger';
const METRICS_DIR = '.claude/continuity/metrics';
const METRICS_FILE = 'tasks.jsonl';

/**
 * TaskCompleted hook - logs task completion metrics to JSONL file.
 *
 * Appends one JSON line per task completion to `.claude/continuity/metrics/tasks.jsonl`.
 * Creates the metrics directory if it doesn't exist.
 *
 * Always returns outputSilentSuccess() -- TaskCompleted hooks cannot block.
 *
 * @param input - Hook input from Claude Code
 * @returns HookResult (always silent success)
 */
export async function taskCompletedLogger(input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';
  const agentId = input.agent_id || 'unknown';
  const sessionId = input.session_id || process.env['CLAUDE_SESSION_ID'] || 'unknown';
  const toolUseId = input.tool_use_id || undefined;

  logDebug(HOOK_NAME, `Task completed: agent_id=${agentId}, session_id=${sessionId}`);

  const metricsDir = path.join(projectDir, METRICS_DIR);
  const metricsFile = path.join(metricsDir, METRICS_FILE);

  try {
    // Ensure metrics directory exists
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }

    const entry = {
      timestamp: formatTimestamp(),
      agent_id: agentId,
      session_id: sessionId,
      ...(toolUseId && { tool_use_id: toolUseId }),
    };

    fs.appendFileSync(metricsFile, `${JSON.stringify(entry)}\n`);

    logInfo(HOOK_NAME, `Task completion logged for agent ${agentId}`);
  } catch (error) {
    logError(HOOK_NAME, `Failed to log task completion: ${error}`);
  }

  return outputSilentSuccess();
}

export default taskCompletedLogger;
