/**
 * Tests for stop-failure-handler hook
 *
 * Verifies that the StopFailure hook:
 * - Returns silent success (never blocks or re-feeds errors)
 * - Records last_api_error in shared-context.json
 * - Updates last_activity timestamp
 * - Handles missing context file gracefully
 * - Handles corrupted JSON gracefully
 * - Releases lock on success and failure
 *
 * @module tests/lifecycle/stop-failure-handler
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONTINUITY_DIRS } from '../../src/lib/continuity.js';
import { stopFailureHandler } from '../../src/lifecycle/stop-failure-handler.js';
import type { HookInput } from '../../src/types.js';

function createMockInput(errorType = 'rate_limit', sessionId = 'test-session-123'): HookInput {
  return {
    tool_name: 'StopFailure' as HookInput['tool_name'],
    tool_input: {},
    source: errorType,
    session_id: sessionId,
  };
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stop-failure-test-'));
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

describe('stop-failure-handler', () => {
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
    it('should record last_api_error with error type and session ID', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await stopFailureHandler(createMockInput('rate_limit', 'session-abc'));

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.last_api_error.error_type).toBe('rate_limit');
      expect(content.last_api_error.session_id).toBe('session-abc');
      expect(content.last_api_error.timestamp).toBeDefined();
    });

    it('should update last_activity timestamp', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      const before = new Date();
      await stopFailureHandler(createMockInput());
      const after = new Date();

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      const lastActivity = new Date(content.session_heartbeat.last_activity);

      expect(lastActivity.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(lastActivity.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });

    it('should handle auth_failure error type', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await stopFailureHandler(createMockInput('auth_failure'));

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.last_api_error.error_type).toBe('auth_failure');
    });

    it('should preserve other context fields', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await stopFailureHandler(createMockInput());

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.dirty_tracking.files_edited_count).toBe(3);
      expect(content.version).toBe('1.0.0');
    });
  });

  describe('return value — must always be silent success', () => {
    it('should return silent success on valid input', async () => {
      createFullStructure(tempDir);
      createContextFile(tempDir);

      const result = await stopFailureHandler(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success when context file is missing', async () => {
      createFullStructure(tempDir);

      const result = await stopFailureHandler(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success on corrupted JSON', async () => {
      createFullStructure(tempDir);
      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      fs.writeFileSync(contextFile, 'invalid json {{{');

      const result = await stopFailureHandler(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should never return a blocking result', async () => {
      createFullStructure(tempDir);
      createContextFile(tempDir);

      const result = await stopFailureHandler(createMockInput());

      // Critical: StopFailure hooks must NEVER block — infinite loop risk
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });
  });

  describe('lock handling', () => {
    it('should release lock after successful operation', async () => {
      createFullStructure(tempDir);
      createContextFile(tempDir);

      await stopFailureHandler(createMockInput());

      const lockDir = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json.lock');
      expect(fs.existsSync(lockDir)).toBe(false);
    });

    it('should release lock after failure', async () => {
      createFullStructure(tempDir);
      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      fs.writeFileSync(contextFile, 'invalid json');

      await stopFailureHandler(createMockInput());

      const lockDir = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json.lock');
      expect(fs.existsSync(lockDir)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing source (error type)', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await stopFailureHandler({
        tool_name: 'StopFailure' as HookInput['tool_name'],
        tool_input: {},
      });

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.last_api_error.error_type).toBe('unknown');
    });

    it('should handle missing session_id', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await stopFailureHandler({
        tool_name: 'StopFailure' as HookInput['tool_name'],
        tool_input: {},
        source: 'rate_limit',
      });

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.last_api_error.session_id).toBe('unknown');
    });

    it('should produce valid JSON when stringified', async () => {
      const result = await stopFailureHandler(createMockInput());

      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });
});
