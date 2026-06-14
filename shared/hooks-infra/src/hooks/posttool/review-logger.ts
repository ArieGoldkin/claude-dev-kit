/**
 * PostToolUse Hook - Log review submissions to JSONL history file
 *
 * Detects when `glab mr note` / `glab mr approve` commands complete, OR when an
 * inline review comment is posted via the discussions API
 * (`glab api .../merge_requests/<n>/discussions --input ...`, the path
 * `/etk:post-mr-comments` actually uses), and logs the review event for
 * analytics via /review-stats. Matching the discussions path closes the G4 dead
 * feedback loop (review-mr process audit, 2026-06-07): posted findings were
 * previously never logged because only `glab mr note/approve` was matched.
 *
 * @module posttool/review-logger
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { guardBash, guardHasCommand, runGuards } from '../lib/guards.js';
import { getCommand, getSessionId } from '../lib/input.js';
import { getLogDir, logDebug, logError } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'review-logger';
const MAX_LOG_SIZE = 200 * 1024; // 200KB
export const REVIEW_COMMAND_PATTERN = /glab\s+mr\s+(note|approve)\s+(\d+)/;
// `/etk:post-mr-comments` posts inline/out-of-hunk findings via the discussions
// API (`glab api .../merge_requests/<n>/discussions --input ...`), NOT `glab mr
// note`. Match that path (with the `--input` posting signature, so read-only GETs
// on /discussions are not logged) to stop dropping posted findings (G4/A3).
export const DISCUSSION_COMMAND_PATTERN = /glab\s+api\b[\s\S]*?merge_requests\/(\d+)\/discussions/;

// =============================================================================
// LOG FILE UTILITIES
// =============================================================================

/**
 * Get the path to the review history JSONL file.
 */
export function getReviewLogPath(): string {
  return path.join(getLogDir(), 'review-history.jsonl');
}

/**
 * Rotate log file if it exceeds MAX_LOG_SIZE.
 * Renames current file to .1 (overwriting previous rotation).
 */
export function rotateIfNeeded(logPath: string): void {
  try {
    const stats = fs.statSync(logPath);
    if (stats.size > MAX_LOG_SIZE) {
      const rotatedPath = `${logPath}.1`;
      fs.renameSync(logPath, rotatedPath);
    }
  } catch {
    // File doesn't exist or can't stat — no rotation needed
  }
}

/**
 * Append a review entry to the JSONL log file.
 * Creates the directory if it doesn't exist.
 */
export function appendReviewEntry(logPath: string, entry: Record<string, unknown>): void {
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * PostToolUse hook — log review submissions to JSONL history.
 *
 * Triggered after Bash tool calls. Detects `glab mr note` / `glab mr approve`
 * commands AND inline-comment posts via the discussions API, extracts the MR
 * number, and logs to review-history.jsonl with command_type
 * `note` | `approve` | `discussion`.
 *
 * @param input - Hook input from Claude Code
 * @returns HookResult (always silent success)
 */
export async function reviewLogger(input: HookInput): Promise<HookResult> {
  const skipped = runGuards(input, guardBash, guardHasCommand);
  if (skipped) return skipped;

  const command = getCommand(input) || '';

  const noteMatch = command.match(REVIEW_COMMAND_PATTERN);
  const discussionMatch = command.match(DISCUSSION_COMMAND_PATTERN);

  let commandType: string;
  let mrNumber: string;

  if (noteMatch?.[1] && noteMatch[2]) {
    commandType = noteMatch[1]; // 'note' or 'approve'
    mrNumber = noteMatch[2];
  } else if (discussionMatch?.[1] && command.includes('--input')) {
    // inline / out-of-hunk review comment posted via /etk:post-mr-comments
    commandType = 'discussion';
    mrNumber = discussionMatch[1];
  } else {
    return outputSilentSuccess();
  }

  const sessionId = getSessionId(input) || 'unknown';

  const entry = {
    timestamp: new Date().toISOString(),
    mr_number: mrNumber,
    command_type: commandType,
    session_id: sessionId,
  };

  try {
    const logPath = getReviewLogPath();
    rotateIfNeeded(logPath);
    appendReviewEntry(logPath, entry);
    logDebug(HOOK_NAME, `Logged review: MR !${mrNumber} (${commandType})`);
  } catch (error) {
    logError(HOOK_NAME, `Failed to log review: ${error}`);
  }

  return outputSilentSuccess();
}

export default reviewLogger;
