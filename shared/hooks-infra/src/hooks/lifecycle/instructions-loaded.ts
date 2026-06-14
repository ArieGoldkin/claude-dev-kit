/**
 * InstructionsLoaded Hook - Log loaded CLAUDE.md files
 *
 * Called when Claude Code loads instruction files (CLAUDE.md, .claude/settings.json).
 * Logs which files were loaded for debugging. This is a fire-and-forget event
 * that cannot block execution.
 *
 * @module lifecycle/instructions-loaded
 */

import { logDebug, logInfo } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'instructions-loaded';

/**
 * InstructionsLoaded hook - logs which instruction files were loaded.
 *
 * Always returns outputSilentSuccess() -- this event cannot block.
 *
 * @param input - Hook input from Claude Code (source field may indicate the file path)
 * @returns HookResult (always silent success)
 */
export async function instructionsLoaded(input: HookInput): Promise<HookResult> {
  const source = input.source || 'unknown';
  const cwd = input.cwd || process.env['CLAUDE_PROJECT_DIR'] || '.';

  logDebug(HOOK_NAME, `Instructions loaded event fired, source: ${source}, cwd: ${cwd}`);
  logInfo(HOOK_NAME, `Instructions loaded: ${source}`);

  return outputSilentSuccess();
}

export default instructionsLoaded;
