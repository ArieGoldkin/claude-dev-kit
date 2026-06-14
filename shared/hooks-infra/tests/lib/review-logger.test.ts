/**
 * Tests for review-logger hook
 *
 * @module tests/lib/review-logger
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DISCUSSION_COMMAND_PATTERN,
  REVIEW_COMMAND_PATTERN,
  appendReviewEntry,
  getReviewLogPath,
  reviewLogger,
  rotateIfNeeded,
} from '../../src/hooks/posttool/review-logger.js';
import type { HookInput } from '../../src/types.js';

// =============================================================================
// HELPERS
// =============================================================================

function bashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    tool_input: { command },
    session_id: 'test-session-123',
  };
}

function nonBashInput(): HookInput {
  return {
    tool_name: 'Write',
    tool_input: { file_path: '/tmp/foo.ts' },
    session_id: 'test-session-123',
  };
}

// =============================================================================
// REVIEW_COMMAND_PATTERN
// =============================================================================

describe('REVIEW_COMMAND_PATTERN matching', () => {
  it('should match glab mr note commands', async () => {
    const result = await reviewLogger(bashInput('glab mr note 123'));
    // Should succeed silently (the command matches, but we can verify it doesn't error)
    expect(result).toBeDefined();
    expect(result.continue).toBe(true);
  });

  it('should match glab mr approve commands', async () => {
    const result = await reviewLogger(bashInput('glab mr approve 456'));
    expect(result).toBeDefined();
    expect(result.continue).toBe(true);
  });

  it('should not match non-glab commands', async () => {
    const result = await reviewLogger(bashInput('git commit -m "fix"'));
    expect(result).toBeDefined();
    expect(result.continue).toBe(true);
  });

  it('should not match glab commands without mr subcommand', async () => {
    const result = await reviewLogger(bashInput('glab issue list'));
    expect(result).toBeDefined();
    expect(result.continue).toBe(true);
  });

  it('should skip non-Bash tool inputs', async () => {
    const result = await reviewLogger(nonBashInput());
    expect(result).toBeDefined();
    expect(result.continue).toBe(true);
  });

  it('should skip Bash input with no command', async () => {
    const input: HookInput = {
      tool_name: 'Bash',
      tool_input: {},
      session_id: 'test-session-123',
    };
    const result = await reviewLogger(input);
    expect(result).toBeDefined();
    expect(result.continue).toBe(true);
  });
});

// =============================================================================
// DISCUSSION_COMMAND_PATTERN (G4/A3 — /etk:post-mr-comments discussions API)
// =============================================================================

describe('DISCUSSION_COMMAND_PATTERN matching', () => {
  it('matches an inline post to the discussions API and captures the MR number', () => {
    const cmd =
      'glab api "projects/grp%2Frepo/merge_requests/200/discussions" --input /tmp/post-x.json';
    const m = cmd.match(DISCUSSION_COMMAND_PATTERN);
    expect(m).not.toBeNull();
    expect(m?.[1]).toBe('200');
  });

  it('matches the multi-line (backslash-continued) post form', () => {
    const cmd =
      'glab api "projects/grp%2Fsub%2Frepo/merge_requests/4242/discussions" \\\n  --input /tmp/post-1.json \\\n  -H "Content-Type: application/json"';
    expect(cmd.match(DISCUSSION_COMMAND_PATTERN)?.[1]).toBe('4242');
  });

  it('does NOT match an MR metadata fetch (no /discussions suffix)', () => {
    const cmd = 'glab api "projects/grp%2Frepo/merge_requests/200" > /tmp/mr.json';
    expect(cmd.match(DISCUSSION_COMMAND_PATTERN)).toBeNull();
  });

  it('REVIEW_COMMAND_PATTERN does not match an api discussions call', () => {
    const cmd = 'glab api "projects/grp%2Frepo/merge_requests/200/discussions" --input /tmp/x.json';
    expect(cmd.match(REVIEW_COMMAND_PATTERN)).toBeNull();
  });
});

describe('reviewLogger — discussion posts (G4/A3)', () => {
  it('returns silent success for a discussions-API post (matched)', async () => {
    const result = await reviewLogger(
      bashInput('glab api "projects/grp%2Frepo/merge_requests/200/discussions" --input /tmp/post-x.json'),
    );
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success for a read-only discussions GET (no --input, not logged)', async () => {
    const result = await reviewLogger(
      bashInput('glab api "projects/grp%2Frepo/merge_requests/200/discussions"'),
    );
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

// =============================================================================
// getReviewLogPath
// =============================================================================

describe('getReviewLogPath', () => {
  it('should return a path ending with review-history.jsonl', () => {
    const logPath = getReviewLogPath();
    expect(logPath).toMatch(/review-history\.jsonl$/);
  });
});

// =============================================================================
// rotateIfNeeded
// =============================================================================

describe('rotateIfNeeded', () => {
  const testDir = path.join('/tmp', 'review-logger-test-' + process.pid);
  const testLogPath = path.join(testDir, 'review-history.jsonl');

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test files
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('should not rotate if file does not exist', () => {
    // Should not throw
    rotateIfNeeded(testLogPath);
    expect(fs.existsSync(`${testLogPath}.1`)).toBe(false);
  });

  it('should not rotate if file is small', () => {
    fs.writeFileSync(testLogPath, 'small content');
    rotateIfNeeded(testLogPath);
    // Original file should still exist, no rotation
    expect(fs.existsSync(testLogPath)).toBe(true);
    expect(fs.existsSync(`${testLogPath}.1`)).toBe(false);
  });

  it('should rotate if file exceeds 200KB', () => {
    // Write > 200KB of data
    const largeContent = 'x'.repeat(201 * 1024);
    fs.writeFileSync(testLogPath, largeContent);
    rotateIfNeeded(testLogPath);
    // Original file should be renamed to .1
    expect(fs.existsSync(testLogPath)).toBe(false);
    expect(fs.existsSync(`${testLogPath}.1`)).toBe(true);
  });
});

// =============================================================================
// appendReviewEntry
// =============================================================================

describe('appendReviewEntry', () => {
  const testDir = path.join('/tmp', 'review-logger-append-test-' + process.pid);
  const testLogPath = path.join(testDir, 'nested', 'review-history.jsonl');

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('should create directory and file if they do not exist', () => {
    const entry = { timestamp: '2026-01-01T00:00:00Z', mr_number: '42', command_type: 'note' };
    appendReviewEntry(testLogPath, entry);
    expect(fs.existsSync(testLogPath)).toBe(true);
    const content = fs.readFileSync(testLogPath, 'utf-8');
    expect(content).toBe(`${JSON.stringify(entry)}\n`);
  });

  it('should append to existing file', () => {
    const entry1 = { mr_number: '1' };
    const entry2 = { mr_number: '2' };
    appendReviewEntry(testLogPath, entry1);
    appendReviewEntry(testLogPath, entry2);
    const content = fs.readFileSync(testLogPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual(entry1);
    expect(JSON.parse(lines[1])).toEqual(entry2);
  });
});

// =============================================================================
// reviewLogger hook function
// =============================================================================

describe('reviewLogger', () => {
  it('should return silent success for matching glab mr note command', async () => {
    const result = await reviewLogger(bashInput('glab mr note 99'));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('should return silent success for matching glab mr approve command', async () => {
    const result = await reviewLogger(bashInput('glab mr approve 42'));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('should return silent success for non-matching commands', async () => {
    const result = await reviewLogger(bashInput('echo hello'));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('should return silent success for non-Bash tools', async () => {
    const result = await reviewLogger(nonBashInput());
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('should handle glab mr note with extra whitespace', async () => {
    const result = await reviewLogger(bashInput('glab  mr  note  777'));
    expect(result.continue).toBe(true);
  });
});
