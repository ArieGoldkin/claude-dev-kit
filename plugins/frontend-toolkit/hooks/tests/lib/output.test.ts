/**
 * Tests for output helper functions
 *
 * These tests verify that all output functions produce the exact JSON structure
 * expected by Claude Code's hook system.
 *
 * @module tests/lib/output
 */

import { describe, expect, it } from 'vitest';
import {
  outputAllow,
  outputAllowWithContext,
  outputDeny,
  outputPromptContext,
  outputSilentSuccess,
  outputSuccess,
  outputWarning,
  outputWithContext,
  outputWithNotification,
} from '../../src/lib/output.js';
import type { HookResult } from '../../src/types.js';

// =============================================================================
// outputSilentSuccess TESTS
// =============================================================================

describe('outputSilentSuccess', () => {
  it('should return exact expected structure', () => {
    const result = outputSilentSuccess();

    expect(result).toEqual({
      continue: true,
      suppressOutput: true,
    });
  });

  it('should have continue set to true', () => {
    const result = outputSilentSuccess();
    expect(result.continue).toBe(true);
  });

  it('should have suppressOutput set to true', () => {
    const result = outputSilentSuccess();
    expect(result.suppressOutput).toBe(true);
  });

  it('should not have stopReason', () => {
    const result = outputSilentSuccess();
    expect(result.stopReason).toBeUndefined();
  });

  it('should not have systemMessage', () => {
    const result = outputSilentSuccess();
    expect(result.systemMessage).toBeUndefined();
  });

  it('should not have hookSpecificOutput', () => {
    const result = outputSilentSuccess();
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('should produce valid JSON when stringified', () => {
    const result = outputSilentSuccess();
    const json = JSON.stringify(result);

    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual({
      continue: true,
      suppressOutput: true,
    });
  });

  it('should satisfy HookResult interface', () => {
    const result: HookResult = outputSilentSuccess();
    expect(result).toBeDefined();
  });
});

// =============================================================================
// outputSuccess TESTS
// =============================================================================

describe('outputSuccess', () => {
  it('should return exact expected structure with message', () => {
    const result = outputSuccess('Operation completed');

    expect(result).toEqual({
      continue: true,
      systemMessage: 'Operation completed',
    });
  });

  it('should have continue set to true', () => {
    const result = outputSuccess('test');
    expect(result.continue).toBe(true);
  });

  it('should include message as systemMessage', () => {
    const message = 'File validated successfully';
    const result = outputSuccess(message);
    expect(result.systemMessage).toBe(message);
  });

  it('should not have suppressOutput', () => {
    const result = outputSuccess('test');
    expect(result.suppressOutput).toBeUndefined();
  });

  it('should not have stopReason', () => {
    const result = outputSuccess('test');
    expect(result.stopReason).toBeUndefined();
  });

  it('should not have hookSpecificOutput', () => {
    const result = outputSuccess('test');
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  describe('message handling', () => {
    it('should handle empty string message', () => {
      const result = outputSuccess('');
      expect(result.systemMessage).toBe('');
    });

    it('should preserve special characters', () => {
      const message = 'Test with special chars: <>&"\'';
      const result = outputSuccess(message);
      expect(result.systemMessage).toBe(message);
    });

    it('should preserve unicode characters', () => {
      const message = 'Success! \u2714 Check mark';
      const result = outputSuccess(message);
      expect(result.systemMessage).toBe(message);
    });

    it('should preserve emoji characters', () => {
      const message = 'Success! \u{1F389} Party time!';
      const result = outputSuccess(message);
      expect(result.systemMessage).toBe(message);
    });

    it('should preserve newlines', () => {
      const message = 'Line 1\nLine 2\nLine 3';
      const result = outputSuccess(message);
      expect(result.systemMessage).toBe(message);
    });

    it('should preserve tabs', () => {
      const message = 'Column1\tColumn2\tColumn3';
      const result = outputSuccess(message);
      expect(result.systemMessage).toBe(message);
    });

    it('should handle long messages', () => {
      const message = 'A'.repeat(10000);
      const result = outputSuccess(message);
      expect(result.systemMessage).toBe(message);
      expect(result.systemMessage?.length).toBe(10000);
    });

    it('should handle message with backslashes', () => {
      const message = 'Path: C:\\Users\\test\\file.ts';
      const result = outputSuccess(message);
      expect(result.systemMessage).toBe(message);
    });

    it('should handle message with quotes', () => {
      const message = 'He said "Hello" and \'Goodbye\'';
      const result = outputSuccess(message);
      expect(result.systemMessage).toBe(message);
    });
  });

  it('should produce valid JSON when stringified', () => {
    const result = outputSuccess('Test message');
    const json = JSON.stringify(result);

    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual({
      continue: true,
      systemMessage: 'Test message',
    });
  });
});

// =============================================================================
// outputWarning TESTS
// =============================================================================

describe('outputWarning', () => {
  it('should return exact expected structure with warning prefix', () => {
    const result = outputWarning('File is very large');

    expect(result).toEqual({
      continue: true,
      systemMessage: '\u26a0 File is very large',
    });
  });

  it('should have continue set to true', () => {
    const result = outputWarning('test');
    expect(result.continue).toBe(true);
  });

  it('should prepend warning symbol (U+26A0) to message', () => {
    const result = outputWarning('Caution');
    expect(result.systemMessage).toBe('\u26a0 Caution');
  });

  it('should have warning symbol followed by space', () => {
    const result = outputWarning('Test');
    expect(result.systemMessage?.startsWith('\u26a0 ')).toBe(true);
  });

  it('should not have suppressOutput', () => {
    const result = outputWarning('test');
    expect(result.suppressOutput).toBeUndefined();
  });

  it('should not have stopReason', () => {
    const result = outputWarning('test');
    expect(result.stopReason).toBeUndefined();
  });

  it('should not have hookSpecificOutput', () => {
    const result = outputWarning('test');
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  describe('message handling', () => {
    it('should handle empty string message', () => {
      const result = outputWarning('');
      expect(result.systemMessage).toBe('\u26a0 ');
    });

    it('should preserve original message after warning symbol', () => {
      const message = 'Be careful with this operation';
      const result = outputWarning(message);
      expect(result.systemMessage).toBe(`\u26a0 ${message}`);
    });

    it('should preserve special characters in message', () => {
      const message = 'Warning: <danger>';
      const result = outputWarning(message);
      expect(result.systemMessage).toBe('\u26a0 Warning: <danger>');
    });

    it('should preserve unicode in message', () => {
      const message = 'Check \u2714 this';
      const result = outputWarning(message);
      expect(result.systemMessage).toBe('\u26a0 Check \u2714 this');
    });

    it('should handle message already containing warning symbol', () => {
      const message = '\u26a0 Already has warning';
      const result = outputWarning(message);
      // Should add another warning symbol
      expect(result.systemMessage).toBe('\u26a0 \u26a0 Already has warning');
    });

    it('should handle newlines in message', () => {
      const message = 'Line 1\nLine 2';
      const result = outputWarning(message);
      expect(result.systemMessage).toBe('\u26a0 Line 1\nLine 2');
    });
  });

  it('should produce valid JSON when stringified', () => {
    const result = outputWarning('Test warning');
    const json = JSON.stringify(result);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.continue).toBe(true);
    expect(parsed.systemMessage).toBe('\u26a0 Test warning');
  });

  it('should use correct unicode escape for warning symbol', () => {
    const result = outputWarning('test');
    // U+26A0 is the warning sign
    expect(result.systemMessage?.charCodeAt(0)).toBe(0x26a0);
  });
});

// =============================================================================
// outputDeny TESTS
// =============================================================================

describe('outputDeny', () => {
  it('should return exact expected structure', () => {
    const result = outputDeny('Access denied');

    expect(result).toEqual({
      continue: false,
      stopReason: 'Access denied',
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Access denied',
      },
    });
  });

  it('should have continue set to false', () => {
    const result = outputDeny('reason');
    expect(result.continue).toBe(false);
  });

  it('should include reason as stopReason', () => {
    const reason = 'Access to .env files is not allowed';
    const result = outputDeny(reason);
    expect(result.stopReason).toBe(reason);
  });

  it('should have hookSpecificOutput with permissionDecision deny', () => {
    const result = outputDeny('reason');
    expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');
  });

  it('should include reason in permissionDecisionReason', () => {
    const reason = 'Dangerous command blocked';
    const result = outputDeny(reason);
    expect(result.hookSpecificOutput?.permissionDecisionReason).toBe(reason);
  });

  it('should not have suppressOutput', () => {
    const result = outputDeny('reason');
    expect(result.suppressOutput).toBeUndefined();
  });

  it('should not have systemMessage', () => {
    const result = outputDeny('reason');
    expect(result.systemMessage).toBeUndefined();
  });

  describe('reason handling', () => {
    it('should handle empty string reason', () => {
      const result = outputDeny('');
      expect(result.stopReason).toBe('');
      expect(result.hookSpecificOutput?.permissionDecisionReason).toBe('');
    });

    it('should preserve special characters in reason', () => {
      const reason = 'Path /etc/passwd is protected';
      const result = outputDeny(reason);
      expect(result.stopReason).toBe(reason);
      expect(result.hookSpecificOutput?.permissionDecisionReason).toBe(reason);
    });

    it('should preserve unicode in reason', () => {
      const reason = 'Blocked \u274c';
      const result = outputDeny(reason);
      expect(result.stopReason).toBe(reason);
    });

    it('should handle long reason', () => {
      const reason = 'B'.repeat(5000);
      const result = outputDeny(reason);
      expect(result.stopReason).toBe(reason);
      expect(result.hookSpecificOutput?.permissionDecisionReason).toBe(reason);
    });

    it('should handle reason with newlines', () => {
      const reason = 'Error:\n- File is protected\n- Access denied';
      const result = outputDeny(reason);
      expect(result.stopReason).toBe(reason);
    });

    it('should handle reason with quotes', () => {
      const reason = 'Cannot access "sensitive" file';
      const result = outputDeny(reason);
      expect(result.stopReason).toBe(reason);
    });
  });

  it('should produce valid JSON when stringified', () => {
    const result = outputDeny('Test denial');
    const json = JSON.stringify(result);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.continue).toBe(false);
    expect(parsed.stopReason).toBe('Test denial');
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(parsed.hookSpecificOutput.permissionDecisionReason).toBe('Test denial');
  });

  it('should have same reason in stopReason and permissionDecisionReason', () => {
    const reason = 'Consistent reason';
    const result = outputDeny(reason);
    expect(result.stopReason).toBe(result.hookSpecificOutput?.permissionDecisionReason);
  });
});

// =============================================================================
// outputAllow TESTS
// =============================================================================

describe('outputAllow', () => {
  it('should return exact expected structure', () => {
    const result = outputAllow();

    expect(result).toEqual({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
      },
    });
  });

  it('should have continue set to true', () => {
    const result = outputAllow();
    expect(result.continue).toBe(true);
  });

  it('should have suppressOutput set to true', () => {
    const result = outputAllow();
    expect(result.suppressOutput).toBe(true);
  });

  it('should have hookSpecificOutput with permissionDecision allow', () => {
    const result = outputAllow();
    expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
  });

  it('should not have stopReason', () => {
    const result = outputAllow();
    expect(result.stopReason).toBeUndefined();
  });

  it('should not have systemMessage', () => {
    const result = outputAllow();
    expect(result.systemMessage).toBeUndefined();
  });

  it('should not have permissionDecisionReason', () => {
    const result = outputAllow();
    expect(result.hookSpecificOutput?.permissionDecisionReason).toBeUndefined();
  });

  it('should not have additionalContext', () => {
    const result = outputAllow();
    expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
  });

  it('should produce valid JSON when stringified', () => {
    const result = outputAllow();
    const json = JSON.stringify(result);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.continue).toBe(true);
    expect(parsed.suppressOutput).toBe(true);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('allow');
  });

  it('should satisfy HookResult interface', () => {
    const result: HookResult = outputAllow();
    expect(result).toBeDefined();
  });
});

// =============================================================================
// outputAllowWithContext TESTS
// =============================================================================

describe('outputAllowWithContext', () => {
  it('should return exact expected structure with context', () => {
    const result = outputAllowWithContext('File is in safe directory');

    expect(result).toEqual({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        additionalContext: 'File is in safe directory',
      },
    });
  });

  it('should have continue set to true', () => {
    const result = outputAllowWithContext('context');
    expect(result.continue).toBe(true);
  });

  it('should have suppressOutput set to true', () => {
    const result = outputAllowWithContext('context');
    expect(result.suppressOutput).toBe(true);
  });

  it('should have hookSpecificOutput with permissionDecision allow', () => {
    const result = outputAllowWithContext('context');
    expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
  });

  it('should include context as additionalContext', () => {
    const context = 'Operation auto-approved: safe path';
    const result = outputAllowWithContext(context);
    expect(result.hookSpecificOutput?.additionalContext).toBe(context);
  });

  it('should not have stopReason', () => {
    const result = outputAllowWithContext('context');
    expect(result.stopReason).toBeUndefined();
  });

  it('should not have systemMessage', () => {
    const result = outputAllowWithContext('context');
    expect(result.systemMessage).toBeUndefined();
  });

  it('should not have permissionDecisionReason', () => {
    const result = outputAllowWithContext('context');
    expect(result.hookSpecificOutput?.permissionDecisionReason).toBeUndefined();
  });

  describe('context handling', () => {
    it('should handle empty string context', () => {
      const result = outputAllowWithContext('');
      expect(result.hookSpecificOutput?.additionalContext).toBe('');
    });

    it('should preserve special characters in context', () => {
      const context = 'Path: /path/to/<file>.ts';
      const result = outputAllowWithContext(context);
      expect(result.hookSpecificOutput?.additionalContext).toBe(context);
    });

    it('should preserve unicode in context', () => {
      const context = 'Approved \u2714';
      const result = outputAllowWithContext(context);
      expect(result.hookSpecificOutput?.additionalContext).toBe(context);
    });

    it('should handle long context', () => {
      const context = 'C'.repeat(5000);
      const result = outputAllowWithContext(context);
      expect(result.hookSpecificOutput?.additionalContext).toBe(context);
    });

    it('should handle context with newlines', () => {
      const context = 'Reason 1\nReason 2\nReason 3';
      const result = outputAllowWithContext(context);
      expect(result.hookSpecificOutput?.additionalContext).toBe(context);
    });

    it('should handle context with quotes', () => {
      const context = 'File "test.ts" approved';
      const result = outputAllowWithContext(context);
      expect(result.hookSpecificOutput?.additionalContext).toBe(context);
    });

    it('should handle context with backslashes', () => {
      const context = 'Windows path: C:\\Users\\test';
      const result = outputAllowWithContext(context);
      expect(result.hookSpecificOutput?.additionalContext).toBe(context);
    });
  });

  it('should produce valid JSON when stringified', () => {
    const result = outputAllowWithContext('Test context');
    const json = JSON.stringify(result);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.continue).toBe(true);
    expect(parsed.suppressOutput).toBe(true);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('allow');
    expect(parsed.hookSpecificOutput.additionalContext).toBe('Test context');
  });

  it('should satisfy HookResult interface', () => {
    const result: HookResult = outputAllowWithContext('context');
    expect(result).toBeDefined();
  });
});

// =============================================================================
// outputPromptContext TESTS
// =============================================================================

describe('outputPromptContext', () => {
  it('should return exact expected structure with context', () => {
    const result = outputPromptContext('Remember: PII must be encrypted at rest');

    expect(result).toEqual({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: 'Remember: PII must be encrypted at rest',
      },
    });
  });

  it('should have continue set to true', () => {
    const result = outputPromptContext('context');
    expect(result.continue).toBe(true);
  });

  it('should have suppressOutput set to true', () => {
    const result = outputPromptContext('context');
    expect(result.suppressOutput).toBe(true);
  });

  it('should have hookEventName set to UserPromptSubmit', () => {
    const result = outputPromptContext('context');
    expect(result.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
  });

  it('should include context as additionalContext', () => {
    const context = 'Security: Use parameterized queries';
    const result = outputPromptContext(context);
    expect(result.hookSpecificOutput?.additionalContext).toBe(context);
  });

  it('should NOT have permissionDecision', () => {
    const result = outputPromptContext('context');
    expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  it('should not have stopReason', () => {
    const result = outputPromptContext('context');
    expect(result.stopReason).toBeUndefined();
  });

  it('should not have systemMessage', () => {
    const result = outputPromptContext('context');
    expect(result.systemMessage).toBeUndefined();
  });

  describe('context handling', () => {
    it('should handle empty string context', () => {
      const result = outputPromptContext('');
      expect(result.hookSpecificOutput?.additionalContext).toBe('');
    });

    it('should preserve special characters in context', () => {
      const context = 'PII fields: <name>, "DOB", \'SSN\'';
      const result = outputPromptContext(context);
      expect(result.hookSpecificOutput?.additionalContext).toBe(context);
    });

    it('should preserve unicode in context', () => {
      const context = 'Security \u2714 compliant';
      const result = outputPromptContext(context);
      expect(result.hookSpecificOutput?.additionalContext).toBe(context);
    });

    it('should handle long context', () => {
      const context = 'C'.repeat(5000);
      const result = outputPromptContext(context);
      expect(result.hookSpecificOutput?.additionalContext).toBe(context);
    });

    it('should handle multi-line context', () => {
      const context = 'Rule 1: Encrypt PII\nRule 2: Audit access\nRule 3: Minimum necessary';
      const result = outputPromptContext(context);
      expect(result.hookSpecificOutput?.additionalContext).toBe(context);
    });

    it('should handle context with backslashes', () => {
      const context = 'Windows path: C:\\Users\\test';
      const result = outputPromptContext(context);
      expect(result.hookSpecificOutput?.additionalContext).toBe(context);
    });
  });

  it('should produce valid JSON when stringified', () => {
    const result = outputPromptContext('Test context');
    const json = JSON.stringify(result);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.continue).toBe(true);
    expect(parsed.suppressOutput).toBe(true);
    expect(parsed.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(parsed.hookSpecificOutput.additionalContext).toBe('Test context');
  });

  it('JSON round-trip should preserve structure', () => {
    const result = outputPromptContext('Security compliance reminder');
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(result);
  });

  it('should satisfy HookResult interface', () => {
    const result: HookResult = outputPromptContext('context');
    expect(result).toBeDefined();
  });
});

// =============================================================================
// outputWithContext TESTS
// =============================================================================

describe('outputWithContext', () => {
  it('should return exact expected structure', () => {
    const result = outputWithContext('Tip: use --no-cache');

    expect(result).toEqual({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: 'Tip: use --no-cache',
      },
    });
  });

  it('should have continue set to true', () => {
    const result = outputWithContext('ctx');
    expect(result.continue).toBe(true);
  });

  it('should have suppressOutput set to true', () => {
    const result = outputWithContext('ctx');
    expect(result.suppressOutput).toBe(true);
  });

  it('should include context as additionalContext', () => {
    const ctx = 'Error matched rule: npm-install-failure';
    const result = outputWithContext(ctx);
    expect(result.hookSpecificOutput?.additionalContext).toBe(ctx);
  });

  it('should have hookEventName PostToolUse', () => {
    const result = outputWithContext('ctx');
    expect(result.hookSpecificOutput?.hookEventName).toBe('PostToolUse');
  });

  it('should NOT have permissionDecision', () => {
    const result = outputWithContext('ctx');
    expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  it('should not have systemMessage', () => {
    const result = outputWithContext('ctx');
    expect(result.systemMessage).toBeUndefined();
  });

  it('should handle empty string context', () => {
    const result = outputWithContext('');
    expect(result.hookSpecificOutput?.additionalContext).toBe('');
  });

  it('should preserve multi-line context', () => {
    const ctx = 'Line 1\nLine 2';
    const result = outputWithContext(ctx);
    expect(result.hookSpecificOutput?.additionalContext).toBe(ctx);
  });

  it('should produce valid JSON when stringified', () => {
    const result = outputWithContext('Test context');
    const json = JSON.stringify(result);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.hookSpecificOutput.additionalContext).toBe('Test context');
  });

  it('should satisfy HookResult interface', () => {
    const result: HookResult = outputWithContext('ctx');
    expect(result).toBeDefined();
  });
});

// =============================================================================
// outputWithNotification TESTS
// =============================================================================

describe('outputWithNotification', () => {
  it('should return exact expected structure', () => {
    const result = outputWithNotification('Lint errors found', 'Fix E401, E501');

    expect(result).toEqual({
      continue: true,
      systemMessage: 'Lint errors found',
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: 'Fix E401, E501',
      },
    });
  });

  it('should have continue set to true', () => {
    const result = outputWithNotification('msg', 'ctx');
    expect(result.continue).toBe(true);
  });

  it('should include userMsg as systemMessage', () => {
    const result = outputWithNotification('User sees this', 'Claude sees this');
    expect(result.systemMessage).toBe('User sees this');
  });

  it('should include claudeCtx as additionalContext', () => {
    const result = outputWithNotification('User sees this', 'Claude sees this');
    expect(result.hookSpecificOutput?.additionalContext).toBe('Claude sees this');
  });

  it('should NOT have suppressOutput', () => {
    const result = outputWithNotification('msg', 'ctx');
    expect(result.suppressOutput).toBeUndefined();
  });

  it('should NOT have permissionDecision', () => {
    const result = outputWithNotification('msg', 'ctx');
    expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  it('should handle empty strings', () => {
    const result = outputWithNotification('', '');
    expect(result.systemMessage).toBe('');
    expect(result.hookSpecificOutput?.additionalContext).toBe('');
  });

  it('should preserve special characters in both channels', () => {
    const result = outputWithNotification('Warning: <danger>', 'Fix "this" & \'that\'');
    expect(result.systemMessage).toBe('Warning: <danger>');
    expect(result.hookSpecificOutput?.additionalContext).toBe('Fix "this" & \'that\'');
  });

  it('should produce valid JSON when stringified', () => {
    const result = outputWithNotification('user msg', 'claude ctx');
    const json = JSON.stringify(result);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.systemMessage).toBe('user msg');
    expect(parsed.hookSpecificOutput.additionalContext).toBe('claude ctx');
  });

  it('should satisfy HookResult interface', () => {
    const result: HookResult = outputWithNotification('msg', 'ctx');
    expect(result).toBeDefined();
  });
});

// =============================================================================
// CROSS-FUNCTION COMPARISON TESTS
// =============================================================================

describe('output function comparisons', () => {
  describe('continue field behavior', () => {
    it('outputSilentSuccess should have continue=true', () => {
      expect(outputSilentSuccess().continue).toBe(true);
    });

    it('outputSuccess should have continue=true', () => {
      expect(outputSuccess('msg').continue).toBe(true);
    });

    it('outputWarning should have continue=true', () => {
      expect(outputWarning('msg').continue).toBe(true);
    });

    it('outputDeny should have continue=false', () => {
      expect(outputDeny('reason').continue).toBe(false);
    });

    it('outputAllow should have continue=true', () => {
      expect(outputAllow().continue).toBe(true);
    });

    it('outputAllowWithContext should have continue=true', () => {
      expect(outputAllowWithContext('ctx').continue).toBe(true);
    });

    it('outputPromptContext should have continue=true', () => {
      expect(outputPromptContext('ctx').continue).toBe(true);
    });
  });

  describe('suppressOutput field behavior', () => {
    it('outputSilentSuccess should suppress output', () => {
      expect(outputSilentSuccess().suppressOutput).toBe(true);
    });

    it('outputSuccess should not suppress output', () => {
      expect(outputSuccess('msg').suppressOutput).toBeUndefined();
    });

    it('outputWarning should not suppress output', () => {
      expect(outputWarning('msg').suppressOutput).toBeUndefined();
    });

    it('outputDeny should not suppress output', () => {
      expect(outputDeny('reason').suppressOutput).toBeUndefined();
    });

    it('outputAllow should suppress output', () => {
      expect(outputAllow().suppressOutput).toBe(true);
    });

    it('outputAllowWithContext should suppress output', () => {
      expect(outputAllowWithContext('ctx').suppressOutput).toBe(true);
    });

    it('outputPromptContext should suppress output', () => {
      expect(outputPromptContext('ctx').suppressOutput).toBe(true);
    });
  });

  describe('permissionDecision field behavior', () => {
    it('outputSilentSuccess should not have permissionDecision', () => {
      expect(outputSilentSuccess().hookSpecificOutput).toBeUndefined();
    });

    it('outputSuccess should not have permissionDecision', () => {
      expect(outputSuccess('msg').hookSpecificOutput).toBeUndefined();
    });

    it('outputWarning should not have permissionDecision', () => {
      expect(outputWarning('msg').hookSpecificOutput).toBeUndefined();
    });

    it('outputDeny should have permissionDecision=deny', () => {
      expect(outputDeny('reason').hookSpecificOutput?.permissionDecision).toBe('deny');
    });

    it('outputAllow should have permissionDecision=allow', () => {
      expect(outputAllow().hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    it('outputAllowWithContext should have permissionDecision=allow', () => {
      expect(outputAllowWithContext('ctx').hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    it('outputPromptContext should NOT have permissionDecision', () => {
      expect(outputPromptContext('ctx').hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });
});

// =============================================================================
// JSON SERIALIZATION TESTS
// =============================================================================

describe('JSON serialization', () => {
  it('all output functions should produce valid JSON', () => {
    const outputs = [
      outputSilentSuccess(),
      outputSuccess('test'),
      outputWarning('test'),
      outputDeny('test'),
      outputAllow(),
      outputAllowWithContext('test'),
      outputPromptContext('test'),
    ];

    for (const output of outputs) {
      expect(() => JSON.stringify(output)).not.toThrow();
    }
  });

  it('JSON round-trip should preserve structure', () => {
    const outputs = [
      outputSilentSuccess(),
      outputSuccess('test message'),
      outputWarning('warning message'),
      outputDeny('denial reason'),
      outputAllow(),
      outputAllowWithContext('context info'),
      outputPromptContext('compliance context'),
    ];

    for (const output of outputs) {
      const json = JSON.stringify(output);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(output);
    }
  });

  it('should handle JSON-unsafe characters in messages', () => {
    const problematicStrings = [
      'Quote: "test"',
      "Apostrophe: 'test'",
      'Backslash: \\test\\',
      'Newline:\ntest',
      'Tab:\ttest',
      'Unicode: \u0000\u001f', // Control characters
      'Null byte: \x00',
    ];

    for (const str of problematicStrings) {
      // These should not throw
      expect(() => JSON.stringify(outputSuccess(str))).not.toThrow();
      expect(() => JSON.stringify(outputWarning(str))).not.toThrow();
      expect(() => JSON.stringify(outputDeny(str))).not.toThrow();
      expect(() => JSON.stringify(outputAllowWithContext(str))).not.toThrow();
    }
  });
});
