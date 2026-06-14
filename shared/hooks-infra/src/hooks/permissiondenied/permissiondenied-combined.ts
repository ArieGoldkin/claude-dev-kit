/**
 * Combined PermissionDenied Hook (Unified Dispatcher)
 *
 * Dispatches PermissionDenied events to all registered handlers:
 * 1. safe-command-retry — Retry known-safe Bash commands (sync, may return retry)
 * 2. project-write-retry — Retry in-project Write/Edit (sync, may return retry)
 * 3. denial-notification — Desktop notification on repeated denials (async)
 * 4. denial-logger — Log denial to .claude/feedback/ (async)
 *
 * Performance budget: <50ms for sync path.
 * If any retry hook returns {retry: true}, the dispatcher returns it immediately.
 * Async hooks (notification, logger) run after retry decision.
 *
 * @module permissiondenied/permissiondenied-combined
 */

import { logDebug, logInfo } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';
import { denialLogger } from './denial-logger.js';
import { denialNotification } from './denial-notification.js';
import { projectWriteRetry } from './project-write-retry.js';
import { safeCommandRetry } from './safe-command-retry.js';

const HOOK_NAME = 'permissiondenied-combined';

/**
 * Check if a hook result requests a retry.
 */
function isRetryDecision(result: HookResult): boolean {
  return result.hookSpecificOutput?.retry === true;
}

/**
 * Combined PermissionDenied dispatcher.
 *
 * Runs retry hooks first (short-circuits on first retry), then async hooks.
 */
export async function permissionDeniedCombined(input: HookInput): Promise<HookResult> {
  logDebug(
    HOOK_NAME,
    `Denial event: ${input.tool_name} — ${(input.tool_input?.command || input.tool_input?.file_path || '').slice(0, 80)}`
  );

  // Phase 1: Try retry hooks (sync path, <50ms budget)
  const retryHooks = [safeCommandRetry, projectWriteRetry];

  for (const hook of retryHooks) {
    const result = await hook(input);
    if (isRetryDecision(result)) {
      logInfo(HOOK_NAME, `Retry granted by ${hook.name}`);
      // Still run async hooks (logging, notification) in background
      Promise.all([denialNotification(input).catch(() => {}), denialLogger(input).catch(() => {})]);
      return result;
    }
  }

  // Phase 2: No retry — run async hooks
  await Promise.all([
    denialNotification(input).catch(() => {}),
    denialLogger(input).catch(() => {}),
  ]);

  logDebug(HOOK_NAME, 'No retry — denial logged');
  return outputSilentSuccess();
}
