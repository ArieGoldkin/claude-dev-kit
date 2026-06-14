/**
 * File claim system for preventing concurrent edits.
 *
 * Claims are stored as JSON files in `.claude/coordination/claims/`,
 * keyed by a truncated SHA-256 hash of the file path. Each claim
 * records the owning session, creation time, and expiry time. Claims
 * expire after CLAIM_TTL_MS and can be taken over by any session.
 *
 * @module coordination/claims
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { acquireLock, releaseLock } from '../lib/lock.js';
import { logDebug, logInfo, logWarn } from '../lib/logging.js';
import { COORDINATION_DIRS } from './types.js';

const MODULE = 'claims';
const CLAIM_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ClaimInfo {
  file_path: string;
  claimed_by: string; // session ID
  claimed_at: string; // ISO timestamp
  expires_at: string; // ISO timestamp
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function hashPath(filePath: string): string {
  return crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 16);
}

function getClaimFilePath(projectDir: string, filePath: string): string {
  return path.join(projectDir, COORDINATION_DIRS.claims, `${hashPath(filePath)}.json`);
}

function isExpired(claim: ClaimInfo): boolean {
  return Date.now() > new Date(claim.expires_at).getTime();
}

function getSessionId(): string {
  return process.env['CLAUDE_SESSION_ID'] || `${process.pid}`;
}

export async function claimFile(
  projectDir: string,
  filePath: string
): Promise<{ success: boolean; owner?: string }> {
  const claimsDir = path.join(projectDir, COORDINATION_DIRS.claims);
  ensureDir(claimsDir);

  const claimFilePath = getClaimFilePath(projectDir, filePath);
  const lockDir = `${claimFilePath}.lock`;
  const sessionId = getSessionId();

  if (!(await acquireLock(lockDir, 20, 2000))) {
    return { success: false, owner: 'lock-contention' };
  }

  try {
    // Check existing claim
    if (fs.existsSync(claimFilePath)) {
      const content = fs.readFileSync(claimFilePath, 'utf8');
      const existing = JSON.parse(content) as ClaimInfo;

      // Our own claim — renew it
      if (existing.claimed_by === sessionId) {
        const now = new Date();
        existing.expires_at = new Date(now.getTime() + CLAIM_TTL_MS).toISOString();
        fs.writeFileSync(claimFilePath, JSON.stringify(existing, null, 2));
        return { success: true };
      }

      // Someone else's claim — check if expired
      if (!isExpired(existing)) {
        return { success: false, owner: existing.claimed_by };
      }

      // Expired — we can take it
      logInfo(MODULE, `Expired claim on ${filePath} by ${existing.claimed_by}, taking over`);
    }

    // Create new claim
    const now = new Date();
    const claim: ClaimInfo = {
      file_path: filePath,
      claimed_by: sessionId,
      claimed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + CLAIM_TTL_MS).toISOString(),
    };

    fs.writeFileSync(claimFilePath, JSON.stringify(claim, null, 2));
    logInfo(MODULE, `Claimed ${filePath}`);
    return { success: true };
  } catch (err) {
    logWarn(MODULE, `Failed to claim ${filePath}: ${err}`);
    return { success: false };
  } finally {
    releaseLock(lockDir);
  }
}

export function releaseFile(projectDir: string, filePath: string): void {
  const claimFilePath = getClaimFilePath(projectDir, filePath);
  const sessionId = getSessionId();

  try {
    if (fs.existsSync(claimFilePath)) {
      const content = fs.readFileSync(claimFilePath, 'utf8');
      const claim = JSON.parse(content) as ClaimInfo;

      // Only release our own claims
      if (claim.claimed_by === sessionId) {
        fs.unlinkSync(claimFilePath);
        logInfo(MODULE, `Released ${filePath}`);
      }
    }
  } catch (err) {
    logWarn(MODULE, `Failed to release ${filePath}: ${err}`);
  }
}

export function isFileClaimed(projectDir: string, filePath: string): boolean {
  const claimFilePath = getClaimFilePath(projectDir, filePath);
  const sessionId = getSessionId();

  try {
    if (!fs.existsSync(claimFilePath)) return false;

    const content = fs.readFileSync(claimFilePath, 'utf8');
    const claim = JSON.parse(content) as ClaimInfo;

    // Not claimed if it's our own or expired
    if (claim.claimed_by === sessionId) return false;
    if (isExpired(claim)) return false;

    return true;
  } catch {
    return false;
  }
}

export function getClaimOwner(projectDir: string, filePath: string): ClaimInfo | null {
  const claimFilePath = getClaimFilePath(projectDir, filePath);

  try {
    if (!fs.existsSync(claimFilePath)) return null;

    const content = fs.readFileSync(claimFilePath, 'utf8');
    const claim = JSON.parse(content) as ClaimInfo;

    if (isExpired(claim)) return null;

    return claim;
  } catch {
    return null;
  }
}

export function releaseAllClaims(projectDir: string): void {
  const claimsDir = path.join(projectDir, COORDINATION_DIRS.claims);
  const sessionId = getSessionId();

  if (!fs.existsSync(claimsDir)) return;

  const files = fs.readdirSync(claimsDir).filter((f) => f.endsWith('.json'));
  let released = 0;

  for (const file of files) {
    const fullPath = path.join(claimsDir, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const claim = JSON.parse(content) as ClaimInfo;

      if (claim.claimed_by === sessionId) {
        fs.unlinkSync(fullPath);
        released++;
      }
    } catch {
      // Skip corrupt files
    }
  }

  if (released > 0) {
    logInfo(MODULE, `Released ${released} file claim(s) on session end`);
  }
}

/**
 * Read live peer IDs from the peers directory.
 */
function getLivePeerIds(peersDir: string): Set<string> {
  const ids = new Set<string>();
  if (!fs.existsSync(peersDir)) return ids;
  for (const file of fs.readdirSync(peersDir).filter((f) => f.endsWith('.json'))) {
    ids.add(file.replace(/\.json$/, ''));
  }
  return ids;
}

/**
 * Check if a single claim file should be deleted, and delete it if so.
 * Returns true if the file was deleted.
 */
function gcClaimFile(fullPath: string, livePeerIds: Set<string>): boolean {
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const claim = JSON.parse(content) as ClaimInfo;
    const expired = isExpired(claim);
    const orphaned = !livePeerIds.has(claim.claimed_by);

    if (!expired && !orphaned) return false;

    fs.unlinkSync(fullPath);
    logDebug(
      MODULE,
      `GC: removed ${expired ? 'expired' : 'orphaned'} claim for ${claim.file_path}`
    );
    return true;
  } catch {
    // Corrupt file — remove it
    try {
      fs.unlinkSync(fullPath);
    } catch {
      /* ignore */
    }
    return true;
  }
}

/**
 * Garbage-collect orphaned claims.
 *
 * Removes claims that are either:
 *   (a) expired (past expires_at), or
 *   (b) owned by a session that no longer has a peer file
 *
 * Called during SessionStart GC sweep.
 *
 * @returns Number of deleted claims
 */
export function gcOrphanedClaims(projectDir: string): number {
  const claimsDir = path.join(projectDir, COORDINATION_DIRS.claims);
  if (!fs.existsSync(claimsDir)) return 0;

  const livePeerIds = getLivePeerIds(path.join(projectDir, COORDINATION_DIRS.peers));
  const claimFiles = fs.readdirSync(claimsDir).filter((f) => f.endsWith('.json'));

  let deleted = 0;
  for (const file of claimFiles) {
    if (gcClaimFile(path.join(claimsDir, file), livePeerIds)) deleted++;
  }

  if (deleted > 0) logDebug(MODULE, `GC: cleaned ${deleted} claim(s)`);
  return deleted;
}
