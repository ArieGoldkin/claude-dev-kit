/**
 * PostToolUse hook that checks for unread peer messages with throttling.
 *
 * Fires on every tool use (async) but only actually checks for messages
 * if the bridge feature is enabled and enough time has passed since the
 * last check (THROTTLE_MS). This gives near-instant message delivery
 * during active coding without excessive overhead.
 *
 * Requires opt-in via /setup-bridge (creates .bridge-enabled marker).
 *
 * @module posttool/bridge-message-checker
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getMessages, isBridgeEnabled, markRead } from '../coordination/messages.js';
import { listPeers } from '../coordination/peers.js';
import { COORDINATION_DIRS } from '../coordination/types.js';
import { logDebug, logInfo } from '../lib/logging.js';
import { outputSilentSuccess, outputWithContext } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'bridge-message-checker';
const THROTTLE_MS = 3_000; // Check at most once every 3 seconds
const THROTTLE_FILE = '.last-message-check';

function getThrottlePath(projectDir: string): string {
  return path.join(projectDir, COORDINATION_DIRS.root, THROTTLE_FILE);
}

function shouldThrottle(projectDir: string): boolean {
  const throttlePath = getThrottlePath(projectDir);
  try {
    const content = fs.readFileSync(throttlePath, 'utf8');
    const lastCheck = Number.parseInt(content, 10);
    return Date.now() - lastCheck < THROTTLE_MS;
  } catch {
    return false; // No throttle file = never checked = don't throttle
  }
}

function updateThrottle(projectDir: string): void {
  try {
    const dir = path.join(projectDir, COORDINATION_DIRS.root);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getThrottlePath(projectDir), String(Date.now()));
  } catch {
    // Best-effort
  }
}

export async function bridgeMessageChecker(_input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';

  try {
    // Fast exits: bridge not enabled or throttled
    if (!isBridgeEnabled(projectDir)) {
      return outputSilentSuccess();
    }

    if (shouldThrottle(projectDir)) {
      return outputSilentSuccess();
    }

    updateThrottle(projectDir);

    const messages = getMessages(projectDir);
    if (messages.length === 0) {
      return outputSilentSuccess();
    }

    const peers = listPeers(projectDir);
    const lines: string[] = [
      `\u{1F4EC} ${messages.length} unread message(s) from peer sessions:\n`,
    ];

    for (const msg of messages) {
      const peer = peers.find((p) => p.id === msg.from);
      const senderName = peer?.name || `${msg.from.slice(0, 8)}...`;
      const typeTag = msg.type ? ` [${msg.type}]` : '';
      const replyTag = msg.inReplyTo ? ` (reply to ${msg.inReplyTo.slice(0, 12)}...)` : '';
      lines.push(`From "${senderName}"${typeTag}${replyTag}: ${msg.content}`);
      markRead(projectDir, msg.id);
    }

    logInfo(HOOK_NAME, `Delivered ${messages.length} message(s) via bridge`);
    return outputWithContext(lines.join('\n'));
  } catch {
    logDebug(HOOK_NAME, 'Bridge message check failed');
    return outputSilentSuccess();
  }
}
