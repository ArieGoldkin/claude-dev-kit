/**
 * SessionStart Hook - Repo Access Guard
 *
 * Enforces repository access policy: blocks non-Bedrock users from accessing
 * repositories that are restricted to AWS Bedrock-authenticated users only.
 *
 * This is a belt-and-suspenders layer. The primary enforcement is a shell wrapper
 * in ~/.zshrc (deployed by /setup-repo-access-guard) that prevents `claude` from
 * launching at all. This hook covers bypass scenarios (direct invocation, non-zsh,
 * marketplace installs) by injecting a hard systemMessage that causes Claude to
 * refuse work.
 *
 * Detection: `git remote get-url origin` — reliable across SSH and HTTPS, works
 * regardless of local clone directory name.
 *
 * @module lifecycle/repo-access-guard
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getProviderInfo } from '../lib/input.js';
import { logDebug, logWarn } from '../lib/logging.js';
import { outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'repo-access-guard';
const POLICY_FILENAME = 'repo-access-policy.json';

// =============================================================================
// TYPES
// =============================================================================

interface RepoAccessPolicy {
  $comment?: string;
  bedrock_only?: string[];
}

// =============================================================================
// POLICY LOADING
// =============================================================================

/**
 * Load repo access policy from user-level or plugin-bundled location.
 *
 * Checks in order:
 * 1. `~/.claude/repo-access-policy.json` (user-level, deployed by setup command)
 * 2. `$CLAUDE_PLUGIN_ROOT/.claude/repo-access-policy.json` (plugin-bundled default)
 *
 * @returns Parsed policy or null if no policy file found
 */
function loadPolicy(): RepoAccessPolicy | null {
  const candidates = [
    join(homedir(), '.claude', POLICY_FILENAME),
    ...(process.env['CLAUDE_PLUGIN_ROOT']
      ? [join(process.env['CLAUDE_PLUGIN_ROOT'], '.claude', POLICY_FILENAME)]
      : []),
  ];

  for (const policyPath of candidates) {
    if (existsSync(policyPath)) {
      try {
        const content = readFileSync(policyPath, 'utf8');
        const policy = JSON.parse(content) as RepoAccessPolicy;
        logDebug(HOOK_NAME, `Loaded policy from ${policyPath}`);
        return policy;
      } catch (err) {
        logWarn(HOOK_NAME, `Failed to parse policy at ${policyPath}: ${err}`);
        // Continue to next candidate
      }
    }
  }

  logDebug(HOOK_NAME, 'No policy file found, skipping access check');
  return null;
}

// =============================================================================
// GIT REMOTE DETECTION
// =============================================================================

/**
 * Get the `origin` remote URL for the current git repository.
 *
 * Uses `git remote get-url origin` which is reliable across SSH and HTTPS
 * remote formats, and works regardless of local clone directory name.
 *
 * @param projectDir - Project directory to check (defaults to CWD)
 * @returns Remote URL string, or empty string if not a git repo or no origin
 */
function getGitRemoteUrl(projectDir: string): string {
  try {
    const url = execSync('git remote get-url origin', {
      cwd: projectDir,
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim();
    logDebug(HOOK_NAME, `Git remote origin: ${url}`);
    return url;
  } catch {
    logDebug(HOOK_NAME, 'Not a git repo or no origin remote');
    return '';
  }
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * SessionStart hook — enforces Bedrock-only access policy for restricted repos.
 *
 * Fast path (returns silentSuccess immediately) when:
 * - No policy file found
 * - Not in a git repo / no origin remote
 * - Remote URL doesn't match any restricted pattern
 * - Current provider is `bedrock`
 *
 * On violation: returns a hard systemMessage that instructs Claude to refuse
 * all work in this repository.
 *
 * @param _input - Hook input (session metadata, not used directly)
 * @returns Silent success on pass, systemMessage warning on violation
 */
export async function repoAccessGuard(_input: HookInput): Promise<HookResult> {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';

  // 1. Load policy — fast exit if no policy configured
  const policy = loadPolicy();
  if (!policy) {
    return outputSilentSuccess();
  }

  const restrictedPatterns = policy.bedrock_only ?? [];
  if (restrictedPatterns.length === 0) {
    logDebug(HOOK_NAME, 'Policy has no bedrock_only entries, skipping');
    return outputSilentSuccess();
  }

  // 2. Get git remote URL — fast exit if not a git repo
  const remoteUrl = getGitRemoteUrl(projectDir);
  if (!remoteUrl) {
    return outputSilentSuccess();
  }

  // 3. Check if remote matches a restricted pattern
  const matchedPattern = restrictedPatterns.find((pattern) => remoteUrl.includes(pattern));
  if (!matchedPattern) {
    logDebug(HOOK_NAME, `Remote ${remoteUrl} not in restricted list`);
    return outputSilentSuccess();
  }

  // 4. Check provider — Bedrock users are allowed
  const { provider } = getProviderInfo();
  if (provider === 'bedrock') {
    logDebug(HOOK_NAME, `Bedrock provider detected, allowing access to ${matchedPattern}`);
    return outputSilentSuccess();
  }

  // 5. Violation: restricted repo + non-Bedrock provider
  logWarn(
    HOOK_NAME,
    `ACCESS POLICY VIOLATION: repo=${matchedPattern}, provider=${provider}, remote=${remoteUrl}`
  );

  const warningMessage = `⛔ REPO ACCESS POLICY VIOLATION

This repository (${matchedPattern}) is restricted to AWS Bedrock users only.
Current provider: ${provider}

You must not perform any work in this repository using an Anthropic subscription.
Configure AWS credentials and set CLAUDE_CODE_USE_BEDROCK=1 to access this repo.

See commands/setup-repo-access-guard.md for setup instructions.`;

  return {
    continue: true,
    systemMessage: warningMessage,
  };
}

export default repoAccessGuard;
