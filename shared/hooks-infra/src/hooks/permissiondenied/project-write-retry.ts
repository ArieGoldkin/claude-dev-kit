/**
 * Project Write Retry — PermissionDenied Hook
 *
 * Retries Write/Edit operations within the project directory that were
 * incorrectly denied by the auto-mode classifier. Reuses isWithinProject()
 * and protected path patterns from existing hooks.
 *
 * Does NOT retry writes to env files, credentials, system dirs, etc.
 *
 * @module permissiondenied/project-write-retry
 */

import { getFilePath } from '../lib/input.js';
import { logDebug, logInfo } from '../lib/logging.js';
import { outputRetry, outputSilentSuccess } from '../lib/output.js';
import { isProtectedPath, isWithinProject } from '../lib/path-utils.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'project-write-retry';

/** Tools that perform write operations */
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

/**
 * Retry in-project Write/Edit operations denied by auto-mode.
 */
export async function projectWriteRetry(input: HookInput): Promise<HookResult> {
  // Only handle Write/Edit/MultiEdit denials
  if (!WRITE_TOOLS.has(input.tool_name)) {
    return outputSilentSuccess();
  }

  const filePath = getFilePath(input);
  if (!filePath) {
    logDebug(HOOK_NAME, 'No file_path in input, skipping');
    return outputSilentSuccess();
  }

  // Check if the file is within the project directory
  if (!isWithinProject(filePath)) {
    logDebug(HOOK_NAME, `Outside project: ${filePath}`);
    return outputSilentSuccess();
  }

  // Check if the file matches protected patterns (env, credentials, git, etc.)
  const protectedResult = isProtectedPath(filePath);
  if (protectedResult.isProtected) {
    logDebug(HOOK_NAME, `Protected file (${protectedResult.category}): ${filePath}`);
    return outputSilentSuccess();
  }

  logInfo(HOOK_NAME, `Retrying in-project write: ${filePath}`);
  return outputRetry();
}
