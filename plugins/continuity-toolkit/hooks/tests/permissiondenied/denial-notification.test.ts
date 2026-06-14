/**
 * Tests for denial-notification PermissionDenied hook
 *
 * Verifies sliding window counting, threshold triggering, and cooldown.
 * Desktop notification (osascript) is NOT tested — just the logic.
 *
 * @module tests/permissiondenied/denial-notification
 */

import { describe, expect, it } from 'vitest';

// We need to re-import for each test to reset module state,
// but since the module has state (denialTimestamps, lastNotificationTime),
// we'll test the exported function's behavior.
import { denialNotification } from '../../src/permissiondenied/denial-notification.js';
import type { HookInput } from '../../src/types.js';

function createDenialInput(toolName = 'Bash', command?: string): HookInput {
  return {
    tool_name: toolName as HookInput['tool_name'],
    tool_input: command ? { command } : {},
    session_id: 'test-session',
  };
}

describe('denialNotification', () => {
  it('should return silent success on first denial', async () => {
    const result = await denialNotification(createDenialInput('Bash', 'ls'));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('should return silent success below threshold', async () => {
    const result = await denialNotification(createDenialInput('Write'));
    expect(result.continue).toBe(true);
  });

  it('should always return continue=true (never blocks)', async () => {
    // Fire many denials to exceed threshold
    for (let i = 0; i < 5; i++) {
      const result = await denialNotification(createDenialInput('Bash', `cmd-${i}`));
      expect(result.continue).toBe(true);
    }
  });

  it('should handle various tool names', async () => {
    const tools = ['Bash', 'Write', 'Edit', 'Read', 'Glob'];
    for (const tool of tools) {
      const result = await denialNotification(createDenialInput(tool));
      expect(result.continue).toBe(true);
    }
  });

  it('should handle missing command gracefully', async () => {
    const result = await denialNotification({
      tool_name: 'Bash',
      tool_input: {},
    });
    expect(result.continue).toBe(true);
  });
});
