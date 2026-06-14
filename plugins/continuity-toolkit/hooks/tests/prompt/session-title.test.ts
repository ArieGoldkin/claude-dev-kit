/**
 * Tests for Session Title hook (CC 2.1.94+)
 *
 * Validates branch name extraction and session title output.
 *
 * @module tests/prompt/session-title
 */

import { describe, expect, it } from 'vitest';
import sessionTitle, { getGitBranch } from '../../src/prompt/session-title.js';
import type { HookInput, ToolInput } from '../../src/types.js';

// =============================================================================
// HELPERS
// =============================================================================

function createInput(cwd?: string): HookInput {
  const input: HookInput = {
    tool_name: '' as HookInput['tool_name'],
    tool_input: {} as ToolInput,
    session_id: 'test-session',
    cwd,
  };
  (input as unknown as Record<string, unknown>)['prompt'] = 'test prompt';
  return input;
}

// CI runners use detached HEAD (no branch), so detect this upfront.
const currentBranch = getGitBranch(process.cwd());
const isOnBranch = currentBranch !== null;

// =============================================================================
// getGitBranch TESTS
// =============================================================================

describe('getGitBranch', () => {
  it('should return a string or null from a git repo', () => {
    const branch = getGitBranch();
    // In CI (detached HEAD) returns null; locally returns branch name
    if (isOnBranch) {
      expect(typeof branch).toBe('string');
      expect(branch?.length).toBeGreaterThan(0);
    } else {
      expect(branch).toBeNull();
    }
  });

  it('should return null for non-git directory', () => {
    const branch = getGitBranch('/tmp');
    expect(branch).toBeNull();
  });

  it('should accept cwd parameter', () => {
    const branch = getGitBranch(process.cwd());
    // Same as default — may be null in CI
    if (isOnBranch) {
      expect(branch).toBeTruthy();
    } else {
      expect(branch).toBeNull();
    }
  });
});

// =============================================================================
// sessionTitle hook TESTS
// =============================================================================

describe('sessionTitle hook', () => {
  it('should return sessionTitle when branch exists', () => {
    if (!isOnBranch) return; // Skip in detached HEAD (CI)
    const input = createInput(process.cwd());
    const result = sessionTitle(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
    expect(result.hookSpecificOutput?.sessionTitle).toBeTruthy();
  });

  it('should return silentSuccess when no git branch', () => {
    const input = createInput('/tmp');
    const result = sessionTitle(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(result.hookSpecificOutput?.sessionTitle).toBeUndefined();
  });

  it('should always return continue=true', () => {
    // Works in both CI and local — hook never blocks
    const input = createInput(process.cwd());
    const result = sessionTitle(input);
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('should produce valid JSON when stringified', () => {
    const input = createInput(process.cwd());
    const result = sessionTitle(input);
    const json = JSON.stringify(result);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
