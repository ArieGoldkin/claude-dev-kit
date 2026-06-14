/**
 * Regression test: every PostToolUse hook MUST emit a valid HookResult payload
 * through every code path.
 *
 * Background: Claude Code v2.1.119 fixed a bug where async PostToolUse hooks
 * that exited without writing a response wrote empty session transcript entries.
 * Our hooks already emit on every path; this test pins the invariant so a future
 * refactor can't reintroduce a fall-through.
 *
 * The test calls each PostToolUse entry-point with minimal valid input and
 * asserts the result is a well-formed HookResult (has `continue: boolean`).
 *
 * @module tests/lib/posttool-empty-payload
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { dirtyStateTracker } from '../../src/hooks/posttool/dirty-state-tracker.js';
import { errorWarner } from '../../src/hooks/posttool/error-warner.js';
import { failureLogger } from '../../src/hooks/posttool/failure-logger.js';
import { lintChecker } from '../../src/hooks/posttool/lint-checker.js';
import { reviewLogger } from '../../src/hooks/posttool/review-logger.js';
import { secretDetector } from '../../src/hooks/posttool/secret-detector.js';
import type { HookInput, HookResult } from '../../src/types.js';

function isValidHookResult(value: unknown): value is HookResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'continue' in value &&
    typeof (value as HookResult).continue === 'boolean'
  );
}

const minimalBashInput: HookInput = {
  tool_name: 'Bash',
  tool_input: { command: 'echo hi' },
};

const minimalWriteInput: HookInput = {
  tool_name: 'Write',
  tool_input: { file_path: '/tmp/example.txt', content: 'hi' },
};

const nonMatchingToolInput: HookInput = {
  tool_name: 'Read',
  tool_input: { file_path: '/tmp/example.txt' },
};

describe('PostToolUse hooks: empty-payload invariant (CC v2.1.119)', () => {
  beforeEach(() => {
    // Silence noisy stderr from logWarn/logError during these tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('dirtyStateTracker', () => {
    it('emits a payload when guards skip (non-matching tool)', async () => {
      const result = await dirtyStateTracker(nonMatchingToolInput);
      expect(isValidHookResult(result)).toBe(true);
    });

    it('emits a payload when no file paths are present', async () => {
      const result = await dirtyStateTracker({
        tool_name: 'Write',
        tool_input: {},
      });
      expect(isValidHookResult(result)).toBe(true);
    });

    it('emits a payload when context file is missing', async () => {
      // Use a project dir that doesn't have shared-context.json
      const original = process.env['CLAUDE_PROJECT_DIR'];
      process.env['CLAUDE_PROJECT_DIR'] = '/tmp/__nonexistent_project_dir__';
      try {
        const result = await dirtyStateTracker(minimalWriteInput);
        expect(isValidHookResult(result)).toBe(true);
      } finally {
        if (original === undefined) delete process.env['CLAUDE_PROJECT_DIR'];
        else process.env['CLAUDE_PROJECT_DIR'] = original;
      }
    });
  });

  describe('errorWarner', () => {
    it('emits a payload when guards skip (non-Bash tool)', async () => {
      const result = await errorWarner(nonMatchingToolInput);
      expect(isValidHookResult(result)).toBe(true);
    });

    it('emits a payload when tool_output is absent', async () => {
      const result = await errorWarner(minimalBashInput);
      expect(isValidHookResult(result)).toBe(true);
    });

    it('emits a payload when output has no error indicators', async () => {
      const input = {
        ...minimalBashInput,
        tool_output: { stdout: 'all good', exit_code: 0 },
      } as HookInput;
      const result = await errorWarner(input);
      expect(isValidHookResult(result)).toBe(true);
    });
  });

  describe('failureLogger', () => {
    it('emits a payload when no error field is present', async () => {
      const result = await failureLogger(minimalBashInput);
      expect(isValidHookResult(result)).toBe(true);
    });

    it('emits a payload when error matches no known pattern', async () => {
      const input = {
        ...minimalBashInput,
        error: 'completely unrecognized failure mode',
      } as HookInput;
      const result = await failureLogger(input);
      expect(isValidHookResult(result)).toBe(true);
    });
  });

  describe('lintChecker', () => {
    it('emits a payload when guards skip (non-Write/Edit tool)', async () => {
      const result = await lintChecker({
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      });
      expect(isValidHookResult(result)).toBe(true);
    });

    it('emits a payload when no Python files are touched', async () => {
      const result = await lintChecker({
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/example.txt', content: 'hi' },
      });
      expect(isValidHookResult(result)).toBe(true);
    });
  });

  describe('reviewLogger', () => {
    it('emits a payload when guards skip (non-Bash tool)', async () => {
      const result = await reviewLogger(nonMatchingToolInput);
      expect(isValidHookResult(result)).toBe(true);
    });

    it('emits a payload when command does not match the review pattern', async () => {
      const result = await reviewLogger(minimalBashInput);
      expect(isValidHookResult(result)).toBe(true);
    });
  });

  describe('secretDetector', () => {
    it('emits a payload when guards skip (non-Bash tool)', async () => {
      const result = await secretDetector(nonMatchingToolInput);
      expect(isValidHookResult(result)).toBe(true);
    });

    it('emits a payload when tool_output is absent', async () => {
      const result = await secretDetector(minimalBashInput);
      expect(isValidHookResult(result)).toBe(true);
    });

    it('emits a payload when output is empty', async () => {
      const input = {
        ...minimalBashInput,
        tool_output: { stdout: '', stderr: '' },
      } as HookInput;
      const result = await secretDetector(input);
      expect(isValidHookResult(result)).toBe(true);
    });

    it('emits a payload when output is clean (no secrets)', async () => {
      const input = {
        ...minimalBashInput,
        tool_output: { stdout: 'hello world\nfoo bar' },
      } as HookInput;
      const result = await secretDetector(input);
      expect(isValidHookResult(result)).toBe(true);
    });
  });
});
