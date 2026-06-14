/**
 * Tests for the message passing module.
 *
 * Verifies sending, receiving, filtering, marking read, auto-expiry,
 * and multi-peer delivery.
 *
 * @module tests/coordination/messages
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMessages,
  isBridgeEnabled,
  markRead,
  sendMessage,
} from '../../src/coordination/messages.js';
import type { Message } from '../../src/coordination/messages.js';
import { COORDINATION_DIRS } from '../../src/coordination/types.js';

// =============================================================================
// HELPERS
// =============================================================================

let tmpDir: string;
const SESSION_A = 'session-aaaa1111';
const SESSION_B = 'session-bbbb2222';
const SESSION_C = 'session-cccc3333';

function messagesDir(): string {
  return path.join(tmpDir, COORDINATION_DIRS.messages);
}

function outboxDir(): string {
  return path.join(tmpDir, COORDINATION_DIRS.outbox);
}

function readMessageFile(id: string): Message {
  const filePath = path.join(messagesDir(), `${id}.json`);
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as Message;
}

function writeMessageFile(msg: Message): void {
  const dir = messagesDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${msg.id}.json`), JSON.stringify(msg, null, 2));
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  const now = new Date();
  return {
    id: `${now.getTime()}-test-msg`,
    from: SESSION_A,
    to: SESSION_B,
    content: 'Hello from A',
    timestamp: now.toISOString(),
    read: false,
    ...overrides,
  };
}

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'messages-test-'));
  vi.stubEnv('CLAUDE_SESSION_ID', SESSION_A);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// =============================================================================
// sendMessage
// =============================================================================

describe('sendMessage', () => {
  it('creates a file with correct schema', () => {
    const msg = sendMessage(tmpDir, SESSION_B, 'Test message');

    expect(msg.from).toBe(SESSION_A);
    expect(msg.to).toBe(SESSION_B);
    expect(msg.content).toBe('Test message');
    expect(msg.read).toBe(false);
    expect(typeof msg.id).toBe('string');
    expect(typeof msg.timestamp).toBe('string');
    expect(() => new Date(msg.timestamp)).not.toThrow();

    // Verify file exists on disk
    const filePath = path.join(messagesDir(), `${msg.id}.json`);
    expect(fs.existsSync(filePath)).toBe(true);

    // Verify file content matches returned object
    const diskMsg = readMessageFile(msg.id);
    expect(diskMsg).toEqual(msg);
  });

  it('creates the messages directory if it does not exist', () => {
    expect(fs.existsSync(messagesDir())).toBe(false);
    sendMessage(tmpDir, SESSION_B, 'First message');
    expect(fs.existsSync(messagesDir())).toBe(true);
  });

  it('generates unique IDs for different messages', () => {
    const msg1 = sendMessage(tmpDir, SESSION_B, 'Message 1');
    const msg2 = sendMessage(tmpDir, SESSION_B, 'Message 2');
    expect(msg1.id).not.toBe(msg2.id);
  });
});

// =============================================================================
// getMessages
// =============================================================================

describe('getMessages', () => {
  it('returns unread messages for this session only', () => {
    vi.stubEnv('CLAUDE_SESSION_ID', SESSION_B);

    // Message addressed to SESSION_B (current session)
    writeMessageFile(makeMessage({ id: 'msg-for-b', to: SESSION_B }));

    const messages = getMessages(tmpDir);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('msg-for-b');
  });

  it('filters out messages for other sessions', () => {
    vi.stubEnv('CLAUDE_SESSION_ID', SESSION_B);

    // Message addressed to SESSION_C (not the current session)
    writeMessageFile(makeMessage({ id: 'msg-for-c', to: SESSION_C }));
    // Message addressed to SESSION_B (current session)
    writeMessageFile(makeMessage({ id: 'msg-for-b', to: SESSION_B }));

    const messages = getMessages(tmpDir);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('msg-for-b');
  });

  it('filters out read messages', () => {
    vi.stubEnv('CLAUDE_SESSION_ID', SESSION_B);

    writeMessageFile(makeMessage({ id: 'msg-unread', to: SESSION_B, read: false }));
    writeMessageFile(makeMessage({ id: 'msg-read', to: SESSION_B, read: true }));

    const messages = getMessages(tmpDir);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('msg-unread');
  });

  it('filters by sinceTimestamp', () => {
    vi.useFakeTimers();

    try {
      const now = new Date('2026-04-04T12:30:00.000Z');
      vi.setSystemTime(now);
      vi.stubEnv('CLAUDE_SESSION_ID', SESSION_B);

      const oldTime = new Date('2026-04-04T12:00:00Z');
      const newTime = new Date('2026-04-04T12:20:00Z');
      const cutoff = '2026-04-04T12:10:00Z';

      writeMessageFile(
        makeMessage({ id: 'msg-old', to: SESSION_B, timestamp: oldTime.toISOString() })
      );
      writeMessageFile(
        makeMessage({ id: 'msg-new', to: SESSION_B, timestamp: newTime.toISOString() })
      );

      const messages = getMessages(tmpDir, cutoff);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-new');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns empty array when directory does not exist', () => {
    const messages = getMessages(tmpDir);
    expect(messages).toEqual([]);
  });

  it('returns empty array when directory is empty', () => {
    fs.mkdirSync(messagesDir(), { recursive: true });
    const messages = getMessages(tmpDir);
    expect(messages).toEqual([]);
  });

  it('sorts messages by timestamp ascending', () => {
    vi.useFakeTimers();

    try {
      const now = new Date('2026-04-04T12:30:00.000Z');
      vi.setSystemTime(now);
      vi.stubEnv('CLAUDE_SESSION_ID', SESSION_B);

      const t1 = new Date('2026-04-04T12:00:00Z');
      const t2 = new Date('2026-04-04T12:10:00Z');
      const t3 = new Date('2026-04-04T12:20:00Z');

      // Write in reverse order
      writeMessageFile(makeMessage({ id: 'msg-3', to: SESSION_B, timestamp: t3.toISOString() }));
      writeMessageFile(makeMessage({ id: 'msg-1', to: SESSION_B, timestamp: t1.toISOString() }));
      writeMessageFile(makeMessage({ id: 'msg-2', to: SESSION_B, timestamp: t2.toISOString() }));

      const messages = getMessages(tmpDir);
      expect(messages.map((m) => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    } finally {
      vi.useRealTimers();
    }
  });
});

// =============================================================================
// markRead
// =============================================================================

describe('markRead', () => {
  it('sets read=true on the message file', () => {
    const msg = makeMessage({ id: 'msg-to-mark', to: SESSION_B });
    writeMessageFile(msg);

    expect(readMessageFile('msg-to-mark').read).toBe(false);

    markRead(tmpDir, 'msg-to-mark');

    expect(readMessageFile('msg-to-mark').read).toBe(true);
  });

  it('does not throw when message file does not exist', () => {
    expect(() => markRead(tmpDir, 'nonexistent-msg')).not.toThrow();
  });
});

// =============================================================================
// Auto-expire
// =============================================================================

describe('auto-expire', () => {
  it('deletes messages older than 1 hour', () => {
    vi.useFakeTimers();

    try {
      const now = new Date('2026-04-04T12:00:00.000Z');
      vi.setSystemTime(now);

      vi.stubEnv('CLAUDE_SESSION_ID', SESSION_B);

      // Message from 2 hours ago — should be expired
      const expiredTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      writeMessageFile(
        makeMessage({ id: 'msg-expired', to: SESSION_B, timestamp: expiredTime.toISOString() })
      );

      // Message from 10 minutes ago — should be kept
      const recentTime = new Date(now.getTime() - 10 * 60 * 1000);
      writeMessageFile(
        makeMessage({ id: 'msg-recent', to: SESSION_B, timestamp: recentTime.toISOString() })
      );

      const messages = getMessages(tmpDir);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-recent');

      // Expired message file should be removed from disk
      const expiredPath = path.join(messagesDir(), 'msg-expired.json');
      expect(fs.existsSync(expiredPath)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

// =============================================================================
// Multi-peer
// =============================================================================

describe('multi-peer', () => {
  it('delivers messages from different senders', () => {
    vi.stubEnv('CLAUDE_SESSION_ID', SESSION_B);

    writeMessageFile(
      makeMessage({ id: 'msg-from-a', from: SESSION_A, to: SESSION_B, content: 'From A' })
    );
    writeMessageFile(
      makeMessage({ id: 'msg-from-c', from: SESSION_C, to: SESSION_B, content: 'From C' })
    );

    const messages = getMessages(tmpDir);
    expect(messages).toHaveLength(2);

    const senders = messages.map((m) => m.from).sort();
    expect(senders).toEqual([SESSION_A, SESSION_C]);
  });
});

// =============================================================================
// Message type and inReplyTo
// =============================================================================

describe('sendMessage with options', () => {
  it('includes type when provided', () => {
    const msg = sendMessage(tmpDir, SESSION_B, 'Question?', { type: 'query' });
    expect(msg.type).toBe('query');

    const diskMsg = readMessageFile(msg.id);
    expect(diskMsg.type).toBe('query');
  });

  it('includes inReplyTo when provided', () => {
    const original = sendMessage(tmpDir, SESSION_B, 'Question?');
    const reply = sendMessage(tmpDir, SESSION_A, 'Answer!', {
      type: 'response',
      inReplyTo: original.id,
    });

    expect(reply.inReplyTo).toBe(original.id);
    expect(reply.type).toBe('response');
  });

  it('omits type and inReplyTo when not provided', () => {
    const msg = sendMessage(tmpDir, SESSION_B, 'Plain message');
    expect(msg.type).toBeUndefined();
    expect(msg.inReplyTo).toBeUndefined();

    const diskMsg = readMessageFile(msg.id);
    expect(diskMsg.type).toBeUndefined();
    expect(diskMsg.inReplyTo).toBeUndefined();
  });
});

// =============================================================================
// Outbox audit log
// =============================================================================

describe('outbox', () => {
  it('writes a copy to the outbox directory', () => {
    const msg = sendMessage(tmpDir, SESSION_B, 'Logged message');

    const outboxPath = path.join(outboxDir(), `${msg.id}.json`);
    expect(fs.existsSync(outboxPath)).toBe(true);

    const outboxMsg = JSON.parse(fs.readFileSync(outboxPath, 'utf8')) as Message;
    expect(outboxMsg).toEqual(msg);
  });

  it('creates the outbox directory if it does not exist', () => {
    expect(fs.existsSync(outboxDir())).toBe(false);
    sendMessage(tmpDir, SESSION_B, 'First message');
    expect(fs.existsSync(outboxDir())).toBe(true);
  });
});

// =============================================================================
// Alias matching (Bug fix: stale/fallback IDs still delivered)
// =============================================================================

describe('alias matching', () => {
  it('delivers messages addressed to the pid-based fallback ID', () => {
    // Sender used raw pid before session ID was established
    const pidAlias = `${process.pid}`;
    vi.stubEnv('CLAUDE_SESSION_ID', SESSION_B); // canonical is SESSION_B

    writeMessageFile(makeMessage({ id: 'msg-pid-alias', to: pidAlias }));

    const messages = getMessages(tmpDir);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('msg-pid-alias');
  });

  it('delivers messages addressed to the env var ID', () => {
    // Both env var and marker file point to different IDs — env var alias accepted
    const coordDir = path.join(tmpDir, COORDINATION_DIRS.root);
    fs.mkdirSync(coordDir, { recursive: true });
    fs.writeFileSync(path.join(coordDir, '.session-id'), SESSION_B);
    vi.stubEnv('CLAUDE_SESSION_ID', SESSION_A); // env var is SESSION_A

    writeMessageFile(makeMessage({ id: 'msg-env-alias', to: SESSION_A }));

    const messages = getMessages(tmpDir);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('msg-env-alias');
  });

  it('env var takes priority over marker file — no cross-session identity theft', () => {
    // Marker file has SESSION_B (written by another session), env has SESSION_A.
    // SESSION_A must NOT receive messages addressed to SESSION_B — that would
    // let one session silently intercept another session's messages when both
    // share the same project directory.
    const coordDir = path.join(tmpDir, COORDINATION_DIRS.root);
    fs.mkdirSync(coordDir, { recursive: true });
    fs.writeFileSync(path.join(coordDir, '.session-id'), SESSION_B);
    vi.stubEnv('CLAUDE_SESSION_ID', SESSION_A);

    writeMessageFile(makeMessage({ id: 'msg-to-other-session', to: SESSION_B }));

    const messages = getMessages(tmpDir);
    expect(messages).toHaveLength(0); // SESSION_A must not receive SESSION_B's messages
  });

  it('does not deliver messages for unrelated sessions', () => {
    vi.stubEnv('CLAUDE_SESSION_ID', SESSION_B);

    writeMessageFile(makeMessage({ id: 'msg-unrelated', to: SESSION_C }));

    const messages = getMessages(tmpDir);
    expect(messages).toHaveLength(0);
  });
});

// =============================================================================
// isBridgeEnabled
// =============================================================================

describe('isBridgeEnabled', () => {
  it('returns false when marker file does not exist', () => {
    expect(isBridgeEnabled(tmpDir)).toBe(false);
  });

  it('returns true when marker file exists', () => {
    const coordDir = path.join(tmpDir, COORDINATION_DIRS.root);
    fs.mkdirSync(coordDir, { recursive: true });
    fs.writeFileSync(path.join(coordDir, '.bridge-enabled'), '');
    expect(isBridgeEnabled(tmpDir)).toBe(true);
  });
});
