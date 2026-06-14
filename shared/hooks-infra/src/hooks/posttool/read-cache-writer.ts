/**
 * PostToolUse Read Hook — delta-cache writer.
 *
 * After a successful `Read`, persist the file's current bytes, hash, mtime,
 * and size in the per-session cache. The companion {@link readCacheHook}
 * uses this entry on a future `Read` of the same path to compute a unified
 * diff instead of re-pulling the full file body.
 *
 * Behaviour rules:
 *
 * - This hook is *passive*: it never blocks, never warns, never returns
 *   anything other than silent success. Cache writes are best-effort.
 * - Any failure path (missing path, file gone, stat error, write error,
 *   directory not creatable) absorbs silently — a failed cache write must
 *   not break the user's `Read` flow.
 * - Skipped for non-`Read` tools, missing file paths, missing sessions,
 *   and non-regular files (sockets, devices, directories).
 *
 * @module posttool/read-cache-writer
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { recordReadEvent } from '../lib/bash-compress/index.js';
import { guardTool, runGuards } from '../lib/guards.js';
import { getFilePath, getSessionId } from '../lib/input.js';
import { logDebug, logWarn } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import {
  type CachedRead,
  computeContentHash,
  ensureSessionDir,
  readEntry,
  writeEntry,
} from '../lib/read-cache/index.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'read-cache-writer';

/**
 * PostToolUse Read hook — writes the cache entry for the just-read file.
 *
 * Always returns silent success: the user's tool call already completed by
 * the time PostToolUse fires, and we have nothing meaningful to surface.
 */
export async function readCacheWriterHook(input: HookInput): Promise<HookResult> {
  try {
    const skipped = runGuards(input, (i) => guardTool(i, 'Read'));
    if (skipped) return skipped;

    const filePath = getFilePath(input);
    const sessionId = getSessionId(input);
    if (!filePath || !sessionId || sessionId === 'unknown') {
      return outputSilentSuccess();
    }

    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      logDebug(HOOK_NAME, `file no longer exists: ${absPath}`);
      return outputSilentSuccess();
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(absPath);
    } catch (e) {
      logDebug(HOOK_NAME, `stat failed: ${e}`);
      return outputSilentSuccess();
    }
    if (!stat.isFile()) {
      return outputSilentSuccess();
    }

    let content: string;
    try {
      content = fs.readFileSync(absPath, 'utf8');
    } catch (e) {
      logWarn(HOOK_NAME, `read failed for ${absPath}: ${e}`);
      return outputSilentSuccess();
    }

    const entry: CachedRead = {
      absPath,
      contentHash: computeContentHash(content),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      cachedContent: content,
      recordedAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    // Spike A measurement: record cache miss (first read this session) for
    // the baseline so the analyzer can compute hit rate as hits/(hits+misses).
    // Probe the cache before we write to determine whether this was a miss.
    try {
      const prior = await readEntry(sessionId, absPath);
      if (!prior) {
        recordReadEvent(sessionId, absPath, 'cache_miss', stat.size);
      }
    } catch (e) {
      logDebug(HOOK_NAME, `measurement record failed: ${e}`);
    }

    try {
      ensureSessionDir(sessionId);
      await writeEntry(sessionId, entry);
      logDebug(HOOK_NAME, `cached read of ${absPath} (${stat.size} bytes)`);
    } catch (e) {
      logWarn(HOOK_NAME, `cache write failed for ${absPath}: ${e}`);
    }

    return outputSilentSuccess();
  } catch (e) {
    // Defensive top-level: cache writes must never break the session.
    logWarn(HOOK_NAME, `unexpected error: ${e}`);
    return outputSilentSuccess();
  }
}

export default readCacheWriterHook;
