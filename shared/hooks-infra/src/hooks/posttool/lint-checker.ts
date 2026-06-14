/**
 * Lint Checker PostToolUse Hook
 *
 * Runs ruff on Python files after Write/Edit/MultiEdit operations.
 * Reports lint errors and format issues as a system message so Claude
 * can fix them immediately. Security (bandit S-prefix) violations are
 * highlighted for security awareness.
 *
 * Linter discovery: checks for ruff in project .venv/bin, mise shims,
 * and PATH (in that order). Silently skips if no linter is found.
 *
 * Security: uses execFileSync (no shell) for ruff invocations to
 * prevent command injection via file paths.
 *
 * @module posttool/lint-checker
 */

import { execFileSync, execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { guardWriteEdit, runGuards } from '../lib/guards.js';
import { getFilePath, getToolName } from '../lib/input.js';
import { logDebug, logInfo, logWarn } from '../lib/logging.js';
import { outputSilentSuccess, outputWithNotification } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'lint-checker';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single ruff violation from JSON output (ruff 0.15.0 schema).
 */
export interface RuffViolation {
  code: string;
  message: string;
  filename: string;
  location: {
    row: number;
    column: number;
  };
  end_location: {
    row: number;
    column: number;
  };
  noqa_row: number;
  cell?: number | null;
  fix?: {
    applicability: 'safe' | 'unsafe' | 'display_only';
    message?: string;
    edits?: Array<{
      content: string;
      location: { row: number; column: number };
      end_location: { row: number; column: number };
    }>;
  };
  url?: string;
}

/**
 * Violations partitioned into security (bandit S-prefix) and general.
 */
export interface ClassifiedViolations {
  security: RuffViolation[];
  general: RuffViolation[];
  totalCount: number;
}

/**
 * Combined lint and format check results.
 */
export interface LintResults {
  violations: ClassifiedViolations;
  formatIssueFiles: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * File extensions that trigger lint checking.
 */
const PYTHON_EXTENSIONS = new Set(['.py', '.pyi']);

/**
 * Maximum number of violations to show in the message.
 */
const MAX_VIOLATIONS_SHOWN = 20;

/**
 * Maximum total message length to include in the system message.
 */
const MAX_MESSAGE_LENGTH = 3000;

/**
 * Timeout for linter execution in milliseconds.
 */
const LINTER_TIMEOUT_MS = 5000;

// =============================================================================
// LINTER DISCOVERY
// =============================================================================

/**
 * Cached linter path (null = not yet checked, undefined = not found).
 */
let cachedLinterPath: string | null | undefined = null;

/**
 * Find the ruff linter binary.
 *
 * Search order:
 * 1. Project .venv/bin/ruff (virtualenv)
 * 2. mise shims (~/.local/share/mise/shims/ruff)
 * 3. PATH (which ruff)
 *
 * @param projectDir - The project directory to check for .venv
 * @returns Path to ruff binary, or undefined if not found
 */
export function findLinter(projectDir: string): string | undefined {
  if (cachedLinterPath !== null) {
    return cachedLinterPath ?? undefined;
  }

  // 1. Check project virtualenv
  const venvRuff = path.join(projectDir, '.venv', 'bin', 'ruff');
  if (fs.existsSync(venvRuff)) {
    cachedLinterPath = venvRuff;
    logDebug(HOOK_NAME, `Found ruff in venv: ${venvRuff}`);
    return venvRuff;
  }

  // 2. Check mise shims
  const homeDir = process.env['HOME'] || '/tmp';
  const miseRuff = path.join(homeDir, '.local', 'share', 'mise', 'shims', 'ruff');
  if (fs.existsSync(miseRuff)) {
    cachedLinterPath = miseRuff;
    logDebug(HOOK_NAME, `Found ruff in mise shims: ${miseRuff}`);
    return miseRuff;
  }

  // 3. Check PATH
  try {
    const whichResult = execSync('which ruff 2>/dev/null', {
      timeout: 2000,
      encoding: 'utf8',
    }).trim();
    if (whichResult) {
      cachedLinterPath = whichResult;
      logDebug(HOOK_NAME, `Found ruff in PATH: ${whichResult}`);
      return whichResult;
    }
  } catch {
    // ruff not in PATH
  }

  cachedLinterPath = undefined;
  logDebug(HOOK_NAME, 'ruff not found');
  return undefined;
}

/**
 * Reset cached linter path. Used for testing.
 */
export function resetLinterCache(): void {
  cachedLinterPath = null;
}

// =============================================================================
// LINT EXECUTION
// =============================================================================

/**
 * Run ruff check on files and return structured violations.
 *
 * Uses execFileSync (args array, no shell) to prevent command injection.
 * Batches all files in a single ruff invocation.
 *
 * @param linterPath - Absolute path to the ruff binary
 * @param filePaths - Absolute paths to Python files to check
 * @returns Array of RuffViolation objects, empty if clean or on error
 */
export function runRuffCheck(linterPath: string, filePaths: string[]): RuffViolation[] {
  try {
    execFileSync(linterPath, ['check', '--output-format', 'json', '--no-cache', ...filePaths], {
      timeout: LINTER_TIMEOUT_MS,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Exit code 0 = no lint errors
    return [];
  } catch (err: unknown) {
    const execError = err as { stdout?: string; stderr?: string; status?: number };

    // Exit code 1 = lint errors found, stdout contains JSON
    if (execError.status === 1 && execError.stdout) {
      try {
        const parsed = JSON.parse(execError.stdout);
        if (Array.isArray(parsed)) {
          return parsed as RuffViolation[];
        }
        return [];
      } catch {
        // JSON parse failure (older ruff without --output-format json)
        logWarn(HOOK_NAME, 'Failed to parse ruff JSON output, skipping');
        return [];
      }
    }

    // Exit code 2 = ruff config/invocation error
    if (execError.status === 2) {
      logWarn(HOOK_NAME, `ruff config error: ${execError.stderr || 'unknown'}`);
      return [];
    }

    // Timeout or other unexpected error
    logWarn(HOOK_NAME, `ruff execution error: ${String(err)}`);
    return [];
  }
}

/**
 * Run ruff format --check on files and return files needing formatting.
 *
 * Uses execFileSync (args array, no shell) to prevent command injection.
 *
 * @param linterPath - Absolute path to the ruff binary
 * @param filePaths - Absolute paths to Python files to check
 * @returns Array of file paths that need formatting, empty if all formatted or on error
 */
export function runRuffFormat(linterPath: string, filePaths: string[]): string[] {
  try {
    execFileSync(linterPath, ['format', '--check', ...filePaths], {
      timeout: LINTER_TIMEOUT_MS,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Exit code 0 = all files formatted
    return [];
  } catch (err: unknown) {
    const execError = err as { stdout?: string; status?: number };

    // Exit code 1 = files need formatting, stdout lists them with "Would reformat: " prefix
    if (execError.status === 1 && execError.stdout) {
      const PREFIX = 'Would reformat: ';
      return execError.stdout
        .trim()
        .split('\n')
        .filter((line) => line.startsWith(PREFIX))
        .map((line) => line.slice(PREFIX.length));
    }

    // Any other error = silently skip format check
    return [];
  }
}

// =============================================================================
// CLASSIFICATION
// =============================================================================

/**
 * Partition violations into security (bandit S-prefix) and general.
 *
 * @param violations - Array of ruff violations
 * @returns Classified violations with counts
 */
export function classifyViolations(violations: RuffViolation[]): ClassifiedViolations {
  const security: RuffViolation[] = [];
  const general: RuffViolation[] = [];

  for (const v of violations) {
    if (v.code.startsWith('S')) {
      security.push(v);
    } else {
      general.push(v);
    }
  }

  return { security, general, totalCount: violations.length };
}

// =============================================================================
// MESSAGE FORMATTING
// =============================================================================

/**
 * Format a single violation line.
 */
function formatViolationLine(v: RuffViolation): string {
  const loc = `${path.basename(v.filename)}:${v.location.row}:${v.location.column}`;
  let fixHint = 'no auto-fix';
  if (v.fix) {
    fixHint = v.fix.applicability === 'safe' ? 'safe fix' : 'unsafe fix';
  }
  return `  ${v.code} ${loc} ${v.message} [${fixHint}]`;
}

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

/**
 * Format the security violations section.
 */
function formatSecuritySection(security: RuffViolation[]): string {
  const shown = security.slice(0, 10);
  const lines = shown.map(formatViolationLine);
  let section = `Security lint violations (${security.length}) -- fix immediately:\n${lines.join('\n')}`;
  if (security.length > 10) {
    section += `\n  ... and ${security.length - 10} more security issues`;
  }
  return section;
}

/**
 * Format the general violations section.
 */
function formatGeneralSection(general: RuffViolation[], securityCount: number): string {
  const maxGeneral = Math.max(MAX_VIOLATIONS_SHOWN - securityCount, 0);
  const shown = general.slice(0, maxGeneral);
  const lines = shown.map(formatViolationLine);
  let section = `Lint violations (${general.length}):\n${lines.join('\n')}`;
  if (general.length > maxGeneral) {
    section += `\n  ... and ${general.length - maxGeneral} more`;
  }
  return section;
}

/**
 * Format the formatting issues section.
 */
function formatFormatSection(files: string[]): string {
  const fileLines = files.map(
    (f) => `  ${path.basename(f)} needs formatting (run \`ruff format\`)`
  );
  return `Format issues (${plural(files.length, 'file')}):\n${fileLines.join('\n')}`;
}

/**
 * Build the summary line.
 */
function formatSummaryLine(
  classified: ClassifiedViolations,
  formatIssueFiles: string[],
  fileCount: number
): string {
  const parts: string[] = [];
  if (classified.totalCount > 0) {
    const secNote =
      classified.security.length > 0 ? ` (${classified.security.length} security)` : '';
    parts.push(`${plural(classified.totalCount, 'lint issue')}${secNote}`);
  }
  if (formatIssueFiles.length > 0) {
    parts.push(plural(formatIssueFiles.length, 'formatting issue'));
  }
  return `Total: ${parts.join(', ')} in ${plural(fileCount, 'file')}.`;
}

/**
 * Format the complete lint/format results message.
 *
 * @param results - Combined lint and format results
 * @param fileCount - Number of files checked
 * @returns Formatted message string, empty if nothing to report
 */
export function formatMessage(results: LintResults, fileCount: number): string {
  const { violations, formatIssueFiles } = results;
  const { security, general, totalCount } = violations;

  if (totalCount === 0 && formatIssueFiles.length === 0) {
    return '';
  }

  const sections: string[] = [];

  if (security.length > 0) {
    sections.push(formatSecuritySection(security));
  }
  if (general.length > 0) {
    sections.push(formatGeneralSection(general, security.length));
  }
  if (formatIssueFiles.length > 0) {
    sections.push(formatFormatSection(formatIssueFiles));
  }
  sections.push(formatSummaryLine(violations, formatIssueFiles, fileCount));

  let message = sections.join('\n\n');
  if (message.length > MAX_MESSAGE_LENGTH) {
    message = `${message.slice(0, MAX_MESSAGE_LENGTH)}\n... (truncated)`;
  }

  return message;
}

// =============================================================================
// FILE PATH EXTRACTION FOR MULTIEDIT
// =============================================================================

/**
 * Extract all unique file paths from a MultiEdit tool input.
 *
 * @param input - Hook input
 * @returns Array of unique file paths
 */
function getMultiEditPaths(input: HookInput): string[] {
  const edits = input.tool_input.edits;
  if (!Array.isArray(edits)) {
    return [];
  }

  const paths = new Set<string>();
  for (const edit of edits) {
    if (typeof edit.file_path === 'string' && edit.file_path) {
      paths.add(edit.file_path);
    }
  }
  return Array.from(paths);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Collect Python file paths from hook input based on tool type.
 *
 * @param input - Hook input
 * @param toolName - The tool name (Write, Edit, MultiEdit)
 * @returns Array of Python file paths, empty if none found
 */
function collectPythonFiles(input: HookInput, toolName: string): string[] {
  let filePaths: string[];
  if (toolName === 'MultiEdit') {
    filePaths = getMultiEditPaths(input);
  } else {
    const fp = getFilePath(input);
    filePaths = fp ? [fp] : [];
  }

  return filePaths.filter((fp) => {
    const ext = path.extname(fp).toLowerCase();
    return PYTHON_EXTENSIONS.has(ext);
  });
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Lint checker PostToolUse hook.
 *
 * After Write/Edit/MultiEdit on a Python file, runs ruff check and
 * ruff format --check, then reports issues as a system message.
 * Security (bandit) violations are highlighted for security awareness.
 * Always continues (never blocks) -- lint feedback is advisory so
 * Claude can self-correct.
 *
 * @param input - Hook input from Claude Code
 * @returns HookResult with lint feedback or silent success
 */
export async function lintChecker(input: HookInput): Promise<HookResult> {
  const skipped = runGuards(input, guardWriteEdit);
  if (skipped) return skipped;

  const toolName = getToolName(input);

  const pythonFiles = collectPythonFiles(input, toolName);
  if (pythonFiles.length === 0) {
    return outputSilentSuccess();
  }

  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';
  const linterPath = findLinter(projectDir);
  if (!linterPath) {
    logDebug(HOOK_NAME, 'No linter available, skipping');
    return outputSilentSuccess();
  }

  // Filter to files that exist on disk
  const existingFiles = pythonFiles.filter((fp) => {
    if (!fs.existsSync(fp)) {
      logDebug(HOOK_NAME, `File not found: ${fp}`);
      return false;
    }
    return true;
  });

  if (existingFiles.length === 0) {
    return outputSilentSuccess();
  }

  // Run ruff check and format in batch
  const violations = runRuffCheck(linterPath, existingFiles);
  const formatIssueFiles = runRuffFormat(linterPath, existingFiles);

  const classified = classifyViolations(violations);
  const results: LintResults = { violations: classified, formatIssueFiles };

  const message = formatMessage(results, existingFiles.length);
  if (!message) {
    logDebug(HOOK_NAME, `Lint clean: ${existingFiles.join(', ')}`);
    return outputSilentSuccess();
  }

  logInfo(
    HOOK_NAME,
    `Found ${classified.totalCount} lint issues in ${existingFiles.length} file(s)`
  );

  // Dual-channel: brief summary for user terminal, full details for Claude via additionalContext
  const { totalCount } = classified;
  const secNote = classified.security.length > 0 ? ` (${classified.security.length} security)` : '';
  const fmtNote = formatIssueFiles.length > 0 ? `, ${formatIssueFiles.length} formatting` : '';
  const userSummary = `ruff: ${totalCount} lint issue${totalCount !== 1 ? 's' : ''}${secNote}${fmtNote} in ${existingFiles.length} file${existingFiles.length !== 1 ? 's' : ''} -- fix before continuing`;
  const claudeDetails = `Lint issues found -- please fix before continuing:\n\`\`\`\n${message}\n\`\`\``;

  return outputWithNotification(userSummary, claudeDetails);
}

export default lintChecker;
