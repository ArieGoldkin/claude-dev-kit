/**
 * Git Utilities Library
 *
 * Provides cached git operations for efficient branch detection
 * and protected branch validation.
 *
 * @module lib/git-utils
 */

import { execSync } from 'node:child_process';
import { logDebug } from './logging.js';

const HOOK_NAME = 'git-utils';

// =============================================================================
// BRANCH CACHE
// =============================================================================

/**
 * Cache entry for git branch information.
 */
interface BranchCacheEntry {
  branch: string;
  timestamp: number;
}

/**
 * Cache for git branch lookups.
 * Key is the project directory, value is the cached branch info.
 */
const branchCache: Map<string, BranchCacheEntry> = new Map();

/**
 * Cache TTL in milliseconds (30 seconds).
 * Branch changes are infrequent during a session.
 */
const CACHE_TTL_MS = 30000;

// =============================================================================
// PROTECTED BRANCHES
// =============================================================================

/**
 * Branch names that are considered protected.
 * These branches should not receive direct commits.
 */
const PROTECTED_BRANCHES: ReadonlySet<string> = new Set([
  'main',
  'master',
  'develop',
  'dev',
  'production',
  'prod',
  'staging',
  'release',
]);

/**
 * Protected branch patterns (regex).
 * Matches branches that follow protected naming conventions.
 */
const PROTECTED_BRANCH_PATTERNS: ReadonlyArray<RegExp> = [/^release\/.+$/, /^hotfix\/.+$/];

// =============================================================================
// GIT OPERATIONS
// =============================================================================

/**
 * Get the current git branch name by executing git command.
 *
 * @param projectDir - The project directory (defaults to CLAUDE_PROJECT_DIR or '.')
 * @returns Branch name or empty string if not in a git repository
 */
export function getCurrentBranch(projectDir?: string): string {
  const cwd = projectDir || process.env['CLAUDE_PROJECT_DIR'] || '.';

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    logDebug(HOOK_NAME, `Current branch: ${branch}`);
    return branch;
  } catch (error) {
    logDebug(HOOK_NAME, `Failed to get branch: ${error}`);
    return '';
  }
}

/**
 * Get the current git branch with caching.
 *
 * Uses a 30-second TTL cache to avoid repeated git command executions.
 * This significantly improves performance during rapid tool calls.
 *
 * @param projectDir - The project directory (defaults to CLAUDE_PROJECT_DIR or '.')
 * @returns Branch name or empty string if not in a git repository
 */
export function getCachedBranch(projectDir?: string): string {
  const cwd = projectDir || process.env['CLAUDE_PROJECT_DIR'] || '.';
  const now = Date.now();

  // Check cache
  const cached = branchCache.get(cwd);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    logDebug(HOOK_NAME, `Using cached branch: ${cached.branch}`);
    return cached.branch;
  }

  // Fetch fresh branch
  const branch = getCurrentBranch(cwd);

  // Update cache
  branchCache.set(cwd, { branch, timestamp: now });

  return branch;
}

/**
 * Clear the branch cache.
 * Useful for testing or when you know the branch has changed.
 */
export function clearBranchCache(): void {
  branchCache.clear();
  logDebug(HOOK_NAME, 'Branch cache cleared');
}

// =============================================================================
// PROTECTED BRANCH CHECKING
// =============================================================================

/**
 * Check if a branch name is protected.
 *
 * Protected branches include:
 * - main, master, develop, dev, production, prod, staging, release
 * - Any branch matching release/* or hotfix/*
 *
 * @param branch - The branch name to check
 * @returns True if the branch is protected
 */
export function isProtectedBranch(branch: string): boolean {
  if (!branch) {
    return false;
  }

  // Check exact matches
  if (PROTECTED_BRANCHES.has(branch.toLowerCase())) {
    return true;
  }

  // Check patterns
  for (const pattern of PROTECTED_BRANCH_PATTERNS) {
    if (pattern.test(branch)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the list of protected branch names.
 * Useful for displaying to users.
 *
 * @returns Array of protected branch names
 */
export function getProtectedBranchNames(): string[] {
  return Array.from(PROTECTED_BRANCHES);
}

// =============================================================================
// GIT REPOSITORY DETECTION
// =============================================================================

/**
 * Check if the current directory is inside a git repository.
 *
 * @param projectDir - The project directory (defaults to CLAUDE_PROJECT_DIR or '.')
 * @returns True if inside a git repository
 */
export function isGitRepository(projectDir?: string): boolean {
  const cwd = projectDir || process.env['CLAUDE_PROJECT_DIR'] || '.';

  try {
    execSync('git rev-parse --is-inside-work-tree', {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
