/**
 * Tests for file claim system.
 *
 * @module tests/coordination/claims
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaimInfo } from '../../src/coordination/claims.js';
import {
  claimFile,
  gcOrphanedClaims,
  getClaimOwner,
  isFileClaimed,
  releaseAllClaims,
  releaseFile,
} from '../../src/coordination/claims.js';
import { COORDINATION_DIRS } from '../../src/coordination/types.js';

// =============================================================================
// HELPERS
// =============================================================================

let tmpDir: string;
const ORIGINAL_SESSION_ID = process.env['CLAUDE_SESSION_ID'];

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-test-'));
  process.env['CLAUDE_SESSION_ID'] = 'session-A';
});

afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (ORIGINAL_SESSION_ID !== undefined) {
    process.env['CLAUDE_SESSION_ID'] = ORIGINAL_SESSION_ID;
  } else {
    delete process.env['CLAUDE_SESSION_ID'];
  }
});

/** Read a claim JSON from disk by file path. */
function findClaimFile(filePath: string): ClaimInfo | null {
  const claimsDir = path.join(tmpDir, '.claude', 'coordination', 'claims');
  if (!fs.existsSync(claimsDir)) return null;
  const files = fs.readdirSync(claimsDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(claimsDir, file), 'utf8');
    const claim = JSON.parse(content) as ClaimInfo;
    if (claim.file_path === filePath) return claim;
  }
  return null;
}

/** Set session ID for the current test. */
function setSession(id: string): void {
  process.env['CLAUDE_SESSION_ID'] = id;
}

// =============================================================================
// claimFile — basic claim creation
// =============================================================================

describe('claimFile', () => {
  it('creates a claim JSON with correct schema', async () => {
    const result = await claimFile(tmpDir, '/src/app.ts');
    expect(result.success).toBe(true);

    const claim = findClaimFile('/src/app.ts');
    expect(claim).not.toBeNull();
    expect(claim?.file_path).toBe('/src/app.ts');
    expect(claim?.claimed_by).toBe('session-A');
    expect(claim?.claimed_at).toBeTruthy();
    expect(claim?.expires_at).toBeTruthy();
  });

  it('sets correct TTL of 5 minutes', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-04T10:00:00.000Z') });

    const result = await claimFile(tmpDir, '/src/app.ts');
    expect(result.success).toBe(true);

    const claim = findClaimFile('/src/app.ts');
    expect(claim?.claimed_at).toBe('2026-04-04T10:00:00.000Z');
    expect(claim?.expires_at).toBe('2026-04-04T10:05:00.000Z');
  });

  it('returns {success: false, owner} when already claimed by another session', async () => {
    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    setSession('session-B');
    const result = await claimFile(tmpDir, '/src/app.ts');
    expect(result.success).toBe(false);
    expect(result.owner).toBe('session-A');
  });

  it('allows reclaiming your own file (renew TTL)', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-04T10:00:00.000Z') });

    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    // Advance 2 minutes, reclaim
    vi.setSystemTime(new Date('2026-04-04T10:02:00.000Z'));
    const result = await claimFile(tmpDir, '/src/app.ts');
    expect(result.success).toBe(true);

    const claim = findClaimFile('/src/app.ts');
    // TTL should be renewed from current time, not original
    expect(claim?.expires_at).toBe('2026-04-04T10:07:00.000Z');
  });

  it('takes over expired claims from other sessions', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-04T10:00:00.000Z') });

    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    // Advance past TTL (5 min + 1 sec)
    vi.setSystemTime(new Date('2026-04-04T10:05:01.000Z'));

    setSession('session-B');
    const result = await claimFile(tmpDir, '/src/app.ts');
    expect(result.success).toBe(true);

    const claim = findClaimFile('/src/app.ts');
    expect(claim?.claimed_by).toBe('session-B');
  });

  it('claims different files independently', async () => {
    const r1 = await claimFile(tmpDir, '/src/a.ts');
    const r2 = await claimFile(tmpDir, '/src/b.ts');
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });
});

// =============================================================================
// releaseFile
// =============================================================================

describe('releaseFile', () => {
  it('removes the claim file', async () => {
    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');
    expect(findClaimFile('/src/app.ts')).not.toBeNull();

    releaseFile(tmpDir, '/src/app.ts');
    expect(findClaimFile('/src/app.ts')).toBeNull();
  });

  it('does not release another sessions claim', async () => {
    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    setSession('session-B');
    releaseFile(tmpDir, '/src/app.ts');

    // Claim should still exist, owned by session-A
    const claim = findClaimFile('/src/app.ts');
    expect(claim).not.toBeNull();
    expect(claim?.claimed_by).toBe('session-A');
  });

  it('handles missing claim gracefully', () => {
    expect(() => releaseFile(tmpDir, '/nonexistent.ts')).not.toThrow();
  });
});

// =============================================================================
// isFileClaimed
// =============================================================================

describe('isFileClaimed', () => {
  it('returns true for another sessions active claim', async () => {
    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    setSession('session-B');
    expect(isFileClaimed(tmpDir, '/src/app.ts')).toBe(true);
  });

  it('returns false for own claim', async () => {
    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    expect(isFileClaimed(tmpDir, '/src/app.ts')).toBe(false);
  });

  it('returns false for expired claim', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-04T10:00:00.000Z') });

    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    vi.setSystemTime(new Date('2026-04-04T10:05:01.000Z'));

    setSession('session-B');
    expect(isFileClaimed(tmpDir, '/src/app.ts')).toBe(false);
  });

  it('returns false when no claim exists', () => {
    expect(isFileClaimed(tmpDir, '/src/app.ts')).toBe(false);
  });

  it('returns false when claims directory does not exist', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-empty-'));
    try {
      expect(isFileClaimed(emptyDir, '/src/app.ts')).toBe(false);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

// =============================================================================
// getClaimOwner
// =============================================================================

describe('getClaimOwner', () => {
  it('returns ClaimInfo for an active claim', async () => {
    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    const owner = getClaimOwner(tmpDir, '/src/app.ts');
    expect(owner).not.toBeNull();
    expect(owner?.file_path).toBe('/src/app.ts');
    expect(owner?.claimed_by).toBe('session-A');
    expect(owner?.claimed_at).toBeTruthy();
    expect(owner?.expires_at).toBeTruthy();
  });

  it('returns null when no claim exists', () => {
    expect(getClaimOwner(tmpDir, '/src/app.ts')).toBeNull();
  });

  it('returns null for expired claim', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-04T10:00:00.000Z') });

    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    vi.setSystemTime(new Date('2026-04-04T10:05:01.000Z'));
    expect(getClaimOwner(tmpDir, '/src/app.ts')).toBeNull();
  });

  it('returns ClaimInfo even for own claim (not filtered)', async () => {
    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    const owner = getClaimOwner(tmpDir, '/src/app.ts');
    expect(owner).not.toBeNull();
    expect(owner?.claimed_by).toBe('session-A');
  });
});

// =============================================================================
// releaseAllClaims
// =============================================================================

describe('releaseAllClaims', () => {
  it('removes all claims for current session', async () => {
    setSession('session-A');
    await claimFile(tmpDir, '/src/a.ts');
    await claimFile(tmpDir, '/src/b.ts');
    await claimFile(tmpDir, '/src/c.ts');

    releaseAllClaims(tmpDir);

    expect(findClaimFile('/src/a.ts')).toBeNull();
    expect(findClaimFile('/src/b.ts')).toBeNull();
    expect(findClaimFile('/src/c.ts')).toBeNull();
  });

  it('leaves other sessions claims intact', async () => {
    setSession('session-A');
    await claimFile(tmpDir, '/src/a.ts');

    setSession('session-B');
    await claimFile(tmpDir, '/src/b.ts');

    // Release session-B's claims only
    releaseAllClaims(tmpDir);

    // session-A's claim should still exist
    const claimA = findClaimFile('/src/a.ts');
    expect(claimA).not.toBeNull();
    expect(claimA?.claimed_by).toBe('session-A');

    // session-B's claim should be gone
    expect(findClaimFile('/src/b.ts')).toBeNull();
  });

  it('handles missing claims directory gracefully', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-empty-'));
    try {
      expect(() => releaseAllClaims(emptyDir)).not.toThrow();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

// =============================================================================
// Edge cases — missing directories and corrupt data
// =============================================================================

describe('edge cases', () => {
  it('claimFile creates claims directory if it does not exist', async () => {
    const claimsDir = path.join(tmpDir, '.claude', 'coordination', 'claims');
    expect(fs.existsSync(claimsDir)).toBe(false);

    await claimFile(tmpDir, '/src/app.ts');
    expect(fs.existsSync(claimsDir)).toBe(true);
  });

  it('isFileClaimed handles corrupt JSON gracefully', async () => {
    // Create a corrupt claim file
    const claimsDir = path.join(tmpDir, '.claude', 'coordination', 'claims');
    fs.mkdirSync(claimsDir, { recursive: true });

    // We need to match the hash used internally. Create a real claim first,
    // then corrupt the file.
    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    // Corrupt all claim files
    const files = fs.readdirSync(claimsDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      fs.writeFileSync(path.join(claimsDir, file), '{{not-json}}');
    }

    setSession('session-B');
    expect(isFileClaimed(tmpDir, '/src/app.ts')).toBe(false);
  });

  it('getClaimOwner handles corrupt JSON gracefully', async () => {
    const claimsDir = path.join(tmpDir, '.claude', 'coordination', 'claims');
    fs.mkdirSync(claimsDir, { recursive: true });

    setSession('session-A');
    await claimFile(tmpDir, '/src/app.ts');

    const files = fs.readdirSync(claimsDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      fs.writeFileSync(path.join(claimsDir, file), '{{not-json}}');
    }

    expect(getClaimOwner(tmpDir, '/src/app.ts')).toBeNull();
  });

  it('getSessionId falls back to pid when env not set', async () => {
    delete process.env['CLAUDE_SESSION_ID'];

    const result = await claimFile(tmpDir, '/src/app.ts');
    expect(result.success).toBe(true);

    const claim = findClaimFile('/src/app.ts');
    expect(claim?.claimed_by).toMatch(/^\d+$/);
  });
});

// =============================================================================
// gcOrphanedClaims
// =============================================================================

describe('gcOrphanedClaims', () => {
  function writeClaimFile(hash: string, claim: ClaimInfo): void {
    const dir = path.join(tmpDir, COORDINATION_DIRS.claims);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${hash}.json`), JSON.stringify(claim, null, 2));
  }

  function writePeerFile(peerId: string): void {
    const dir = path.join(tmpDir, COORDINATION_DIRS.peers);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${peerId}.json`), JSON.stringify({ id: peerId }));
  }

  function claimExists(hash: string): boolean {
    return fs.existsSync(path.join(tmpDir, COORDINATION_DIRS.claims, `${hash}.json`));
  }

  it('removes expired claims', () => {
    const expired: ClaimInfo = {
      file_path: '/src/old.ts',
      claimed_by: 'session-A',
      claimed_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-01T00:05:00Z', // long past
    };
    writeClaimFile('expired1', expired);
    writePeerFile('session-A'); // peer still alive, but claim expired

    const deleted = gcOrphanedClaims(tmpDir);
    expect(deleted).toBe(1);
    expect(claimExists('expired1')).toBe(false);
  });

  it('removes claims owned by sessions with no peer file', () => {
    const now = new Date();
    const orphaned: ClaimInfo = {
      file_path: '/src/orphan.ts',
      claimed_by: 'dead-session-xyz',
      claimed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 300_000).toISOString(), // not expired
    };
    writeClaimFile('orphan1', orphaned);
    // No peer file for 'dead-session-xyz'

    const deleted = gcOrphanedClaims(tmpDir);
    expect(deleted).toBe(1);
    expect(claimExists('orphan1')).toBe(false);
  });

  it('keeps valid claims owned by active peers', () => {
    const now = new Date();
    const valid: ClaimInfo = {
      file_path: '/src/valid.ts',
      claimed_by: 'session-A',
      claimed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 300_000).toISOString(),
    };
    writeClaimFile('valid1', valid);
    writePeerFile('session-A');

    const deleted = gcOrphanedClaims(tmpDir);
    expect(deleted).toBe(0);
    expect(claimExists('valid1')).toBe(true);
  });

  it('handles empty claims directory', () => {
    fs.mkdirSync(path.join(tmpDir, COORDINATION_DIRS.claims), { recursive: true });
    const deleted = gcOrphanedClaims(tmpDir);
    expect(deleted).toBe(0);
  });

  it('handles missing claims directory', () => {
    const deleted = gcOrphanedClaims(tmpDir);
    expect(deleted).toBe(0);
  });

  it('handles corrupt claim JSON files', () => {
    const dir = path.join(tmpDir, COORDINATION_DIRS.claims);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'corrupt.json'), '{ not valid json !!!');

    const deleted = gcOrphanedClaims(tmpDir);
    expect(deleted).toBe(1); // corrupt file should be removed
    expect(fs.existsSync(path.join(dir, 'corrupt.json'))).toBe(false);
  });

  it('returns count of deleted claims', () => {
    const now = new Date();
    const past = '2026-01-01T00:05:00Z';

    writeClaimFile('exp1', {
      file_path: '/a.ts',
      claimed_by: 's1',
      claimed_at: past,
      expires_at: past,
    });
    writeClaimFile('exp2', {
      file_path: '/b.ts',
      claimed_by: 's2',
      claimed_at: past,
      expires_at: past,
    });
    writeClaimFile('valid', {
      file_path: '/c.ts',
      claimed_by: 'session-A',
      claimed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 300_000).toISOString(),
    });
    writePeerFile('session-A');

    const deleted = gcOrphanedClaims(tmpDir);
    expect(deleted).toBe(2);
  });
});
