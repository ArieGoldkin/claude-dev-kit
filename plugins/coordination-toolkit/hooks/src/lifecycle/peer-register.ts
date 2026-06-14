/**
 * SessionStart Hook — Register this session as a peer.
 *
 * Always shows the session name so users know how to identify
 * themselves to other sessions. First use also shows commands.
 *
 * @module lifecycle/peer-register
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { gcOrphanedClaims } from '../coordination/claims.js';
import { listPeers, registerPeer } from '../coordination/peers.js';
import { COORDINATION_DIRS } from '../coordination/types.js';
import { logDebug, logInfo } from '../lib/logging.js';
import { outputSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'peer-register';
const GITIGNORE_ENTRY = '.claude/coordination/';

/**
 * Ensure .gitignore excludes coordination state.
 * Called once on first use (alongside .welcomed marker).
 */
function ensureGitignore(projectDir: string): void {
  const gitignorePath = path.join(projectDir, '.gitignore');
  try {
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      if (content.includes(GITIGNORE_ENTRY)) return;
      fs.appendFileSync(
        gitignorePath,
        `\n# Claude coordination state (session-specific)\n${GITIGNORE_ENTRY}\n`
      );
    } else {
      fs.writeFileSync(
        gitignorePath,
        `# Claude coordination state (session-specific)\n${GITIGNORE_ENTRY}\n`
      );
    }
    logDebug(HOOK_NAME, 'Added .claude/coordination/ to .gitignore');
  } catch {
    /* non-fatal */
  }
}

export async function peerRegister(_input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';

  logDebug(HOOK_NAME, 'Registering peer on session start');

  try {
    const peer = await registerPeer(projectDir);
    logInfo(HOOK_NAME, `Peer registered: "${peer.name}" (${peer.id})`);

    // GC: listPeers cleans dead peers, then sweep orphaned claims
    const otherPeers = listPeers(projectDir).filter((p) => p.id !== peer.id);
    const gcCount = gcOrphanedClaims(projectDir);
    if (gcCount > 0) logDebug(HOOK_NAME, `GC: cleaned ${gcCount} orphaned claim(s)`);
    const othersNote =
      otherPeers.length > 0 ? ` Peers: ${otherPeers.map((p) => `"${p.name}"`).join(', ')}.` : '';

    // First use: show full welcome with commands + ensure gitignore
    const markerFile = path.join(projectDir, COORDINATION_DIRS.root, '.welcomed');
    if (!fs.existsSync(markerFile)) {
      try {
        fs.mkdirSync(path.join(projectDir, COORDINATION_DIRS.root), { recursive: true });
        fs.writeFileSync(markerFile, new Date().toISOString());
      } catch {
        /* ignore */
      }
      ensureGitignore(projectDir);
      return outputSuccess(
        `Session: "${peer.name}".${othersNote} Commands: \`/peers\`, \`/coordinate\`. File conflicts auto-detected.`
      );
    }

    // Subsequent sessions: just show name + peers
    return outputSuccess(`Session: "${peer.name}".${othersNote}`);
  } catch (err) {
    logDebug(HOOK_NAME, `Failed to register peer: ${err}`);
    return outputSuccess('cotk active.');
  }
}
