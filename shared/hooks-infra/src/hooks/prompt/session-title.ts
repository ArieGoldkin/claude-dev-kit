/**
 * Session Title Hook (CC 2.1.94+)
 *
 * UserPromptSubmit hook that auto-sets the session title from the
 * current git branch name on the first prompt. Configured with
 * `once: true` in hooks.json so it fires only once per session.
 *
 * Title format:
 *   - Branch name as-is (e.g., "feat/user-auth", "fix/login-bug")
 *   - Falls back to "main" or "master" if on default branch
 *   - Skips title setting if git is unavailable or in detached HEAD
 *
 * Graceful degradation: Returns silentSuccess if git fails.
 *
 * @module prompt/session-title
 */

import { execSync } from 'node:child_process';
import { logDebug } from '../lib/logging.js';
import { outputSessionTitle, outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'session-title';

/**
 * Get the current git branch name.
 * Returns null if git is unavailable or in detached HEAD state.
 */
export function getGitBranch(cwd?: string): string | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: cwd || process.env['CLAUDE_PROJECT_DIR'] || process.cwd(),
      timeout: 2000,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (!branch || branch === 'HEAD') {
      return null;
    }
    return branch;
  } catch {
    return null;
  }
}

/**
 * Session title hook handler.
 * Reads git branch and returns sessionTitle for the session card.
 */
export default function sessionTitle(input: HookInput): HookResult {
  const branch = getGitBranch(input.cwd);

  if (!branch) {
    logDebug(HOOK_NAME, 'No git branch detected, skipping session title');
    return outputSilentSuccess();
  }

  logDebug(HOOK_NAME, `Setting session title to branch: ${branch}`);
  return outputSessionTitle(branch);
}
