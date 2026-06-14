/**
 * UserPromptSubmit hook that checks for unread peer messages.
 *
 * On every user prompt, reads the messages directory for unread messages
 * addressed to this session. If any exist, injects them as prompt context
 * so Claude can inform the user, then marks them as read.
 *
 * @module prompt/message-checker
 */

import { getMessages, markRead } from '../coordination/messages.js';
import { listPeers } from '../coordination/peers.js';
import { logDebug, logInfo } from '../lib/logging.js';
import { outputPromptContext, outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'message-checker';

export async function messageChecker(_input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';

  try {
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
      lines.push(`From "${senderName}": ${msg.content}`);
      markRead(projectDir, msg.id);
    }

    logInfo(HOOK_NAME, `Delivered ${messages.length} message(s)`);
    return outputPromptContext(lines.join('\n'));
  } catch {
    logDebug(HOOK_NAME, 'Message check failed');
    return outputSilentSuccess();
  }
}
