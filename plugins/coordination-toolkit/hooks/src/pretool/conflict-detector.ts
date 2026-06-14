/**
 * PreToolUse Hook — Detect file conflicts and auto-claim files.
 * Fires on Write, Edit, MultiEdit.
 *
 * @module pretool/conflict-detector
 */

import { claimFile, getClaimOwner } from '../coordination/claims.js';
import { listPeers } from '../coordination/peers.js';
import { guardWriteEdit, runGuards } from '../lib/guards.js';
import { getFilePath } from '../lib/input.js';
import { logDebug, logInfo } from '../lib/logging.js';
import { outputSilentSuccess, outputWithNotification } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'conflict-detector';

export async function conflictDetector(input: HookInput): Promise<HookResult> {
  const skipped = runGuards(input, guardWriteEdit);
  if (skipped) return skipped;

  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';
  const filePath = getFilePath(input);

  if (!filePath) {
    logDebug(HOOK_NAME, 'No file path in input, skipping');
    return outputSilentSuccess();
  }

  // Check if another session has claimed this file
  const claim = getClaimOwner(projectDir, filePath);

  if (claim) {
    const sessionId = process.env['CLAUDE_SESSION_ID'] || '';
    if (claim.claimed_by !== sessionId) {
      // Find peer info for the claimer
      const peers = listPeers(projectDir);
      const claimer = peers.find((p) => p.id === claim.claimed_by);
      const peerName = claimer?.name || claim.claimed_by.slice(0, 8);
      const summary = claimer?.summary || 'unknown task';
      const branch = claimer?.branch || 'unknown branch';

      logInfo(HOOK_NAME, `Conflict: ${filePath} claimed by ${peerName}`);

      const userMsg = `\u26a0 Conflict: ${filePath} is being edited by "${peerName}" (${branch})`;
      const claudeCtx = [
        `File conflict detected: \`${filePath}\``,
        `Session "${peerName}" on branch \`${branch}\` is editing this file.`,
        `Their task: ${summary}`,
        `Claim expires: ${claim.expires_at}`,
        `To message them: send a message to "${peerName}" via the coordination system.`,
      ].join('\n');

      return outputWithNotification(userMsg, claudeCtx);
    }
  }

  // No conflict — auto-claim the file
  try {
    await claimFile(projectDir, filePath);
    logDebug(HOOK_NAME, `Auto-claimed ${filePath}`);
  } catch {
    logDebug(HOOK_NAME, `Failed to auto-claim ${filePath}`);
  }

  return outputSilentSuccess();
}
