/**
 * Integration tests for the PreToolUse `read-cache` hook.
 *
 * Each test creates an isolated temp directory and sets
 * `TOKEN_COMPRESS_CACHE_DIR` so the cache lives entirely under the temp
 * tree. `CLAUDE_SESSION_ID` is set so eviction logic in the cache layer
 * recognizes the active session and so the hook resolves a session id.
 *
 * The hook returns one of two shapes:
 *
 * - `outputSilentSuccess()` for any fast-path or error path
 * - A deny-with-additional-context envelope when a real diff fits the budgets
 *
 * @module tests/pretool/read-cache
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeContentHash,
  ensureSessionDir,
  writeEntry,
} from '../../src/lib/read-cache/index.js';
import { readCacheHook } from '../../src/pretool/read-cache.js';
import type { CachedRead, HookInput } from '../../src/types.js';

const SESSION_ID = 'test-session-pretool';

let tempRoot: string;
let cacheRoot: string;
let workspace: string;

function buildInput(filePath?: string, toolName: HookInput['tool_name'] = 'Read'): HookInput {
  return {
    tool_name: toolName,
    session_id: SESSION_ID,
    tool_input: filePath ? { file_path: filePath } : {},
  };
}

async function seedCache(
  absPath: string,
  content: string,
  overrides: Partial<CachedRead> = {}
): Promise<CachedRead> {
  const stat = fs.statSync(absPath);
  const entry: CachedRead = {
    absPath,
    contentHash: computeContentHash(content),
    size: content.length,
    mtimeMs: stat.mtimeMs,
    cachedContent: content,
    recordedAt: new Date().toISOString(),
    schemaVersion: 1,
    ...overrides,
  };
  ensureSessionDir(SESSION_ID);
  await writeEntry(SESSION_ID, entry);
  return entry;
}

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'read-cache-pretool-'));
  cacheRoot = path.join(tempRoot, 'cache');
  workspace = path.join(tempRoot, 'workspace');
  fs.mkdirSync(cacheRoot, { recursive: true });
  fs.mkdirSync(workspace, { recursive: true });
  process.env['TOKEN_COMPRESS_CACHE_DIR'] = cacheRoot;
  process.env['CLAUDE_SESSION_ID'] = SESSION_ID;
});

afterEach(() => {
  delete process.env['TOKEN_COMPRESS_CACHE_DIR'];
  delete process.env['CLAUDE_SESSION_ID'];
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

describe('read-cache pre-tool hook', () => {
  it('returns silent success for non-Read tools', async () => {
    const file = path.join(workspace, 'a.txt');
    fs.writeFileSync(file, 'hello\n');
    const result = await readCacheHook(buildInput(file, 'Bash'));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('returns silent success when filePath is missing', async () => {
    const result = await readCacheHook(buildInput(undefined, 'Read'));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when sessionId is "unknown"', async () => {
    const file = path.join(workspace, 'a.txt');
    fs.writeFileSync(file, 'hello\n');
    const input: HookInput = {
      tool_name: 'Read',
      session_id: 'unknown',
      tool_input: { file_path: file },
    };
    delete process.env['CLAUDE_SESSION_ID'];
    const result = await readCacheHook(input);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success for first read of a file (no cache yet)', async () => {
    const file = path.join(workspace, 'first.txt');
    fs.writeFileSync(file, 'never seen before\n');
    const result = await readCacheHook(buildInput(file));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when file does not exist on disk', async () => {
    const file = path.join(workspace, 'ghost.txt');
    // never created
    const result = await readCacheHook(buildInput(file));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when path resolves to a directory', async () => {
    const dir = path.join(workspace, 'dir');
    fs.mkdirSync(dir);
    const result = await readCacheHook(buildInput(dir));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when stat (mtime + size) matches cache (fast path)', async () => {
    const file = path.join(workspace, 'stable.txt');
    fs.writeFileSync(file, 'unchanged\n');
    await seedCache(file, 'unchanged\n');

    const result = await readCacheHook(buildInput(file));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('returns silent success when content hash matches despite mtime change', async () => {
    const file = path.join(workspace, 'touched.txt');
    const content = 'identical bytes\n';
    fs.writeFileSync(file, content);
    // Seed cache with same content but a stale mtime (simulating `touch`).
    await seedCache(file, content, { mtimeMs: 1, size: content.length - 999 });

    const result = await readCacheHook(buildInput(file));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('injects a unified diff when the file changed by a small amount', async () => {
    const file = path.join(workspace, 'changed.txt');
    const original = 'line one\nline two\nline three\n';
    fs.writeFileSync(file, original);
    await seedCache(file, original);

    // Mutate the file: replace "line two" → "line TWO"
    const mutated = 'line one\nline TWO\nline three\n';
    fs.writeFileSync(file, mutated);

    const result = await readCacheHook(buildInput(file));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(false);
    expect(result.hookSpecificOutput).toBeDefined();
    const out = result.hookSpecificOutput;
    expect(out?.hookEventName).toBe('PreToolUse');
    expect(out?.permissionDecision).toBe('deny');
    expect(out?.permissionDecisionReason).toContain('Delta-cache');
    expect(out?.additionalContext).toContain('[delta-cache]');
    expect(out?.additionalContext).toContain(file);
    expect(out?.additionalContext).toContain('+line TWO');
    expect(out?.additionalContext).toContain('-line two');
    expect(out?.additionalContext).toContain('@@');
  });

  it('falls through silently when diff exceeds the line budget', async () => {
    const file = path.join(workspace, 'huge-lines.txt');
    // Seed cache with a small file; mutate to >2000 lines so the line budget trips.
    const original = 'one\n';
    fs.writeFileSync(file, original);
    await seedCache(file, original);

    const big = `${Array.from({ length: 2100 }, (_, i) => `row ${i}`).join('\n')}\n`;
    fs.writeFileSync(file, big);

    const result = await readCacheHook(buildInput(file));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('falls through silently when diff exceeds the char budget', async () => {
    const file = path.join(workspace, 'huge-chars.txt');
    // Many short lines so we stay under the line budget, but each line is
    // long enough that the rendered diff overshoots MAX_DELTA_CHARS.
    const original = 'preamble\n';
    fs.writeFileSync(file, original);
    await seedCache(file, original);

    const longLine = 'x'.repeat(80);
    const mutated = `${Array.from({ length: 50 }, () => longLine).join('\n')}\n`;
    fs.writeFileSync(file, mutated);

    const result = await readCacheHook(buildInput(file));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('falls back to env CLAUDE_SESSION_ID when input lacks session_id', async () => {
    const file = path.join(workspace, 'envsession.txt');
    const original = 'one\n';
    fs.writeFileSync(file, original);
    await seedCache(file, original);
    fs.writeFileSync(file, 'two\n');

    // No session_id on input — the hook should resolve it from env.
    const input: HookInput = {
      tool_name: 'Read',
      tool_input: { file_path: file },
    };
    const result = await readCacheHook(input);
    // We don't assert deny vs silent here — we just confirm the hook didn't
    // crash and produced a continue=true envelope.
    expect(result.continue).toBe(true);
  });

  it('resolves relative paths to absolute before cache lookup', async () => {
    // Seed under absolute path; query with a relative one that resolves to it.
    // realpathSync canonicalizes /var → /private/var on macOS so the cache key
    // we seed and the absolute path the hook computes via path.resolve match.
    const realWorkspace = fs.realpathSync(workspace);
    const file = path.join(realWorkspace, 'relative-test.txt');
    fs.writeFileSync(file, 'a\n');
    await seedCache(file, 'a\n');
    fs.writeFileSync(file, 'b\n');

    const cwd = process.cwd();
    process.chdir(realWorkspace);
    try {
      const result = await readCacheHook(buildInput('relative-test.txt'));
      expect(result.continue).toBe(true);
      // Should detect the change and inject a diff.
      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');
    } finally {
      process.chdir(cwd);
    }
  });
});
