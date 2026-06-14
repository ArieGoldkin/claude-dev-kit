/**
 * PostToolUse Hook — Announce file edits to peer registry.
 * Updates this session's files_editing list after Write/Edit/MultiEdit.
 *
 * @module posttool/peer-announcer
 */

import { updateHeartbeat } from '../coordination/peers.js';
import { guardWriteEdit, runGuards } from '../lib/guards.js';
import { getFilePath } from '../lib/input.js';
import { logDebug } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'peer-announcer';

/** Track files edited this session to update peer registry */
const filesEdited = new Set<string>();

export async function peerAnnouncer(input: HookInput): Promise<HookResult> {
  const skipped = runGuards(input, guardWriteEdit);
  if (skipped) return skipped;

  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';
  const filePath = getFilePath(input);

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Track the file
  filesEdited.add(filePath);

  // Update peer registry with current files
  try {
    await updateHeartbeat(projectDir, {
      status: 'busy',
      files_editing: Array.from(filesEdited),
    });
    logDebug(HOOK_NAME, `Announced edit: ${filePath} (${filesEdited.size} total)`);
  } catch {
    logDebug(HOOK_NAME, `Failed to announce edit: ${filePath}`);
  }

  return outputSilentSuccess();
}
