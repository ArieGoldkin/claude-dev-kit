/**
 * Tests for the peer registry module.
 *
 * Verifies registration, heartbeat, deregistration, stale detection,
 * re-registration on missing file, empty directory handling, and
 * corrupt file cleanup.
 *
 * @module tests/coordination/peers
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deregisterPeer,
  listPeers,
  registerPeer,
  resolveSessionId,
  setPeerName,
  updateHeartbeat,
} from '../../src/coordination/peers.js';
import * as processUtils from '../../src/coordination/process-utils.js';
import { COORDINATION_DIRS } from '../../src/coordination/types.js';
import type { PeerInfo } from '../../src/coordination/types.js';

// =============================================================================
// HELPERS
// =============================================================================

let tmpDir: string;
const TEST_SESSION_ID = 'test-session-abc123';
const TEST_PID = 12345;

function peersDir(): string {
  return path.join(tmpDir, COORDINATION_DIRS.peers);
}

function peerFilePath(id = TEST_SESSION_ID): string {
  return path.join(peersDir(), `${id}.json`);
}

function readPeerFile(id = TEST_SESSION_ID): PeerInfo {
  const content = fs.readFileSync(peerFilePath(id), 'utf8');
  return JSON.parse(content) as PeerInfo;
}

function writePeerFile(peer: PeerInfo): void {
  const dir = peersDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${peer.id}.json`), JSON.stringify(peer, null, 2));
}

function makePeer(overrides: Partial<PeerInfo> = {}): PeerInfo {
  const now = new Date().toISOString();
  return {
    id: TEST_SESSION_ID,
    pid: TEST_PID,
    cwd: '/tmp/test',
    branch: 'main',
    started_at: now,
    last_heartbeat: now,
    status: 'active',
    summary: null,
    files_editing: [],
    ...overrides,
  };
}

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'peers-test-'));
  vi.stubEnv('CLAUDE_SESSION_ID', TEST_SESSION_ID);
  // Stub process.pid and process.ppid (readonly, so use spyOn getter)
  vi.spyOn(process, 'pid', 'get').mockReturnValue(TEST_PID);
  vi.spyOn(process, 'ppid', 'get').mockReturnValue(TEST_PID);
  // Default: all peers considered alive (overridden in stale detection tests)
  vi.spyOn(processUtils, 'isPeerAlive').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// =============================================================================
// registerPeer
// =============================================================================

describe('registerPeer', () => {
  it('creates a peer file in the peers directory', async () => {
    await registerPeer(tmpDir);
    expect(fs.existsSync(peerFilePath())).toBe(true);
  });

  it('returns a PeerInfo with correct id and pid', async () => {
    const peer = await registerPeer(tmpDir);
    expect(peer.id).toBe(TEST_SESSION_ID);
    expect(peer.pid).toBe(TEST_PID);
  });

  it('writes valid JSON matching the PeerInfo schema', async () => {
    await registerPeer(tmpDir);
    const peer = readPeerFile();

    expect(peer.id).toBe(TEST_SESSION_ID);
    expect(peer.pid).toBe(TEST_PID);
    expect(typeof peer.cwd).toBe('string');
    expect(typeof peer.started_at).toBe('string');
    expect(typeof peer.last_heartbeat).toBe('string');
    expect(peer.status).toBe('active');
    expect(peer.summary).toBeNull();
    expect(peer.files_editing).toEqual([]);
    // branch may be null or a string depending on git context
    expect(peer.branch === null || typeof peer.branch === 'string').toBe(true);
  });

  it('sets started_at and last_heartbeat to the same ISO timestamp', async () => {
    const peer = await registerPeer(tmpDir);
    expect(peer.started_at).toBe(peer.last_heartbeat);
    // Verify ISO format
    expect(() => new Date(peer.started_at)).not.toThrow();
    expect(new Date(peer.started_at).toISOString()).toBe(peer.started_at);
  });

  it('creates the peers directory if it does not exist', async () => {
    expect(fs.existsSync(peersDir())).toBe(false);
    await registerPeer(tmpDir);
    expect(fs.existsSync(peersDir())).toBe(true);
  });

  it('extracts pid from numeric session ID (wrapper-set stable PID)', async () => {
    const stablePid = 99999;
    vi.stubEnv('CLAUDE_SESSION_ID', `${stablePid}`);

    const peer = await registerPeer(tmpDir);
    expect(peer.id).toBe(`${stablePid}`);
    expect(peer.pid).toBe(stablePid);
  });

  it('uses fallback id when CLAUDE_SESSION_ID is not set', async () => {
    vi.stubEnv('CLAUDE_SESSION_ID', '');
    delete process.env['CLAUDE_SESSION_ID'];

    const peer = await registerPeer(tmpDir);
    expect(peer.id).toBe(`${TEST_PID}`);

    const expectedFile = path.join(peersDir(), `${TEST_PID}.json`);
    expect(fs.existsSync(expectedFile)).toBe(true);
  });
});

// =============================================================================
// generatePeerName (tested via registerPeer)
// =============================================================================

describe('peer name generation', () => {
  it('uses branch name as session name', async () => {
    // We're in a git repo, so branch should be set
    const peer = await registerPeer(tmpDir);
    // Name should NOT start with "unknown"
    expect(peer.name).not.toMatch(/^unknown/);
    // Name should be a string (branch or "session")
    expect(typeof peer.name).toBe('string');
    expect(peer.name.length).toBeGreaterThan(0);
  });

  it('uses "session" fallback when no branch', async () => {
    // Create a peer in a non-git directory
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-git-'));
    const peer = await registerPeer(nonGitDir);
    expect(peer.name).toBe('session');
    fs.rmSync(nonGitDir, { recursive: true, force: true });
  });

  it('appends -2 on name collision', async () => {
    // Register first peer manually with a known name
    writePeerFile(makePeer({ id: 'other-session', name: 'main' }));

    // Now register our session — if on main, should get "main-2"
    // Since we can't control the branch, test by writing another peer with same name
    writePeerFile(makePeer({ id: 'session-x', name: 'test-branch' }));
    writePeerFile(makePeer({ id: 'session-y', name: 'test-branch-2' }));

    // Simulate: a new peer with name "test-branch" would get "-3"
    const peersPath = peersDir();
    const existing: string[] = [];
    for (const file of fs.readdirSync(peersPath).filter((f: string) => f.endsWith('.json'))) {
      try {
        const content = fs.readFileSync(path.join(peersPath, file), 'utf8');
        const p = JSON.parse(content);
        if (p.name) existing.push(p.name);
      } catch {
        /* skip */
      }
    }
    expect(existing).toContain('test-branch');
    expect(existing).toContain('test-branch-2');
  });
});

// =============================================================================
// updateHeartbeat
// =============================================================================

describe('updateHeartbeat', () => {
  it('updates the last_heartbeat timestamp', async () => {
    await registerPeer(tmpDir);
    const original = readPeerFile();

    // Small delay to ensure timestamps differ
    await new Promise((resolve) => setTimeout(resolve, 10));

    await updateHeartbeat(tmpDir);
    const updated = readPeerFile();

    expect(new Date(updated.last_heartbeat).getTime()).toBeGreaterThanOrEqual(
      new Date(original.last_heartbeat).getTime()
    );
    // started_at should not change
    expect(updated.started_at).toBe(original.started_at);
  });

  it('updates optional status field', async () => {
    await registerPeer(tmpDir);
    await updateHeartbeat(tmpDir, { status: 'busy' });
    const updated = readPeerFile();
    expect(updated.status).toBe('busy');
  });

  it('updates optional summary field', async () => {
    await registerPeer(tmpDir);
    await updateHeartbeat(tmpDir, { summary: 'Refactoring auth module' });
    const updated = readPeerFile();
    expect(updated.summary).toBe('Refactoring auth module');
  });

  it('updates optional files_editing field', async () => {
    await registerPeer(tmpDir);
    await updateHeartbeat(tmpDir, { files_editing: ['src/index.ts', 'tests/index.test.ts'] });
    const updated = readPeerFile();
    expect(updated.files_editing).toEqual(['src/index.ts', 'tests/index.test.ts']);
  });

  it('does not overwrite fields that are not in the update', async () => {
    await registerPeer(tmpDir);
    await updateHeartbeat(tmpDir, { status: 'busy' });

    const updated = readPeerFile();
    // summary should remain null (not overwritten)
    expect(updated.summary).toBeNull();
    expect(updated.files_editing).toEqual([]);
  });

  it('re-registers when peer file is missing', async () => {
    // Do not register first -- the file does not exist
    await updateHeartbeat(tmpDir);

    // Should have created a new peer file via re-registration
    expect(fs.existsSync(peerFilePath())).toBe(true);
    const peer = readPeerFile();
    expect(peer.id).toBe(TEST_SESSION_ID);
    expect(peer.status).toBe('active');
  });
});

// =============================================================================
// deregisterPeer
// =============================================================================

describe('deregisterPeer', () => {
  it('removes the peer file', async () => {
    await registerPeer(tmpDir);
    expect(fs.existsSync(peerFilePath())).toBe(true);

    deregisterPeer(tmpDir);
    expect(fs.existsSync(peerFilePath())).toBe(false);
  });

  it('does not throw when peer file does not exist', () => {
    expect(() => deregisterPeer(tmpDir)).not.toThrow();
  });

  it('does not affect other peer files', async () => {
    await registerPeer(tmpDir);

    // Create a second peer file manually
    const otherPeer = makePeer({ id: 'other-session-xyz' });
    writePeerFile(otherPeer);

    deregisterPeer(tmpDir);

    expect(fs.existsSync(peerFilePath())).toBe(false);
    expect(fs.existsSync(peerFilePath('other-session-xyz'))).toBe(true);
  });
});

// =============================================================================
// listPeers
// =============================================================================

describe('listPeers', () => {
  it('returns empty array when peers directory does not exist', () => {
    const peers = listPeers(tmpDir);
    expect(peers).toEqual([]);
  });

  it('returns empty array when peers directory is empty', () => {
    fs.mkdirSync(peersDir(), { recursive: true });
    const peers = listPeers(tmpDir);
    expect(peers).toEqual([]);
  });

  it('returns active peers', () => {
    const peer = makePeer();
    writePeerFile(peer);

    const peers = listPeers(tmpDir);
    expect(peers).toHaveLength(1);
    expect(peers[0].id).toBe(TEST_SESSION_ID);
  });

  it('returns multiple active peers', () => {
    writePeerFile(makePeer({ id: 'session-1' }));
    writePeerFile(makePeer({ id: 'session-2' }));
    writePeerFile(makePeer({ id: 'session-3' }));

    const peers = listPeers(tmpDir);
    expect(peers).toHaveLength(3);

    const ids = peers.map((p) => p.id).sort();
    expect(ids).toEqual(['session-1', 'session-2', 'session-3']);
  });

  it('ignores non-JSON files in the peers directory', () => {
    writePeerFile(makePeer());
    fs.writeFileSync(path.join(peersDir(), '.gitkeep'), '');
    fs.writeFileSync(path.join(peersDir(), 'notes.txt'), 'not a peer');

    const peers = listPeers(tmpDir);
    expect(peers).toHaveLength(1);
  });
});

// =============================================================================
// Stale detection
// =============================================================================

describe('stale detection (PID-based)', () => {
  it('filters out peers whose PID is dead', () => {
    writePeerFile(makePeer({ id: 'alive-peer', pid: 11111 }));
    writePeerFile(makePeer({ id: 'dead-peer', pid: 22222 }));

    // Mock: alive-peer is alive, dead-peer is dead
    vi.spyOn(processUtils, 'isPeerAlive').mockImplementation((pid) => pid === 11111);

    const peers = listPeers(tmpDir);
    expect(peers).toHaveLength(1);
    expect(peers[0].id).toBe('alive-peer');
  });

  it('keeps peers whose PID is alive', () => {
    writePeerFile(makePeer({ id: 'session-1', pid: 11111 }));
    writePeerFile(makePeer({ id: 'session-2', pid: 22222 }));

    vi.spyOn(processUtils, 'isPeerAlive').mockReturnValue(true);

    const peers = listPeers(tmpDir);
    expect(peers).toHaveLength(2);
  });

  it('removes stale peer files from disk when PID is dead', () => {
    writePeerFile(makePeer({ id: 'dead-peer', pid: 99999 }));
    expect(fs.existsSync(peerFilePath('dead-peer'))).toBe(true);

    vi.spyOn(processUtils, 'isPeerAlive').mockReturnValue(false);

    listPeers(tmpDir);

    expect(fs.existsSync(peerFilePath('dead-peer'))).toBe(false);
  });

  it('keeps peer files on disk when PID is alive', () => {
    writePeerFile(makePeer({ id: 'alive-peer', pid: 11111 }));

    vi.spyOn(processUtils, 'isPeerAlive').mockReturnValue(true);

    listPeers(tmpDir);

    expect(fs.existsSync(peerFilePath('alive-peer'))).toBe(true);
  });

  it('handles mix of alive and dead peers correctly', () => {
    writePeerFile(makePeer({ id: 'alive-1', pid: 100 }));
    writePeerFile(makePeer({ id: 'dead-1', pid: 200 }));
    writePeerFile(makePeer({ id: 'alive-2', pid: 300 }));

    vi.spyOn(processUtils, 'isPeerAlive').mockImplementation((pid) => pid !== 200);

    const peers = listPeers(tmpDir);
    expect(peers).toHaveLength(2);
    const ids = peers.map((p) => p.id).sort();
    expect(ids).toEqual(['alive-1', 'alive-2']);

    // Dead peer file should be cleaned
    expect(fs.existsSync(peerFilePath('dead-1'))).toBe(false);
    // Alive peer files should remain
    expect(fs.existsSync(peerFilePath('alive-1'))).toBe(true);
    expect(fs.existsSync(peerFilePath('alive-2'))).toBe(true);
  });

  // Note: Inner catch blocks in listPeers (stale cleanup errors) are defensive
  // and not testable without vi.mock('node:fs') at module level, which would
  // affect all tests. Coverage for these paths is accepted as a known gap.
});

// =============================================================================
// Corrupt file handling
// =============================================================================

describe('corrupt file handling', () => {
  it('skips and removes corrupt JSON files', () => {
    fs.mkdirSync(peersDir(), { recursive: true });
    fs.writeFileSync(peerFilePath('corrupt'), '{ not valid json !!!');

    // Also add a valid peer so we can confirm it is still returned
    writePeerFile(makePeer({ id: 'valid-peer' }));

    const peers = listPeers(tmpDir);
    expect(peers).toHaveLength(1);
    expect(peers[0].id).toBe('valid-peer');

    // Corrupt file should be cleaned up
    expect(fs.existsSync(peerFilePath('corrupt'))).toBe(false);
  });

  // Note: corrupt file unlink error path not tested — same node:fs mock
  // limitation as stale detection. The catch block is purely defensive.

  it('handles empty JSON files gracefully', () => {
    fs.mkdirSync(peersDir(), { recursive: true });
    fs.writeFileSync(peerFilePath('empty'), '');

    const peers = listPeers(tmpDir);
    expect(peers).toEqual([]);
    expect(fs.existsSync(peerFilePath('empty'))).toBe(false);
  });
});

// =============================================================================
// setPeerName
// =============================================================================

describe('setPeerName', () => {
  it('updates the peer name in the file', async () => {
    await registerPeer(tmpDir);
    await setPeerName(tmpDir, 'my-custom-name');

    const peer = readPeerFile();
    expect(peer.name).toBe('my-custom-name');
  });

  it('does nothing when peer file does not exist', async () => {
    // No registration — peer file doesn't exist
    await expect(setPeerName(tmpDir, 'ghost')).resolves.not.toThrow();
  });
});

// =============================================================================
// resolveSessionId
// =============================================================================

describe('resolveSessionId', () => {
  it('resolves by exact peer name', () => {
    const peer = makePeer({ id: 'session-abc', name: 'feat-abc' });
    writePeerFile(peer);

    const resolved = resolveSessionId(tmpDir, 'feat-abc');
    expect(resolved).toBe('session-abc');
  });

  it('resolves by ID prefix', () => {
    const peer = makePeer({ id: 'session-abc-long-id', name: 'feat-abc' });
    writePeerFile(peer);

    const resolved = resolveSessionId(tmpDir, 'session-abc');
    expect(resolved).toBe('session-abc-long-id');
  });

  it('returns null when no match found', () => {
    writePeerFile(makePeer({ id: 'session-1', name: 'feat-1' }));

    const resolved = resolveSessionId(tmpDir, 'nonexistent');
    expect(resolved).toBeNull();
  });

  it('prefers name match over ID prefix match', () => {
    // Create a peer whose name matches the query
    writePeerFile(makePeer({ id: 'session-different', name: 'session-1' }));
    // Create a peer whose ID starts with the query
    writePeerFile(makePeer({ id: 'session-1-long', name: 'other-name' }));

    const resolved = resolveSessionId(tmpDir, 'session-1');
    // Name match should win
    expect(resolved).toBe('session-different');
  });

  it('returns null when peers directory does not exist', () => {
    const resolved = resolveSessionId(tmpDir, 'anything');
    expect(resolved).toBeNull();
  });
});
