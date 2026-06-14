/**
 * Integration tests for the PostToolUse `read-cache-writer` hook.
 *
 * Each test runs in an isolated temp directory with `TOKEN_COMPRESS_CACHE_DIR`
 * pointed at a per-test cache root. The hook must always return
 * `outputSilentSuccess()` regardless of cache write success/failure — its
 * job is to populate the cache, not to surface anything to the user.
 *
 * @module tests/posttool/read-cache-writer
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeContentHash, getReadsPath, readEntry } from '../../src/lib/read-cache/index.js';
import { readCacheWriterHook } from '../../src/posttool/read-cache-writer.js';
import type { HookInput } from '../../src/types.js';

const SESSION_ID = 'test-session-posttool';

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

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'read-cache-writer-'));
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

describe('read-cache-writer post-tool hook', () => {
  it('writes a cache entry after a successful Read', async () => {
    const file = path.join(workspace, 'a.txt');
    const content = 'first contents\nline two\n';
    fs.writeFileSync(file, content);

    const result = await readCacheWriterHook(buildInput(file));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);

    const entry = await readEntry(SESSION_ID, file);
    expect(entry).not.toBeNull();
    expect(entry?.absPath).toBe(file);
    expect(entry?.contentHash).toBe(computeContentHash(content));
    expect(entry?.size).toBe(fs.statSync(file).size);
    expect(entry?.mtimeMs).toBe(fs.statSync(file).mtimeMs);
    expect(entry?.cachedContent).toBe(content);
    expect(entry?.schemaVersion).toBe(1);
    expect(typeof entry?.recordedAt).toBe('string');
  });

  it('overwrites with most-recent entry on repeat Read of same file', async () => {
    const file = path.join(workspace, 'churn.txt');
    fs.writeFileSync(file, 'v1\n');
    await readCacheWriterHook(buildInput(file));

    // Mutate and re-fire the hook
    fs.writeFileSync(file, 'v2 longer content\n');
    await readCacheWriterHook(buildInput(file));

    const entry = await readEntry(SESSION_ID, file);
    expect(entry).not.toBeNull();
    expect(entry?.cachedContent).toBe('v2 longer content\n');
    expect(entry?.contentHash).toBe(computeContentHash('v2 longer content\n'));

    // JSONL should contain at least 2 lines for this file
    const reads = fs.readFileSync(getReadsPath(SESSION_ID), 'utf8');
    const matchingLines = reads.split('\n').filter((l) => l.includes(file));
    expect(matchingLines.length).toBeGreaterThanOrEqual(2);
  });

  it('does not write when tool is not Read', async () => {
    const file = path.join(workspace, 'b.txt');
    fs.writeFileSync(file, 'should not be cached\n');

    const result = await readCacheWriterHook(buildInput(file, 'Bash'));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);

    const entry = await readEntry(SESSION_ID, file);
    expect(entry).toBeNull();
  });

  it('returns silent success without writing when filePath is missing', async () => {
    const result = await readCacheWriterHook(buildInput(undefined));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);

    expect(fs.existsSync(getReadsPath(SESSION_ID))).toBe(false);
  });

  it('returns silent success without writing when sessionId is unknown', async () => {
    const file = path.join(workspace, 'c.txt');
    fs.writeFileSync(file, 'data\n');

    delete process.env['CLAUDE_SESSION_ID'];
    const input: HookInput = {
      tool_name: 'Read',
      session_id: 'unknown',
      tool_input: { file_path: file },
    };
    const result = await readCacheWriterHook(input);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success without crashing when file no longer exists', async () => {
    const file = path.join(workspace, 'nonexistent.txt');
    // never created
    const result = await readCacheWriterHook(buildInput(file));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);

    const entry = await readEntry(SESSION_ID, file);
    expect(entry).toBeNull();
  });

  it('skips writing when path resolves to a directory', async () => {
    const dir = path.join(workspace, 'as-dir');
    fs.mkdirSync(dir);
    const result = await readCacheWriterHook(buildInput(dir));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);

    const entry = await readEntry(SESSION_ID, dir);
    expect(entry).toBeNull();
  });

  it('absorbs cache write failures (unwritable cache root) silently', async () => {
    const file = path.join(workspace, 'doomed.txt');
    fs.writeFileSync(file, 'will not be written\n');

    // Point cache root at a path under a read-only directory.
    const ro = path.join(tempRoot, 'readonly');
    fs.mkdirSync(ro);
    fs.chmodSync(ro, 0o500);
    process.env['TOKEN_COMPRESS_CACHE_DIR'] = path.join(ro, 'cache');

    try {
      const result = await readCacheWriterHook(buildInput(file));
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    } finally {
      // Restore so afterEach cleanup can rm -rf
      fs.chmodSync(ro, 0o700);
    }
  });

  it('persists entries that the pretool hook can later consume', async () => {
    // End-to-end shape: write via post hook, retrieve via readEntry like the
    // pretool hook does — confirms file format compatibility across hooks.
    const file = path.join(workspace, 'roundtrip.txt');
    const content = 'alpha\nbeta\ngamma\n';
    fs.writeFileSync(file, content);

    await readCacheWriterHook(buildInput(file));

    const entry = await readEntry(SESSION_ID, file);
    expect(entry).not.toBeNull();
    expect(entry?.cachedContent).toBe(content);
  });
});
