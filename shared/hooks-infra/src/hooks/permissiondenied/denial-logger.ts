/**
 * Denial Logger — PermissionDenied Hook
 *
 * Async hook that logs auto-mode denials to .claude/feedback/*.json
 * for analysis and permission rule tuning.
 *
 * Runs asynchronously — does NOT block the PermissionDenied flow.
 *
 * @module permissiondenied/denial-logger
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getProjectDir } from '../lib/input.js';
import { logError, logInfo } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'denial-logger';

export interface DenialLogEntry {
  timestamp: string;
  session_id: string;
  tool_name: string;
  command_or_path: string;
  agent_id?: string | undefined;
}

/**
 * Log a PermissionDenied event to .claude/feedback/denials.jsonl.
 */
export async function denialLogger(input: HookInput): Promise<HookResult> {
  try {
    const projectDir = getProjectDir();
    const feedbackDir = path.join(projectDir, '.claude', 'feedback');

    // Ensure directory exists
    fs.mkdirSync(feedbackDir, { recursive: true });

    const entry: DenialLogEntry = {
      timestamp: new Date().toISOString(),
      session_id: input.session_id || process.env['CLAUDE_SESSION_ID'] || 'unknown',
      tool_name: input.tool_name || 'unknown',
      command_or_path: input.tool_input?.command || input.tool_input?.file_path || '',
      agent_id: input.agent_id,
    };

    const logFile = path.join(feedbackDir, 'denials.jsonl');
    fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`);

    logInfo(HOOK_NAME, `Logged denial: ${entry.tool_name} — ${entry.command_or_path.slice(0, 80)}`);
  } catch (err) {
    logError(HOOK_NAME, `Failed to log denial: ${err}`);
  }

  return outputSilentSuccess();
}
