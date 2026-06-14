/**
 * Tests for session-end hook
 *
 * Verifies that the SessionEnd hook:
 * - Sets was_cleanly_ended = true
 * - Updates last_activity timestamp
 * - Handles missing context file gracefully
 * - Handles corrupted JSON gracefully
 * - Releases lock on success and failure
 * - Works with different source values
 *
 * @module tests/lifecycle/session-end
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONTINUITY_DIRS } from '../../src/lib/continuity.js';
import { sessionEnd } from '../../src/lifecycle/session-end.js';
import type { HookInput } from '../../src/types.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockInput(source = 'prompt_input_exit'): HookInput {
  return {
    tool_name: 'SessionEnd' as HookInput['tool_name'],
    tool_input: {},
    source,
  };
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'session-end-test-'));
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
      files_edited_count: 5,
      files_edited_this_session: ['a.ts', 'b.ts'],
      last_edit_timestamp: '2026-01-01T11:00:00Z',
    },
    ...overrides,
  };
  fs.writeFileSync(contextFile, JSON.stringify(defaultContext, null, 2));
  return contextFile;
}

function cleanupTempDir(tempDir: string): void {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('session-end', () => {
  const originalEnv = { ...process.env };
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    process.env['CLAUDE_PROJECT_DIR'] = tempDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    cleanupTempDir(tempDir);
  });

  // ===========================================================================
  // Core Functionality
  // ===========================================================================

  describe('core functionality', () => {
    it('should set was_cleanly_ended to true', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await sessionEnd(createMockInput());

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.session_heartbeat.was_cleanly_ended).toBe(true);
    });

    it('should update last_activity timestamp', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      const before = new Date();
      await sessionEnd(createMockInput());
      const after = new Date();

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      const lastActivity = new Date(content.session_heartbeat.last_activity);

      expect(lastActivity.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(lastActivity.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });

    it('should preserve other context fields', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await sessionEnd(createMockInput());

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));

      // dirty_tracking should be preserved
      expect(content.dirty_tracking.files_edited_count).toBe(5);
      expect(content.dirty_tracking.files_edited_this_session).toEqual(['a.ts', 'b.ts']);
      expect(content.version).toBe('1.0.0');
    });
  });

  // ===========================================================================
  // Return Value
  // ===========================================================================

  describe('return value', () => {
    it('should always return silent success', async () => {
      createFullStructure(tempDir);
      createContextFile(tempDir);

      const result = await sessionEnd(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success even when context file is missing', async () => {
      createFullStructure(tempDir);
      // Don't create context file

      const result = await sessionEnd(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success on corrupted JSON', async () => {
      createFullStructure(tempDir);
      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      fs.writeFileSync(contextFile, 'invalid json {{{');

      const result = await sessionEnd(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ===========================================================================
  // Lock Handling
  // ===========================================================================

  describe('lock handling', () => {
    it('should release lock after successful operation', async () => {
      createFullStructure(tempDir);
      createContextFile(tempDir);

      await sessionEnd(createMockInput());

      const lockDir = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json.lock');
      expect(fs.existsSync(lockDir)).toBe(false);
    });

    it('should release lock after failure', async () => {
      createFullStructure(tempDir);
      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      fs.writeFileSync(contextFile, 'invalid json');

      await sessionEnd(createMockInput());

      const lockDir = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json.lock');
      expect(fs.existsSync(lockDir)).toBe(false);
    });
  });

  // ===========================================================================
  // Different Source Values
  // ===========================================================================

  describe('different source values', () => {
    const sources = [
      'clear',
      'logout',
      'prompt_input_exit',
      'bypass_permissions_disabled',
      'other',
    ];

    for (const source of sources) {
      it(`should handle source='${source}'`, async () => {
        createFullStructure(tempDir);
        const contextFile = createContextFile(tempDir);

        const result = await sessionEnd(createMockInput(source));

        expect(result.continue).toBe(true);
        expect(result.suppressOutput).toBe(true);

        const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
        expect(content.session_heartbeat.was_cleanly_ended).toBe(true);
      });
    }
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle missing session_heartbeat field', async () => {
      createFullStructure(tempDir);
      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      fs.writeFileSync(contextFile, JSON.stringify({ version: '1.0.0' }, null, 2));

      await sessionEnd(createMockInput());

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.session_heartbeat.was_cleanly_ended).toBe(true);
    });

    it('should handle empty context file', async () => {
      createFullStructure(tempDir);
      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      fs.writeFileSync(contextFile, '{}');

      await sessionEnd(createMockInput());

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.session_heartbeat.was_cleanly_ended).toBe(true);
    });

    it('should handle missing CLAUDE_PROJECT_DIR', async () => {
      delete process.env['CLAUDE_PROJECT_DIR'];

      const result = await sessionEnd(createMockInput());

      // Should succeed silently (uses '.' as fallback)
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should produce valid JSON when stringified', async () => {
      createFullStructure(tempDir);
      createContextFile(tempDir);

      const result = await sessionEnd(createMockInput());

      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });
});
