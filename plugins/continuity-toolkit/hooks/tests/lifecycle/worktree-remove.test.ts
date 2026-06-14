/**
 * Tests for worktree-remove hook
 *
 * Verifies that the WorktreeRemove hook:
 * - Records worktree removal in archived_worktrees
 * - Handles missing context file gracefully
 * - Handles corrupted JSON gracefully
 * - Releases lock on success and failure
 * - Appends to existing archived_worktrees array
 *
 * @module tests/lifecycle/worktree-remove
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONTINUITY_DIRS } from '../../src/lib/continuity.js';
import { worktreeRemove } from '../../src/lifecycle/worktree-remove.js';
import type { HookInput } from '../../src/types.js';

function createMockInput(worktreePath = '/tmp/my-worktree'): HookInput {
  return {
    tool_name: 'WorktreeRemove' as HookInput['tool_name'],
    tool_input: {},
    worktree_path: worktreePath,
  };
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'worktree-remove-test-'));
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
    ...overrides,
  };
  fs.writeFileSync(contextFile, JSON.stringify(defaultContext, null, 2));
  return contextFile;
}

describe('worktree-remove', () => {
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
    it('should record worktree removal in archived_worktrees', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await worktreeRemove(createMockInput('/tmp/removed-worktree'));

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.archived_worktrees).toHaveLength(1);
      expect(content.archived_worktrees[0].path).toBe('/tmp/removed-worktree');
      expect(content.archived_worktrees[0].removed_at).toBeDefined();
    });

    it('should append to existing archived_worktrees', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir, {
        archived_worktrees: [{ path: '/old-wt', removed_at: '2026-01-01T00:00:00Z' }],
      });

      await worktreeRemove(createMockInput('/tmp/new-removal'));

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.archived_worktrees).toHaveLength(2);
      expect(content.archived_worktrees[0].path).toBe('/old-wt');
      expect(content.archived_worktrees[1].path).toBe('/tmp/new-removal');
    });

    it('should preserve other context fields', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await worktreeRemove(createMockInput());

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.version).toBe('1.0.0');
      expect(content.session_heartbeat.session_start).toBe('2026-01-01T10:00:00Z');
    });
  });

  describe('return value', () => {
    it('should always return silent success', async () => {
      createFullStructure(tempDir);
      createContextFile(tempDir);

      const result = await worktreeRemove(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success when context file is missing', async () => {
      createFullStructure(tempDir);

      const result = await worktreeRemove(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success on corrupted JSON', async () => {
      createFullStructure(tempDir);
      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      fs.writeFileSync(contextFile, 'not valid json');

      const result = await worktreeRemove(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('lock handling', () => {
    it('should release lock after successful operation', async () => {
      createFullStructure(tempDir);
      createContextFile(tempDir);

      await worktreeRemove(createMockInput());

      const lockDir = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json.lock');
      expect(fs.existsSync(lockDir)).toBe(false);
    });

    it('should release lock after failure', async () => {
      createFullStructure(tempDir);
      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      fs.writeFileSync(contextFile, 'invalid json');

      await worktreeRemove(createMockInput());

      const lockDir = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json.lock');
      expect(fs.existsSync(lockDir)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing worktree_path', async () => {
      createFullStructure(tempDir);
      const contextFile = createContextFile(tempDir);

      await worktreeRemove({
        tool_name: 'WorktreeRemove' as HookInput['tool_name'],
        tool_input: {},
      });

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.archived_worktrees[0].path).toBe('unknown');
    });

    it('should handle missing CLAUDE_PROJECT_DIR', async () => {
      delete process.env['CLAUDE_PROJECT_DIR'];

      const result = await worktreeRemove(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should produce valid JSON when stringified', async () => {
      const result = await worktreeRemove(createMockInput());

      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });
});
