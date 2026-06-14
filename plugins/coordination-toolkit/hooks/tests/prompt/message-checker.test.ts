/**
 * Tests for the message-checker UserPromptSubmit hook.
 *
 * Mocks coordination modules to verify message delivery, marking read,
 * and error handling.
 *
 * @module tests/prompt/message-checker
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock coordination modules
vi.mock('../../src/coordination/messages.js');
vi.mock('../../src/coordination/peers.js');

import { getMessages, markRead } from '../../src/coordination/messages.js';
import type { Message } from '../../src/coordination/messages.js';
import { listPeers } from '../../src/coordination/peers.js';
import type { PeerInfo } from '../../src/coordination/types.js';
import { messageChecker } from '../../src/prompt/message-checker.js';
import type { HookInput } from '../../src/types.js';

// =============================================================================
// HELPERS
// =============================================================================

function makeInput(): HookInput {
  return {
    tool_name: 'Bash',
    tool_input: {},
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-123',
    from: 'session-aaaa',
    to: 'session-bbbb',
    content: 'Please rebase before merging',
    timestamp: '2026-04-04T12:00:00Z',
    read: false,
    ...overrides,
  };
}

function makePeer(overrides: Partial<PeerInfo> = {}): PeerInfo {
  return {
    id: 'session-aaaa',
    name: 'auth-sess',
    pid: 1234,
    cwd: '/test/project',
    branch: 'feat/auth',
    started_at: '2026-04-04T10:00:00Z',
    last_heartbeat: '2026-04-04T12:00:00Z',
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
  vi.stubEnv('CLAUDE_PROJECT_DIR', '/test/project');
  vi.mocked(getMessages).mockReturnValue([]);
  vi.mocked(listPeers).mockReturnValue([]);
  vi.mocked(markRead).mockReturnValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

// =============================================================================
// TESTS
// =============================================================================

describe('messageChecker', () => {
  it('returns silent success when no messages', async () => {
    vi.mocked(getMessages).mockReturnValue([]);

    const result = await messageChecker(makeInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('returns outputPromptContext with message content when messages exist', async () => {
    const msg = makeMessage();
    vi.mocked(getMessages).mockReturnValue([msg]);
    vi.mocked(listPeers).mockReturnValue([makePeer({ id: 'session-aaaa', branch: 'feat/auth' })]);

    const result = await messageChecker(makeInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeDefined();
    expect(result.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
    expect(result.hookSpecificOutput?.additionalContext).toContain('1 unread message(s)');
    expect(result.hookSpecificOutput?.additionalContext).toContain('Please rebase before merging');
    expect(result.hookSpecificOutput?.additionalContext).toContain('auth-sess');
  });

  it('marks messages as read after delivery', async () => {
    const msg1 = makeMessage({ id: 'msg-1' });
    const msg2 = makeMessage({ id: 'msg-2', content: 'Second message' });
    vi.mocked(getMessages).mockReturnValue([msg1, msg2]);

    await messageChecker(makeInput());

    expect(markRead).toHaveBeenCalledTimes(2);
    expect(markRead).toHaveBeenCalledWith('/test/project', 'msg-1');
    expect(markRead).toHaveBeenCalledWith('/test/project', 'msg-2');
  });

  it('returns silent success on error', async () => {
    vi.mocked(getMessages).mockImplementation(() => {
      throw new Error('Filesystem error');
    });

    const result = await messageChecker(makeInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('shows truncated session ID when peer is not found', async () => {
    const msg = makeMessage({ from: 'session-unknown-xyz' });
    vi.mocked(getMessages).mockReturnValue([msg]);
    vi.mocked(listPeers).mockReturnValue([]); // No matching peer

    const result = await messageChecker(makeInput());

    expect(result.hookSpecificOutput?.additionalContext).toContain('session-...');
    expect(result.hookSpecificOutput?.additionalContext).not.toContain('feat/auth');
  });
});
