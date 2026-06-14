/**
 * WorktreeCreate Hook - Initialize continuity for new worktrees
 *
 * Called when Claude Code creates a git worktree. Initializes
 * continuity context in the new worktree directory.
 *
 * @module lifecycle/worktree-create
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONTINUITY_DIRS, formatTimestamp } from '../lib/continuity.js';
import { logDebug, logError, logInfo } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'worktree-create';

/**
 * WorktreeCreate hook - initializes continuity context for new worktrees.
 *
 * Creates `.claude/context/shared-context.json` in the worktree directory
 * with a minimal context structure linking back to the main project.
 *
 * Always returns outputSilentSuccess() -- WorktreeCreate hooks cannot block.
 *
 * @param input - Hook input from Claude Code
 * @returns HookResult (always silent success)
 */
export async function worktreeCreate(input: HookInput): Promise<HookResult> {
  const worktreePath = input.worktree_path || input.cwd || '.';
  const worktreeBranch = input.worktree_branch || 'unknown';
  const mainProjectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';

  logDebug(HOOK_NAME, `Worktree created: path=${worktreePath}, branch=${worktreeBranch}`);

  try {
    // Create context directory in worktree
    const contextDir = path.join(worktreePath, CONTINUITY_DIRS.context);
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }

    // Create minimal context file for the worktree
    const contextFile = path.join(contextDir, 'shared-context.json');
    if (!fs.existsSync(contextFile)) {
      const timestamp = formatTimestamp();
      const worktreeContext = {
        version: '1.0.0',
        timestamp,
        worktree: {
          path: worktreePath,
          branch: worktreeBranch,
          main_project: mainProjectDir,
          created_at: timestamp,
        },
        session_heartbeat: {
          last_activity: timestamp,
          session_start: timestamp,
          was_cleanly_ended: false,
        },
        dirty_tracking: {
          files_edited_count: 0,
          files_edited_this_session: [],
          threshold_warning: 15,
          threshold_auto_suggest: 25,
        },
      };

      fs.writeFileSync(contextFile, `${JSON.stringify(worktreeContext, null, 2)}\n`);
      logInfo(HOOK_NAME, `Initialized continuity context for worktree: ${worktreeBranch}`);
    } else {
      logDebug(HOOK_NAME, 'Worktree context already exists, skipping initialization');
    }
  } catch (error) {
    logError(HOOK_NAME, `Failed to initialize worktree context: ${error}`);
  }

  return outputSilentSuccess();
}

export default worktreeCreate;
