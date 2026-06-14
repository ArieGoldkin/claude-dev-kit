/**
 * WorktreeRemove Hook - Archive continuity state for removed worktrees
 *
 * Called when Claude Code removes a git worktree. Logs the removal
 * and marks the worktree as archived in the main project's context.
 *
 * @module lifecycle/worktree-remove
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONTINUITY_DIRS, formatTimestamp } from '../lib/continuity.js';
import { acquireLock, releaseLock } from '../lib/lock.js';
import { logDebug, logError, logInfo } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'worktree-remove';
const MAX_LOCK_ATTEMPTS = 20;

/**
 * WorktreeRemove hook - archives continuity state for removed worktrees.
 *
 * Updates the main project's shared-context.json to record the worktree removal.
 * Does not delete any files — just marks the worktree as archived.
 *
 * Always returns outputSilentSuccess() -- WorktreeRemove hooks cannot block.
 *
 * @param input - Hook input from Claude Code
 * @returns HookResult (always silent success)
 */
export async function worktreeRemove(input: HookInput): Promise<HookResult> {
  const worktreePath = input.worktree_path || 'unknown';
  const mainProjectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';

  logDebug(HOOK_NAME, `Worktree removed: path=${worktreePath}`);

  const contextFile = path.join(mainProjectDir, CONTINUITY_DIRS.context, 'shared-context.json');

  if (!fs.existsSync(contextFile)) {
    logDebug(HOOK_NAME, 'No main context file found, nothing to update');
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

    // Record worktree removal in archived_worktrees array
    const archivedWorktrees =
      (context['archived_worktrees'] as Array<Record<string, unknown>>) || [];
    archivedWorktrees.push({
      path: worktreePath,
      removed_at: timestamp,
    });
    context['archived_worktrees'] = archivedWorktrees;

    // Write atomically
    const tempFile = `${contextFile}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(context, null, 2)}\n`);
    fs.renameSync(tempFile, contextFile);

    logInfo(HOOK_NAME, `Worktree removal recorded: ${worktreePath}`);
  } catch (error) {
    logError(HOOK_NAME, `Failed to update context file: ${error}`);
  } finally {
    releaseLock(lockDir);
  }

  return outputSilentSuccess();
}

export default worktreeRemove;
