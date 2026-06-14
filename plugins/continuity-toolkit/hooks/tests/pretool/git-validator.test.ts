/**
 * Tests for git-validator PreToolUse hook
 *
 * @module tests/pretool/git-validator
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { gitValidator } from '../../src/pretool/git-validator.js';
import type { HookInput } from '../../src/types.js';

// Mock git-utils to control branch detection
vi.mock('../../src/lib/git-utils.js', () => ({
  getCachedBranch: vi.fn(() => 'feature/test-branch'),
  isProtectedBranch: vi.fn((branch: string) => {
    const protected_branches = ['main', 'master', 'develop', 'dev'];
    return protected_branches.includes(branch.toLowerCase());
  }),
}));

// Import the mocked module
import * as gitUtils from '../../src/lib/git-utils.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    tool_input: { command },
  };
}

function createNonBashInput(toolName: string): HookInput {
  return {
    tool_name: toolName as HookInput['tool_name'],
    tool_input: {},
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('gitValidator', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('non-Bash tools', () => {
    it('should return silent success for Write tool', async () => {
      const input = createNonBashInput('Write');
      const result = await gitValidator(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success for Edit tool', async () => {
      const input = createNonBashInput('Edit');
      const result = await gitValidator(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('non-git-commit commands', () => {
    it('should return silent success for git status', async () => {
      const result = await gitValidator(createBashInput('git status'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success for git log', async () => {
      const result = await gitValidator(createBashInput('git log --oneline'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success for non-git commands', async () => {
      const result = await gitValidator(createBashInput('ls -la'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success for empty command', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: {},
      };
      const result = await gitValidator(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('valid git commits', () => {
    it('should return silent success for valid conventional commit', async () => {
      const result = await gitValidator(createBashInput('git commit -m "feat: add new feature"'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success for valid fix commit', async () => {
      const result = await gitValidator(createBashInput('git commit -m "fix(auth): resolve bug"'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success for valid docs commit', async () => {
      const result = await gitValidator(createBashInput('git commit -m "docs: update readme"'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('invalid commit messages', () => {
    it('should warn for non-conventional commit message', async () => {
      const result = await gitValidator(createBashInput('git commit -m "add new feature"'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('⚠');
      expect(result.systemMessage).toContain('conventional commit');
    });

    it('should warn for commit message without type', async () => {
      const result = await gitValidator(createBashInput('git commit -m "updated the login page"'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeDefined();
    });
  });

  describe('protected branch warnings', () => {
    it('should warn when committing to main', async () => {
      vi.mocked(gitUtils.getCachedBranch).mockReturnValue('main');

      const result = await gitValidator(createBashInput('git commit -m "feat: add feature"'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('⚠');
      expect(result.systemMessage).toContain('protected branch');
      expect(result.systemMessage).toContain('main');
    });

    it('should warn when committing to master', async () => {
      vi.mocked(gitUtils.getCachedBranch).mockReturnValue('master');

      const result = await gitValidator(createBashInput('git commit -m "feat: add feature"'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('protected branch');
    });

    it('should not warn for feature branches', async () => {
      vi.mocked(gitUtils.getCachedBranch).mockReturnValue('feature/new-feature');

      const result = await gitValidator(createBashInput('git commit -m "feat: add feature"'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('amend commits', () => {
    it('should skip message validation for amend commits', async () => {
      vi.mocked(gitUtils.getCachedBranch).mockReturnValue('feature/test');

      const result = await gitValidator(createBashInput('git commit --amend'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should still check protected branch for amend commits', async () => {
      vi.mocked(gitUtils.getCachedBranch).mockReturnValue('main');

      const result = await gitValidator(createBashInput('git commit --amend'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('protected branch');
    });
  });

  describe('result structure', () => {
    it('should always continue (never block)', async () => {
      const result = await gitValidator(createBashInput('git commit -m "bad"'));

      expect(result.continue).toBe(true);
    });

    it('should produce valid JSON', async () => {
      const result = await gitValidator(createBashInput('git commit -m "bad"'));

      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });

  describe('branch validation', () => {
    it('should not warn about branch name for protected branches', async () => {
      vi.mocked(gitUtils.getCachedBranch).mockReturnValue('main');

      const result = await gitValidator(createBashInput('git commit -m "feat: feature"'));

      expect(result.systemMessage).toContain('protected branch');
      expect(result.systemMessage).not.toContain("doesn't follow naming conventions");
    });

    it('should warn about invalid branch name', async () => {
      vi.mocked(gitUtils.getCachedBranch).mockReturnValue('random-invalid-branch');
      vi.mocked(gitUtils.isProtectedBranch).mockReturnValue(false);

      const result = await gitValidator(createBashInput('git commit -m "feat: feature"'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Branch');
    });

    it('should not warn about valid branch name', async () => {
      vi.mocked(gitUtils.getCachedBranch).mockReturnValue('feature/NAPP-1234-new-feature');
      vi.mocked(gitUtils.isProtectedBranch).mockReturnValue(false);

      const result = await gitValidator(createBashInput('git commit -m "feat: feature"'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });
});
