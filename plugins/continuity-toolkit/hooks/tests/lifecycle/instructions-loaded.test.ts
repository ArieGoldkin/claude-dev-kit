/**
 * Tests for instructions-loaded hook
 *
 * Verifies that the InstructionsLoaded hook:
 * - Returns silent success
 * - Handles missing source gracefully
 * - Handles different source values
 *
 * @module tests/lifecycle/instructions-loaded
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { instructionsLoaded } from '../../src/lifecycle/instructions-loaded.js';
import type { HookInput } from '../../src/types.js';

function createMockInput(source?: string): HookInput {
  return {
    tool_name: 'InstructionsLoaded' as HookInput['tool_name'],
    tool_input: {},
    ...(source !== undefined && { source }),
  };
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'instructions-loaded-test-'));
}

describe('instructions-loaded', () => {
  const originalEnv = { ...process.env };
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    process.env['CLAUDE_PROJECT_DIR'] = tempDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('return value', () => {
    it('should return silent success', async () => {
      const result = await instructionsLoaded(createMockInput('/path/to/CLAUDE.md'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success with no source', async () => {
      const result = await instructionsLoaded(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success with empty input', async () => {
      const result = await instructionsLoaded({
        tool_name: '' as HookInput['tool_name'],
        tool_input: {},
      });

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('different source values', () => {
    const sources = ['/path/to/CLAUDE.md', '.claude/settings.json', 'unknown'];

    for (const source of sources) {
      it(`should handle source='${source}'`, async () => {
        const result = await instructionsLoaded(createMockInput(source));

        expect(result.continue).toBe(true);
        expect(result.suppressOutput).toBe(true);
      });
    }
  });

  describe('edge cases', () => {
    it('should handle missing CLAUDE_PROJECT_DIR', async () => {
      delete process.env['CLAUDE_PROJECT_DIR'];

      const result = await instructionsLoaded(createMockInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should produce valid JSON when stringified', async () => {
      const result = await instructionsLoaded(createMockInput());

      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });
});
