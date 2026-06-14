/**
 * PreCompact Hook - Saves state before context compaction
 *
 * This hook is called automatically by Claude Code before conversation compaction.
 * It appends a timestamp marker to the project ledger so sessions can track when
 * compaction events occurred.
 *
 * TypeScript port of scripts/pre-compact-hook.sh
 *
 * @module lifecycle/pre-compact-saver
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCurrentLedgerPath } from '../lib/continuity.js';
import { getCachedBranch } from '../lib/git-utils.js';
import { buildHandoff } from '../lib/handoff-schema.js';
import { logDebug, logInfo, logWarn } from '../lib/logging.js';
import { outputSuccess, outputWarning } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

/** Threshold: block compaction if this many files edited without a save */
const BLOCK_THRESHOLD = 10;
/** Don't block if ledger was updated within this many minutes */
const RECENT_SAVE_MINUTES = 15;

const HOOK_NAME = 'pre-compact';

/**
 * Format a timestamp for the compaction marker.
 * Uses ISO8601 format without milliseconds (matching bash implementation).
 *
 * @returns Timestamp string in format YYYY-MM-DDTHH:mm:ssZ
 */
export function formatTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * PreCompact hook - saves state before context compaction.
 *
 * Appends a timestamp marker to the project ledger so sessions
 * can track when compaction events occurred.
 *
 * @param _input - Hook input (not used for this hook)
 * @returns HookResult indicating success or warning
 *
 * @example
 * ```typescript
 * const result = await preCompactSaver({});
 * // On success: { continue: true, systemMessage: "State preserved in ledger before compaction" }
 * // On warning: { continue: true, systemMessage: "\u26a0 Ledger not found - state not preserved before compaction" }
 * ```
 */
export async function preCompactSaver(_input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'];

  if (!projectDir) {
    logWarn(HOOK_NAME, 'CLAUDE_PROJECT_DIR not set');
    return outputWarning('Project directory not set - state not preserved before compaction');
  }

  logDebug(HOOK_NAME, `Hook fired for project: ${projectDir}`);

  const ledgerPath = getCurrentLedgerPath(projectDir);

  // Check if ledger exists
  if (!ledgerPath || !fs.existsSync(ledgerPath)) {
    logWarn(HOOK_NAME, `Ledger not found at ${ledgerPath ?? 'unknown'}`);
    return outputWarning('Ledger not found - state not preserved before compaction');
  }

  // Check if ledger is writable
  try {
    fs.accessSync(ledgerPath, fs.constants.W_OK);
  } catch {
    logWarn(HOOK_NAME, `Ledger not writable at ${ledgerPath}`);
    return outputWarning('Ledger not writable - state not preserved before compaction');
  }

  // Check if we should block compaction (CC v2.1.105+: exit code 2 or decision:"block")
  // Block when many files edited but state hasn't been saved recently
  const contextPath = path.join(projectDir, '.claude', 'context', 'shared-context.json');
  try {
    if (fs.existsSync(contextPath)) {
      const ctx = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
      const editCount = ctx?.dirty_tracking?.files_edited_count ?? 0;
      const ledgerStat = fs.statSync(ledgerPath);
      const minutesSinceLastSave = (Date.now() - ledgerStat.mtimeMs) / 60000;

      if (editCount >= BLOCK_THRESHOLD && minutesSinceLastSave > RECENT_SAVE_MINUTES) {
        logWarn(
          HOOK_NAME,
          `Blocking compaction: ${editCount} files edited, ledger last saved ${Math.round(minutesSinceLastSave)}m ago. Run /save-state first.`
        );
        return {
          continue: false,
          decision: 'block',
          reason: `${editCount} files edited since last save (${Math.round(minutesSinceLastSave)}m ago). Run /save-state to preserve state, then compact again.`,
        } as HookResult;
      }
    }
  } catch (error) {
    logDebug(HOOK_NAME, `Could not check dirty state: ${error}`);
    // Non-fatal — proceed with compaction
  }

  // Append compaction marker
  const timestamp = formatTimestamp();
  const marker = `\n---\n**Auto-saved before compaction**: ${timestamp}\n`;

  try {
    fs.appendFileSync(ledgerPath, marker);
    logInfo(HOOK_NAME, 'Timestamp added to ledger');
  } catch (error) {
    logWarn(HOOK_NAME, `Failed to write to ledger: ${error}`);
    return outputWarning('Failed to write to ledger - state not preserved');
  }

  // Best-effort: also write a machine-readable handoff.json so the next
  // session can pick up context automatically via SessionStart. Never block
  // compaction if this write fails — the ledger marker is the load-bearing
  // half; handoff.json is enrichment.
  writeHandoffJson(projectDir, timestamp);

  return outputSuccess('State preserved in ledger before compaction');
}

/**
 * Build and write the latest handoff.json under
 * `.claude/continuity/handoffs/handoff-latest.json`.
 *
 * Pulls dirty file state from shared-context.json when available. PHI
 * scrubbing is performed inside buildHandoff so callers can never bypass
 * it. Failures are non-fatal — the function logs and returns.
 */
function writeHandoffJson(projectDir: string, timestamp: string): void {
  try {
    const handoffsDir = path.join(projectDir, '.claude', 'continuity', 'handoffs');
    if (!fs.existsSync(handoffsDir)) {
      fs.mkdirSync(handoffsDir, { recursive: true });
    }

    const contextPath = path.join(projectDir, '.claude', 'context', 'shared-context.json');
    let dirtyFiles: string[] = [];
    let sessionId: string | null = process.env['CLAUDE_CODE_SESSION_ID'] ?? null;

    if (fs.existsSync(contextPath)) {
      try {
        const ctx = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
        const tracked = ctx?.dirty_tracking?.files_edited_this_session;
        if (Array.isArray(tracked)) {
          dirtyFiles = tracked.filter((f): f is string => typeof f === 'string');
        }
        if (!sessionId && typeof ctx?.session_id === 'string') {
          sessionId = ctx.session_id;
        }
      } catch {
        // Non-fatal — proceed with empty dirty list
      }
    }

    const handoff = buildHandoff({
      session_id: sessionId,
      branch: getCachedBranch(projectDir) || null,
      worktree: projectDir,
      dirty_files: dirtyFiles,
      compaction_trigger: 'pre-compact',
      timestamp,
    });

    const outPath = path.join(handoffsDir, 'handoff-latest.json');
    const tmpPath = `${outPath}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(handoff, null, 2)}\n`);
    fs.renameSync(tmpPath, outPath);
    logInfo(HOOK_NAME, `Handoff JSON written to ${outPath}`);
  } catch (error) {
    logWarn(HOOK_NAME, `Failed to write handoff.json: ${error}`);
  }
}

export default preCompactSaver;
