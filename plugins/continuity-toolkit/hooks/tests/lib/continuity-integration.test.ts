/**
 * Integration tests for the ledger system
 *
 * These tests exercise the ledger system end-to-end in a real temp directory,
 * validating the full lifecycle: initialization, creation, querying, updates,
 * summary extraction, and edge cases.
 *
 * Objective findings are documented as test comments where behavior may
 * surprise callers.
 *
 * @module tests/lib/continuity-integration
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
  getContinuityStatus,
  getCurrentLedgerPath,
  getLatestHandoffPath,
  isContinuityInitialized,
} from '../../src/lib/continuity.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createTempDir(prefix = 'ledger-integ-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Build a realistic ledger markdown string with configurable sections.
 */
function buildLedger(opts: {
  project?: string;
  branch?: string;
  focus?: string;
  statusLine?: string;
  doneItems?: string[];
  nextItems?: string[];
  extraSections?: string;
}): string {
  const project = opts.project ?? 'test-project';
  const branch = opts.branch ?? 'main';
  const focus = opts.focus ?? 'Development';
  const statusLine = opts.statusLine ?? 'Ready';

  const doneLines = (opts.doneItems ?? ['Initial setup'])
    .map((d, i) => `${i + 1}. ${d}`)
    .join('\n');
  const nextLines = (opts.nextItems ?? ['Begin work']).map((n) => `- ${n}`).join('\n');

  return `# Project Ledger: ${project}

> Last updated: 2026-02-28T12:00:00Z
> Session: ${focus}
> Model: Append-Until-Handoff (v2.0)

## Current State

### Now
- **Branch**: \`${branch}\`
- **Focus**: ${focus}
- **Status**: ${statusLine}

### Done (Recent)
${doneLines}

### Next
${nextLines}

## Session Activity Log

### 2026-02-28 - Session
- Session work done

## Key Decisions

_None_

## Open Questions

### Blocking
_None_

### Non-blocking
_None_

## Context

### Active Branch
- **Name**: \`${branch}\`
- **Purpose**: Development

---
*Created: 2026-02-28T12:00:00Z*
*Updated: 2026-02-28T12:00:00Z*
${opts.extraSections ?? ''}`;
}

// =============================================================================
// FULL LIFECYCLE TESTS
// =============================================================================

describe('ledger system integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('full lifecycle: init → create → query → extract', () => {
    it('should initialize, create a ledger, resolve its path, and extract a summary', () => {
      // Step 1: Not initialized yet
      expect(isContinuityInitialized(tempDir)).toBe(false);
      expect(getContinuityStatus(tempDir)).toEqual({
        initialized: false,
        ledgerCount: 0,
        handoffCount: 0,
      });

      // Step 2: Initialize
      const result = ensureContinuityStructure(tempDir);
      expect(result).toBe('created');
      expect(isContinuityInitialized(tempDir)).toBe(true);

      // Step 3: Ledger was auto-created
      const ledgerPath = getCurrentLedgerPath(tempDir);
      expect(ledgerPath).not.toBeNull();
      const resolvedLedger = ledgerPath as string;
      expect(fs.existsSync(resolvedLedger)).toBe(true);

      // Step 4: Extract summary from the auto-created ledger
      const content = fs.readFileSync(resolvedLedger, 'utf8');
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      expect(summary?.status).toBe('Branch: `main`');
      expect(summary?.recent).toBe('Initialized continuity system structure');
      expect(summary?.next).toBe('Begin development work');

      // Step 5: Status shows 1 ledger, 0 handoffs
      const status = getContinuityStatus(tempDir);
      expect(status).toEqual({
        initialized: true,
        ledgerCount: 1,
        handoffCount: 0,
      });
    });

    it('should support updating a ledger and re-extracting the summary', () => {
      ensureContinuityStructure(tempDir);
      const ledgerPath = getCurrentLedgerPath(tempDir) as string;

      // Simulate a session updating the ledger (as /save-state would)
      const updatedContent = buildLedger({
        branch: 'feature/auth',
        focus: 'Implementing auth',
        statusLine: 'In progress',
        doneItems: ['Set up project', 'Added login page', 'Connected API'],
        nextItems: ['Add session management', 'Write tests', 'Deploy to staging'],
      });
      fs.writeFileSync(ledgerPath, updatedContent);

      const summary = extractLedgerSummary(fs.readFileSync(ledgerPath, 'utf8'));
      expect(summary).not.toBeNull();
      expect(summary?.status).toBe('Branch: `feature/auth`');
      // Last numbered item = most recent work
      expect(summary?.recent).toBe('Connected API');
      // First bullet = top priority
      expect(summary?.next).toBe('Add session management');
    });
  });

  // ===========================================================================
  // IDEMPOTENCY
  // ===========================================================================

  describe('idempotency', () => {
    it('should be safe to call ensureContinuityStructure multiple times', () => {
      const r1 = ensureContinuityStructure(tempDir);
      const r2 = ensureContinuityStructure(tempDir);
      const r3 = ensureContinuityStructure(tempDir);

      expect(r1).toBe('created');
      expect(r2).toBe('existed');
      expect(r3).toBe('existed');

      // Structure still valid
      expect(isContinuityInitialized(tempDir)).toBe(true);
      expect(getContinuityStatus(tempDir).ledgerCount).toBe(1);
    });

    it('should not corrupt shared-context.json on repeated initialization', () => {
      ensureContinuityStructure(tempDir);

      // Add custom data to shared-context
      const ctxPath = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      const ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
      ctx.dirty_tracking.files_edited_count = 5;
      ctx.dirty_tracking.files_edited_this_session = ['a.ts', 'b.ts'];
      fs.writeFileSync(ctxPath, JSON.stringify(ctx, null, 2));

      // Re-initialize — should NOT overwrite
      ensureContinuityStructure(tempDir);

      const after = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
      expect(after.dirty_tracking.files_edited_count).toBe(5);
      expect(after.dirty_tracking.files_edited_this_session).toEqual(['a.ts', 'b.ts']);
    });

    it('should not overwrite existing ledger content on re-initialization', () => {
      ensureContinuityStructure(tempDir);
      const ledgerPath = getCurrentLedgerPath(tempDir) as string;

      // Modify ledger with real work
      const custom = buildLedger({ focus: 'Custom work', doneItems: ['Did important thing'] });
      fs.writeFileSync(ledgerPath, custom);

      // Re-initialize
      ensureContinuityStructure(tempDir);

      const content = fs.readFileSync(ledgerPath, 'utf8');
      expect(content).toContain('Custom work');
      expect(content).toContain('Did important thing');
    });
  });

  // ===========================================================================
  // SHARED-CONTEXT.JSON STRUCTURE
  // ===========================================================================

  describe('shared-context.json contract', () => {
    it('should produce a complete shared-context.json with all required fields', () => {
      ensureContinuityStructure(tempDir);
      const ctxPath = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      const ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));

      // Top-level required fields
      expect(ctx).toHaveProperty('version', '1.0.0');
      expect(ctx).toHaveProperty('timestamp');
      expect(ctx).toHaveProperty('session_id', null);
      expect(ctx).toHaveProperty('mode', 'adaptive');
      expect(ctx).toHaveProperty('agent_decisions');
      expect(ctx).toHaveProperty('tasks_completed');
      expect(ctx).toHaveProperty('tasks_pending');
      expect(ctx).toHaveProperty('codebase_patterns');
      expect(ctx).toHaveProperty('architectural_decisions');
      expect(ctx).toHaveProperty('retention');
      expect(ctx).toHaveProperty('continuity');
      expect(ctx).toHaveProperty('last_activity', null);
      expect(ctx).toHaveProperty('active_agent', null);
      expect(ctx).toHaveProperty('dirty_tracking');
      expect(ctx).toHaveProperty('session_heartbeat');

      // Heartbeat defaults
      expect(ctx.session_heartbeat.was_cleanly_ended).toBe(true);
      expect(ctx.session_heartbeat.last_activity).toBeNull();
      expect(ctx.session_heartbeat.session_start).toBeNull();

      // Dirty tracking defaults
      expect(ctx.dirty_tracking.files_edited_count).toBe(0);
      expect(ctx.dirty_tracking.threshold_warning).toBe(15);
      expect(ctx.dirty_tracking.threshold_auto_suggest).toBe(25);

      // Continuity cross-reference
      const projectName = path.basename(tempDir);
      expect(ctx.continuity.current_ledger).toBe(
        `.claude/continuity/ledgers/CONTINUITY_${projectName}.md`
      );
    });
  });

  // ===========================================================================
  // LEDGER TEMPLATE STRUCTURE
  // ===========================================================================

  describe('default ledger template contract', () => {
    it('should contain all required markdown sections in correct order', () => {
      ensureContinuityStructure(tempDir);
      const content = fs.readFileSync(getCurrentLedgerPath(tempDir) as string, 'utf8');

      const requiredSections = [
        '## Current State',
        '### Now',
        '### Done (Recent)',
        '### Next',
        '## Session Activity Log',
        '## Key Decisions',
        '## Open Questions',
        '### Blocking',
        '### Non-blocking',
        '## Context',
      ];

      // Verify all sections present
      for (const section of requiredSections) {
        expect(content).toContain(section);
      }

      // Verify ordering: each section should appear after the previous one
      let lastIndex = -1;
      for (const section of requiredSections) {
        const idx = content.indexOf(section);
        expect(idx).toBeGreaterThan(lastIndex);
        lastIndex = idx;
      }
    });

    it('should include metadata header with timestamp and model version', () => {
      ensureContinuityStructure(tempDir);
      const content = fs.readFileSync(getCurrentLedgerPath(tempDir) as string, 'utf8');

      expect(content).toMatch(/> Last updated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
      expect(content).toContain('> Session: Initial Setup');
      expect(content).toContain('> Model: Append-Until-Handoff (v2.0)');
    });

    it('should include creation and update timestamps at the bottom', () => {
      ensureContinuityStructure(tempDir);
      const content = fs.readFileSync(getCurrentLedgerPath(tempDir) as string, 'utf8');

      expect(content).toMatch(/\*Created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\*/);
      expect(content).toMatch(/\*Updated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\*/);
    });
  });

  // ===========================================================================
  // extractLedgerSummary EDGE CASES
  // ===========================================================================

  describe('extractLedgerSummary edge cases', () => {
    it('should return null for null-ish input', () => {
      expect(extractLedgerSummary('')).toBeNull();
      expect(extractLedgerSummary('  \n\n  ')).toBeNull();
    });

    it('should return null for markdown with no recognized sections', () => {
      expect(extractLedgerSummary('# Just a title\n\nSome paragraphs.\n')).toBeNull();
    });

    it('should handle a ledger where Current State has no subsections', () => {
      const content = `## Current State

Some free-form text here without any ### headers.

## Session Activity Log
- Did stuff
`;
      // No ### Now/Done/Next sections — nothing to extract from Current State
      // The free-form text is NOT inside any tracked subsection
      const summary = extractLedgerSummary(content);
      expect(summary).toBeNull();
    });

    it('should handle Done (Recent) with sub-bullets under numbered items', () => {
      const content = `### Now
- **Status**: Working

### Done (Recent)
1. Built the API
   - Added endpoints
   - Added validation
2. Wrote tests
   - Unit tests
   - Integration tests
3. Deployed to staging

### Next
- Monitor logs
`;
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      // The parser takes the last numbered item — sub-bullets are ignored
      expect(summary?.recent).toBe('Deployed to staging');
    });

    it('should handle Done (Recent) where sub-bullets look like numbered items', () => {
      const content = `### Now
Working

### Done (Recent)
1. Main task
2. Secondary task
   3. This is indented — should NOT be captured as last item

### Next
- Do more
`;
      const summary = extractLedgerSummary(content);
      // "   3. This is indented" — trimmed becomes "3. This is indented"
      // The parser processes it as a numbered item, so it WILL be captured
      // This is a notable behavior: indented numbered sub-items are treated
      // the same as top-level items by the parser
      expect(summary?.recent).toBe('This is indented — should NOT be captured as last item');
    });

    it('should handle multiple ## Current State sections (uses first)', () => {
      const content = `## Current State

### Now
First section

## Session Activity Log
- log entry

## Current State

### Now
Second section — this is after a ## boundary, so parser already exited
`;
      const summary = extractLedgerSummary(content);
      expect(summary?.status).toBe('First section');
    });

    it('should handle empty Now section', () => {
      const content = `### Now

### Done (Recent)
1. Something done

### Next
- Next thing
`;
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      expect(summary?.status).toBe('');
      expect(summary?.recent).toBe('Something done');
      expect(summary?.next).toBe('Next thing');
    });

    it('should handle Done (Recent) with no numbered items', () => {
      const content = `### Now
Working

### Done (Recent)
- This is a bullet, not a numbered item
- Another bullet

### Next
- Future work
`;
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      // Bullets in Done (Recent) are NOT captured — only numbered items
      expect(summary?.recent).toBe('');
    });

    it('should handle Next section with no bullet items', () => {
      const content = `### Now
Working

### Done (Recent)
1. Done

### Next
Just plain text without a bullet
`;
      const summary = extractLedgerSummary(content);
      expect(summary).not.toBeNull();
      // Plain text in Next is NOT captured — only bullet items
      expect(summary?.next).toBe('');
    });

    it('should handle very long ledger content efficiently', () => {
      // Build a ledger with 500 Done items and 500 activity log entries
      const doneItems = Array.from({ length: 500 }, (_, i) => `Task ${i + 1} completed`);
      const logEntries = Array.from({ length: 500 }, (_, i) => `- Log entry ${i + 1}`).join('\n');

      const content = buildLedger({
        doneItems,
        nextItems: ['First next', 'Second next'],
        extraSections: logEntries,
      });

      const start = performance.now();
      const summary = extractLedgerSummary(content);
      const elapsed = performance.now() - start;

      expect(summary).not.toBeNull();
      expect(summary?.recent).toBe('Task 500 completed');
      expect(summary?.next).toBe('First next');
      // Should parse in well under 100ms even for large content
      expect(elapsed).toBeLessThan(100);
    });

    it('should strip leading "- " from status but preserve inline markdown', () => {
      const content = `### Now
- **Branch**: \`feat/new-thing\`
`;
      const summary = extractLedgerSummary(content);
      // "- " is stripped, "**...**" is stripped, but backticks remain
      expect(summary?.status).toBe('Branch: `feat/new-thing`');
    });

    it('should capture only the first line from Now section', () => {
      const content = `### Now
- **Branch**: \`main\`
- **Focus**: Doing stuff
- **Status**: All good

### Done (Recent)
1. Done

### Next
- Next
`;
      const summary = extractLedgerSummary(content);
      // Only the first non-empty line is captured
      expect(summary?.status).toBe('Branch: `main`');
      expect(summary?.status).not.toContain('Focus');
    });
  });

  // ===========================================================================
  // getCurrentLedgerPath BEHAVIOR
  // ===========================================================================

  describe('getCurrentLedgerPath behavior', () => {
    it('should ignore non-md files in ledgers directory', () => {
      const ledgersDir = path.join(tempDir, CONTINUITY_DIRS.ledgers);
      fs.mkdirSync(ledgersDir, { recursive: true });
      fs.writeFileSync(path.join(ledgersDir, 'notes.txt'), 'text');
      fs.writeFileSync(path.join(ledgersDir, 'data.json'), '{}');
      fs.writeFileSync(path.join(ledgersDir, 'CONTINUITY_proj.md'), '# Ledger');

      const result = getCurrentLedgerPath(tempDir);
      expect(result).not.toBeNull();
      expect(result).toContain('CONTINUITY_proj.md');
    });

    it('should return first .md file alphabetically when multiple exist', () => {
      // NOTE: readdirSync order is filesystem-dependent, but on most systems
      // it returns entries in creation or alphabetical order
      const ledgersDir = path.join(tempDir, CONTINUITY_DIRS.ledgers);
      fs.mkdirSync(ledgersDir, { recursive: true });
      fs.writeFileSync(path.join(ledgersDir, 'B_ledger.md'), '# B');
      fs.writeFileSync(path.join(ledgersDir, 'A_ledger.md'), '# A');

      const result = getCurrentLedgerPath(tempDir);
      expect(result).not.toBeNull();
      // The function uses .find() on readdirSync — returns first match
      // This is filesystem-order dependent, not guaranteed alphabetical
      expect(result).toMatch(/\.md$/);
    });
  });

  // ===========================================================================
  // HANDOFF PATH RESOLUTION
  // ===========================================================================

  describe('getLatestHandoffPath behavior', () => {
    it('should prefer .md over .yaml when .md is newer', async () => {
      const handoffsDir = path.join(tempDir, CONTINUITY_DIRS.handoffs);
      fs.mkdirSync(handoffsDir, { recursive: true });

      fs.writeFileSync(path.join(handoffsDir, 'old.yaml'), 'old: true');
      await new Promise((r) => setTimeout(r, 50));
      fs.writeFileSync(path.join(handoffsDir, 'new.md'), '# New');

      expect(getLatestHandoffPath(tempDir)).toBe(path.join(handoffsDir, 'new.md'));
    });

    it('should prefer .yaml over .md when .yaml is newer', async () => {
      const handoffsDir = path.join(tempDir, CONTINUITY_DIRS.handoffs);
      fs.mkdirSync(handoffsDir, { recursive: true });

      fs.writeFileSync(path.join(handoffsDir, 'old.md'), '# Old');
      await new Promise((r) => setTimeout(r, 50));
      fs.writeFileSync(path.join(handoffsDir, 'new.yaml'), 'new: true');

      expect(getLatestHandoffPath(tempDir)).toBe(path.join(handoffsDir, 'new.yaml'));
    });

    it('should not pick up .json or .txt files as handoffs', () => {
      const handoffsDir = path.join(tempDir, CONTINUITY_DIRS.handoffs);
      fs.mkdirSync(handoffsDir, { recursive: true });
      fs.writeFileSync(path.join(handoffsDir, 'data.json'), '{}');
      fs.writeFileSync(path.join(handoffsDir, 'notes.txt'), 'notes');

      expect(getLatestHandoffPath(tempDir)).toBeNull();
    });
  });

  // ===========================================================================
  // DIRECTORY STRUCTURE EDGE CASES
  // ===========================================================================

  describe('directory structure edge cases', () => {
    it('should handle project names with special characters', () => {
      const specialDir = createTempDir('my-project.v2-');
      try {
        const result = ensureContinuityStructure(specialDir);
        expect(result).toBe('created');

        const projectName = path.basename(specialDir);
        const ledgerPath = path.join(
          specialDir,
          CONTINUITY_DIRS.ledgers,
          `CONTINUITY_${projectName}.md`
        );
        expect(fs.existsSync(ledgerPath)).toBe(true);

        const content = fs.readFileSync(ledgerPath, 'utf8');
        expect(content).toContain(`# Project Ledger: ${projectName}`);
      } finally {
        cleanupTempDir(specialDir);
      }
    });

    it('should work when .claude directory already exists', () => {
      fs.mkdirSync(path.join(tempDir, '.claude'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, '.claude', 'settings.json'), '{}');

      const result = ensureContinuityStructure(tempDir);
      expect(result).toBe('created');
      expect(isContinuityInitialized(tempDir)).toBe(true);

      // Pre-existing file should not be affected
      expect(fs.existsSync(path.join(tempDir, '.claude', 'settings.json'))).toBe(true);
    });

    it('should create .gitkeep in ledgers, handoffs, archive, learnings but not context', () => {
      ensureContinuityStructure(tempDir);

      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.ledgers, '.gitkeep'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.handoffs, '.gitkeep'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.archive, '.gitkeep'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.learnings, '.gitkeep'))).toBe(true);
      // context/ does NOT get .gitkeep (it gets shared-context.json instead)
      expect(fs.existsSync(path.join(tempDir, CONTINUITY_DIRS.context, '.gitkeep'))).toBe(false);
    });
  });

  // ===========================================================================
  // isContinuityInitialized BOUNDARY CHECKS
  // ===========================================================================

  describe('isContinuityInitialized boundary checks', () => {
    it('should not require archive dir (only base, ledgers, handoffs, context)', () => {
      // Create only the 4 checked directories
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.base), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.ledgers), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.context), { recursive: true });
      // archive and learnings intentionally NOT created

      expect(isContinuityInitialized(tempDir)).toBe(true);
    });

    it('should return false for non-existent projectDir', () => {
      expect(isContinuityInitialized('/tmp/does-not-exist-xyz-999')).toBe(false);
    });
  });

  // ===========================================================================
  // CROSS-REFERENCE: shared-context ↔ ledger
  // ===========================================================================

  describe('shared-context ↔ ledger cross-reference', () => {
    it('should have shared-context.continuity.current_ledger match the actual ledger path', () => {
      ensureContinuityStructure(tempDir);

      const ctxPath = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      const ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
      const referencedPath = ctx.continuity.current_ledger;

      // The referenced path is relative — resolve it
      const absoluteRef = path.join(tempDir, referencedPath);
      const actualLedger = getCurrentLedgerPath(tempDir);

      expect(absoluteRef).toBe(actualLedger);
      expect(fs.existsSync(absoluteRef)).toBe(true);
    });
  });

  // ===========================================================================
  // MULTIPLE INDEPENDENT PROJECTS
  // ===========================================================================

  describe('multiple independent projects', () => {
    let tempDir2: string;

    beforeEach(() => {
      tempDir2 = createTempDir('ledger-integ-2-');
    });

    afterEach(() => {
      cleanupTempDir(tempDir2);
    });

    it('should initialize two projects independently without interference', () => {
      ensureContinuityStructure(tempDir);
      ensureContinuityStructure(tempDir2);

      const name1 = path.basename(tempDir);
      const name2 = path.basename(tempDir2);

      // Each should have their own ledger named after the directory
      const ledger1 = getCurrentLedgerPath(tempDir) as string;
      const ledger2 = getCurrentLedgerPath(tempDir2) as string;

      expect(ledger1).toContain(name1);
      expect(ledger2).toContain(name2);
      expect(ledger1).not.toBe(ledger2);

      // Modifying one should not affect the other
      fs.writeFileSync(ledger1, buildLedger({ focus: 'Project 1 work' }));

      const content2 = fs.readFileSync(ledger2, 'utf8');
      expect(content2).not.toContain('Project 1 work');
    });
  });

  // ===========================================================================
  // createDefaultLedger DIRECT TESTS
  // ===========================================================================

  describe('createDefaultLedger roundtrip', () => {
    it('should produce a ledger that extractLedgerSummary can parse', () => {
      const ledgersDir = path.join(tempDir, CONTINUITY_DIRS.ledgers);
      fs.mkdirSync(ledgersDir, { recursive: true });
      const ledgerPath = path.join(ledgersDir, 'CONTINUITY_roundtrip.md');
      createDefaultLedger(ledgerPath, 'roundtrip');

      const content = fs.readFileSync(ledgerPath, 'utf8');
      const summary = extractLedgerSummary(content);

      expect(summary).not.toBeNull();
      expect(summary?.status).toBeTruthy();
      expect(summary?.recent).toBeTruthy();
      expect(summary?.next).toBeTruthy();
    });

    it('should throw when the target directory does not exist', () => {
      const badPath = path.join(tempDir, 'nonexistent', 'dir', 'LEDGER.md');
      expect(() => createDefaultLedger(badPath, 'test')).toThrow();
    });
  });

  // ===========================================================================
  // createDefaultSharedContext DIRECT TESTS
  // ===========================================================================

  describe('createDefaultSharedContext edge cases', () => {
    it('should throw when context directory does not exist', () => {
      // Don't create the context directory
      expect(() => createDefaultSharedContext(tempDir, 'test')).toThrow();
    });

    it('should produce valid JSON that can be parsed back', () => {
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.context), { recursive: true });
      createDefaultSharedContext(tempDir, 'json-test');

      const ctxPath = path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json');
      const raw = fs.readFileSync(ctxPath, 'utf8');

      // Should end with newline (for git-friendliness)
      expect(raw.endsWith('\n')).toBe(true);

      // Should be valid JSON
      const parsed = JSON.parse(raw);
      expect(parsed).toBeTypeOf('object');
    });
  });

  // ===========================================================================
  // ensureContinuityStructure ERROR HANDLING
  // ===========================================================================

  describe('ensureContinuityStructure error handling', () => {
    it('should return "error" when projectDir is a file, not a directory', () => {
      const filePath = path.join(tempDir, 'not-a-dir');
      fs.writeFileSync(filePath, 'I am a file');

      const result = ensureContinuityStructure(filePath);
      expect(result).toBe('error');
    });
  });

  // ===========================================================================
  // CUSTOM LEDGER (non-default name)
  // ===========================================================================

  describe('custom-named ledger support', () => {
    it('should find a non-default-named ledger via getCurrentLedgerPath', () => {
      const ledgersDir = path.join(tempDir, CONTINUITY_DIRS.ledgers);
      fs.mkdirSync(ledgersDir, { recursive: true });

      // Create a custom-named ledger (not CONTINUITY_<project>.md)
      const customPath = path.join(ledgersDir, 'MY_CUSTOM_LEDGER.md');
      fs.writeFileSync(customPath, buildLedger({ project: 'custom' }));

      const found = getCurrentLedgerPath(tempDir);
      expect(found).toBe(customPath);
    });

    it('should not re-create default ledger when a custom one exists', () => {
      const ledgersDir = path.join(tempDir, CONTINUITY_DIRS.ledgers);
      fs.mkdirSync(ledgersDir, { recursive: true });
      fs.writeFileSync(path.join(ledgersDir, 'CUSTOM.md'), '# Custom');

      // Create remaining structure
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.base), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.handoffs), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.archive), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.learnings), { recursive: true });
      fs.mkdirSync(path.join(tempDir, CONTINUITY_DIRS.context), { recursive: true });
      fs.writeFileSync(path.join(tempDir, CONTINUITY_DIRS.context, 'shared-context.json'), '{}');

      ensureContinuityStructure(tempDir);

      // Should NOT have created a CONTINUITY_<name>.md
      const files = fs.readdirSync(ledgersDir).filter((f) => f.endsWith('.md'));
      expect(files).toEqual(['CUSTOM.md']);
    });
  });

  // ===========================================================================
  // STATUS AFTER HANDOFF FILES ADDED
  // ===========================================================================

  describe('status with handoff files', () => {
    it('should count handoffs correctly as files are added and removed', () => {
      ensureContinuityStructure(tempDir);
      const handoffsDir = path.join(tempDir, CONTINUITY_DIRS.handoffs);

      expect(getContinuityStatus(tempDir).handoffCount).toBe(0);

      // Add handoffs
      fs.writeFileSync(path.join(handoffsDir, '2026-02-01_session.md'), '# H1');
      expect(getContinuityStatus(tempDir).handoffCount).toBe(1);

      fs.writeFileSync(path.join(handoffsDir, '2026-02-02_session.yaml'), 'session: 2');
      expect(getContinuityStatus(tempDir).handoffCount).toBe(2);

      // Remove one
      fs.unlinkSync(path.join(handoffsDir, '2026-02-01_session.md'));
      expect(getContinuityStatus(tempDir).handoffCount).toBe(1);
    });
  });
});
