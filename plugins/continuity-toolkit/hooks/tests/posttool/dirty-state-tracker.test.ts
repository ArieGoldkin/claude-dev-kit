/**
 * Tests for dirty-state-tracker hook
 *
 * These tests verify that the PostToolUse hook correctly:
 * - Returns silent success for non-edit tools (Bash, Read, Grep)
 * - Returns silent success for empty file path
 * - Returns silent success when context file doesn't exist
 * - Acquires and releases locks correctly
 * - Deduplicates files (same file edited twice doesn't increment count)
 * - Shows threshold warnings at 15 and 25 files
 * - Writes atomically
 * - Preserves existing JSON structure
 *
 * @module tests/posttool/dirty-state-tracker
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acquireLock,
  dirtyStateTracker,
  getContextFilePath,
  getThresholdResponse,
  readContextFile,
  releaseLock,
  updateContextWithEdit,
  writeContextFile,
} from '../../src/posttool/dirty-state-tracker.js';
import type { HookInput, SharedContext } from '../../src/types.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a mock HookInput for testing
 */
function createMockInput(toolName = 'Write', filePath?: string): HookInput {
  return {
    tool_name: toolName as HookInput['tool_name'],
    tool_input: filePath ? { file_path: filePath } : {},
  };
}

/**
 * Create a mock MultiEdit HookInput for testing
 */
function createMultiEditInput(filePaths: string[]): HookInput {
  return {
    tool_name: 'MultiEdit' as HookInput['tool_name'],
    tool_input: {
      edits: filePaths.map((fp) => ({ file_path: fp, old_string: 'old', new_string: 'new' })),
    },
  };
}

/**
 * Create a temporary directory structure for testing
 */
function createTempProjectDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dirty-tracker-test-'));
  const contextDir = path.join(tempDir, '.claude', 'context');
  fs.mkdirSync(contextDir, { recursive: true });
  return tempDir;
}

/**
 * Create a minimal shared context file
 */
function createContextFile(projectDir: string, context?: Partial<SharedContext>): string {
  const contextPath = getContextFilePath(projectDir);
  const defaultContext: SharedContext = {
    session_heartbeat: {
      was_cleanly_ended: false,
    },
    dirty_tracking: {
      files_edited_count: 0,
      files_edited_this_session: [],
      threshold_warning: 15,
      threshold_auto_suggest: 25,
    },
  };

  const mergedContext = {
    ...defaultContext,
    ...context,
    dirty_tracking: {
      ...defaultContext.dirty_tracking,
      ...context?.dirty_tracking,
    },
    session_heartbeat: {
      ...defaultContext.session_heartbeat,
      ...context?.session_heartbeat,
    },
  };

  fs.writeFileSync(contextPath, JSON.stringify(mergedContext, null, 2));
  return contextPath;
}

/**
 * Clean up a temporary directory
 */
function cleanupTempDir(tempDir: string): void {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('dirty-state-tracker', () => {
  const originalEnv = { ...process.env };
  let tempDir: string | null = null;

  beforeEach(() => {
    // Reset environment
    delete process.env['CLAUDE_PROJECT_DIR'];
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };

    // Clean up temp directory if created
    if (tempDir) {
      cleanupTempDir(tempDir);
      tempDir = null;
    }
  });

  // ===========================================================================
  // getContextFilePath TESTS
  // ===========================================================================

  describe('getContextFilePath', () => {
    it('should return correct path for project directory', () => {
      const projectDir = '/path/to/project';
      const contextPath = getContextFilePath(projectDir);

      expect(contextPath).toBe('/path/to/project/.claude/context/shared-context.json');
    });

    it('should handle project directory with trailing slash', () => {
      const projectDir = '/path/to/project/';
      const contextPath = getContextFilePath(projectDir);

      expect(contextPath).toContain('.claude/context/shared-context.json');
    });
  });

  // ===========================================================================
  // acquireLock / releaseLock TESTS
  // ===========================================================================

  describe('acquireLock and releaseLock', () => {
    it('should acquire lock on first attempt', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-test-'));
      const lockPath = path.join(tempDir, 'test.lock');

      const acquired = await acquireLock(lockPath);

      expect(acquired).toBe(true);
      expect(fs.existsSync(lockPath)).toBe(true);
      expect(fs.existsSync(path.join(lockPath, 'pid'))).toBe(true);

      releaseLock(lockPath);
    });

    it('should release lock by removing directory', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-test-'));
      const lockPath = path.join(tempDir, 'test.lock');

      await acquireLock(lockPath);
      expect(fs.existsSync(lockPath)).toBe(true);

      releaseLock(lockPath);
      expect(fs.existsSync(lockPath)).toBe(false);
    });

    it('should fail after max attempts when lock is held', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-test-'));
      const lockPath = path.join(tempDir, 'test.lock');

      // Manually create lock with current PID so it looks alive (not stale)
      fs.mkdirSync(lockPath);
      fs.writeFileSync(path.join(lockPath, 'pid'), String(process.pid));

      // Try to acquire with only 2 attempts (200ms timeout)
      const acquired = await acquireLock(lockPath, 2);

      expect(acquired).toBe(false);

      // Clean up
      fs.rmSync(lockPath, { recursive: true });
    });

    it('should store PID in lock directory', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-test-'));
      const lockPath = path.join(tempDir, 'test.lock');

      await acquireLock(lockPath);

      const pidContent = fs.readFileSync(path.join(lockPath, 'pid'), 'utf-8');
      expect(pidContent).toBe(process.pid.toString());

      releaseLock(lockPath);
    });

    it('should handle release of non-existent lock gracefully', () => {
      const lockPath = '/nonexistent/path/test.lock';

      // Should not throw
      expect(() => releaseLock(lockPath)).not.toThrow();
    });
  });

  // ===========================================================================
  // readContextFile / writeContextFile TESTS
  // ===========================================================================

  describe('readContextFile', () => {
    it('should read and parse valid context file', () => {
      tempDir = createTempProjectDir();
      const contextPath = createContextFile(tempDir);

      const context = readContextFile(contextPath);

      expect(context).not.toBeNull();
      expect(context?.dirty_tracking.files_edited_count).toBe(0);
    });

    it('should return null for non-existent file', () => {
      const context = readContextFile('/nonexistent/path/context.json');

      expect(context).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      tempDir = createTempProjectDir();
      const contextPath = getContextFilePath(tempDir);
      fs.writeFileSync(contextPath, 'invalid json {{{');

      const context = readContextFile(contextPath);

      expect(context).toBeNull();
    });
  });

  describe('writeContextFile', () => {
    it('should write context file atomically', () => {
      tempDir = createTempProjectDir();
      const contextPath = createContextFile(tempDir);

      const newContext: SharedContext = {
        session_heartbeat: { was_cleanly_ended: true },
        dirty_tracking: {
          files_edited_count: 5,
          files_edited_this_session: ['/a.ts', '/b.ts'],
          threshold_warning: 15,
          threshold_auto_suggest: 25,
        },
      };

      writeContextFile(contextPath, newContext);

      const content = fs.readFileSync(contextPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.dirty_tracking.files_edited_count).toBe(5);
      expect(parsed.session_heartbeat.was_cleanly_ended).toBe(true);
    });

    it('should not leave temp file after successful write', () => {
      tempDir = createTempProjectDir();
      const contextPath = createContextFile(tempDir);

      writeContextFile(contextPath, {
        session_heartbeat: { was_cleanly_ended: false },
        dirty_tracking: {
          files_edited_count: 1,
          files_edited_this_session: [],
          threshold_warning: 15,
          threshold_auto_suggest: 25,
        },
      });

      expect(fs.existsSync(`${contextPath}.tmp`)).toBe(false);
    });
  });

  // ===========================================================================
  // updateContextWithEdit TESTS
  // ===========================================================================

  describe('updateContextWithEdit', () => {
    it('should add new file and increment count', () => {
      const context: SharedContext = {
        session_heartbeat: { was_cleanly_ended: false },
        dirty_tracking: {
          files_edited_count: 0,
          files_edited_this_session: [],
          threshold_warning: 15,
          threshold_auto_suggest: 25,
        },
      };

      const { context: updated, isNewFile } = updateContextWithEdit(context, '/path/to/file.ts');

      expect(isNewFile).toBe(true);
      expect(updated.dirty_tracking.files_edited_count).toBe(1);
      expect(updated.dirty_tracking.files_edited_this_session).toContain('/path/to/file.ts');
    });

    it('should not increment count for duplicate file', () => {
      const context: SharedContext = {
        session_heartbeat: { was_cleanly_ended: false },
        dirty_tracking: {
          files_edited_count: 1,
          files_edited_this_session: ['/path/to/file.ts'],
          threshold_warning: 15,
          threshold_auto_suggest: 25,
        },
      };

      const { context: updated, isNewFile } = updateContextWithEdit(context, '/path/to/file.ts');

      expect(isNewFile).toBe(false);
      expect(updated.dirty_tracking.files_edited_count).toBe(1);
      expect(updated.dirty_tracking.files_edited_this_session).toHaveLength(1);
    });

    it('should update timestamps', () => {
      const context: SharedContext = {
        session_heartbeat: { was_cleanly_ended: false },
        dirty_tracking: {
          files_edited_count: 0,
          files_edited_this_session: [],
          threshold_warning: 15,
          threshold_auto_suggest: 25,
        },
      };

      const { context: updated } = updateContextWithEdit(context, '/path/to/file.ts');

      expect(updated.dirty_tracking.last_edit_timestamp).toBeDefined();
      expect(updated.session_heartbeat.last_activity).toBeDefined();

      // Timestamps should be valid ISO strings
      const editTimestamp = new Date(updated.dirty_tracking.last_edit_timestamp ?? '');
      const activityTimestamp = new Date(updated.session_heartbeat.last_activity ?? '');

      expect(editTimestamp.toString()).not.toBe('Invalid Date');
      expect(activityTimestamp.toString()).not.toBe('Invalid Date');
    });

    it('should initialize dirty_tracking if not present', () => {
      const context = {
        session_heartbeat: { was_cleanly_ended: false },
      } as SharedContext;

      const { context: updated } = updateContextWithEdit(context, '/path/to/file.ts');

      expect(updated.dirty_tracking).toBeDefined();
      expect(updated.dirty_tracking.files_edited_count).toBe(1);
      expect(updated.dirty_tracking.threshold_warning).toBe(15);
      expect(updated.dirty_tracking.threshold_auto_suggest).toBe(25);
    });

    it('should initialize session_heartbeat if not present', () => {
      const context = {
        dirty_tracking: {
          files_edited_count: 0,
          files_edited_this_session: [],
          threshold_warning: 15,
          threshold_auto_suggest: 25,
        },
      } as SharedContext;

      const { context: updated } = updateContextWithEdit(context, '/path/to/file.ts');

      expect(updated.session_heartbeat).toBeDefined();
      expect(updated.session_heartbeat.was_cleanly_ended).toBe(false);
      expect(updated.session_heartbeat.last_activity).toBeDefined();
    });
  });

  // ===========================================================================
  // getThresholdResponse TESTS
  // ===========================================================================

  describe('getThresholdResponse', () => {
    it('should return silent success below warning threshold', () => {
      const result = getThresholdResponse(10, 15, 25);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.systemMessage).toBeUndefined();
    });

    it('should return warning at warning threshold', () => {
      const result = getThresholdResponse(15, 15, 25);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('15 unique files edited');
      expect(result.systemMessage).toContain('Will suggest handoff at 25 files');
    });

    it('should return auto-suggest warning at auto-suggest threshold', () => {
      const result = getThresholdResponse(25, 15, 25);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('25 unique files edited');
      expect(result.systemMessage).toContain('/create-handoff');
    });

    it('should return auto-suggest warning above auto-suggest threshold', () => {
      const result = getThresholdResponse(30, 15, 25);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('30 unique files edited');
      expect(result.systemMessage).toContain('/create-handoff');
    });

    it('should include warning symbol in threshold messages', () => {
      const warningResult = getThresholdResponse(15, 15, 25);
      const autoResult = getThresholdResponse(25, 15, 25);

      // Warning symbol is \u26a0
      expect(warningResult.systemMessage).toMatch(/^\u26a0/);
      expect(autoResult.systemMessage).toMatch(/^\u26a0/);
    });
  });

  // ===========================================================================
  // dirtyStateTracker - Non-edit tools
  // ===========================================================================

  describe('when tool is not Write, Edit, or MultiEdit', () => {
    it('should return silent success for Bash tool', async () => {
      const result = await dirtyStateTracker(createMockInput('Bash', '/some/file.sh'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success for Read tool', async () => {
      const result = await dirtyStateTracker(createMockInput('Read', '/some/file.ts'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success for Grep tool', async () => {
      const result = await dirtyStateTracker(createMockInput('Grep', '/some/path'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success for Glob tool', async () => {
      const result = await dirtyStateTracker(createMockInput('Glob', '/some/path'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ===========================================================================
  // dirtyStateTracker - Empty file path
  // ===========================================================================

  describe('when file path is empty', () => {
    it('should return silent success for Write with no file_path', async () => {
      const result = await dirtyStateTracker(createMockInput('Write'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success for Edit with no file_path', async () => {
      const result = await dirtyStateTracker(createMockInput('Edit'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success for MultiEdit with no edits field', async () => {
      const result = await dirtyStateTracker({
        tool_name: 'MultiEdit' as HookInput['tool_name'],
        tool_input: {},
      });

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ===========================================================================
  // dirtyStateTracker - MultiEdit tool
  // ===========================================================================

  describe('when tool is MultiEdit', () => {
    it('should track all files from edits array', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      await dirtyStateTracker(
        createMultiEditInput(['/path/to/file1.ts', '/path/to/file2.ts', '/path/to/file3.ts'])
      );

      const context = readContextFile(getContextFilePath(tempDir));
      expect(context?.dirty_tracking.files_edited_count).toBe(3);
      expect(context?.dirty_tracking.files_edited_this_session).toContain('/path/to/file1.ts');
      expect(context?.dirty_tracking.files_edited_this_session).toContain('/path/to/file2.ts');
      expect(context?.dirty_tracking.files_edited_this_session).toContain('/path/to/file3.ts');
    });

    it('should deduplicate files within a single MultiEdit call', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      // Same file appears twice in edits array
      await dirtyStateTracker(createMultiEditInput(['/path/to/file.ts', '/path/to/file.ts']));

      const context = readContextFile(getContextFilePath(tempDir));
      expect(context?.dirty_tracking.files_edited_count).toBe(1);
      expect(context?.dirty_tracking.files_edited_this_session).toHaveLength(1);
    });

    it('should return silent success for empty edits array', async () => {
      const result = await dirtyStateTracker(createMultiEditInput([]));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should return silent success when context file does not exist', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dirty-tracker-test-'));
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const result = await dirtyStateTracker(
        createMultiEditInput(['/path/to/file1.ts', '/path/to/file2.ts'])
      );

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should count correctly when mixed with Write edits', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      await dirtyStateTracker(createMockInput('Write', '/path/to/file1.ts'));
      await dirtyStateTracker(createMultiEditInput(['/path/to/file2.ts', '/path/to/file3.ts']));

      const context = readContextFile(getContextFilePath(tempDir));
      expect(context?.dirty_tracking.files_edited_count).toBe(3);
    });

    it('should not double-count files already edited via Write', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      await dirtyStateTracker(createMockInput('Write', '/path/to/file1.ts'));
      await dirtyStateTracker(createMultiEditInput(['/path/to/file1.ts', '/path/to/file2.ts']));

      const context = readContextFile(getContextFilePath(tempDir));
      expect(context?.dirty_tracking.files_edited_count).toBe(2);
    });
  });

  // ===========================================================================
  // dirtyStateTracker - Context file doesn't exist
  // ===========================================================================

  describe('when context file does not exist', () => {
    it('should return silent success', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dirty-tracker-test-'));
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      // Don't create context file

      const result = await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ===========================================================================
  // dirtyStateTracker - Context file not writable
  // ===========================================================================

  describe('when context file is not writable', () => {
    it('should return silent success', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const contextPath = createContextFile(tempDir);
      fs.chmodSync(contextPath, 0o444);

      const result = await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));

      // Restore permissions for cleanup
      fs.chmodSync(contextPath, 0o644);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ===========================================================================
  // dirtyStateTracker - Successful tracking
  // ===========================================================================

  describe('when tracking succeeds', () => {
    it('should update context file with new file', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));

      const context = readContextFile(getContextFilePath(tempDir));
      expect(context?.dirty_tracking.files_edited_count).toBe(1);
      expect(context?.dirty_tracking.files_edited_this_session).toContain('/path/to/file.ts');
    });

    it('should return silent success when below threshold', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      const result = await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should deduplicate files on repeated edits', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      // Edit same file twice
      await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));
      await dirtyStateTracker(createMockInput('Edit', '/path/to/file.ts'));

      const context = readContextFile(getContextFilePath(tempDir));
      expect(context?.dirty_tracking.files_edited_count).toBe(1);
      expect(context?.dirty_tracking.files_edited_this_session).toHaveLength(1);
    });

    it('should increment count for different files', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      await dirtyStateTracker(createMockInput('Write', '/path/to/file1.ts'));
      await dirtyStateTracker(createMockInput('Write', '/path/to/file2.ts'));
      await dirtyStateTracker(createMockInput('Write', '/path/to/file3.ts'));

      const context = readContextFile(getContextFilePath(tempDir));
      expect(context?.dirty_tracking.files_edited_count).toBe(3);
      expect(context?.dirty_tracking.files_edited_this_session).toHaveLength(3);
    });

    it('should update last_edit_timestamp', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      const before = new Date();
      await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));
      const after = new Date();

      const context = readContextFile(getContextFilePath(tempDir));
      const timestamp = new Date(context?.dirty_tracking.last_edit_timestamp ?? '');

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });

    it('should update session_heartbeat.last_activity', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));

      const context = readContextFile(getContextFilePath(tempDir));
      expect(context?.session_heartbeat.last_activity).toBeDefined();
    });
  });

  // ===========================================================================
  // dirtyStateTracker - Threshold warnings
  // ===========================================================================

  describe('threshold warnings', () => {
    it('should return warning at warning threshold (15)', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      // Create context with 14 files already edited
      createContextFile(tempDir, {
        dirty_tracking: {
          files_edited_count: 14,
          files_edited_this_session: Array.from({ length: 14 }, (_, i) => `/file${i}.ts`),
          threshold_warning: 15,
          threshold_auto_suggest: 25,
        },
      });

      // This edit should trigger the warning
      const result = await dirtyStateTracker(createMockInput('Write', '/path/to/new-file.ts'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('15 unique files edited');
      expect(result.systemMessage).toContain('Will suggest handoff at 25 files');
    });

    it('should return auto-suggest warning at auto-suggest threshold (25)', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      // Create context with 24 files already edited
      createContextFile(tempDir, {
        dirty_tracking: {
          files_edited_count: 24,
          files_edited_this_session: Array.from({ length: 24 }, (_, i) => `/file${i}.ts`),
          threshold_warning: 15,
          threshold_auto_suggest: 25,
        },
      });

      // This edit should trigger the auto-suggest
      const result = await dirtyStateTracker(createMockInput('Write', '/path/to/new-file.ts'));

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('25 unique files edited');
      expect(result.systemMessage).toContain('/create-handoff');
    });

    it('should respect custom thresholds', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      // Create context with custom thresholds
      createContextFile(tempDir, {
        dirty_tracking: {
          files_edited_count: 9,
          files_edited_this_session: Array.from({ length: 9 }, (_, i) => `/file${i}.ts`),
          threshold_warning: 10,
          threshold_auto_suggest: 20,
        },
      });

      // This edit should trigger the warning at custom threshold
      const result = await dirtyStateTracker(createMockInput('Write', '/path/to/new-file.ts'));

      expect(result.systemMessage).toContain('10 unique files edited');
      expect(result.systemMessage).toContain('Will suggest handoff at 20 files');
    });
  });

  // ===========================================================================
  // dirtyStateTracker - JSON structure preservation
  // ===========================================================================

  describe('JSON structure preservation', () => {
    it('should preserve additional fields in context file', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const contextPath = getContextFilePath(tempDir);
      const originalContext = {
        session_heartbeat: { was_cleanly_ended: false },
        dirty_tracking: {
          files_edited_count: 0,
          files_edited_this_session: [],
          threshold_warning: 15,
          threshold_auto_suggest: 25,
        },
        agent_decisions: { some_agent: 'some_value' },
        tasks_completed: ['task1', 'task2'],
      };
      fs.writeFileSync(contextPath, JSON.stringify(originalContext, null, 2));

      await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));

      const content = fs.readFileSync(contextPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Additional fields should be preserved
      expect(parsed.agent_decisions).toEqual({ some_agent: 'some_value' });
      expect(parsed.tasks_completed).toEqual(['task1', 'task2']);
    });

    it('should produce valid JSON after update', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));

      const contextPath = getContextFilePath(tempDir);
      const content = fs.readFileSync(contextPath, 'utf-8');

      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  // ===========================================================================
  // dirtyStateTracker - Edge cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle file paths with special characters', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      const specialPath = '/path/to/file with spaces & "quotes".ts';
      await dirtyStateTracker(createMockInput('Write', specialPath));

      const context = readContextFile(getContextFilePath(tempDir));
      expect(context?.dirty_tracking.files_edited_this_session).toContain(specialPath);
    });

    it('should handle unicode in file paths', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      const unicodePath = '/path/to/\u6587\u4EF6.ts';
      await dirtyStateTracker(createMockInput('Write', unicodePath));

      const context = readContextFile(getContextFilePath(tempDir));
      expect(context?.dirty_tracking.files_edited_this_session).toContain(unicodePath);
    });

    it('should handle Edit tool same as Write tool', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      await dirtyStateTracker(createMockInput('Edit', '/path/to/file.ts'));

      const context = readContextFile(getContextFilePath(tempDir));
      expect(context?.dirty_tracking.files_edited_count).toBe(1);
    });

    it('should use default project dir when CLAUDE_PROJECT_DIR not set', async () => {
      // This should not crash, just return silent success (file won't exist)
      delete process.env['CLAUDE_PROJECT_DIR'];

      const result = await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ===========================================================================
  // HookResult structure tests
  // ===========================================================================

  describe('HookResult structure', () => {
    it('should have correct structure for silent success', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      const result = await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));

      expect(result).toEqual({
        continue: true,
        suppressOutput: true,
      });
    });

    it('should have correct structure for threshold warning', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir, {
        dirty_tracking: {
          files_edited_count: 14,
          files_edited_this_session: Array.from({ length: 14 }, (_, i) => `/file${i}.ts`),
          threshold_warning: 15,
          threshold_auto_suggest: 25,
        },
      });

      const result = await dirtyStateTracker(createMockInput('Write', '/path/to/new-file.ts'));

      expect(result).toHaveProperty('continue', true);
      expect(result).toHaveProperty('systemMessage');
      expect(result.systemMessage).toMatch(/^\u26a0/);
    });

    it('should produce valid JSON when stringified', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createContextFile(tempDir);

      const result = await dirtyStateTracker(createMockInput('Write', '/path/to/file.ts'));

      expect(() => JSON.stringify(result)).not.toThrow();

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(parsed.continue).toBe(true);
      expect(parsed.suppressOutput).toBe(true);
    });
  });
});
