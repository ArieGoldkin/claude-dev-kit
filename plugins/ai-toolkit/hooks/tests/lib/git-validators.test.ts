/**
 * Tests for git-validators library
 *
 * @module tests/lib/git-validators
 */

import { describe, expect, it } from 'vitest';
import {
  extractCommitMessageFromCommand,
  getCommitTypes,
  hasNoVerifyFlag,
  isAmendCommit,
  isGitCommitCommand,
  validateBranchName,
  validateCommitMessage,
} from '../../src/lib/git-validators.js';

// =============================================================================
// BRANCH NAME VALIDATION TESTS
// =============================================================================

describe('validateBranchName', () => {
  describe('valid branch names', () => {
    it('should accept JIRA ticket format (NAPP-1234-description)', () => {
      expect(validateBranchName('NAPP-1234-feature-name').valid).toBe(true);
      expect(validateBranchName('NAPP-12345-longer-description').valid).toBe(true);
      expect(validateBranchName('napp-1234-lowercase').valid).toBe(true);
    });

    it('should accept generic JIRA format (PROJECT-123-description)', () => {
      expect(validateBranchName('ABC-123-feature').valid).toBe(true);
      expect(validateBranchName('PROJ-1-short').valid).toBe(true);
    });

    it('should accept feature/* branches', () => {
      expect(validateBranchName('feature/login-page').valid).toBe(true);
      expect(validateBranchName('feature/NAPP-1234').valid).toBe(true);
    });

    it('should accept fix/* branches', () => {
      expect(validateBranchName('fix/login-bug').valid).toBe(true);
      expect(validateBranchName('fix/typo-in-readme').valid).toBe(true);
    });

    it('should accept bugfix/* branches', () => {
      expect(validateBranchName('bugfix/critical-issue').valid).toBe(true);
    });

    it('should accept chore/* branches', () => {
      expect(validateBranchName('chore/update-deps').valid).toBe(true);
      expect(validateBranchName('chore/cleanup').valid).toBe(true);
    });

    it('should accept docs/* branches', () => {
      expect(validateBranchName('docs/update-readme').valid).toBe(true);
    });

    it('should accept refactor/* branches', () => {
      expect(validateBranchName('refactor/auth-module').valid).toBe(true);
    });

    it('should accept test/* branches', () => {
      expect(validateBranchName('test/unit-tests').valid).toBe(true);
    });

    it('should accept hotfix/* branches', () => {
      expect(validateBranchName('hotfix/v1.0.1').valid).toBe(true);
    });

    it('should accept release/* branches', () => {
      expect(validateBranchName('release/v2.0.0').valid).toBe(true);
    });

    it('should accept dev/* branches', () => {
      expect(validateBranchName('dev/experiment').valid).toBe(true);
      expect(validateBranchName('dev/my-feature').valid).toBe(true);
    });

    it('should accept main/master/develop', () => {
      expect(validateBranchName('main').valid).toBe(true);
      expect(validateBranchName('master').valid).toBe(true);
      expect(validateBranchName('develop').valid).toBe(true);
      expect(validateBranchName('dev').valid).toBe(true);
    });

    it('should accept HEAD', () => {
      expect(validateBranchName('HEAD').valid).toBe(true);
    });
  });

  describe('invalid branch names', () => {
    it('should reject arbitrary names', () => {
      const result = validateBranchName('random-branch');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
    });

    it('should reject numeric-only names', () => {
      const result = validateBranchName('12345');
      expect(result.valid).toBe(false);
    });

    it('should reject NAPP without proper format', () => {
      expect(validateBranchName('NAPP-123').valid).toBe(false); // Too few digits
      expect(validateBranchName('NAPP1234-feature').valid).toBe(false); // Missing hyphen
    });
  });

  describe('edge cases', () => {
    it('should reject empty string', () => {
      const result = validateBranchName('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should provide helpful suggestion on failure', () => {
      const result = validateBranchName('bad-name');
      expect(result.suggestion).toContain('NAPP-1234');
      expect(result.suggestion).toContain('feature/');
    });
  });
});

// =============================================================================
// COMMIT MESSAGE VALIDATION TESTS
// =============================================================================

describe('validateCommitMessage', () => {
  describe('valid conventional commits', () => {
    it('should accept feat commits', () => {
      expect(validateCommitMessage('feat: add new feature').valid).toBe(true);
      expect(validateCommitMessage('feat(auth): add OAuth support').valid).toBe(true);
    });

    it('should accept fix commits', () => {
      expect(validateCommitMessage('fix: resolve login bug').valid).toBe(true);
      expect(validateCommitMessage('fix(api): handle null response').valid).toBe(true);
    });

    it('should accept docs commits', () => {
      expect(validateCommitMessage('docs: update README').valid).toBe(true);
      expect(validateCommitMessage('docs(api): add endpoint docs').valid).toBe(true);
    });

    it('should accept style commits', () => {
      expect(validateCommitMessage('style: format code with prettier').valid).toBe(true);
    });

    it('should accept refactor commits', () => {
      expect(validateCommitMessage('refactor: extract utility function').valid).toBe(true);
      expect(validateCommitMessage('refactor(hooks): simplify logic').valid).toBe(true);
    });

    it('should accept perf commits', () => {
      expect(validateCommitMessage('perf: optimize database queries').valid).toBe(true);
    });

    it('should accept test commits', () => {
      expect(validateCommitMessage('test: add unit tests for auth').valid).toBe(true);
    });

    it('should accept build commits', () => {
      expect(validateCommitMessage('build: update webpack config').valid).toBe(true);
    });

    it('should accept ci commits', () => {
      expect(validateCommitMessage('ci: add GitHub Actions workflow').valid).toBe(true);
    });

    it('should accept chore commits', () => {
      expect(validateCommitMessage('chore: update dependencies').valid).toBe(true);
    });

    it('should accept revert commits', () => {
      expect(validateCommitMessage('revert: undo previous change').valid).toBe(true);
    });
  });

  describe('merge and revert commits', () => {
    it('should accept merge commit messages', () => {
      expect(validateCommitMessage("Merge branch 'feature/login'").valid).toBe(true);
      expect(validateCommitMessage('Merge pull request #123').valid).toBe(true);
      expect(validateCommitMessage("Merge 'develop' into main").valid).toBe(true);
      expect(validateCommitMessage('Merge remote-tracking branch origin/main').valid).toBe(true);
      expect(validateCommitMessage('Merged develop into feature').valid).toBe(true);
    });

    it('should accept Revert commit messages', () => {
      expect(validateCommitMessage('Revert "feat: add feature"').valid).toBe(true);
      expect(validateCommitMessage('Revert: undo changes').valid).toBe(true);
    });
  });

  describe('invalid commit messages', () => {
    it('should reject messages without type prefix', () => {
      const result = validateCommitMessage('add new feature');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('conventional commit');
    });

    it('should reject messages with invalid type', () => {
      const result = validateCommitMessage('feature: add something');
      expect(result.valid).toBe(false);
    });

    it('should reject messages missing colon', () => {
      const result = validateCommitMessage('feat add new feature');
      expect(result.valid).toBe(false);
    });

    it('should reject messages with too short description', () => {
      const result = validateCommitMessage('feat: ab');
      expect(result.valid).toBe(false);
    });

    it('should reject very short messages', () => {
      const result = validateCommitMessage('fix bug');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });
  });

  describe('edge cases', () => {
    it('should reject empty message', () => {
      const result = validateCommitMessage('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should handle multi-line messages (validate first line)', () => {
      const message = 'feat: add feature\n\nThis is a longer description.';
      expect(validateCommitMessage(message).valid).toBe(true);
    });

    it('should provide helpful suggestion on failure', () => {
      const result = validateCommitMessage('bad commit message');
      expect(result.suggestion).toContain('feat');
      expect(result.suggestion).toContain('fix');
    });
  });
});

describe('getCommitTypes', () => {
  it('should return array of commit types', () => {
    const types = getCommitTypes();
    expect(Array.isArray(types)).toBe(true);
    expect(types).toContain('feat');
    expect(types).toContain('fix');
    expect(types).toContain('docs');
    expect(types).toContain('chore');
  });
});

// =============================================================================
// COMMAND PARSING TESTS
// =============================================================================

describe('extractCommitMessageFromCommand', () => {
  describe('double-quoted messages', () => {
    it('should extract -m "message"', () => {
      expect(extractCommitMessageFromCommand('git commit -m "feat: add feature"')).toBe(
        'feat: add feature'
      );
    });

    it('should extract -m "message" with other flags before', () => {
      expect(extractCommitMessageFromCommand('git commit --all -m "fix: bug fix"')).toBe(
        'fix: bug fix'
      );
    });

    it('should extract -m "message" with other flags after', () => {
      expect(extractCommitMessageFromCommand('git commit -m "fix: bug fix" --verbose')).toBe(
        'fix: bug fix'
      );
    });

    it('should extract message with special characters', () => {
      expect(extractCommitMessageFromCommand('git commit -m "feat(auth): add OAuth"')).toBe(
        'feat(auth): add OAuth'
      );
    });
  });

  describe('single-quoted messages', () => {
    it("should extract -m 'message'", () => {
      expect(extractCommitMessageFromCommand("git commit -m 'feat: add feature'")).toBe(
        'feat: add feature'
      );
    });
  });

  describe('--message flag', () => {
    it('should extract --message="message"', () => {
      expect(extractCommitMessageFromCommand('git commit --message="chore: update"')).toBe(
        'chore: update'
      );
    });

    it("should extract --message='message'", () => {
      expect(extractCommitMessageFromCommand("git commit --message='docs: readme'")).toBe(
        'docs: readme'
      );
    });
  });

  describe('edge cases', () => {
    it('should return null for empty command', () => {
      expect(extractCommitMessageFromCommand('')).toBeNull();
    });

    it('should return null for command without message', () => {
      expect(extractCommitMessageFromCommand('git commit --amend')).toBeNull();
    });

    it('should handle compound commands', () => {
      expect(extractCommitMessageFromCommand('git add . && git commit -m "feat: add"')).toBe(
        'feat: add'
      );
    });
  });
});

describe('isGitCommitCommand', () => {
  it('should identify git commit commands', () => {
    expect(isGitCommitCommand('git commit -m "message"')).toBe(true);
    expect(isGitCommitCommand('git commit --amend')).toBe(true);
    expect(isGitCommitCommand('git commit')).toBe(true);
  });

  it('should identify compound commit commands', () => {
    expect(isGitCommitCommand('git add . && git commit -m "msg"')).toBe(true);
    expect(isGitCommitCommand('ls; git commit -m "msg"')).toBe(true);
  });

  it('should not match non-commit git commands', () => {
    expect(isGitCommitCommand('git status')).toBe(false);
    expect(isGitCommitCommand('git log')).toBe(false);
    expect(isGitCommitCommand('git diff')).toBe(false);
  });

  it('should handle empty/null input', () => {
    expect(isGitCommitCommand('')).toBe(false);
    // @ts-expect-error - Testing invalid input
    expect(isGitCommitCommand(null)).toBe(false);
  });
});

describe('isAmendCommit', () => {
  it('should detect --amend flag', () => {
    expect(isAmendCommit('git commit --amend')).toBe(true);
    expect(isAmendCommit('git commit --amend -m "new message"')).toBe(true);
    expect(isAmendCommit('git commit -m "msg" --amend')).toBe(true);
  });

  it('should not match non-amend commits', () => {
    expect(isAmendCommit('git commit -m "message"')).toBe(false);
    expect(isAmendCommit('git commit')).toBe(false);
  });

  it('should handle empty/null input', () => {
    expect(isAmendCommit('')).toBe(false);
    // @ts-expect-error - Testing invalid input
    expect(isAmendCommit(null)).toBe(false);
  });
});

describe('hasNoVerifyFlag', () => {
  it('should detect --no-verify flag', () => {
    expect(hasNoVerifyFlag('git commit --no-verify -m "msg"')).toBe(true);
    expect(hasNoVerifyFlag('git commit -m "msg" --no-verify')).toBe(true);
  });

  it('should detect -n flag', () => {
    expect(hasNoVerifyFlag('git commit -n -m "msg"')).toBe(true);
  });

  it('should not match commits without no-verify', () => {
    expect(hasNoVerifyFlag('git commit -m "message"')).toBe(false);
  });

  it('should handle empty/null input', () => {
    expect(hasNoVerifyFlag('')).toBe(false);
    // @ts-expect-error - Testing invalid input
    expect(hasNoVerifyFlag(null)).toBe(false);
  });
});
