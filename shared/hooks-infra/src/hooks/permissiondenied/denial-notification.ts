/**
 * Denial Notification — PermissionDenied Hook
 *
 * Sends a desktop notification when 3+ denials occur within a 60-second
 * sliding window, signaling potential permission misconfiguration.
 *
 * Cooldown: max 1 notification per 5 minutes.
 *
 * @module permissiondenied/denial-notification
 */

import { execSync } from 'node:child_process';
import { logDebug, logInfo, logWarn } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'denial-notification';

/** Threshold: number of denials in window to trigger notification */
const DENIAL_THRESHOLD = 3;

/** Sliding window size in milliseconds (60 seconds) */
const WINDOW_MS = 60_000;

/** Cooldown between notifications in milliseconds (5 minutes) */
const COOLDOWN_MS = 300_000;

/** Timestamps of recent denials */
const denialTimestamps: number[] = [];

/** Last notification timestamp */
let lastNotificationTime = 0;

/**
 * Send a macOS desktop notification.
 */
function sendNotification(title: string, message: string): void {
  try {
    const escapedTitle = title.replace(/"/g, '\\"');
    const escapedMessage = message.replace(/"/g, '\\"');
    execSync(
      `osascript -e 'display notification "${escapedMessage}" with title "${escapedTitle}"'`,
      { timeout: 3000 }
    );
  } catch {
    logWarn(HOOK_NAME, 'Failed to send desktop notification');
  }
}

/**
 * Track denials and notify when threshold is exceeded.
 */
export async function denialNotification(input: HookInput): Promise<HookResult> {
  const now = Date.now();

  // Add current denial to window
  denialTimestamps.push(now);

  // Prune denials outside the sliding window
  while (denialTimestamps.length > 0 && (denialTimestamps[0] ?? 0) < now - WINDOW_MS) {
    denialTimestamps.shift();
  }

  logDebug(HOOK_NAME, `Denials in window: ${denialTimestamps.length}/${DENIAL_THRESHOLD}`);

  // Check if threshold exceeded
  if (denialTimestamps.length < DENIAL_THRESHOLD) {
    return outputSilentSuccess();
  }

  // Check cooldown
  if (now - lastNotificationTime < COOLDOWN_MS) {
    logDebug(HOOK_NAME, 'Notification cooldown active, skipping');
    return outputSilentSuccess();
  }

  // Send notification
  const toolName = input.tool_name || 'unknown';
  const detail = input.tool_input?.command?.slice(0, 50) || input.tool_input?.file_path || '';
  sendNotification(
    'Claude Code: Permission Denials',
    `${denialTimestamps.length} denials in 60s. Latest: ${toolName} ${detail}. Check /permissions.`
  );

  lastNotificationTime = now;
  logInfo(HOOK_NAME, `Notification sent: ${denialTimestamps.length} denials in window`);

  return outputSilentSuccess();
}
