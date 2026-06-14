/**
 * Tests for stop-state-saver hook
 *
 * Verifies that the Stop hook:
 * - Updates last_activity in shared-context.json
 * - Records last_stop event with truncated last_message
 * - Handles missing context file gracefully
 * - Handles corrupted JSON gracefully
 * - Releases lock on success and failure
 *
 * @module tests/lifecycle/stop-state-saver
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONTINUITY_DIRS } from '../../src/lib/continuity.js';
import { stopStateSaver } from '../../src/lifecycle/stop-state-saver.js';
import type { HookInput } from '../../src/types.js';

function createMockInput(
  lastMessage = 'I completed the task.',
  stopReason = 'end_turn'
): HookInput {
  return {
    tool_name: 'Stop' as HookInput['tool_name'],
    tool_input: {},
    last_assistant_message: lastMessage,
    source: stopReason,
  };
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stop-state-test-'));
}

function createFullStructure(projectDir: string): void {
  for (const dir of Object.values(CONTINUITY_DIRS)) {
    fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
  }
}

function createContextFile(projectDir: string, overrides: Record<string, unknown> = {}): string {
  const contextFile = path.join(projectDir, CONTINUITY_DIRS.context, 'shared-context.json');
  const defaultContext = {
    version: '1.0.0',
    session_heartbeat: {
      last_activity: '2026-01-01T12:00:00Z',
      session_start: '2026-01-01T10:00:00Z',
      was_cleanly_ended: false,
    },
    dirty_tracking: {
      files_edited_count: 3,
      files_edited_this_session: ['a.ts'],
    },
    ...overrides,
  };
  fs.writeFileSync(contextFile, JSON.stringify(defaultContext, null, 2));
  return contextFile;
}

describe('stop-state-saver', () => {
  const originalEnv = { ...process.env };
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    process.env['CLAUDE_PROJECT_DIR'] = tempDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('core functionality', () => {
    it('should update last_activity timestamp', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      const before = new Date();
      await stopStateSaver(createMockInput());
      const after = new Date();

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      const lastActivity = new Date(content.session_heartbeat.last_activity);

      expect(lastActivity.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(lastActivity.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });

    it('should record last_stop event with message and reason', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await stopStateSaver(createMockInput('Final message here', 'end_turn'));

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.last_stop.source).toBe('end_turn');
      expect(content.last_stop.last_message).toBe('Final message here');
      expect(content.last_stop.timestamp).toBeDefined();
    });

    it('should truncate long last_assistant_message', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      const longMessage = 'x'.repeat(1000);
      await stopStateSaver(createMockInput(longMessage, 'end_turn'));

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.last_stop.last_message.length).toBeLessThanOrEqual(600); // 500 chars + truncation suffix
    });

    it('should handle empty last_assistant_message', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await stopStateSaver(createMockInput('', 'interrupted'));

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.last_stop.last_message).toBe('');
      expect(content.last_stop.source).toBe('interrupted');
    });

    it('should preserve other context fields', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await stopStateSaver(createMockInput());

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.dirty_tracking.files_edited_count).toBe(3);
      expect(content.version).toBe('1.0.0');
    });
  });

  describe('return value', () => {
    it('should always return silent success', async () => {
      createFullStructure(tempDir);
      createContextFile(tempDir);

      const result = await stopStateSaver(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success when context file is missing', async () => {
      createFullStructure(tempDir);

      const result = await stopStateSaver(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success on corrupted JSON', async () => {
      createFullStructure(tempDir);
      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      fs.writeFileSync(contextFile, 'invalid json {{{');

      const result = await stopStateSaver(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('lock handling', () => {
    it('should release lock after successful operation', async () => {
      createFullStructure(tempDir);
      createContextFile(tempDir);

      await stopStateSaver(createMockInput());

      const lockDir = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json.lock');
      expect(fs.existsSync(lockDir)).toBe(false);
    });

    it('should release lock after failure', async () => {
      createFullStructure(tempDir);
      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      fs.writeFileSync(contextFile, 'invalid json');

      await stopStateSaver(createMockInput());

      const lockDir = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json.lock');
      expect(fs.existsSync(lockDir)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing stop_reason', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await stopStateSaver({
        tool_name: 'Stop' as HookInput['tool_name'],
        tool_input: {},
      });

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.last_stop.source).toBe('unknown');
    });

    it('should produce valid JSON when stringified', async () => {
      const result = await stopStateSaver(createMockInput());

      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });
});
