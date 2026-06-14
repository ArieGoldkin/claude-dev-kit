/**
 * Tests for the bridge-message-checker PostToolUse hook.
 *
 * Verifies throttling, bridge-enabled gating, message delivery,
 * and error handling.
 *
 * @module tests/posttool/bridge-message-checker
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock coordination modules
vi.mock('../../src/coordination/messages.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/coordination/messages.js')>();
  return {
    ...original,
    getMessages: vi.fn().mockReturnValue([]),
    markRead: vi.fn(),
    // Keep real isBridgeEnabled — it reads the filesystem
  };
});
vi.mock('../../src/coordination/peers.js');

import { getMessages, markRead } from '../../src/coordination/messages.js';
import type { Message } from '../../src/coordination/messages.js';
import { listPeers } from '../../src/coordination/peers.js';
import type { PeerInfo } from '../../src/coordination/types.js';
import { COORDINATION_DIRS } from '../../src/coordination/types.js';
import { bridgeMessageChecker } from '../../src/posttool/bridge-message-checker.js';
import type { HookInput } from '../../src/types.js';

// =============================================================================
// HELPERS
// =============================================================================

let tmpDir: string;

function makeInput(): HookInput {
  return { tool_name: 'Bash', tool_input: {} };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-bridge-1',
    from: 'session-aaaa',
    to: 'session-bbbb',
    content: 'Check the error logs please',
    timestamp: '2026-04-04T12:00:00Z',
    read: false,
    ...overrides,
  };
}

function makePeer(overrides: Partial<PeerInfo> = {}): PeerInfo {
  return {
    id: 'session-aaaa',
    name: 'monitor-sess',
    pid: 1234,
    cwd: '/test/project',
    branch: 'main',
    started_at: '2026-04-04T10:00:00Z',
    last_heartbeat: '2026-04-04T12:00:00Z',
    status: 'active',
    summary: null,
    files_editing: [],
    ...overrides,
  };
}

function enableBridge(): void {
  const coordDir = path.join(tmpDir, COORDINATION_DIRS.root);
  fs.mkdirSync(coordDir, { recursive: true });
  fs.writeFileSync(path.join(coordDir, '.bridge-enabled'), '');
}

function writeThrottleFile(timestampMs: number): void {
  const coordDir = path.join(tmpDir, COORDINATION_DIRS.root);
  fs.mkdirSync(coordDir, { recursive: true });
  fs.writeFileSync(path.join(coordDir, '.last-message-check'), String(timestampMs));
}

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-checker-test-'));
  vi.stubEnv('CLAUDE_PROJECT_DIR', tmpDir);
  vi.mocked(getMessages).mockReturnValue([]);
  vi.mocked(listPeers).mockReturnValue([]);
  vi.mocked(markRead).mockReturnValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// =============================================================================
// TESTS
// =============================================================================

describe('bridgeMessageChecker', () => {
  it('returns silent success when bridge is not enabled', async () => {
    // No .bridge-enabled marker
    const result = await bridgeMessageChecker(makeInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(getMessages).not.toHaveBeenCalled();
  });

  it('returns silent success when throttled', async () => {
    enableBridge();
    // Throttle file with very recent timestamp
    writeThrottleFile(Date.now());

    const result = await bridgeMessageChecker(makeInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(getMessages).not.toHaveBeenCalled();
  });

  it('checks messages when bridge is enabled and not throttled', async () => {
    enableBridge();
    // Throttle file with old timestamp (> 3 seconds ago)
    writeThrottleFile(Date.now() - 5000);

    vi.mocked(getMessages).mockReturnValue([]);

    const result = await bridgeMessageChecker(makeInput());

    expect(result.continue).toBe(true);
    expect(getMessages).toHaveBeenCalledWith(tmpDir);
  });

  it('checks messages when no throttle file exists', async () => {
    enableBridge();

    await bridgeMessageChecker(makeInput());

    expect(getMessages).toHaveBeenCalledWith(tmpDir);
  });

  it('delivers messages via outputWithContext', async () => {
    enableBridge();
    const msg = makeMessage();
    vi.mocked(getMessages).mockReturnValue([msg]);
    vi.mocked(listPeers).mockReturnValue([makePeer()]);

    const result = await bridgeMessageChecker(makeInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeDefined();
    expect(result.hookSpecificOutput?.additionalContext).toContain('1 unread message(s)');
    expect(result.hookSpecificOutput?.additionalContext).toContain('Check the error logs please');
    expect(result.hookSpecificOutput?.additionalContext).toContain('monitor-sess');
  });

  it('includes type and inReplyTo tags in output', async () => {
    enableBridge();
    const msg = makeMessage({ type: 'query', inReplyTo: 'msg-original-abc123' });
    vi.mocked(getMessages).mockReturnValue([msg]);
    vi.mocked(listPeers).mockReturnValue([makePeer()]);

    const result = await bridgeMessageChecker(makeInput());

    expect(result.hookSpecificOutput?.additionalContext).toContain('[query]');
    expect(result.hookSpecificOutput?.additionalContext).toContain('(reply to msg-original');
  });

  it('marks all messages as read', async () => {
    enableBridge();
    const msg1 = makeMessage({ id: 'msg-1' });
    const msg2 = makeMessage({ id: 'msg-2', content: 'Second' });
    vi.mocked(getMessages).mockReturnValue([msg1, msg2]);

    await bridgeMessageChecker(makeInput());

    expect(markRead).toHaveBeenCalledTimes(2);
    expect(markRead).toHaveBeenCalledWith(tmpDir, 'msg-1');
    expect(markRead).toHaveBeenCalledWith(tmpDir, 'msg-2');
  });

  it('updates throttle file after checking', async () => {
    enableBridge();

    const before = Date.now();
    await bridgeMessageChecker(makeInput());

    const throttlePath = path.join(tmpDir, COORDINATION_DIRS.root, '.last-message-check');
    const content = fs.readFileSync(throttlePath, 'utf8');
    const ts = Number.parseInt(content, 10);
    expect(ts).toBeGreaterThanOrEqual(before);
  });

  it('returns silent success on error', async () => {
    enableBridge();
    vi.mocked(getMessages).mockImplementation(() => {
      throw new Error('Filesystem error');
    });

    const result = await bridgeMessageChecker(makeInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});
