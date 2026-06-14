/**
 * Tests for preflight-context-injector PreToolUse hook
 *
 * @module tests/pretool/preflight-context-injector
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPreflightContext,
  isDestructiveCommand,
  preflightContextInjector,
} from '../../src/pretool/preflight-context-injector.js';
import type { HookInput } from '../../src/types.js';

// Mock git-utils so branch detection is deterministic
vi.mock('../../src/lib/git-utils.js', () => ({
  getCachedBranch: vi.fn(() => 'feat/login-redesign'),
}));

// Mock execSync so remote / worktree calls don't shell out during tests
vi.mock('node:child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.startsWith('git remote get-url')) {
      return 'git@gitlab.com:example/repo.git\n';
    }
    if (cmd.startsWith('git worktree list')) {
      return '/Users/x/repo  abc1234 [main]\n/Users/x/repo-alpha  def5678 [feat/login-redesign]\n';
    }
    return '';
  }),
}));

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

describe('isDestructiveCommand', () => {
  it.each([
    ['git commit -m "feat: x"', true],
    ['git commit', true],
    ['git push origin main', true],
    ['git push --force', true],
    ['terraform apply', true],
    ['terraform apply -auto-approve', true],
    ['terraform destroy', true],
    ['rm -rf /tmp/foo', true],
    ['rm -fr ./build', true],
    ['rm -r ./dist', true],
    ['ls -la', false],
    ['git status', false],
    ['git log --oneline', false],
    ['git diff', false],
    ['terraform plan', false],
    ['echo "rm -rf"', true], // intentional: substring match — false positive acceptable since output is non-blocking
  ])('returns %s for "%s"', (cmd, expected) => {
    expect(isDestructiveCommand(cmd as string)).toBe(expected);
  });
});

describe('buildPreflightContext', () => {
  beforeEach(() => {
    process.env['CLAUDE_PROJECT_DIR'] = '/Users/x/repo-alpha';
  });

  afterEach(() => {
    delete process.env['CLAUDE_PROJECT_DIR'];
    vi.clearAllMocks();
  });

  it('returns null for non-destructive commands', () => {
    expect(buildPreflightContext('ls -la')).toBeNull();
    expect(buildPreflightContext('git status')).toBeNull();
    expect(buildPreflightContext('terraform plan')).toBeNull();
  });

  it('returns multi-line context for git commit', () => {
    const ctx = buildPreflightContext('git commit -m "feat: x"');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('Preflight context');
    expect(ctx).toContain('pwd: /Users/x/repo-alpha');
    expect(ctx).toContain('branch: feat/login-redesign');
    expect(ctx).toContain('remote: git@gitlab.com:example/repo.git');
    expect(ctx).toContain('Verify pwd/branch/remote');
  });

  it('includes worktree list when more than one exists', () => {
    const ctx = buildPreflightContext('git push origin main');
    expect(ctx).toContain('worktrees:');
    expect(ctx).toContain('/Users/x/repo');
    expect(ctx).toContain('/Users/x/repo-alpha');
  });

  it('fires for terraform apply', () => {
    const ctx = buildPreflightContext('terraform apply -auto-approve');
    expect(ctx).toContain('Preflight context');
    expect(ctx).toContain('branch: feat/login-redesign');
  });

  it('fires for rm -rf', () => {
    const ctx = buildPreflightContext('rm -rf ./build');
    expect(ctx).toContain('Preflight context');
  });

  it('uses provided projectDir when passed explicitly', () => {
    const ctx = buildPreflightContext('git commit', '/different/path');
    expect(ctx).toContain('pwd: /different/path');
  });
});

describe('preflightContextInjector hook', () => {
  beforeEach(() => {
    process.env['CLAUDE_PROJECT_DIR'] = '/Users/x/repo-alpha';
  });

  afterEach(() => {
    delete process.env['CLAUDE_PROJECT_DIR'];
    vi.clearAllMocks();
  });

  it('returns silent success for non-Bash tools', async () => {
    const result = await preflightContextInjector(createNonBashInput('Write'));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('returns silent success for non-destructive bash', async () => {
    const result = await preflightContextInjector(createBashInput('ls -la'));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('returns silent success for empty command', async () => {
    const input: HookInput = { tool_name: 'Bash', tool_input: {} };
    const result = await preflightContextInjector(input);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('injects additionalContext for git commit', async () => {
    const result = await preflightContextInjector(createBashInput('git commit -m "feat: x"'));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    expect(result.hookSpecificOutput?.additionalContext).toContain('Preflight context');
    expect(result.hookSpecificOutput?.additionalContext).toContain('pwd:');
    expect(result.hookSpecificOutput?.additionalContext).toContain('branch:');
    // No permission decision: this is context only, not approve/deny
    expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  it('injects additionalContext for git push', async () => {
    const result = await preflightContextInjector(
      createBashInput('git push origin feat/login-redesign')
    );
    expect(result.hookSpecificOutput?.additionalContext).toContain('Preflight context');
    expect(result.hookSpecificOutput?.additionalContext).toContain(
      'git@gitlab.com:example/repo.git'
    );
  });

  it('injects additionalContext for terraform apply', async () => {
    const result = await preflightContextInjector(createBashInput('terraform apply -auto-approve'));
    expect(result.hookSpecificOutput?.additionalContext).toContain('Preflight context');
  });

  it('injects additionalContext for rm -rf', async () => {
    const result = await preflightContextInjector(createBashInput('rm -rf ./dist'));
    expect(result.hookSpecificOutput?.additionalContext).toContain('Preflight context');
  });

  it('never returns continue=false', async () => {
    // Verify non-blocking contract across destructive command types
    const cmds = [
      'git commit -m "x"',
      'git push',
      'terraform apply',
      'terraform destroy',
      'rm -rf /tmp/x',
    ];
    for (const cmd of cmds) {
      const result = await preflightContextInjector(createBashInput(cmd));
      expect(result.continue).toBe(true);
    }
  });
});
