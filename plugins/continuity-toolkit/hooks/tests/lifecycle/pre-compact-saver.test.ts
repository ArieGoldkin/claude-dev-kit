/**
 * Tests for pre-compact-saver hook
 *
 * @module tests/lifecycle/pre-compact-saver
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCurrentLedgerPath } from '../../src/lib/continuity.js';
import { formatTimestamp, preCompactSaver } from '../../src/lifecycle/pre-compact-saver.js';
import type { HookInput } from '../../src/types.js';

function createMockInput(): HookInput {
  return { tool_name: 'Read', tool_input: {} };
}

function createTempProjectDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-compact-test-'));
  const ledgerDir = path.join(tempDir, '.claude', 'continuity', 'ledgers');
  fs.mkdirSync(ledgerDir, { recursive: true });
  return tempDir;
}

function createLedgerFile(projectDir: string, content = '# Test Ledger\n'): string {
  const basename = path.basename(projectDir);
  const ledgerDir = path.join(projectDir, '.claude', 'continuity', 'ledgers');
  const ledgerPath = path.join(ledgerDir, `CONTINUITY_${basename}.md`);
  fs.writeFileSync(ledgerPath, content);
  return ledgerPath;
}

function cleanupTempDir(tempDir: string): void {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

describe('pre-compact-saver', () => {
  const originalEnv = { ...process.env };
  let tempDir: string | null = null;

  beforeEach(() => {
    delete process.env['CLAUDE_PROJECT_DIR'];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (tempDir) {
      cleanupTempDir(tempDir);
      tempDir = null;
    }
  });

  describe('formatTimestamp', () => {
    it('should return ISO8601 format without milliseconds', () => {
      expect(formatTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it('should not include milliseconds', () => {
      expect(formatTimestamp()).not.toMatch(/\.\d{3}Z$/);
    });

    it('should end with Z (UTC timezone)', () => {
      expect(formatTimestamp().endsWith('Z')).toBe(true);
    });

    it('should be a valid date string', () => {
      const date = new Date(formatTimestamp());
      expect(date.toString()).not.toBe('Invalid Date');
    });

    it('should return current time (within tolerance)', () => {
      const before = new Date();
      const timestamp = formatTimestamp();
      const after = new Date();
      const parsed = new Date(timestamp);
      expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });
  });

  describe('when CLAUDE_PROJECT_DIR is not set', () => {
    it('should return warning result', async () => {
      delete process.env['CLAUDE_PROJECT_DIR'];
      const result = await preCompactSaver(createMockInput());
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Project directory not set');
    });

    it('should include warning symbol', async () => {
      delete process.env['CLAUDE_PROJECT_DIR'];
      const result = await preCompactSaver(createMockInput());
      expect(result.systemMessage).toMatch(/^\u26a0/);
    });

    it('should continue (not block)', async () => {
      delete process.env['CLAUDE_PROJECT_DIR'];
      const result = await preCompactSaver(createMockInput());
      expect(result.continue).toBe(true);
    });
  });

  describe('when ledger does not exist', () => {
    it('should return warning result', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      const result = await preCompactSaver(createMockInput());
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Ledger not found');
    });

    it('should continue (not block)', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      const result = await preCompactSaver(createMockInput());
      expect(result.continue).toBe(true);
    });
  });

  describe('when ledger is not writable', () => {
    const isRunningAsRoot = () => process.getuid?.() === 0;

    it('should return warning result', async () => {
      if (isRunningAsRoot()) return;
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      const ledgerPath = createLedgerFile(tempDir);
      fs.chmodSync(ledgerPath, 0o444);
      const result = await preCompactSaver(createMockInput());
      fs.chmodSync(ledgerPath, 0o644);
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('Ledger not writable');
    });

    it('should continue (not block)', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      const ledgerPath = createLedgerFile(tempDir);
      fs.chmodSync(ledgerPath, 0o444);
      const result = await preCompactSaver(createMockInput());
      fs.chmodSync(ledgerPath, 0o644);
      expect(result.continue).toBe(true);
    });
  });

  describe('when ledger exists and is writable', () => {
    it('should return success result', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      createLedgerFile(tempDir);
      const result = await preCompactSaver(createMockInput());
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBe('State preserved in ledger before compaction');
    });

    it('should append marker to ledger file', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      const initialContent = '# Test Ledger\n\nSome content here.\n';
      const ledgerPath = createLedgerFile(tempDir, initialContent);
      await preCompactSaver(createMockInput());
      const content = fs.readFileSync(ledgerPath, 'utf8');
      expect(content).toContain(initialContent);
      expect(content).toContain('---');
      expect(content).toContain('**Auto-saved before compaction**:');
    });

    it('should include timestamp in marker', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      createLedgerFile(tempDir);
      await preCompactSaver(createMockInput());
      const ledgerPath = getCurrentLedgerPath(tempDir) as string;
      const content = fs.readFileSync(ledgerPath, 'utf8');
      expect(content).toMatch(
        /\*\*Auto-saved before compaction\*\*: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/
      );
    });

    it('should preserve existing ledger content', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      const existingContent = '# Project Ledger\n\n## Session 1\n- Did some work\n';
      const ledgerPath = createLedgerFile(tempDir, existingContent);
      await preCompactSaver(createMockInput());
      const content = fs.readFileSync(ledgerPath, 'utf8');
      expect(content.startsWith(existingContent)).toBe(true);
    });

    it('should append multiple markers on multiple calls', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      createLedgerFile(tempDir);
      await preCompactSaver(createMockInput());
      await preCompactSaver(createMockInput());
      await preCompactSaver(createMockInput());
      const ledgerPath = getCurrentLedgerPath(tempDir) as string;
      const content = fs.readFileSync(ledgerPath, 'utf8');
      const markerMatches = content.match(/\*\*Auto-saved before compaction\*\*/g);
      expect(markerMatches).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty ledger file', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      createLedgerFile(tempDir, '');
      const result = await preCompactSaver(createMockInput());
      expect(result.continue).toBe(true);
      const ledgerPath = getCurrentLedgerPath(tempDir) as string;
      const content = fs.readFileSync(ledgerPath, 'utf8');
      expect(content).toContain('**Auto-saved before compaction**');
    });

    it('should handle project dir with spaces', async () => {
      const baseTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-compact test with spaces-'));
      tempDir = baseTempDir;
      const ledgerDir = path.join(baseTempDir, '.claude', 'continuity', 'ledgers');
      fs.mkdirSync(ledgerDir, { recursive: true });
      process.env['CLAUDE_PROJECT_DIR'] = baseTempDir;
      createLedgerFile(baseTempDir);
      const result = await preCompactSaver(createMockInput());
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBe('State preserved in ledger before compaction');
    });
  });

  describe('HookResult structure', () => {
    it('should have correct structure for success', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      createLedgerFile(tempDir);
      const result = await preCompactSaver(createMockInput());
      expect(result).toEqual({
        continue: true,
        systemMessage: 'State preserved in ledger before compaction',
      });
    });

    it('should have correct structure for warning', async () => {
      delete process.env['CLAUDE_PROJECT_DIR'];
      const result = await preCompactSaver(createMockInput());
      expect(result).toHaveProperty('continue', true);
      expect(result.systemMessage).toMatch(/^\u26a0/);
    });

    it('should produce valid JSON when stringified', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;
      createLedgerFile(tempDir);
      const result = await preCompactSaver(createMockInput());
      expect(() => JSON.stringify(result)).not.toThrow();
      const parsed = JSON.parse(JSON.stringify(result));
      expect(parsed.continue).toBe(true);
    });
  });
});
