/**
 * Preflight Context Injector PreToolUse Hook
 *
 * Surfaces working-tree context (pwd, branch, remote URL, worktrees) before
 * destructive bash commands: git commit, git push, terraform apply,
 * terraform destroy, and rm -rf. The injected additionalContext gives
 * Claude a chance to self-verify pwd/branch/remote match the intended
 * target before the command executes — catching wrong-repo and
 * wrong-worktree mistakes.
 *
 * Non-blocking: emits additionalContext only. No permission decision.
 *
 * @module pretool/preflight-context-injector
 */

import { execSync } from 'node:child_process';
import { getCachedBranch } from '../lib/git-utils.js';
import { guardBash, guardHasCommand, runGuards } from '../lib/guards.js';
import { getCommand } from '../lib/input.js';
import { logDebug } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'preflight-context-injector';

/**
 * Regex patterns identifying commands that change shared state and benefit
 * from a pre-flight context surface.
 */
const DESTRUCTIVE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bgit\s+commit\b/,
  /\bgit\s+push\b/,
  /\bterraform\s+apply\b/,
  /\bterraform\s+destroy\b/,
  /\brm\s+-[rf][rf]?\b/,
];

/**
 * Test whether a command matches a destructive pattern.
 */
export function isDestructiveCommand(command: string): boolean {
  return DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
}

/**
 * Resolve the project directory honoring CLAUDE_PROJECT_DIR.
 */
function getWorkingDir(): string {
  return process.env['CLAUDE_PROJECT_DIR'] || process.cwd();
}

/**
 * Return the configured origin remote URL for the repo at projectDir, or
 * an empty string if not in a git repo / no remote configured.
 */
function getRemoteUrl(projectDir: string): string {
  try {
    return execSync('git remote get-url origin', {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Return one line per worktree (path + branch), or an empty array if the
 * repo has no worktrees or git is unavailable.
 */
function getWorktrees(projectDir: string): string[] {
  try {
    const out = execSync('git worktree list', {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!out) return [];
    return out.split('\n').filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

/**
 * Build the preflight context string for the given command, or return
 * null if the command does not warrant context injection.
 *
 * The string is plain text designed to be embedded as additionalContext
 * for Claude. It is not user-visible.
 *
 * @param command - The bash command being run
 * @param projectDir - The directory in which to resolve git/shell state.
 *                     Defaults to CLAUDE_PROJECT_DIR or process.cwd().
 * @returns The context string, or null if not applicable
 */
export function buildPreflightContext(command: string, projectDir?: string): string | null {
  if (!isDestructiveCommand(command)) {
    return null;
  }

  const cwd = projectDir || getWorkingDir();
  const branch = getCachedBranch(cwd) || '(detached or not a git repo)';
  const remote = getRemoteUrl(cwd) || '(no remote configured)';
  const worktrees = getWorktrees(cwd);

  const lines = [
    'Preflight context for upcoming destructive command:',
    `  pwd: ${cwd}`,
    `  branch: ${branch}`,
    `  remote: ${remote}`,
  ];

  if (worktrees.length > 1) {
    lines.push('  worktrees:');
    for (const w of worktrees) {
      lines.push(`    ${w}`);
    }
  }

  lines.push('Verify pwd/branch/remote match the intended target before proceeding.');

  return lines.join('\n');
}

/**
 * Preflight context injector PreToolUse hook.
 *
 * For destructive bash commands, emits an additionalContext block with
 * pwd / branch / remote / worktrees. For non-destructive commands or
 * non-Bash tools, returns silent success.
 *
 * @param input - Hook input from Claude Code
 * @returns HookResult
 */
export async function preflightContextInjector(input: HookInput): Promise<HookResult> {
  const skipped = runGuards(input, guardBash, guardHasCommand);
  if (skipped) return skipped;

  const command = getCommand(input) as string;
  const context = buildPreflightContext(command);

  if (!context) {
    logDebug(HOOK_NAME, 'Non-destructive command, no context injected');
    return outputSilentSuccess();
  }

  logDebug(HOOK_NAME, 'Destructive command detected, injecting preflight context');
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: context,
    },
  };
}

export default preflightContextInjector;
