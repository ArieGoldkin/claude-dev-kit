/**
 * Tests for permission-request-combined hook
 *
 * @module tests/permission/permission-request-combined
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { permissionRequestCombined } from '../../src/permission/permission-request-combined.js';
import type { HookInput } from '../../src/types.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    tool_input: { command },
  };
}

function createWriteInput(filePath: string): HookInput {
  return {
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: 'test content' },
  };
}

function createEditInput(filePath: string): HookInput {
  return {
    tool_name: 'Edit',
    tool_input: { file_path: filePath, old_string: 'old', new_string: 'new' },
  };
}

function createReadInput(): HookInput {
  return {
    tool_name: 'Read',
    tool_input: { file_path: '/some/file.ts' },
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('permission-request-combined', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['CLAUDE_PROJECT_DIR'] = '/tmp/test-project';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Bash auto-approval', () => {
    it('should auto-approve safe Bash commands', async () => {
      const result = await permissionRequestCombined(createBashInput('git status'));

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    it('should return hookEventName PermissionRequest for approved Bash commands', async () => {
      const result = await permissionRequestCombined(createBashInput('git status'));

      expect(result.hookSpecificOutput?.hookEventName).toBe('PermissionRequest');
    });

    it('should auto-approve ls commands', async () => {
      const result = await permissionRequestCombined(createBashInput('ls -la'));

      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
      expect(result.hookSpecificOutput?.hookEventName).toBe('PermissionRequest');
    });

    it('should defer unsafe Bash commands to permission dialog', async () => {
      const result = await permissionRequestCombined(createBashInput('npm install express'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });

  describe('Write/Edit auto-approval', () => {
    it('should auto-approve safe project file writes', async () => {
      const result = await permissionRequestCombined(
        createWriteInput('/tmp/test-project/src/app.ts')
      );

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    it('should return hookEventName PermissionRequest for approved writes', async () => {
      const result = await permissionRequestCombined(
        createWriteInput('/tmp/test-project/src/app.ts')
      );

      expect(result.hookSpecificOutput?.hookEventName).toBe('PermissionRequest');
    });

    it('should auto-approve Edit operations within project', async () => {
      const result = await permissionRequestCombined(
        createEditInput('/tmp/test-project/src/utils.ts')
      );

      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
      expect(result.hookSpecificOutput?.hookEventName).toBe('PermissionRequest');
    });

    it('should defer writes outside project to permission dialog', async () => {
      const result = await permissionRequestCombined(createWriteInput('/etc/some-config'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('read-only tools', () => {
    it('should defer Read operations to permission dialog', async () => {
      const result = await permissionRequestCombined(createReadInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('deferred decisions', () => {
    it('should return silent success when no hook matches', async () => {
      const input: HookInput = {
        tool_name: 'Glob',
        tool_input: { pattern: '**/*.ts' },
      };

      const result = await permissionRequestCombined(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });

  describe('result structure', () => {
    it('should produce valid JSON when stringified', async () => {
      const result = await permissionRequestCombined(createBashInput('git status'));
      const json = JSON.stringify(result);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('approved results should have suppressOutput=true', async () => {
      const result = await permissionRequestCombined(createBashInput('git status'));

      expect(result.suppressOutput).toBe(true);
    });
  });
});
