/**
 * Tests for worktree-create hook
 *
 * Verifies that the WorktreeCreate hook:
 * - Creates context directory in worktree
 * - Creates shared-context.json with worktree metadata
 * - Is idempotent (doesn't overwrite existing context)
 * - Handles missing worktree_path gracefully
 *
 * @module tests/lifecycle/worktree-create
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONTINUITY_DIRS } from '../../src/lib/continuity.js';
import { worktreeCreate } from '../../src/lifecycle/worktree-create.js';
import type { HookInput } from '../../src/types.js';

function createMockInput(worktreePath: string, branch = 'feature/test'): HookInput {
  return {
    tool_name: 'WorktreeCreate' as HookInput['tool_name'],
    tool_input: {},
    worktree_path: worktreePath,
    worktree_branch: branch,
  };
}

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

describe('worktree-create', () => {
  const originalEnv = { ...process.env };
  let mainDir: string;
  let worktreeDir: string;

  beforeEach(() => {
    mainDir = createTempDir('worktree-create-main');
    worktreeDir = createTempDir('worktree-create-wt');
    process.env['CLAUDE_PROJECT_DIR'] = mainDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    try {
      fs.rmSync(mainDir, { recursive: true, force: true });
      fs.rmSync(worktreeDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('core functionality', () => {
    it('should create context directory in worktree', async () => {
      await worktreeCreate(createMockInput(worktreeDir));

      const contextDir = path.join(worktreeDir, CONTINUITY_DIRS.context);
      expect(fs.existsSync(contextDir)).toBe(true);
    });

    it('should create shared-context.json with worktree metadata', async () => {
      await worktreeCreate(createMockInput(worktreeDir, 'feature/my-branch'));

      const contextFile = path.join(worktreeDir, CONTINUITY_DIRS.context, 'shared-context.json');
      expect(fs.existsSync(contextFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.worktree.path).toBe(worktreeDir);
      expect(content.worktree.branch).toBe('feature/my-branch');
      expect(content.worktree.main_project).toBe(mainDir);
      expect(content.worktree.created_at).toBeDefined();
      expect(content.version).toBe('1.0.0');
    });

    it('should initialize session_heartbeat', async () => {
      await worktreeCreate(createMockInput(worktreeDir));

      const contextFile = path.join(worktreeDir, CONTINUITY_DIRS.context, 'shared-context.json');
      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));

      expect(content.session_heartbeat.was_cleanly_ended).toBe(false);
      expect(content.session_heartbeat.last_activity).toBeDefined();
    });

    it('should initialize dirty_tracking', async () => {
      await worktreeCreate(createMockInput(worktreeDir));

      const contextFile = path.join(worktreeDir, CONTINUITY_DIRS.context, 'shared-context.json');
      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));

      expect(content.dirty_tracking.files_edited_count).toBe(0);
      expect(content.dirty_tracking.files_edited_this_session).toEqual([]);
    });
  });

  describe('idempotency', () => {
    it('should not overwrite existing context file', async () => {
      // Create context with custom data
      const contextDir = path.join(worktreeDir, CONTINUITY_DIRS.context);
      fs.mkdirSync(contextDir, { recursive: true });
      const contextFile = path.join(contextDir, 'shared-context.json');
      fs.writeFileSync(contextFile, JSON.stringify({ custom: 'data', version: '2.0.0' }));

      await worktreeCreate(createMockInput(worktreeDir));

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.custom).toBe('data');
      expect(content.version).toBe('2.0.0');
    });
  });

  describe('return value', () => {
    it('should always return silent success', async () => {
      const result = await worktreeCreate(createMockInput(worktreeDir));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle missing worktree_path (fallback to cwd)', async () => {
      const result = await worktreeCreate({
        tool_name: 'WorktreeCreate' as HookInput['tool_name'],
        tool_input: {},
        cwd: worktreeDir,
      });

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should produce valid JSON when stringified', async () => {
      const result = await worktreeCreate(createMockInput(worktreeDir));

      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });
});
