/**
 * Shared experiment leaderboard and distributed experiment claim protocol.
 *
 * Leaderboard (#38): Append experiment results to a shared TSV file,
 * query sorted results, and find the best kept result.
 *
 * Experiment Claims (#39): Distributed claim protocol so multiple sessions
 * avoid testing the same hypothesis concurrently. Claims expire after
 * CLAIM_TTL_MS.
 *
 * @module coordination/experiments
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { acquireLock, releaseLock } from '../lib/lock.js';
import { logInfo } from '../lib/logging.js';
import { COORDINATION_DIRS } from './types.js';

const MODULE = 'experiments';

export interface ExperimentResult {
  session_id: string;
  description: string;
  metric_name: string;
  metric_value: number;
  kept: boolean;
  timestamp: string;
}

export interface ExperimentClaim {
  hypothesis: string;
  claimed_by: string;
  claimed_at: string;
  expires_at: string;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function getSessionId(): string {
  return process.env['CLAUDE_SESSION_ID'] || `${process.pid}`;
}

function getExperimentDir(projectDir: string, experimentName: string): string {
  return path.join(projectDir, COORDINATION_DIRS.experiments, experimentName);
}

// =============================================================================
// Leaderboard (#38)
// =============================================================================

export async function appendResult(
  projectDir: string,
  experimentName: string,
  result: Omit<ExperimentResult, 'session_id' | 'timestamp'>
): Promise<void> {
  const dir = getExperimentDir(projectDir, experimentName);
  ensureDir(dir);

  const resultsFile = path.join(dir, 'results.tsv');
  const lockDir = `${resultsFile}.lock`;

  const row: ExperimentResult = {
    ...result,
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
  };

  if (await acquireLock(lockDir, 20, 2000)) {
    try {
      // Write header if new file
      if (!fs.existsSync(resultsFile)) {
        fs.writeFileSync(
          resultsFile,
          'session_id\tdescription\tmetric_name\tmetric_value\tkept\ttimestamp\n'
        );
      }
      const line = `${row.session_id}\t${row.description}\t${row.metric_name}\t${row.metric_value}\t${row.kept}\t${row.timestamp}\n`;
      fs.appendFileSync(resultsFile, line);
      logInfo(
        MODULE,
        `Appended result: ${row.metric_name}=${row.metric_value} (${row.kept ? 'kept' : 'discarded'})`
      );
    } finally {
      releaseLock(lockDir);
    }
  }
}

export function getLeaderboard(projectDir: string, experimentName: string): ExperimentResult[] {
  const resultsFile = path.join(getExperimentDir(projectDir, experimentName), 'results.tsv');

  if (!fs.existsSync(resultsFile)) return [];

  const content = fs.readFileSync(resultsFile, 'utf8');
  const lines = content.trim().split('\n').slice(1); // skip header

  return lines
    .map((line) => {
      const [session_id, description, metric_name, metric_value, kept, timestamp] =
        line.split('\t');
      return {
        session_id: session_id || '',
        description: description || '',
        metric_name: metric_name || '',
        metric_value: Number.parseFloat(metric_value || '0'),
        kept: kept === 'true',
        timestamp: timestamp || '',
      };
    })
    .sort((a, b) => b.metric_value - a.metric_value);
}

export function getBestResult(projectDir: string, experimentName: string): ExperimentResult | null {
  const results = getLeaderboard(projectDir, experimentName);
  const kept = results.filter((r) => r.kept);
  return kept.length > 0 ? (kept[0] ?? null) : null;
}

// =============================================================================
// Experiment Claims (#39)
// =============================================================================

const CLAIM_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getClaimsDir(projectDir: string, experimentName: string): string {
  return path.join(getExperimentDir(projectDir, experimentName), 'claims');
}

function hashHypothesis(hypothesis: string): string {
  return crypto.createHash('sha256').update(hypothesis).digest('hex').slice(0, 16);
}

export function claimHypothesis(
  projectDir: string,
  experimentName: string,
  hypothesis: string
): { success: boolean; owner?: string } {
  const claimsDir = getClaimsDir(projectDir, experimentName);
  ensureDir(claimsDir);

  const claimFile = path.join(claimsDir, `${hashHypothesis(hypothesis)}.json`);
  const sessionId = getSessionId();

  // Check existing
  if (fs.existsSync(claimFile)) {
    try {
      const content = fs.readFileSync(claimFile, 'utf8');
      const existing = JSON.parse(content) as ExperimentClaim;

      if (existing.claimed_by === sessionId) {
        return { success: true }; // own claim
      }

      if (Date.now() <= new Date(existing.expires_at).getTime()) {
        return { success: false, owner: existing.claimed_by };
      }
      // Expired — take it
    } catch {
      /* corrupt, overwrite */
    }
  }

  const now = new Date();
  const claim: ExperimentClaim = {
    hypothesis,
    claimed_by: sessionId,
    claimed_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CLAIM_TTL_MS).toISOString(),
  };

  fs.writeFileSync(claimFile, JSON.stringify(claim, null, 2));
  logInfo(MODULE, `Claimed hypothesis: ${hypothesis.slice(0, 50)}`);
  return { success: true };
}

export function getClaimedHypotheses(
  projectDir: string,
  experimentName: string
): ExperimentClaim[] {
  const claimsDir = getClaimsDir(projectDir, experimentName);
  if (!fs.existsSync(claimsDir)) return [];

  const files = fs.readdirSync(claimsDir).filter((f) => f.endsWith('.json'));
  const claims: ExperimentClaim[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(claimsDir, file), 'utf8');
      const claim = JSON.parse(content) as ExperimentClaim;

      // Filter expired
      if (Date.now() > new Date(claim.expires_at).getTime()) {
        try {
          fs.unlinkSync(path.join(claimsDir, file));
        } catch {
          /* ignore */
        }
        continue;
      }

      claims.push(claim);
    } catch {
      /* skip corrupt */
    }
  }

  return claims;
}
