/**
 * Tests for readStdinSync chunked reading and EAGAIN handling (audit P1).
 *
 * The reader previously treated ANY readSync error as EOF, so a non-blocking
 * stdin that raised EAGAIN mid-stream truncated the payload, failed the JSON
 * parse, and handed security/permission hooks an empty default input that
 * skipped their checks. These tests pin the retry behavior via a mocked
 * node:fs readSync.
 *
 * @module tests/lib/input-stdin
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readSyncMock } = vi.hoisted(() => ({ readSyncMock: vi.fn() }));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readSync: readSyncMock };
});

import { readHookInput } from '../../src/lib/input.js';

/** Queue a successful chunk delivery into the mocked readSync. */
function enqueueChunk(text: string): void {
  const bytes = Buffer.from(text, 'utf8');
  readSyncMock.mockImplementationOnce((_fd: number, buf: Buffer) => {
    bytes.copy(buf, 0);
    return bytes.length;
  });
}

/** Queue a thrown errno error into the mocked readSync. */
function enqueueError(code: string): void {
  readSyncMock.mockImplementationOnce(() => {
    const err = new Error(code) as NodeJS.ErrnoException;
    err.code = code;
    throw err;
  });
}

/** Queue an EOF (zero-byte read). */
function enqueueEof(): void {
  readSyncMock.mockImplementationOnce(() => 0);
}

const PAYLOAD = '{"tool_name":"Bash","session_id":"s1","tool_input":{"command":"ls -la"}}';

beforeEach(() => {
  readSyncMock.mockReset();
});

describe('readStdinSync multi-chunk reading', () => {
  it('assembles a payload delivered across multiple chunks', () => {
    const mid = Math.floor(PAYLOAD.length / 2);
    enqueueChunk(PAYLOAD.slice(0, mid));
    enqueueChunk(PAYLOAD.slice(mid));
    enqueueEof();

    const input = readHookInput();
    expect(input.tool_name).toBe('Bash');
    expect(input.tool_input.command).toBe('ls -la');
  });

  it('assembles a payload larger than one 256-byte buffer', () => {
    const bigCommand = 'echo '.concat('x'.repeat(600));
    const payload = JSON.stringify({
      tool_name: 'Bash',
      session_id: 's1',
      tool_input: { command: bigCommand },
    });
    for (let i = 0; i < payload.length; i += 256) {
      enqueueChunk(payload.slice(i, i + 256));
    }
    enqueueEof();

    const input = readHookInput();
    expect(input.tool_name).toBe('Bash');
    expect(input.tool_input.command).toBe(bigCommand);
  });
});

describe('readStdinSync EAGAIN handling (audit P1)', () => {
  it('retries through a mid-stream EAGAIN instead of truncating', () => {
    const mid = Math.floor(PAYLOAD.length / 2);
    enqueueChunk(PAYLOAD.slice(0, mid));
    enqueueError('EAGAIN');
    enqueueChunk(PAYLOAD.slice(mid));
    enqueueEof();

    const input = readHookInput();
    // Pre-fix behavior: EAGAIN treated as EOF → half a JSON document →
    // parse failure → default input with empty tool_name.
    expect(input.tool_name).toBe('Bash');
    expect(input.tool_input.command).toBe('ls -la');
  });

  it('survives several consecutive EAGAINs mid-stream', () => {
    const mid = Math.floor(PAYLOAD.length / 2);
    enqueueChunk(PAYLOAD.slice(0, mid));
    enqueueError('EAGAIN');
    enqueueError('EAGAIN');
    enqueueError('EAGAIN');
    enqueueChunk(PAYLOAD.slice(mid));
    enqueueEof();

    const input = readHookInput();
    expect(input.tool_name).toBe('Bash');
  });

  it('gives up after the EAGAIN retry budget and returns default input', () => {
    readSyncMock.mockImplementation(() => {
      const err = new Error('EAGAIN') as NodeJS.ErrnoException;
      err.code = 'EAGAIN';
      throw err;
    });

    const input = readHookInput();
    expect(input.tool_name).toBe('');
    // Budget is 50 retries — the reader must not spin forever
    expect(readSyncMock.mock.calls.length).toBeLessThanOrEqual(52);
  });

  it('stops immediately on a genuine error (EBADF)', () => {
    enqueueError('EBADF');

    const input = readHookInput();
    expect(input.tool_name).toBe('');
    expect(readSyncMock).toHaveBeenCalledTimes(1);
  });

  it('keeps already-read chunks when the stream errors after them', () => {
    enqueueChunk(PAYLOAD);
    enqueueError('EBADF');

    const input = readHookInput();
    // The full payload arrived before the error — it must still parse.
    expect(input.tool_name).toBe('Bash');
  });
});
