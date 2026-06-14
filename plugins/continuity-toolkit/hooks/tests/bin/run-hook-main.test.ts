/**
 * Unit tests for run-hook.ts core functions: silentSuccess, outputResult, executeHook.
 *
 * Tests executeHook directly with inputOverride to avoid stdin reads.
 * Uses registerHook/unregisterHook for test hook setup (no mocks).
 *
 * @module tests/bin/run-hook-main
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeHook, outputResult, silentSuccess } from '../../bin/run-hook.js';
import { registerHook, unregisterHook } from '../../src/index.js';
import type { HookInput, HookResult } from '../../src/types.js';

/**
 * Create a minimal HookInput for testing.
 */
function createTestInput(overrides?: Partial<HookInput>): HookInput {
  return {
    tool_name: 'Bash',
    tool_input: { command: 'echo test' },
    ...overrides,
  };
}

// =============================================================================
// silentSuccess
// =============================================================================

describe('silentSuccess', () => {
  it('should return continue: true', () => {
    expect(silentSuccess().continue).toBe(true);
  });

  it('should return suppressOutput: true', () => {
    expect(silentSuccess().suppressOutput).toBe(true);
  });

  it('should have no stopReason or systemMessage', () => {
    const result = silentSuccess();
    expect(result.stopReason).toBeUndefined();
    expect(result.systemMessage).toBeUndefined();
  });

  it('should be JSON-serializable', () => {
    const json = JSON.stringify(silentSuccess());
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({ continue: true, suppressOutput: true });
  });
});

// =============================================================================
// outputResult
// =============================================================================

describe('outputResult', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should write JSON-stringified result to stdout', () => {
    const result: HookResult = { continue: true, suppressOutput: false };
    outputResult(result);
    expect(consoleSpy).toHaveBeenCalledWith('{"continue":true,"suppressOutput":false}');
  });

  it('should write silent success JSON for a blocking result', () => {
    const result: HookResult = { continue: false, stopReason: 'blocked' };
    outputResult(result);
    expect(consoleSpy).toHaveBeenCalledWith('{"continue":false,"stopReason":"blocked"}');
  });

  it('should write result with systemMessage', () => {
    const result: HookResult = { continue: true, systemMessage: 'warning: context at 80%' };
    outputResult(result);
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.systemMessage).toBe('warning: context at 80%');
  });

  it('should write fallback JSON when JSON.stringify throws', () => {
    // Force JSON.stringify to throw by passing a value with a toJSON that throws
    const badResult = {
      continue: true,
      toJSON() {
        throw new Error('stringify fail');
      },
    } as unknown as HookResult;
    outputResult(badResult);
    expect(consoleSpy).toHaveBeenCalledWith('{"continue":true,"suppressOutput":true}');
  });
});

// =============================================================================
// executeHook
// =============================================================================

describe('executeHook', () => {
  // Suppress console.error noise from expected error paths
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Missing hook name
  // ---------------------------------------------------------------------------

  describe('missing hook name', () => {
    it('should return exitCode 1 when hookName is undefined', async () => {
      const { exitCode } = await executeHook(undefined, createTestInput());
      expect(exitCode).toBe(1);
    });

    it('should return exitCode 1 when hookName is empty string', async () => {
      const { exitCode } = await executeHook('', createTestInput());
      expect(exitCode).toBe(1);
    });

    it('should return silentSuccess result when hookName is undefined', async () => {
      const { result } = await executeHook(undefined, createTestInput());
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should log usage to stderr', async () => {
      await executeHook(undefined, createTestInput());
      expect(stderrSpy).toHaveBeenCalledWith('Usage: run-hook.ts <hook-name>');
    });
  });

  // ---------------------------------------------------------------------------
  // Unknown hook
  // ---------------------------------------------------------------------------

  describe('unknown hook', () => {
    it('should return exitCode 0 for unregistered hook name', async () => {
      const { exitCode } = await executeHook('nonexistent/test-hook', createTestInput());
      expect(exitCode).toBe(0);
    });

    it('should return silentSuccess for unregistered hook name', async () => {
      const { result } = await executeHook('nonexistent/test-hook', createTestInput());
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ---------------------------------------------------------------------------
  // Disabled hook (via project-level overrides)
  // ---------------------------------------------------------------------------

  describe('disabled hook', () => {
    const TEST_HOOK_NAME = 'test/disable-target';
    const originalEnv = process.env['CLAUDE_PROJECT_DIR'];
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join('/tmp', 'run-hook-main-'));
      process.env['CLAUDE_PROJECT_DIR'] = tmpDir;

      // Write overrides file that disables our test hook
      const claudeDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(
        path.join(claudeDir, 'hook-overrides.json'),
        JSON.stringify({ disabled: [TEST_HOOK_NAME] })
      );

      // Register a test hook that should NOT execute
      registerHook(TEST_HOOK_NAME, 'test hook for disable check', () => ({
        continue: false,
        stopReason: 'should not reach here',
      }));
    });

    afterEach(() => {
      unregisterHook(TEST_HOOK_NAME);
      if (originalEnv !== undefined) {
        process.env['CLAUDE_PROJECT_DIR'] = originalEnv;
      } else {
        delete process.env['CLAUDE_PROJECT_DIR'];
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return silentSuccess when hook is disabled', async () => {
      const { result } = await executeHook(TEST_HOOK_NAME, createTestInput());
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should return exitCode 0 when hook is disabled', async () => {
      const { exitCode } = await executeHook(TEST_HOOK_NAME, createTestInput());
      expect(exitCode).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Successful hook execution
  // ---------------------------------------------------------------------------

  describe('successful hook execution', () => {
    const PASS_HOOK = 'test/pass-hook';
    const BLOCK_HOOK = 'test/block-hook';
    const ASYNC_HOOK = 'test/async-hook';
    const INPUT_ECHO_HOOK = 'test/input-echo-hook';

    let capturedInput: HookInput | undefined;

    beforeEach(() => {
      capturedInput = undefined;

      registerHook(PASS_HOOK, 'test hook that allows', () => ({
        continue: true,
        suppressOutput: false,
        systemMessage: 'hook passed',
      }));

      registerHook(BLOCK_HOOK, 'test hook that blocks', () => ({
        continue: false,
        stopReason: 'blocked by test',
      }));

      registerHook(ASYNC_HOOK, 'test async hook', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { continue: true, systemMessage: 'async done' };
      });

      registerHook(INPUT_ECHO_HOOK, 'test hook that captures input', (input) => {
        capturedInput = input;
        return { continue: true };
      });
    });

    afterEach(() => {
      unregisterHook(PASS_HOOK);
      unregisterHook(BLOCK_HOOK);
      unregisterHook(ASYNC_HOOK);
      unregisterHook(INPUT_ECHO_HOOK);
    });

    it('should return hook result for continue:true handler', async () => {
      const { result } = await executeHook(PASS_HOOK, createTestInput());
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBe('hook passed');
    });

    it('should return exitCode 0 for continue:true handler', async () => {
      const { exitCode } = await executeHook(PASS_HOOK, createTestInput());
      expect(exitCode).toBe(0);
    });

    it('should return hook result for continue:false handler', async () => {
      const { result } = await executeHook(BLOCK_HOOK, createTestInput());
      expect(result.continue).toBe(false);
      expect(result.stopReason).toBe('blocked by test');
    });

    it('should return exitCode 1 for continue:false handler', async () => {
      const { exitCode } = await executeHook(BLOCK_HOOK, createTestInput());
      expect(exitCode).toBe(1);
    });

    it('should pass inputOverride to hook handler', async () => {
      const input = createTestInput({ tool_name: 'Write', tool_input: { file_path: '/tmp/test' } });
      await executeHook(INPUT_ECHO_HOOK, input);
      expect(capturedInput).toBeDefined();
      expect(capturedInput?.tool_name).toBe('Write');
      expect(capturedInput?.tool_input).toEqual({ file_path: '/tmp/test' });
    });

    it('should handle async hook handlers', async () => {
      const { result, exitCode } = await executeHook(ASYNC_HOOK, createTestInput());
      expect(exitCode).toBe(0);
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBe('async done');
    });
  });

  // ---------------------------------------------------------------------------
  // Hook handler throws
  // ---------------------------------------------------------------------------

  describe('hook handler throws', () => {
    const ERROR_HOOK = 'test/error-hook';
    const NON_ERROR_HOOK = 'test/non-error-hook';
    const ASYNC_ERROR_HOOK = 'test/async-error-hook';

    beforeEach(() => {
      registerHook(ERROR_HOOK, 'test hook that throws Error', () => {
        throw new Error('handler exploded');
      });

      registerHook(NON_ERROR_HOOK, 'test hook that throws non-Error', () => {
        throw 'string error'; // eslint-disable-line no-throw-literal
      });

      registerHook(ASYNC_ERROR_HOOK, 'test async hook that rejects', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new Error('async failure');
      });
    });

    afterEach(() => {
      unregisterHook(ERROR_HOOK);
      unregisterHook(NON_ERROR_HOOK);
      unregisterHook(ASYNC_ERROR_HOOK);
    });

    it('should return silentSuccess when handler throws Error', async () => {
      const { result } = await executeHook(ERROR_HOOK, createTestInput());
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should return exitCode 0 when handler throws Error', async () => {
      const { exitCode } = await executeHook(ERROR_HOOK, createTestInput());
      expect(exitCode).toBe(0);
    });

    it('should return silentSuccess when handler throws non-Error', async () => {
      const { result } = await executeHook(NON_ERROR_HOOK, createTestInput());
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should log error message for Error throw', async () => {
      await executeHook(ERROR_HOOK, createTestInput());
      expect(stderrSpy).toHaveBeenCalledWith(
        '[continuity-hooks] Error in test/error-hook: handler exploded'
      );
    });

    it('should log "Unknown error" for non-Error throw', async () => {
      await executeHook(NON_ERROR_HOOK, createTestInput());
      expect(stderrSpy).toHaveBeenCalledWith(
        '[continuity-hooks] Error in test/non-error-hook: Unknown error'
      );
    });

    it('should return silentSuccess when async handler rejects', async () => {
      const { result, exitCode } = await executeHook(ASYNC_ERROR_HOOK, createTestInput());
      expect(exitCode).toBe(0);
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });
});
