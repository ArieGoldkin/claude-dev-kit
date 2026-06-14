/**
 * Peer registry for multi-session coordination.
 *
 * Each Claude Code session registers itself as a peer by writing a JSON file
 * under `.claude/coordination/peers/<session-id>.json`. Liveness is determined
 * by OS-level PID checks (`process.kill(pid, 0)`), with PID reuse mitigation
 * via the peer's `started_at` timestamp. Stale peers (dead PID or unreasonable
 * age) are automatically cleaned up when the peer list is read.
 *
 * File access is protected by mkdir-based atomic locks from the shared
 * hooks-infra lock library.
 *
 * @module coordination/peers
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { acquireLock, releaseLock } from '../lib/lock.js';
import { logDebug, logInfo, logWarn } from '../lib/logging.js';
import { isPeerAlive } from './process-utils.js';
import { COORDINATION_DIRS, SESSION_ID_FILE } from './types.js';
import type { PeerInfo } from './types.js';

const MODULE = 'peers';

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function getPeerFilePath(projectDir: string, peerId: string): string {
  return path.join(projectDir, COORDINATION_DIRS.peers, `${peerId}.json`);
}

function getCurrentBranch(cwd: string): string | null {
  try {
    return (
      execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', {
        cwd,
        encoding: 'utf-8',
      }).trim() || null
    );
  } catch {
    return null;
  }
}

/**
 * Generate a human-friendly session name from the git branch.
 *
 * Uses the full branch name (e.g., "feat/auth") for maximum clarity.
 * When two sessions share a branch, appends "-2", "-3", etc.
 * Falls back to "session" when no branch is available (detached HEAD).
 */
function generatePeerName(branch: string | null, projectDir: string): string {
  const name = branch || 'session';

  // Check for name collisions with existing peers
  const peersDir = path.join(projectDir, COORDINATION_DIRS.peers);
  if (!fs.existsSync(peersDir)) return name;

  const existing: string[] = [];
  for (const file of fs.readdirSync(peersDir).filter((f) => f.endsWith('.json'))) {
    try {
      const content = fs.readFileSync(path.join(peersDir, file), 'utf8');
      const peer = JSON.parse(content) as PeerInfo;
      if (peer.name) existing.push(peer.name);
    } catch {
      // Skip corrupt files
    }
  }

  if (!existing.includes(name)) return name;

  // Collision: find next available suffix
  let i = 2;
  while (existing.includes(`${name}-${i}`)) i++;
  return `${name}-${i}`;
}

/**
 * Register the current session as a peer.
 *
 * Creates (or overwrites) `<projectDir>/.claude/coordination/peers/<id>.json`
 * with the session's metadata. Uses a lock to prevent partial writes.
 */
/**
 * Extract the long-lived Claude Code process PID to store in the peer file.
 *
 * The wrapper exports CLAUDE_SESSION_ID="$PPID" where $PPID is the Claude Code
 * process PID — stable for the whole session. We parse it from the session ID
 * rather than using process.pid (the hook subprocess, which dies immediately
 * after the hook runs and would cause isPeerAlive() to incorrectly clean up
 * the peer file on the very next hook invocation).
 */
function getClaudeCodePid(sessionId: string): number {
  const pid = Number.parseInt(sessionId, 10);
  if (Number.isInteger(pid) && pid > 0) return pid;
  // Real CLAUDE_SESSION_ID (not pid-based): fall back to ppid (shell wrapper),
  // which at least outlives the current Node process.
  return process.ppid || process.pid;
}

export async function registerPeer(projectDir: string): Promise<PeerInfo> {
  const peerId = process.env['CLAUDE_SESSION_ID'] || `${process.pid}`;
  const peersDir = path.join(projectDir, COORDINATION_DIRS.peers);
  ensureDir(peersDir);

  const branch = getCurrentBranch(projectDir);
  const now = new Date().toISOString();
  const peer: PeerInfo = {
    id: peerId,
    name: generatePeerName(branch, projectDir),
    pid: getClaudeCodePid(peerId),
    cwd: process.cwd(),
    branch,
    started_at: now,
    last_heartbeat: now,
    status: 'active',
    summary: null,
    files_editing: [],
  };

  const peerFile = getPeerFilePath(projectDir, peerId);
  const lockDir = `${peerFile}.lock`;

  if (await acquireLock(lockDir, 20)) {
    try {
      fs.writeFileSync(peerFile, JSON.stringify(peer, null, 2));
      logInfo(MODULE, `Registered peer ${peerId} as "${peer.name}"`);
    } finally {
      releaseLock(lockDir);
    }
  }

  // Write canonical session ID marker — single source of truth for all processes
  try {
    fs.writeFileSync(path.join(projectDir, COORDINATION_DIRS.root, SESSION_ID_FILE), peerId);
  } catch {
    logDebug(MODULE, 'Failed to write session ID marker');
  }

  // Clean stale peers on every registration (keeps the directory tidy)
  listPeers(projectDir);

  return peer;
}

/**
 * Update the heartbeat timestamp (and optional fields) for the current peer.
 *
 * If the peer file is missing (e.g. cleaned up as stale), re-registers.
 */
export async function updateHeartbeat(
  projectDir: string,
  update?: Partial<Pick<PeerInfo, 'status' | 'summary' | 'files_editing'>>
): Promise<void> {
  const peerId = process.env['CLAUDE_SESSION_ID'] || `${process.pid}`;
  const peerFile = getPeerFilePath(projectDir, peerId);

  if (!fs.existsSync(peerFile)) {
    logWarn(MODULE, `Peer file not found for ${peerId}, re-registering`);
    await registerPeer(projectDir);
    return;
  }

  const lockDir = `${peerFile}.lock`;
  if (await acquireLock(lockDir, 20)) {
    try {
      const content = fs.readFileSync(peerFile, 'utf8');
      const peer = JSON.parse(content) as PeerInfo;
      peer.last_heartbeat = new Date().toISOString();
      if (update?.status !== undefined) peer.status = update.status;
      if (update?.summary !== undefined) peer.summary = update.summary;
      if (update?.files_editing !== undefined) peer.files_editing = update.files_editing;
      fs.writeFileSync(peerFile, JSON.stringify(peer, null, 2));
      logDebug(MODULE, `Heartbeat updated for ${peerId}`);
    } finally {
      releaseLock(lockDir);
    }
  }
}

/**
 * Remove the current session's peer file.
 */
export function deregisterPeer(projectDir: string): void {
  const peerId = process.env['CLAUDE_SESSION_ID'] || `${process.pid}`;
  const peerFile = getPeerFilePath(projectDir, peerId);

  try {
    if (fs.existsSync(peerFile)) {
      fs.unlinkSync(peerFile);
      logInfo(MODULE, `Deregistered peer ${peerId}`);
    }
  } catch (err) {
    logWarn(MODULE, `Failed to deregister peer ${peerId}: ${err}`);
  }
}

function isStale(peer: PeerInfo): boolean {
  return !isPeerAlive(peer.pid, peer.started_at);
}

/**
 * List all active (non-stale) peers. Stale entries are automatically removed.
 */
export function listPeers(projectDir: string): PeerInfo[] {
  const peersDir = path.join(projectDir, COORDINATION_DIRS.peers);

  if (!fs.existsSync(peersDir)) return [];

  const files = fs.readdirSync(peersDir).filter((f) => f.endsWith('.json'));
  const peers: PeerInfo[] = [];

  for (const file of files) {
    const filePath = path.join(peersDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const peer = JSON.parse(content) as PeerInfo;

      if (isStale(peer)) {
        // Auto-cleanup stale peers
        try {
          fs.unlinkSync(filePath);
        } catch {
          // Ignore cleanup errors
        }
        logDebug(MODULE, `Cleaned up stale peer ${peer.id}`);
        continue;
      }

      peers.push(peer);
    } catch {
      // Corrupt file -- remove it
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  return peers;
}

/**
 * Set a custom name for the current session's peer entry.
 */
export async function setPeerName(projectDir: string, name: string): Promise<void> {
  await updateHeartbeat(projectDir, {});
  const peerId = process.env['CLAUDE_SESSION_ID'] || `${process.pid}`;
  const peerFile = getPeerFilePath(projectDir, peerId);

  if (!fs.existsSync(peerFile)) return;

  const lockDir = `${peerFile}.lock`;
  if (await acquireLock(lockDir, 20)) {
    try {
      const content = fs.readFileSync(peerFile, 'utf8');
      const peer = JSON.parse(content) as PeerInfo;
      peer.name = name;
      fs.writeFileSync(peerFile, JSON.stringify(peer, null, 2));
      logInfo(MODULE, `Peer name set to "${name}"`);
    } finally {
      releaseLock(lockDir);
    }
  }
}

/**
 * Resolve a peer name or partial ID to a full session ID.
 * Tries exact name match first, then ID prefix match.
 */
export function resolveSessionId(projectDir: string, nameOrId: string): string | null {
  const peers = listPeers(projectDir);
  const byName = peers.find((p) => p.name === nameOrId);
  if (byName) return byName.id;

  const byId = peers.find((p) => p.id.startsWith(nameOrId));
  return byId?.id ?? null;
}
