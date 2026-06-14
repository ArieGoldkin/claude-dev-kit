/**
 * Shared Hooks Infra - Continuity Library
 *
 * TypeScript port of scripts/lib/continuity-init.sh
 * Manages the continuity directory structure for session persistence.
 *
 * Required structure in user's project:
 *   .claude/continuity/          - Session management
 *   .claude/continuity/ledgers/  - Project ledger files
 *   .claude/continuity/handoffs/ - Session handoff files
 *   .claude/continuity/archive/  - Archived content
 *   .claude/continuity/learnings/ - Extracted patterns
 *   .claude/context/             - Shared context for agents
 *
 * @module lib/continuity
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Directory paths relative to project root for the continuity system.
 */
export const CONTINUITY_DIRS = {
  base: '.claude/continuity',
  ledgers: '.claude/continuity/ledgers',
  handoffs: '.claude/continuity/handoffs',
  archive: '.claude/continuity/archive',
  learnings: '.claude/continuity/learnings',
  context: '.claude/context',
} as const;

// =============================================================================
// DIRECTORY INITIALIZATION
// =============================================================================

/**
 * Check if continuity structure is initialized in the project.
 *
 * @param projectDir - The project directory path
 * @returns True if all required directories exist
 *
 * @example
 * ```typescript
 * if (isContinuityInitialized('/path/to/project')) {
 *   console.log('Continuity is ready');
 * }
 * ```
 */
export function isContinuityInitialized(projectDir: string): boolean {
  const baseDir = path.join(projectDir, CONTINUITY_DIRS.base);
  const ledgersDir = path.join(projectDir, CONTINUITY_DIRS.ledgers);
  const handoffsDir = path.join(projectDir, CONTINUITY_DIRS.handoffs);
  const contextDir = path.join(projectDir, CONTINUITY_DIRS.context);

  return (
    fs.existsSync(baseDir) &&
    fs.existsSync(ledgersDir) &&
    fs.existsSync(handoffsDir) &&
    fs.existsSync(contextDir)
  );
}

/**
 * Ensure a single directory exists, creating it if needed.
 *
 * @param dirPath - The directory path to ensure exists
 * @returns True if directory exists or was created successfully
 */
function ensureDirectory(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Get the current timestamp in ISO 8601 format without milliseconds.
 *
 * @returns Timestamp string in format YYYY-MM-DDTHH:mm:ssZ
 */
export function formatTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Create default shared-context.json file.
 *
 * @param projectDir - The project directory path
 * @param projectName - The project name for the ledger reference
 */
export function createDefaultSharedContext(projectDir: string, projectName: string): void {
  const contextFile = path.join(projectDir, CONTINUITY_DIRS.context, 'shared-context.json');
  const timestamp = formatTimestamp();

  const defaultContext = {
    version: '1.0.0',
    timestamp,
    session_id: null,
    mode: 'adaptive',
    agent_decisions: {},
    tasks_completed: [],
    tasks_pending: [],
    codebase_patterns: {
      component_style: 'functional',
      state_management: 'hooks',
      testing_framework: 'vitest',
    },
    architectural_decisions: {},
    retention: {
      current_session: null,
      active_since: null,
      archive_after_days: 30,
      summarize_after_days: 90,
      previous_sessions: [],
    },
    continuity: {
      current_ledger: `.claude/continuity/ledgers/CONTINUITY_${projectName}.md`,
      last_handoff: null,
      last_cleanup: null,
      session_start: null,
      learnings_file: '.claude/continuity/learnings/extracted-patterns.md',
      last_suggestion: {
        timestamp: null,
        command: null,
        reason: null,
      },
    },
    last_activity: null,
    active_agent: null,
    dirty_tracking: {
      files_edited_count: 0,
      last_edit_timestamp: null,
      files_edited_this_session: [],
      threshold_warning: 15,
      threshold_auto_suggest: 25,
    },
    session_heartbeat: {
      last_activity: null,
      session_start: null,
      was_cleanly_ended: true,
    },
  };

  fs.writeFileSync(contextFile, `${JSON.stringify(defaultContext, null, 2)}\n`);
}

/**
 * Create default ledger template.
 *
 * @param ledgerPath - The full path to the ledger file
 * @param projectName - The project name
 */
export function createDefaultLedger(ledgerPath: string, projectName: string): void {
  const timestamp = formatTimestamp();
  const dateStr = timestamp.slice(0, 10);

  const ledgerContent = `# Project Ledger: ${projectName}

> Last updated: ${timestamp}
> Session: Initial Setup
> Model: Append-Until-Handoff (v2.0)

## Current State

### Now
- **Branch**: \`main\`
- **Focus**: Project initialized with continuity system
- **Status**: Ready for development

### Done (Recent)
1. Initialized continuity system structure

### Next
- Begin development work
- Use \`/save-state\` to capture progress
- Use \`/create-handoff\` when ending sessions

## Session Activity Log

### ${dateStr} - Initial Setup
- Continuity system initialized
- Default ledger created

## Key Decisions

_No decisions recorded yet. Use this section to document architectural and design decisions._

## Open Questions

### Blocking
_None_

### Non-blocking
_None_

## Context

### Active Branch
- **Name**: \`main\`
- **Purpose**: Main development branch

---
*Created: ${timestamp}*
*Updated: ${timestamp}*
`;

  fs.writeFileSync(ledgerPath, ledgerContent);
}

/**
 * Create all required continuity directories.
 * Returns true if any directories were created, false if all existed.
 * Throws on error.
 */
function createContinuityDirectories(projectDir: string): boolean {
  let createdAny = false;

  // Create base .claude directory if needed
  const claudeDir = path.join(projectDir, '.claude');
  if (!fs.existsSync(claudeDir)) {
    if (!ensureDirectory(claudeDir)) {
      throw new Error('Failed to create .claude directory');
    }
    createdAny = true;
  }

  // Create all continuity directories
  const directories = [
    CONTINUITY_DIRS.base,
    CONTINUITY_DIRS.ledgers,
    CONTINUITY_DIRS.handoffs,
    CONTINUITY_DIRS.archive,
    CONTINUITY_DIRS.learnings,
    CONTINUITY_DIRS.context,
  ];

  for (const dir of directories) {
    const dirPath = path.join(projectDir, dir);
    if (!fs.existsSync(dirPath)) {
      if (!ensureDirectory(dirPath)) {
        throw new Error(`Failed to create directory: ${dir}`);
      }
      createdAny = true;
    }
  }

  return createdAny;
}

/**
 * Create .gitkeep files in directories that should be tracked by git.
 */
function createGitkeepFiles(projectDir: string): void {
  const gitkeepDirs = [
    CONTINUITY_DIRS.ledgers,
    CONTINUITY_DIRS.handoffs,
    CONTINUITY_DIRS.archive,
    CONTINUITY_DIRS.learnings,
  ];

  for (const dir of gitkeepDirs) {
    const gitkeepPath = path.join(projectDir, dir, '.gitkeep');
    if (!fs.existsSync(gitkeepPath)) {
      try {
        fs.writeFileSync(gitkeepPath, '');
      } catch {
        // Ignore gitkeep errors - non-critical
      }
    }
  }
}

/**
 * Create default ledger if none exists.
 * Returns true if created, false if ledger already exists.
 * Throws on error.
 */
function createLedgerIfNeeded(projectDir: string, projectName: string): boolean {
  const ledgersDir = path.join(projectDir, CONTINUITY_DIRS.ledgers);
  const defaultLedger = path.join(ledgersDir, `CONTINUITY_${projectName}.md`);

  if (fs.existsSync(defaultLedger)) {
    return false;
  }

  // Check if any other ledger exists
  const files = fs.readdirSync(ledgersDir);
  const hasLedger = files.some((f) => f.endsWith('.md') && f !== '.gitkeep');

  if (!hasLedger) {
    createDefaultLedger(defaultLedger, projectName);
    return true;
  }

  return false;
}

/**
 * Ensure all continuity directories exist and create default files if needed.
 *
 * @param projectDir - The project directory path
 * @returns 'existed' if all existed, 'created' if any were created, 'error' on failure
 *
 * @example
 * ```typescript
 * const result = ensureContinuityStructure('/path/to/project');
 * if (result === 'created') {
 *   console.log('Initialized continuity structure');
 * }
 * ```
 */
export function ensureContinuityStructure(projectDir: string): 'existed' | 'created' | 'error' {
  const projectName = path.basename(projectDir);
  let createdAny = false;

  try {
    // Create directories
    if (createContinuityDirectories(projectDir)) {
      createdAny = true;
    }

    // Create .gitkeep files (non-critical, no tracking)
    createGitkeepFiles(projectDir);

    // Create shared-context.json if missing
    const contextFile = path.join(projectDir, CONTINUITY_DIRS.context, 'shared-context.json');
    if (!fs.existsSync(contextFile)) {
      createDefaultSharedContext(projectDir, projectName);
      createdAny = true;
    }

    // Create default ledger if no ledger exists
    if (createLedgerIfNeeded(projectDir, projectName)) {
      createdAny = true;
    }

    return createdAny ? 'created' : 'existed';
  } catch {
    return 'error';
  }
}

// =============================================================================
// PATH RESOLUTION FUNCTIONS
// =============================================================================

/**
 * Get the path to the current ledger file.
 * Returns the first .md file found in the ledgers directory.
 *
 * @param projectDir - The project directory path
 * @returns The absolute path to the ledger file, or null if not found
 *
 * @example
 * ```typescript
 * const ledgerPath = getCurrentLedgerPath('/path/to/project');
 * if (ledgerPath) {
 *   const content = fs.readFileSync(ledgerPath, 'utf8');
 * }
 * ```
 */
export function getCurrentLedgerPath(projectDir: string): string | null {
  const ledgersDir = path.join(projectDir, CONTINUITY_DIRS.ledgers);

  if (!fs.existsSync(ledgersDir)) {
    return null;
  }

  try {
    const files = fs.readdirSync(ledgersDir);
    const ledgerFile = files.find((f) => f.endsWith('.md') && f !== '.gitkeep');

    if (ledgerFile) {
      return path.join(ledgersDir, ledgerFile);
    }
  } catch {
    // Ignore read errors
  }

  return null;
}

/**
 * Get the path to the latest handoff file.
 * Returns the most recently modified .md or .yaml file in the handoffs directory.
 *
 * @param projectDir - The project directory path
 * @returns The absolute path to the handoff file, or null if not found
 *
 * @example
 * ```typescript
 * const handoffPath = getLatestHandoffPath('/path/to/project');
 * if (handoffPath) {
 *   const content = fs.readFileSync(handoffPath, 'utf8');
 * }
 * ```
 */
export function getLatestHandoffPath(projectDir: string): string | null {
  const handoffsDir = path.join(projectDir, CONTINUITY_DIRS.handoffs);

  if (!fs.existsSync(handoffsDir)) {
    return null;
  }

  try {
    const files = fs.readdirSync(handoffsDir);
    const handoffFiles = files
      .filter((f) => (f.endsWith('.md') || f.endsWith('.yaml')) && f !== '.gitkeep')
      .map((f) => ({
        name: f,
        path: path.join(handoffsDir, f),
        mtime: fs.statSync(path.join(handoffsDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    const latestHandoff = handoffFiles[0];
    if (latestHandoff) {
      return latestHandoff.path;
    }
  } catch {
    // Ignore read errors
  }

  return null;
}

// =============================================================================
// LEDGER SUMMARY EXTRACTION
// =============================================================================

/**
 * Summary extracted from the Current State section of a ledger.
 */
export interface LedgerSummary {
  /** First line from "Now" section (branch, status, or focus) */
  status: string;
  /** Last item from "Done (Recent)" section */
  recent: string;
  /** First item from "Next" section */
  next: string;
}

/**
 * Parser state for ledger summary extraction.
 */
interface LedgerParserState {
  status: string;
  recent: string;
  next: string;
  inNow: boolean;
  inDoneRecent: boolean;
  inNext: boolean;
  exitedCurrentState: boolean;
}

/**
 * Detect which section a line header represents.
 */
type SectionType = 'now' | 'doneRecent' | 'next' | 'otherSubsection' | 'exitCurrentState' | null;

/**
 * Detect section type from a trimmed line.
 */
function detectSectionType(trimmed: string, exitedCurrentState: boolean): SectionType {
  // Exit on ## sections (except ## Current State)
  if (trimmed.startsWith('## ') && !trimmed.startsWith('## Current State')) {
    return 'exitCurrentState';
  }

  // Skip section detection if we've exited Current State
  if (exitedCurrentState) {
    return null;
  }

  // Section detection (only within Current State)
  if (trimmed.startsWith('### Now')) {
    return 'now';
  }
  if (trimmed.startsWith('### Done (Recent)') || trimmed.startsWith('### Done(Recent)')) {
    return 'doneRecent';
  }
  if (trimmed.startsWith('### Next')) {
    return 'next';
  }
  // Other ### sections within Current State
  if (trimmed.startsWith('###')) {
    return 'otherSubsection';
  }

  return null;
}

/**
 * Update parser state based on detected section type.
 */
function updateParserStateForSection(state: LedgerParserState, sectionType: SectionType): void {
  switch (sectionType) {
    case 'exitCurrentState':
      state.exitedCurrentState = true;
      state.inNow = false;
      state.inDoneRecent = false;
      state.inNext = false;
      break;
    case 'now':
      state.inNow = true;
      state.inDoneRecent = false;
      state.inNext = false;
      break;
    case 'doneRecent':
      state.inNow = false;
      state.inDoneRecent = true;
      state.inNext = false;
      break;
    case 'next':
      state.inNow = false;
      state.inDoneRecent = false;
      state.inNext = true;
      break;
    case 'otherSubsection':
      state.inNow = false;
      state.inDoneRecent = false;
      state.inNext = false;
      break;
  }
}

/**
 * Strip markdown formatting from a status line.
 */
function cleanStatusLine(line: string): string {
  // Remove leading "- " bullet
  let cleaned = line.replace(/^- /, '');
  // Remove **bold** markers (e.g., "**Branch**:" → "Branch:")
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  return cleaned;
}

/**
 * Extract content from a line based on current parser state.
 */
function extractContentFromLine(state: LedgerParserState, trimmed: string): void {
  if (trimmed.length === 0) {
    return;
  }

  // Extract status from Now section
  if (state.inNow && !state.status) {
    state.status = cleanStatusLine(trimmed);
    return;
  }

  // Extract recent from Done (Recent) section
  if (state.inDoneRecent) {
    const numberedMatch = trimmed.match(/^\d+\.\s*(.+)/);
    if (numberedMatch?.[1]) {
      state.recent = numberedMatch[1];
    }
    return;
  }

  // Extract next from Next section
  if (state.inNext && !state.next) {
    const bulletMatch = trimmed.match(/^[-*]\s*(.+)/);
    if (bulletMatch?.[1]) {
      state.next = bulletMatch[1];
    }
  }
}

/**
 * Extract a summary from the Current State section of a ledger.
 *
 * Parses the ledger markdown to find:
 * - "### Now" → first non-empty line after header
 * - "### Done (Recent)" → last numbered item (most recent work)
 * - "### Next" → first bullet item
 *
 * @param content - The full ledger file content
 * @returns LedgerSummary if extraction succeeds, null if ledger is empty/malformed
 *
 * @example
 * ```typescript
 * const summary = extractLedgerSummary(ledgerContent);
 * if (summary) {
 *   console.log(`Status: ${summary.status}`);
 *   console.log(`Recent: ${summary.recent}`);
 *   console.log(`Next: ${summary.next}`);
 * }
 * ```
 */
export function extractLedgerSummary(content: string): LedgerSummary | null {
  if (!content || content.trim().length === 0) {
    return null;
  }

  const state: LedgerParserState = {
    status: '',
    recent: '',
    next: '',
    inNow: false,
    inDoneRecent: false,
    inNext: false,
    exitedCurrentState: false,
  };

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Check for section headers
    const sectionType = detectSectionType(trimmed, state.exitedCurrentState);
    if (sectionType) {
      updateParserStateForSection(state, sectionType);
      continue;
    }

    // Skip if we've exited Current State
    if (state.exitedCurrentState) {
      continue;
    }

    // Extract content from line
    extractContentFromLine(state, trimmed);
  }

  // Return null if we couldn't extract any meaningful data
  if (!state.status && !state.recent && !state.next) {
    return null;
  }

  return { status: state.status, recent: state.recent, next: state.next };
}

// =============================================================================
// STATUS FUNCTIONS
// =============================================================================

/**
 * Continuity status information.
 */
export interface ContinuityStatus {
  /**
   * Whether continuity is initialized.
   */
  initialized: boolean;

  /**
   * Number of ledger files.
   */
  ledgerCount: number;

  /**
   * Number of handoff files.
   */
  handoffCount: number;
}

/**
 * Get continuity status summary.
 *
 * @param projectDir - The project directory path
 * @returns Status object with initialization state and file counts
 */
export function getContinuityStatus(projectDir: string): ContinuityStatus {
  const initialized = isContinuityInitialized(projectDir);
  let ledgerCount = 0;
  let handoffCount = 0;

  const ledgersDir = path.join(projectDir, CONTINUITY_DIRS.ledgers);
  if (fs.existsSync(ledgersDir)) {
    try {
      const files = fs.readdirSync(ledgersDir);
      ledgerCount = files.filter((f) => f.endsWith('.md') && f !== '.gitkeep').length;
    } catch {
      // Ignore errors
    }
  }

  const handoffsDir = path.join(projectDir, CONTINUITY_DIRS.handoffs);
  if (fs.existsSync(handoffsDir)) {
    try {
      const files = fs.readdirSync(handoffsDir);
      handoffCount = files.filter(
        (f) => (f.endsWith('.md') || f.endsWith('.yaml')) && f !== '.gitkeep'
      ).length;
    } catch {
      // Ignore errors
    }
  }

  return { initialized, ledgerCount, handoffCount };
}
