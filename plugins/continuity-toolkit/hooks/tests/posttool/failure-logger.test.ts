/**
 * Tests for failure-logger PostToolUseFailure hook
 *
 * @module tests/posttool/failure-logger
 */

import { describe, expect, it } from 'vitest';
import { failureLogger } from '../../src/posttool/failure-logger.js';
import type { HookInput } from '../../src/types.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a PostToolUseFailure input with an error string.
 */
function createFailureInput(
  toolName: string,
  error: string,
  extra?: Partial<HookInput & { tool_use_id: string; is_interrupt: boolean }>
): HookInput & { error: string } {
  return {
    tool_name: toolName as HookInput['tool_name'],
    tool_input: extra?.tool_input ?? {},
    session_id: extra?.session_id ?? 'test-session',
    error,
    ...extra,
  } as HookInput & { error: string };
}

/**
 * Create a Bash failure input with a command.
 */
function createBashFailure(command: string, error: string): HookInput & { error: string } {
  return createFailureInput('Bash', error, {
    tool_input: { command },
  });
}

/**
 * Create a file tool failure input with a file path.
 */
function createFileFailure(
  toolName: string,
  filePath: string,
  error: string
): HookInput & { error: string } {
  return createFailureInput(toolName, error, {
    tool_input: { file_path: filePath },
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe('failureLogger', () => {
  describe('missing error field', () => {
    it('should return silent success when no error field', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      };
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success when error is empty string', async () => {
      const input = createFailureInput('Bash', '');
      // Empty string is falsy, should be treated as no error
      const result = await failureLogger(input as unknown as HookInput);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('known failure patterns', () => {
    it('should provide ruff-specific hint for ruff not found', async () => {
      const input = createBashFailure('ruff check .', 'ruff: command not found');
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('ruff');
      expect(result.hookSpecificOutput?.additionalContext).toContain('install');
    });

    it('should provide hint for generic command not found', async () => {
      const input = createBashFailure('mycommand --version', 'mycommand: command not found');
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('not installed');
    });

    it('should provide hint for ENOENT errors', async () => {
      const input = createFileFailure(
        'Read',
        '/nonexistent/path.ts',
        'ENOENT: no such file or directory'
      );
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('does not exist');
    });

    it('should provide hint for permission denied', async () => {
      const input = createBashFailure('cat /etc/shadow', 'EACCES: permission denied');
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('Permission denied');
    });

    it('should provide hint for timeout errors', async () => {
      const input = createBashFailure('npm test', 'Command timed out after 120000ms');
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('timed out');
    });

    it('should provide hint for network errors', async () => {
      const input = createBashFailure(
        'curl http://localhost:3000',
        'ECONNREFUSED: connection refused'
      );
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('connection');
    });

    it('should provide hint for syntax errors', async () => {
      const input = createBashFailure('node script.js', 'SyntaxError: Unexpected token }');
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('syntax error');
    });

    it('should provide hint for disk space errors', async () => {
      const input = createFileFailure(
        'Write',
        '/tmp/bigfile.bin',
        'ENOSPC: No space left on device'
      );
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('Disk is full');
    });
  });

  describe('unknown failures', () => {
    it('should return silent success for unrecognized errors', async () => {
      const input = createBashFailure('some-tool', 'weird internal error 42');
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });
  });

  describe('result structure', () => {
    it('should always continue (never block)', async () => {
      const input = createBashFailure('rm -rf /', 'permission denied everywhere');
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
    });

    it('should produce valid JSON', async () => {
      const input = createBashFailure('npm test', 'ENOENT: file not found');
      const result = await failureLogger(input);

      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should handle very long error messages gracefully', async () => {
      const longError = 'Error: '.concat('x'.repeat(5000));
      const input = createBashFailure('failing-command', longError);
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });

  describe('different tool types', () => {
    it('should handle Write tool failures', async () => {
      const input = createFileFailure('Write', '/path/to/file.ts', 'EACCES: permission denied');
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('Permission');
    });

    it('should handle Edit tool failures', async () => {
      const input = createFileFailure('Edit', '/path/to/file.ts', 'No such file or directory');
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('does not exist');
    });

    it('should handle Glob tool failures', async () => {
      const input = createFailureInput('Glob', 'ENOENT: no such file or directory', {
        tool_input: { pattern: '**/*.ts' },
      });
      const result = await failureLogger(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('does not exist');
    });
  });
});
