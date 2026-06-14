/**
 * Notification Hook — Bridge filesystem messages to Claude Code notifications.
 *
 * When a peer sends a message, this hook can surface it as a notification
 * to the active session.
 *
 * @module lifecycle/notification-handler
 */

import { logDebug } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'notification-handler';

export async function notificationHandler(_input: HookInput): Promise<HookResult> {
  // Notification events are informational — we acknowledge them silently.
  // Peer messages are delivered via the message-checker UserPromptSubmit hook instead,
  // which has better timing (runs when the user is actively interacting).
  logDebug(HOOK_NAME, 'Notification event received');
  return outputSilentSuccess();
}
