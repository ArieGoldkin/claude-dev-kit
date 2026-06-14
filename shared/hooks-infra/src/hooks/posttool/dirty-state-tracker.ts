/**
 * PostToolUse Hook - Tracks file edits for dirty flag auto-handoff
 *
 * This hook is called automatically by Claude Code after Write/Edit/MultiEdit tool calls.
 * It maintains a count of unique files edited during the session and warns the
 * user when they should consider creating a handoff.
 *
 * TypeScript port of scripts/post-tool-use-hook.sh
 *
 * @module posttool/dirty-state-tracker
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { guardTool, runGuards } from '../lib/guards.js';
import { getFilePath } from '../lib/input.js';
import { logDebug, logError, logWarn } from '../lib/logging.js';
import { outputSilentSuccess, outputWarning } from '../lib/output.js';
import type { HookInput, HookResult, SharedContext } from '../types.js';

const HOOK_NAME = 'post-tool-use';

// =============================================================================
// LOCKING UTILITIES
// =============================================================================

/**
 * Acquire a lock using mkdir (atomic on POSIX systems).
 *
 * Creates a lock directory at the specified path. If the directory already
 * exists, waits and retries up to maxAttempts times with 100ms delay between
 * attempts.
 *
 * @param lockPath - Path to the lock directory
 * @param maxAttempts - Maximum number of acquisition attempts (default: 50 = 5s)
 * @returns True if lock was acquired, false if timeout
 */
export async function acquireLock(lockPath: string, maxAttempts = 50): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      fs.mkdirSync(lockPath);
      // Store PID for stale lock detection
      fs.writeFileSync(path.join(lockPath, 'pid'), process.pid.toString());
      return true;
    } catch {
      // Lock exists or other error - wait and retry
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return false;
}

/**
 * Release a lock by removing the lock directory.
 *
 * @param lockPath - Path to the lock directory
 */
export function releaseLock(lockPath: string): void {
  try {
    fs.rmSync(lockPath, { recursive: true, force: true });
  } catch {
    // Silently ignore release errors
  }
}

// =============================================================================
// CONTEXT FILE UTILITIES
// =============================================================================

/**
 * Get the path to the shared context file.
 *
 * @param projectDir - The project directory path
 * @returns The path to shared-context.json
 */
export function getContextFilePath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'context', 'shared-context.json');
}

/**
 * Read and parse the shared context file.
 *
 * @param contextFile - Path to the context file
 * @returns Parsed SharedContext or null on error
 */
export function readContextFile(contextFile: string): SharedContext | null {
  try {
    const content = fs.readFileSync(contextFile, 'utf-8');
    return JSON.parse(content) as SharedContext;
  } catch {
    return null;
  }
}

/**
 * Write the shared context file atomically.
 *
 * Writes to a temporary file first, then renames to avoid corruption.
 *
 * @param contextFile - Path to the context file
 * @param context - The context object to write
 */
export function writeContextFile(contextFile: string, context: SharedContext): void {
  const tmpFile = `${contextFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(context, null, 2));
  fs.renameSync(tmpFile, contextFile);
}

// =============================================================================
// DIRTY TRACKING LOGIC
// =============================================================================

/**
 * Update the context with a new file edit.
 *
 * Adds the file to files_edited_this_session (if not already present),
 * increments files_edited_count only for new files, and updates timestamps.
 *
 * @param context - The shared context object
 * @param filePath - The file path that was edited
 * @returns Object with updated context and whether this was a new file
 */
export function updateContextWithEdit(
  context: SharedContext,
  filePath: string
): { context: SharedContext; isNewFile: boolean } {
  const timestamp = new Date().toISOString();

  // Initialize dirty_tracking if not present
  context.dirty_tracking = context.dirty_tracking || {
    files_edited_count: 0,
    files_edited_this_session: [],
    threshold_warning: 15,
    threshold_auto_suggest: 25,
  };

  // Get current array of edited files
  const filesEdited = context.dirty_tracking.files_edited_this_session || [];

  // Check if this is a new file (not already in the array)
  const isNewFile = !filesEdited.includes(filePath);

  // Add file if new (deduplication)
  if (isNewFile) {
    filesEdited.push(filePath);
    context.dirty_tracking.files_edited_count =
      (context.dirty_tracking.files_edited_count || 0) + 1;
  }

  // Update arrays and timestamps
  context.dirty_tracking.files_edited_this_session = filesEdited;
  context.dirty_tracking.last_edit_timestamp = timestamp;

  // Initialize and update session heartbeat
  context.session_heartbeat = context.session_heartbeat || {
    was_cleanly_ended: false,
  };
  context.session_heartbeat.last_activity = timestamp;

  return { context, isNewFile };
}

/**
 * Determine the appropriate response based on edit count and thresholds.
 *
 * @param count - Current count of unique files edited
 * @param thresholdWarning - Threshold for initial warning (default: 15)
 * @param thresholdAuto - Threshold for auto-suggest handoff (default: 25)
 * @returns HookResult with appropriate message or silent success
 */
export function getThresholdResponse(
  count: number,
  thresholdWarning: number,
  thresholdAuto: number
): HookResult {
  if (count >= thresholdAuto) {
    return outputWarning(
      `${count} unique files edited this session. Consider running /create-handoff to save progress.`
    );
  }

  if (count >= thresholdWarning) {
    return outputWarning(
      `${count} unique files edited. Will suggest handoff at ${thresholdAuto} files.`
    );
  }

  return outputSilentSuccess();
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Extract all file paths from the hook input, handling Write, Edit, and MultiEdit.
 *
 * @param input - Hook input from Claude Code
 * @returns Array of unique file paths
 */
function getEditedFilePaths(input: HookInput): string[] {
  const toolName = input.tool_name;

  if (toolName === 'MultiEdit') {
    const edits = input.tool_input.edits;
    if (!Array.isArray(edits)) return [];
    const paths = new Set<string>();
    for (const edit of edits) {
      if (typeof edit.file_path === 'string' && edit.file_path) {
        paths.add(edit.file_path);
      }
    }
    return Array.from(paths);
  }

  const fp = getFilePath(input);
  return fp ? [fp] : [];
}

/**
 * PostToolUse hook - tracks file edits for dirty flag auto-handoff.
 *
 * This hook is triggered after Write, Edit, and MultiEdit tool calls. It:
 * 1. Checks if the tool is Write, Edit, or MultiEdit (ignores all others)
 * 2. Extracts file path(s) from the input
 * 3. Updates the shared context file with the edit(s)
 * 4. Warns the user if edit count exceeds thresholds
 *
 * @param input - Hook input from Claude Code
 * @returns HookResult indicating success or warning
 *
 * @example
 * ```typescript
 * const result = await dirtyStateTracker({
 *   tool_name: 'Write',
 *   tool_input: { file_path: '/path/to/file.ts', content: '...' }
 * });
 * // On success: { continue: true, suppressOutput: true }
 * // On threshold warning: { continue: true, systemMessage: "\u26a0 15 unique files..." }
 * ```
 */
export async function dirtyStateTracker(input: HookInput): Promise<HookResult> {
  const skipped = runGuards(input, (i) => guardTool(i, 'Write', 'Edit', 'MultiEdit'));
  if (skipped) return skipped;

  const filePaths = getEditedFilePaths(input);
  if (filePaths.length === 0) {
    logDebug(HOOK_NAME, 'No file paths found in input');
    return outputSilentSuccess();
  }

  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';
  const contextFile = getContextFilePath(projectDir);
  const lockDir = `${contextFile}.lock`;

  // Check if context file exists
  if (!fs.existsSync(contextFile)) {
    logDebug(HOOK_NAME, `Context file not found: ${contextFile}`);
    return outputSilentSuccess();
  }

  // Check if context file is writable
  try {
    fs.accessSync(contextFile, fs.constants.W_OK);
  } catch {
    logWarn(HOOK_NAME, 'Context file not writable');
    return outputSilentSuccess();
  }

  // Acquire lock to prevent race conditions on parallel edits
  const lockAcquired = await acquireLock(lockDir);
  if (!lockAcquired) {
    logWarn(HOOK_NAME, 'Failed to acquire lock after 5s, skipping');
    return outputSilentSuccess();
  }

  try {
    // Read context file
    const context = readContextFile(contextFile);
    if (!context) {
      logError(HOOK_NAME, 'Failed to parse context file');
      return outputSilentSuccess();
    }

    // Update context with each edited file path
    let updatedContext = context;
    for (const fp of filePaths) {
      ({ context: updatedContext } = updateContextWithEdit(updatedContext, fp));
    }

    // Write atomically
    writeContextFile(contextFile, updatedContext);

    // Get updated count and thresholds
    const count = updatedContext.dirty_tracking.files_edited_count;
    const thresholdWarning = updatedContext.dirty_tracking.threshold_warning || 15;
    const thresholdAuto = updatedContext.dirty_tracking.threshold_auto_suggest || 25;

    logDebug(HOOK_NAME, `Count=${count} (unique files)`);

    // Check thresholds and return appropriate response
    return getThresholdResponse(count, thresholdWarning, thresholdAuto);
  } catch (error) {
    logError(HOOK_NAME, `Error updating context: ${error}`);
    return outputSilentSuccess();
  } finally {
    releaseLock(lockDir);
  }
}

export default dirtyStateTracker;
