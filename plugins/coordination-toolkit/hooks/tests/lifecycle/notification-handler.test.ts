/**
 * Tests for notification-handler hook.
 *
 * @module tests/lifecycle/notification-handler
 */

import { describe, expect, it } from 'vitest';
import { notificationHandler } from '../../src/lifecycle/notification-handler.js';
import type { HookInput } from '../../src/types.js';

function makeInput(): HookInput {
  return {
    tool_name: 'Bash',
    tool_input: {},
  };
}

describe('notificationHandler', () => {
  it('should return silentSuccess', async () => {
    const result = await notificationHandler(makeInput());
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('should produce valid JSON', async () => {
    const result = await notificationHandler(makeInput());
    const json = JSON.stringify(result);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
