/**
 * Tests for continuity library
 *
 * These tests verify that the continuity library correctly:
 * - Checks if continuity structure is initialized
 * - Creates all required directories
 * - Creates default shared-context.json
 * - Creates default ledger template
 * - Finds current ledger path
 * - Finds latest handoff path
 * - Returns correct status information
 *
 * @module tests/lib/continuity
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONTINUITY_DIRS,
  createDefaultLedger,
  createDefaultSharedContext,
  ensureContinuityStructure,
  extractLedgerSummary,
  formatTimestamp,
  getContinuityStatus,
  getCurrentLedgerPath,
  getLatestHandoffPath,
  isContinuityInitialized,
} from '../../src/lib/continuity.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a temporary directory for testing.
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'continuity-test-'));
}

/**
 * Create full continuity directory structure.
 */
function createFullStructure(projectDir: string): void {
  for (const dir of Object.values(CONTINUITY_DIRS)) {
    fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
  }
}

/**
 * Clean up a temporary directory.
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

describe('continuity library', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  // ===========================================================================
  // CONTINUITY_DIRS constant
  // ===========================================================================

  describe('CONTINUITY_DIRS', () => {
    it('should export correct directory paths', () => {
      expect(CONTINUITY_DIRS.base).toBe('.claude/continuity');
      expect(CONTINUITY_DIRS.ledgers).toBe('.claude/continuity/ledgers');
      expect(CONTINUITY_DIRS.handoffs).toBe('.claude/continuity/handoffs');
      expect(CONTINUITY_DIRS.archive).toBe('.claude/continuity/archive');
      expect(CONTINUITY_DIRS.learnings).toBe('.claude/continuity/learnings');
      expect(CONTINUITY_DIRS.context).toBe('.claude/context');
    });
  });

  // ===========================================================================
  // formatTimestamp tests
  // ===========================================================================

  describe('formatTimestamp', () => {
    it('should return ISO8601 format without milliseconds', () => {
      const timestamp = formatTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it('should not include milliseconds', () => {
      const timestamp = formatTimestamp();
      expect(timestamp).not.toMatch(/\.\d{3}Z$/);
    });

    it('should end with Z (UTC timezone)', () => {
      const timestamp = formatTimestamp();
      expect(timestamp.endsWith('Z')).toBe(true);
    });

    it('should be a valid date string', () => {
      const timestamp = formatTimestamp();
      const date = new Date(timestamp);
      expect(date.toString()).not.toBe('Invalid Date');
    });
  });

  // ===========================================================================
  // isContinuityInitialized tests
  // ===========================================================================

  describe('isContinuityInitialized', () => {
    it('should return false for empty directory', () => {
      expect(isContinuityInitialized(tempDir)).toBe(false);
    });

    it('should return false if only base dir exists', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.base), { recursive: true });
      expect(isContinuityInitialized(tempDir)).toBe(false);
    });

    it('should return false if ledgers dir is missing', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.base), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.context), { recursive: true });
      expect(isContinuityInitialized(tempDir)).toBe(false);
    });

    it('should return false if handoffs dir is missing', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.base), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.context), { recursive: true });
      expect(isContinuityInitialized(tempDir)).toBe(false);
    });

    it('should return false if context dir is missing', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.base), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      expect(isContinuityInitialized(tempDir)).toBe(false);
    });

    it('should return true when all required directories exist', () => {
      createFullStructure(tempDir);
      expect(isContinuityInitialized(tempDir)).toBe(true);
    });

    it('should not require archive or learnings dirs', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.base), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.context), { recursive: true });
      // archive and learnings not created
      expect(isContinuityInitialized(tempDir)).toBe(true);
    });
  });

  // ===========================================================================
  // ensureContinuityStructure tests
  // ===========================================================================

  describe('ensureContinuityStructure', () => {
    it('should return "created" for empty directory', () => {
      const result = ensureContinuityStructure(tempDir);
      expect(result).toBe('created');
    });

    it('should create all required directories', () => {
      ensureContinuityStructure(tempDir);

      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.base))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.ledgers))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.handoffs))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.archive))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.learnings))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.context))).toBe(true);
    });

    it('should create .gitkeep files in appropriate directories', () => {
      ensureContinuityStructure(tempDir);

      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.ledgers, '.gitkeep'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.handoffs, '.gitkeep'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.archive, '.gitkeep'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.learnings, '.gitkeep'))).toBe(true);
    });

    it('should create shared-context.json', () => {
      ensureContinuityStructure(tempDir);

      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      expect(fs.existsSync(contextFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.version).toBe('1.0.0');
      expect(content.session_heartbeat).toBeDefined();
      expect(content.dirty_tracking).toBeDefined();
    });

    it('should create default ledger', () => {
      ensureContinuityStructure(tempDir);

      const projectName = path.basename(tempDir);
      const ledgerFile = path.join(
        tempDir,
        CONTINUITY_DIRS.ledgers,
        `CONTINUITY_${projectName}.md`
      );
      expect(fs.existsSync(ledgerFile)).toBe(true);

      const content = fs.readFileSync(ledgerFile, 'utf8');
      expect(content).toContain('# Project Ledger:');
      expect(content).toContain('## Current State');
    });

    it('should return "existed" when all already exists', () => {
      // First call creates
      ensureContinuityStructure(tempDir);

      // Second call should return existed
      const result = ensureContinuityStructure(tempDir);
      expect(result).toBe('existed');
    });

    it('should not overwrite existing shared-context.json', () => {
      ensureContinuityStructure(tempDir);

      // Modify context file
      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      content.custom_field = 'test';
      fs.writeFileSync(contextFile, JSON.stringify(content, null, 2));

      // Re-run ensure
      ensureContinuityStructure(tempDir);

      // Custom field should still exist
      const updatedContent = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(updatedContent.custom_field).toBe('test');
    });

    it('should not create ledger if one already exists', () => {
      ensureContinuityStructure(tempDir);

      // Create a custom ledger
      const customLedger = path.join(tempDir, CONTINUITY_DIRS.ledgers, 'MY_LEDGER.md');
      fs.writeFileSync(customLedger, '# Custom Ledger\n');

      // Remove the auto-created ledger
      const projectName = path.basename(tempDir);
      const defaultLedger = path.join(
        tempDir,
        CONTINUITY_DIRS.ledgers,
        `CONTINUITY_${projectName}.md`
      );
      fs.unlinkSync(defaultLedger);

      // Re-run ensure
      ensureContinuityStructure(tempDir);

      // Default ledger should not be recreated
      expect(fs.existsSync(defaultLedger)).toBe(false);
      expect(fs.existsSync(customLedger)).toBe(true);
    });
  });

  // ===========================================================================
  // createDefaultSharedContext tests
  // ===========================================================================

  describe('createDefaultSharedContext', () => {
    it('should create valid JSON file', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.context), { recursive: true });
      createDefaultSharedContext(tempDir, 'test-project');

      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      expect(() => JSON.parse(fs.readFileSync(contextFile, 'utf8'))).not.toThrow();
    });

    it('should include correct version', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.context), { recursive: true });
      createDefaultSharedContext(tempDir, 'test-project');

      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.version).toBe('1.0.0');
    });

    it('should include session_heartbeat with was_cleanly_ended=true', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.context), { recursive: true });
      createDefaultSharedContext(tempDir, 'test-project');

      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.session_heartbeat.was_cleanly_ended).toBe(true);
    });

    it('should include dirty_tracking with zero count', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.context), { recursive: true });
      createDefaultSharedContext(tempDir, 'test-project');

      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.dirty_tracking.files_edited_count).toBe(0);
      expect(content.dirty_tracking.files_edited_this_session).toEqual([]);
    });

    it('should reference correct ledger path', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.context), { recursive: true });
      createDefaultSharedContext(tempDir, 'my-project');

      const contextFile = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      const content = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(content.continuity.current_ledger).toBe(
        '.claude/continuity/ledgers/CONTINUITY_my-project.md'
      );
    });
  });

  // ===========================================================================
  // createDefaultLedger tests
  // ===========================================================================

  describe('createDefaultLedger', () => {
    it('should create markdown file', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      const ledgerPath = path.join(tempDir, CONTINUITY_DIRS.ledgers, 'CONTINUITY_test.md');
      createDefaultLedger(ledgerPath, 'test');

      expect(fs.existsSync(ledgerPath)).toBe(true);
    });

    it('should include project name in title', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      const ledgerPath = path.join(tempDir, CONTINUITY_DIRS.ledgers, 'CONTINUITY_my-app.md');
      createDefaultLedger(ledgerPath, 'my-app');

      const content = fs.readFileSync(ledgerPath, 'utf8');
      expect(content).toContain('# Project Ledger: my-app');
    });

    it('should include timestamp in header', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      const ledgerPath = path.join(tempDir, CONTINUITY_DIRS.ledgers, 'CONTINUITY_test.md');
      createDefaultLedger(ledgerPath, 'test');

      const content = fs.readFileSync(ledgerPath, 'utf8');
      expect(content).toMatch(/> Last updated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
    });

    it('should include required sections', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      const ledgerPath = path.join(tempDir, CONTINUITY_DIRS.ledgers, 'CONTINUITY_test.md');
      createDefaultLedger(ledgerPath, 'test');

      const content = fs.readFileSync(ledgerPath, 'utf8');
      expect(content).toContain('## Current State');
      expect(content).toContain('### Now');
      expect(content).toContain('### Done (Recent)');
      expect(content).toContain('### Next');
      expect(content).toContain('## Session Activity Log');
      expect(content).toContain('## Key Decisions');
      expect(content).toContain('## Open Questions');
    });
  });

  // ===========================================================================
  // getCurrentLedgerPath tests
  // ===========================================================================

  describe('getCurrentLedgerPath', () => {
    it('should return null for non-existent directory', () => {
      expect(getCurrentLedgerPath(tempDir)).toBeNull();
    });

    it('should return null for empty ledgers directory', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      expect(getCurrentLedgerPath(tempDir)).toBeNull();
    });

    it('should return null if only .gitkeep exists', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.ledgers, '.gitkeep'), '');
      expect(getCurrentLedgerPath(tempDir)).toBeNull();
    });

    it('should find .md file in ledgers directory', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      const ledgerPath = path.join(tempDir, CONTINUITY_DIRS.ledgers, 'CONTINUITY_test.md');
      fs.writeFileSync(ledgerPath, '# Ledger');

      expect(getCurrentLedgerPath(tempDir)).toBe(ledgerPath);
    });

    it('should return first .md file when multiple exist', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.ledgers, 'A_ledger.md'), '# A');
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.ledgers, 'B_ledger.md'), '# B');

      const result = getCurrentLedgerPath(tempDir);
      expect(result).not.toBeNull();
      expect(result).toMatch(/\.md$/);
    });

    it('should return absolute path', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.ledgers, 'test.md'), '# Test');

      const result = getCurrentLedgerPath(tempDir);
      expect(result).not.toBeNull();
      if (result) {
        expect(path.isAbsolute(result)).toBe(true);
      }
    });
  });

  // ===========================================================================
  // getLatestHandoffPath tests
  // ===========================================================================

  describe('getLatestHandoffPath', () => {
    it('should return null for non-existent directory', () => {
      expect(getLatestHandoffPath(tempDir)).toBeNull();
    });

    it('should return null for empty handoffs directory', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      expect(getLatestHandoffPath(tempDir)).toBeNull();
    });

    it('should return null if only .gitkeep exists', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.handoffs, '.gitkeep'), '');
      expect(getLatestHandoffPath(tempDir)).toBeNull();
    });

    it('should find .md file in handoffs directory', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      const handoffPath = path.join(tempDir, CONTINUITY_DIRS.handoffs, 'handoff-2024.md');
      fs.writeFileSync(handoffPath, '# Handoff');

      expect(getLatestHandoffPath(tempDir)).toBe(handoffPath);
    });

    it('should find .yaml file in handoffs directory', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      const handoffPath = path.join(tempDir, CONTINUITY_DIRS.handoffs, 'handoff-2024.yaml');
      fs.writeFileSync(handoffPath, 'session: 1');

      expect(getLatestHandoffPath(tempDir)).toBe(handoffPath);
    });

    it('should return most recently modified file', async () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });

      const olderPath = path.join(tempDir, CONTINUITY_DIRS.handoffs, 'handoff-old.md');
      fs.writeFileSync(olderPath, '# Old');

      // Wait a bit to ensure different mtime
      await new Promise((resolve) => setTimeout(resolve, 100));

      const newerPath = path.join(tempDir, CONTINUITY_DIRS.handoffs, 'handoff-new.md');
      fs.writeFileSync(newerPath, '# New');

      expect(getLatestHandoffPath(tempDir)).toBe(newerPath);
    });

    it('should return absolute path', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.handoffs, 'test.md'), '# Test');

      const result = getLatestHandoffPath(tempDir);
      expect(result).not.toBeNull();
      if (result) {
        expect(path.isAbsolute(result)).toBe(true);
      }
    });
  });

  // ===========================================================================
  // getContinuityStatus tests
  // ===========================================================================

  describe('getContinuityStatus', () => {
    it('should return not initialized for empty directory', () => {
      const status = getContinuityStatus(tempDir);
      expect(status.initialized).toBe(false);
      expect(status.ledgerCount).toBe(0);
      expect(status.handoffCount).toBe(0);
    });

    it('should return initialized after ensureContinuityStructure', () => {
      ensureContinuityStructure(tempDir);
      const status = getContinuityStatus(tempDir);
      expect(status.initialized).toBe(true);
    });

    it('should count ledger files correctly', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.ledgers, 'ledger1.md'), '');
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.ledgers, 'ledger2.md'), '');
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.ledgers, '.gitkeep'), '');

      const status = getContinuityStatus(tempDir);
      expect(status.ledgerCount).toBe(2);
    });

    it('should count handoff files correctly (md and yaml)', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.handoffs, 'h1.md'), '');
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.handoffs, 'h2.yaml'), '');
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.handoffs, '.gitkeep'), '');

      const status = getContinuityStatus(tempDir);
      expect(status.handoffCount).toBe(2);
    });

    it('should not count non-md/yaml files in handoffs', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.handoffs, 'h1.md'), '');
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.handoffs, 'data.json'), '');
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.handoffs, 'notes.txt'), '');

      const status = getContinuityStatus(tempDir);
      expect(status.handoffCount).toBe(1);
    });
  });

  // ===========================================================================
  // extractLedgerSummary tests
  // ===========================================================================

  describe('extractLedgerSummary', () => {
    it('should return null for empty content', () => {
      expect(extractLedgerSummary('')).toBeNull();
      expect(extractLedgerSummary('   ')).toBeNull();
    });

    it('should return null for content without any sections', () => {
      const content = '# Project Ledger\n\nSome text without sections.';
      expect(extractLedgerSummary(content)).toBeNull();
    });

    it('should extract status from Now section', () => {
      const content = `# Ledger

## Current State

### Now
- **Branch**: \`main\`
- **Status**: Working on feature

### Done (Recent)
1. First task

### Next
- Next task
`;
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      expect(summary?.status).toBe('Branch: `main`');
    });

    it('should extract recent from Done (Recent) section - last numbered item', () => {
      const content = `## Current State

### Now
Working on something

### Done (Recent)
1. First task completed
2. Second task completed
3. Most recent work done

### Next
- Future work
`;
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      expect(summary?.recent).toBe('Most recent work done');
    });

    it('should extract next from Next section - first bullet', () => {
      const content = `## Current State

### Now
Current status

### Done (Recent)
1. Something done

### Next
- First next item
- Second next item
- Third next item
`;
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      expect(summary?.next).toBe('First next item');
    });

    it('should handle asterisk bullets in Next section', () => {
      const content = `### Now
Status

### Next
* Star bullet item
`;
      const summary = extractLedgerSummary(content);
      expect(summary?.next).toBe('Star bullet item');
    });

    it('should strip ** markdown from status', () => {
      const content = `### Now
**Branch**: main

### Done (Recent)
1. Done

### Next
- Next
`;
      const summary = extractLedgerSummary(content);
      expect(summary?.status).toBe('Branch: main');
    });

    it('should handle ledger with only Now section', () => {
      const content = `### Now
Currently working on tests
`;
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      expect(summary?.status).toBe('Currently working on tests');
      expect(summary?.recent).toBe('');
      expect(summary?.next).toBe('');
    });

    it('should handle ledger with only Done section', () => {
      const content = `### Done (Recent)
1. Completed the task
`;
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      expect(summary?.status).toBe('');
      expect(summary?.recent).toBe('Completed the task');
      expect(summary?.next).toBe('');
    });

    it('should handle ledger with only Next section', () => {
      const content = `### Next
- Write tests
`;
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      expect(summary?.status).toBe('');
      expect(summary?.recent).toBe('');
      expect(summary?.next).toBe('Write tests');
    });

    it('should stop parsing at ## sections', () => {
      const content = `### Now
Current status

## Session Activity Log
This should not be captured

### Done (Recent)
1. This should also not be captured
`;
      const summary = extractLedgerSummary(content);
      expect(summary?.status).toBe('Current status');
      // Done (Recent) comes after ## so should not be captured
      expect(summary?.recent).toBe('');
    });

    it('should handle real-world ledger content', () => {
      const content = `# Project Ledger: demo-app

> Last updated: 2026-02-02T10:30:00Z
> Session: Development
> Model: Append-Until-Handoff (v2.0)

## Current State

### Now
- **Branch**: \`arie/fix-session-start-stdin-race-condition\`
- **Focus**: Reducing SessionStart output
- **Status**: v1.0.6 - MR !5 pending review

### Done (Recent)
1. Initialized continuity system structure
2. Fixed SessionStart stdin race condition
3. Implemented input normalization

### Next
- Get MR reviewed and merged
- Reduce SessionStart output size
- Update documentation

## Session Activity Log

### 2026-02-02 - Development
- Working on v1.0.7
`;
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      expect(summary?.status).toBe('Branch: `arie/fix-session-start-stdin-race-condition`');
      expect(summary?.recent).toBe('Implemented input normalization');
      expect(summary?.next).toBe('Get MR reviewed and merged');
    });

    it('should handle Done(Recent) without space', () => {
      const content = `### Now
Status

### Done(Recent)
1. No space variant

### Next
- Next item
`;
      const summary = extractLedgerSummary(content);
      expect(summary?.recent).toBe('No space variant');
    });
  });
});
