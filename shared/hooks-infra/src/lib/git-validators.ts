/**
 * Git Validators Library
 *
 * Provides validation logic for git branch names and commit messages.
 * Enforces conventional commit patterns and branch naming conventions.
 *
 * @module lib/git-validators
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logDebug, logError } from './logging.js';

const HOOK_NAME = 'git-validators';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of a validation check.
 */
export interface ValidationResult {
  /**
   * Whether the validation passed.
   */
  valid: boolean;

  /**
   * Error message if validation failed.
   */
  error?: string;

  /**
   * Suggestion for fixing the issue.
   */
  suggestion?: string;
}

// =============================================================================
// BRANCH NAME PATTERNS
// =============================================================================

/**
 * Valid branch name patterns.
 * - NAPP-\d{4,}-[\w-]+ : Jira ticket branches (e.g., NAPP-1234-feature-name)
 * - feature/.+ : Feature branches
 * - fix/.+ : Bug fix branches
 * - chore/.+ : Chore branches
 * - docs/.+ : Documentation branches
 * - refactor/.+ : Refactoring branches
 * - test/.+ : Test branches
 * - hotfix/.+ : Hotfix branches
 * - release/.+ : Release branches
 */
const VALID_BRANCH_PATTERNS: ReadonlyArray<RegExp> = [
  /^NAPP-\d{4,}-[\w-]+$/i, // Jira ticket format
  /^[A-Z]+-\d+-[\w-]+$/i, // Generic JIRA format
  /^feature\/.+$/,
  /^fix\/.+$/,
  /^bugfix\/.+$/,
  /^chore\/.+$/,
  /^docs\/.+$/,
  /^refactor\/.+$/,
  /^test\/.+$/,
  /^hotfix\/.+$/,
  /^release\/.+$/,
  /^dev\/.+$/i, // Developer prefixed branches
];

/**
 * Branches that are always valid (special cases).
 */
const ALWAYS_VALID_BRANCHES: ReadonlySet<string> = new Set([
  'main',
  'master',
  'develop',
  'dev',
  'HEAD',
]);

// =============================================================================
// BRANCH PATTERNS CONFIG (configurable via .claude/rules/branch-patterns.json)
// =============================================================================

/**
 * Configuration file structure for branch patterns.
 */
export interface BranchPatternsConfig {
  /**
   * Additional glob-like patterns to allow (e.g., "john/*", "team-a/*").
   * Use * as a wildcard for one or more characters.
   */
  additional_patterns?: string[];
}

/**
 * Cache for loaded branch patterns.
 * Key is the project directory.
 */
const branchPatternsCache: Map<string, BranchPatternsConfig> = new Map();

/**
 * Clear the branch patterns cache.
 * Useful for testing or when the patterns file changes.
 */
export function clearBranchPatternsCache(): void {
  branchPatternsCache.clear();
  logDebug(HOOK_NAME, 'Branch patterns cache cleared');
}

/**
 * Get the path to the branch patterns config file.
 *
 * @param projectDir - The project directory
 * @returns Path to the branch-patterns.json file
 */
export function getBranchPatternsPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'rules', 'branch-patterns.json');
}

/**
 * Convert a glob-like pattern string to a RegExp.
 * Supports * as a wildcard (matches one or more characters).
 *
 * @param pattern - Glob-like pattern, e.g. "john/*"
 * @returns RegExp matching the pattern
 */
// Maximum length of a single branch pattern. Inputs come from
// .claude/rules/ (dev-controlled, project-local) but a pathological
// `***...***` would expand into a long `.+.+.+...` chain after the
// substitution below and cause catastrophic backtracking on certain
// branch names. 256 chars is well above any realistic branch pattern
// (longest real-world examples are ~80 chars) while bounding the
// post-substitution regex length.
const MAX_BRANCH_PATTERN_LENGTH = 256;

function patternStringToRegex(pattern: string): RegExp {
  if (pattern.length > MAX_BRANCH_PATTERN_LENGTH) {
    throw new Error(
      `Branch pattern exceeds ${MAX_BRANCH_PATTERN_LENGTH} chars (got ${pattern.length}); shorten the pattern or split it into multiple entries.`
    );
  }
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regexStr = escaped.replace(/\*/g, '.+');
  // nosemgrep: javascript.lang.security.audit.non-literal-regexp
  // regexStr is built from a length-capped, escape-sanitized,
  // dev-controlled glob pattern. The only un-escaped wildcard is `*`
  // → `.+`, applied to the already-escaped string. Safe.
  return new RegExp(`^${regexStr}$`);
}

/**
 * Load additional branch patterns from the project's .claude/rules directory.
 *
 * File format: { "additional_patterns": ["john/*", "team-a/*"] }
 *
 * Returns cached config if available. If the file doesn't exist or
 * is invalid, returns null without throwing.
 *
 * @param projectDir - The project directory (defaults to CLAUDE_PROJECT_DIR or '.')
 * @returns BranchPatternsConfig or null if not found/invalid
 */
export function loadBranchPatterns(projectDir?: string): BranchPatternsConfig | null {
  const cwd = projectDir || process.env['CLAUDE_PROJECT_DIR'] || '.';

  // Check cache
  if (branchPatternsCache.has(cwd)) {
    logDebug(HOOK_NAME, 'Using cached branch patterns');
    return branchPatternsCache.get(cwd) || null;
  }

  const patternsPath = getBranchPatternsPath(cwd);

  if (!fs.existsSync(patternsPath)) {
    logDebug(HOOK_NAME, `Branch patterns file not found: ${patternsPath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(patternsPath, 'utf-8');
    const config = JSON.parse(content) as BranchPatternsConfig;

    branchPatternsCache.set(cwd, config);
    logDebug(
      HOOK_NAME,
      `Loaded ${config.additional_patterns?.length ?? 0} additional branch patterns`
    );

    return config;
  } catch (error) {
    logError(HOOK_NAME, `Failed to load branch patterns: ${error}`);
    return null;
  }
}

// =============================================================================
// COMMIT MESSAGE PATTERNS
// =============================================================================

/**
 * Conventional commit type prefixes.
 */
const COMMIT_TYPES: ReadonlyArray<string> = [
  'feat', // New feature
  'fix', // Bug fix
  'docs', // Documentation
  'style', // Formatting, no code change
  'refactor', // Code change without feature/fix
  'perf', // Performance improvement
  'test', // Adding tests
  'build', // Build system changes
  'ci', // CI configuration
  'chore', // Other changes
  'revert', // Revert previous commit
];

/**
 * Conventional commit pattern.
 * Format: type(optional-scope): description
 * - type: One of the defined commit types
 * - scope: Optional, in parentheses
 * - description: At least 3 characters
 */
const CONVENTIONAL_COMMIT_PATTERN =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?: .{3,}/;

/**
 * Merge commit patterns (always valid).
 */
const MERGE_COMMIT_PATTERNS: ReadonlyArray<RegExp> = [
  /^Merge (branch|pull request|remote-tracking branch)/i,
  /^Merge '.+' into /i,
  /^Merged /i,
];

/**
 * Revert commit patterns (always valid).
 */
const REVERT_COMMIT_PATTERNS: ReadonlyArray<RegExp> = [/^Revert ".*"$/i, /^Revert:/i];

// =============================================================================
// BRANCH NAME VALIDATION
// =============================================================================

/**
 * Validate a git branch name against naming conventions.
 *
 * Valid patterns:
 * - NAPP-1234-feature-name (Jira ticket)
 * - feature/my-feature
 * - fix/bug-description
 * - chore/update-deps
 * - Additional patterns from .claude/rules/branch-patterns.json
 *
 * @param branch - The branch name to validate
 * @param projectDir - Optional project directory for loading custom patterns
 * @returns ValidationResult with validity and error/suggestion
 */
export function validateBranchName(branch: string, projectDir?: string): ValidationResult {
  if (!branch) {
    return {
      valid: false,
      error: 'Branch name is empty',
    };
  }

  // Check always-valid branches
  if (ALWAYS_VALID_BRANCHES.has(branch)) {
    return { valid: true };
  }

  // Load additional patterns from config file and merge with defaults.
  // Each pattern goes through patternStringToRegex which length-caps at
  // MAX_BRANCH_PATTERN_LENGTH; bad patterns are logged and skipped, not
  // thrown — a single overlong rule shouldn't break the whole validator.
  const config = loadBranchPatterns(projectDir);
  const additionalPatterns: RegExp[] = [];
  for (const raw of config?.additional_patterns ?? []) {
    try {
      additionalPatterns.push(patternStringToRegex(raw));
    } catch (error) {
      logError(HOOK_NAME, `Skipping invalid branch pattern: ${error}`);
    }
  }
  const allPatterns = [...VALID_BRANCH_PATTERNS, ...additionalPatterns];

  // Check against all valid patterns
  for (const pattern of allPatterns) {
    if (pattern.test(branch)) {
      logDebug(HOOK_NAME, `Branch '${branch}' matches pattern ${pattern}`);
      return { valid: true };
    }
  }

  // Provide helpful suggestion
  return {
    valid: false,
    error: `Branch name '${branch}' doesn't follow naming conventions`,
    suggestion:
      'Use: NAPP-1234-description, feature/name, fix/name, chore/name, or developer-prefix/name',
  };
}

// =============================================================================
// COMMIT MESSAGE VALIDATION
// =============================================================================

/**
 * Validate a git commit message against conventional commit format.
 *
 * Valid formats:
 * - feat: add new feature
 * - fix(auth): resolve login bug
 * - docs(readme): update installation steps
 * - chore: update dependencies
 *
 * @param message - The commit message to validate
 * @returns ValidationResult with validity and error/suggestion
 */
export function validateCommitMessage(message: string): ValidationResult {
  if (!message) {
    return {
      valid: false,
      error: 'Commit message is empty',
    };
  }

  // Get first line (subject)
  const firstLine = message.split('\n')[0]?.trim() ?? '';

  if (!firstLine) {
    return {
      valid: false,
      error: 'Commit message subject line is empty',
    };
  }

  // Check merge commits (always valid)
  for (const pattern of MERGE_COMMIT_PATTERNS) {
    if (pattern.test(firstLine)) {
      return { valid: true };
    }
  }

  // Check revert commits (always valid)
  for (const pattern of REVERT_COMMIT_PATTERNS) {
    if (pattern.test(firstLine)) {
      return { valid: true };
    }
  }

  // Check conventional commit format
  if (CONVENTIONAL_COMMIT_PATTERN.test(firstLine)) {
    logDebug(HOOK_NAME, 'Commit message follows conventional format');
    return { valid: true };
  }

  // Check if message is too short
  if (firstLine.length < 10) {
    return {
      valid: false,
      error: 'Commit message is too short (minimum 10 characters)',
      suggestion: 'Write a descriptive commit message explaining what and why',
    };
  }

  // Provide helpful suggestion
  return {
    valid: false,
    error: "Commit message doesn't follow conventional commit format",
    suggestion: `Use: ${COMMIT_TYPES.join('|')}(scope): description\nExample: feat(auth): add OAuth2 login support`,
  };
}

/**
 * Get the list of valid commit types.
 * Useful for displaying to users.
 *
 * @returns Array of valid commit type prefixes
 */
export function getCommitTypes(): string[] {
  return [...COMMIT_TYPES];
}

// =============================================================================
// GIT COMMAND PARSING
// =============================================================================

/**
 * Extract commit message from a git commit command.
 *
 * Handles various formats:
 * - git commit -m "message"
 * - git commit -m 'message'
 * - git commit --message="message"
 * - git commit -m "message" --amend
 *
 * @param command - The git commit command
 * @returns Extracted commit message or null if not found
 */
export function extractCommitMessageFromCommand(command: string): string | null {
  if (!command) {
    return null;
  }

  // Pattern for -m "message" or -m 'message'
  const shortFlagPattern = /-m\s+(?:"([^"]+)"|'([^']+)')/;
  const shortMatch = shortFlagPattern.exec(command);
  if (shortMatch) {
    return shortMatch[1] || shortMatch[2] || null;
  }

  // Pattern for --message="message" or --message='message'
  const longFlagPattern = /--message=(?:"([^"]+)"|'([^']+)')/;
  const longMatch = longFlagPattern.exec(command);
  if (longMatch) {
    return longMatch[1] || longMatch[2] || null;
  }

  // Pattern for -m message (without quotes, single word)
  const noQuotesPattern = /-m\s+([^\s]+)/;
  const noQuotesMatch = noQuotesPattern.exec(command);
  if (noQuotesMatch) {
    return noQuotesMatch[1] || null;
  }

  return null;
}

/**
 * Check if a command is a git commit command.
 *
 * @param command - The bash command to check
 * @returns True if this is a git commit command
 */
export function isGitCommitCommand(command: string): boolean {
  if (!command) {
    return false;
  }

  // Match 'git commit' at start or after && or ;
  return /(?:^|&&\s*|;\s*)git\s+commit\b/.test(command);
}

/**
 * Check if a git commit command is an amend.
 *
 * @param command - The bash command to check
 * @returns True if this is an amend commit
 */
export function isAmendCommit(command: string): boolean {
  if (!command) {
    return false;
  }

  return /git\s+commit\s+.*--amend/.test(command);
}

/**
 * Check if a git commit command uses --no-verify.
 *
 * @param command - The bash command to check
 * @returns True if --no-verify is used
 */
export function hasNoVerifyFlag(command: string): boolean {
  if (!command) {
    return false;
  }

  return /git\s+commit\s+.*--no-verify/.test(command) || /git\s+commit\s+.*-n\b/.test(command);
}
