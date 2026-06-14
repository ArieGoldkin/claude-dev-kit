/**
 * Tests for task-created-logger hook
 *
 * Verifies that the TaskCreated hook:
 * - Appends JSONL entry to metrics file with event: 'created'
 * - Creates metrics directory if missing
 * - Handles multiple creations (append, not overwrite)
 * - Records correct fields
 *
 * @module tests/lifecycle/task-created-logger
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { taskCreatedLogger } from '../../src/lifecycle/task-created-logger.js';
import type { HookInput } from '../../src/types.js';

function createMockInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'TaskCreated' as HookInput['tool_name'],
    tool_input: {},
    agent_id: 'agent-789',
    session_id: 'session-abc',
    tool_use_id: 'tu-001',
    ...overrides,
  };
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'task-created-test-'));
}

describe('task-created-logger', () => {
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
    it('should create metrics directory and file', async () => {
      await taskCreatedLogger(createMockInput());

      const metricsFile = path.join(tempDir, '.claude/continuity/metrics/tasks.jsonl');
      expect(fs.existsSync(metricsFile)).toBe(true);
    });

    it('should write valid JSONL entry with event: created', async () => {
      await taskCreatedLogger(createMockInput());

      const metricsFile = path.join(tempDir, '.claude/continuity/metrics/tasks.jsonl');
      const content = fs.readFileSync(metricsFile, 'utf8').trim();
      const entry = JSON.parse(content);

      expect(entry.event).toBe('created');
      expect(entry.agent_id).toBe('agent-789');
      expect(entry.session_id).toBe('session-abc');
      expect(entry.tool_use_id).toBe('tu-001');
      expect(entry.timestamp).toBeDefined();
    });

    it('should append multiple entries', async () => {
      await taskCreatedLogger(createMockInput({ agent_id: 'agent-1' }));
      await taskCreatedLogger(createMockInput({ agent_id: 'agent-2' }));

      const metricsFile = path.join(tempDir, '.claude/continuity/metrics/tasks.jsonl');
      const lines = fs.readFileSync(metricsFile, 'utf8').trim().split('\n');

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).agent_id).toBe('agent-1');
      expect(JSON.parse(lines[1]).agent_id).toBe('agent-2');
    });

    it('should omit tool_use_id when not present', async () => {
      await taskCreatedLogger(createMockInput({ tool_use_id: undefined }));

      const metricsFile = path.join(tempDir, '.claude/continuity/metrics/tasks.jsonl');
      const entry = JSON.parse(fs.readFileSync(metricsFile, 'utf8').trim());

      expect(entry).not.toHaveProperty('tool_use_id');
    });
  });

  describe('return value', () => {
    it('should always return silent success', async () => {
      const result = await taskCreatedLogger(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle missing agent_id', async () => {
      await taskCreatedLogger(createMockInput({ agent_id: undefined }));

      const metricsFile = path.join(tempDir, '.claude/continuity/metrics/tasks.jsonl');
      const entry = JSON.parse(fs.readFileSync(metricsFile, 'utf8').trim());

      expect(entry.agent_id).toBe('unknown');
    });

    it('should handle missing session_id', async () => {
      delete process.env['CLAUDE_SESSION_ID'];
      await taskCreatedLogger(createMockInput({ session_id: undefined }));

      const metricsFile = path.join(tempDir, '.claude/continuity/metrics/tasks.jsonl');
      const entry = JSON.parse(fs.readFileSync(metricsFile, 'utf8').trim());

      expect(entry.session_id).toBe('unknown');
    });

    it('should handle pre-existing metrics directory', async () => {
      const metricsDir = path.join(tempDir, '.claude/continuity/metrics');
      fs.mkdirSync(metricsDir, { recursive: true });

      const result = await taskCreatedLogger(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should produce valid JSON when stringified', async () => {
      const result = await taskCreatedLogger(createMockInput());

      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });
});
