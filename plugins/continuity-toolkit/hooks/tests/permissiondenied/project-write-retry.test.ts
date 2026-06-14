/**
 * Tests for project-write-retry PermissionDenied hook
 *
 * Verifies that in-project Write/Edit denied by auto-mode are retried,
 * protected files are NOT retried, and non-write tools are ignored.
 *
 * Uses mocked path-utils to isolate retry logic from filesystem resolution
 * (path resolution has its own 67 tests in path-utils.test.ts).
 *
 * @module tests/permissiondenied/project-write-retry
 */

import { describe, expect, it, vi } from 'vitest';
import type { HookInput } from '../../src/types.js';

// Mock path-utils to isolate retry logic from macOS /private/tmp resolution
vi.mock('../../src/lib/path-utils.js', () => ({
  isWithinProject: (p: string) => p.startsWith('/project/'),
  isProtectedPath: (p: string) => {
    if (/\.env\b/.test(p) || p.includes('.git/') || p.includes('.aws/') || /credentials/.test(p))
      return { isProtected: true, category: 'env' };
    return { isProtected: false };
  },
  resolveRealPath: (p: string) => p,
  normalizePath: (p: string) => p,
}));

// Import AFTER mock setup
const { projectWriteRetry } = await import('../../src/permissiondenied/project-write-retry.js');

function createWriteDenial(filePath: string): HookInput {
  return {
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: 'test content' },
    session_id: 'test-session',
  };
}

function createEditDenial(filePath: string): HookInput {
  return {
    tool_name: 'Edit',
    tool_input: { file_path: filePath, old_string: 'old', new_string: 'new' },
    session_id: 'test-session',
  };
}

function createBashDenial(command: string): HookInput {
  return {
    tool_name: 'Bash',
    tool_input: { command },
    session_id: 'test-session',
  };
}

describe('projectWriteRetry', () => {
  describe('in-project writes should be retried', () => {
    it('should retry Write to a .ts file in project', async () => {
      const result = await projectWriteRetry(createWriteDenial('/project/src/index.ts'));
      expect(result.hookSpecificOutput?.retry).toBe(true);
    });

    it('should retry Edit to a .js file in project', async () => {
      const result = await projectWriteRetry(createEditDenial('/project/lib/utils.js'));
      expect(result.hookSpecificOutput?.retry).toBe(true);
    });

    it('should retry Write to a .md file in project', async () => {
      const result = await projectWriteRetry(createWriteDenial('/project/README.md'));
      expect(result.hookSpecificOutput?.retry).toBe(true);
    });
  });

  describe('outside-project writes should NOT be retried', () => {
    it('should not retry Write outside project', async () => {
      const result = await projectWriteRetry(createWriteDenial('/home/user/other-project/file.ts'));
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });
  });

  describe('protected files should NOT be retried', () => {
    it('should not retry Write to env file', async () => {
      const result = await projectWriteRetry(createWriteDenial('/project/.env'));
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });

    it('should not retry Write to env.local', async () => {
      const result = await projectWriteRetry(createWriteDenial('/project/.env.local'));
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });

    it('should not retry Write to .git directory', async () => {
      const result = await projectWriteRetry(createWriteDenial('/project/.git/config'));
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });

    it('should not retry Write to credentials file', async () => {
      const result = await projectWriteRetry(createWriteDenial('/project/.aws/credentials'));
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });
  });

  describe('non-write tools should be ignored', () => {
    it('should not retry Bash denials', async () => {
      const result = await projectWriteRetry(createBashDenial('ls -la'));
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
      expect(result.continue).toBe(true);
    });

    it('should not retry Read denials', async () => {
      const result = await projectWriteRetry({
        tool_name: 'Read',
        tool_input: { file_path: '/project/file.ts' },
      });
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });
  });

  describe('missing file_path should be handled', () => {
    it('should handle Write with no file_path', async () => {
      const result = await projectWriteRetry({
        tool_name: 'Write',
        tool_input: { content: 'test' },
      });
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });
  });

  describe('MultiEdit should be handled', () => {
    it('should retry MultiEdit in project', async () => {
      const result = await projectWriteRetry({
        tool_name: 'MultiEdit',
        tool_input: { file_path: '/project/src/file.ts', edits: [] },
      });
      expect(result.hookSpecificOutput?.retry).toBe(true);
    });
  });
});
