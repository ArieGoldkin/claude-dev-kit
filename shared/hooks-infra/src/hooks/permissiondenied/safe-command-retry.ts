/**
 * Safe Command Retry — PermissionDenied Hook
 *
 * Retries Bash commands that match known safe patterns when incorrectly
 * denied by the auto-mode classifier. Reuses SAFE_COMMAND_PREFIXES from
 * auto-approve-safe-bash.
 *
 * Rate limited: max 3 retries per command prefix per session to prevent loops.
 *
 * @module permissiondenied/safe-command-retry
 */

import { logDebug, logInfo, logWarn } from '../lib/logging.js';
import { outputRetry, outputSilentSuccess } from '../lib/output.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'safe-command-retry';

/** Max retries per command prefix pattern per session */
const MAX_RETRIES_PER_PREFIX = 3;

/**
 * Safe command prefixes — commands that are always safe to retry.
 * Subset of the full SAFE_COMMAND_PREFIXES to be conservative.
 */
const SAFE_RETRY_PREFIXES: readonly string[] = [
  'ls ',
  'ls\t',
  'pwd',
  'echo ',
  'cat ',
  'head ',
  'tail ',
  'wc ',
  'which ',
  'type ',
  'file ',
  'stat ',
  'date',
  'whoami',
  'hostname',
  'uname ',
  'node --version',
  'node -v',
  'npm --version',
  'npm list',
  'npm ls',
  'npm info',
  'npm view',
  'npx --version',
  'python --version',
  'python3 --version',
  'git status',
  'git log',
  'git diff',
  'git branch',
  'git remote',
  'git show',
  'git tag',
  'glab issue list',
  'glab mr list',
  'gh issue list',
  'gh pr list',
];

/**
 * Prefixes that indicate a compound chain with potentially dangerous commands.
 * If any of these appear after a safe prefix, we should NOT retry.
 */
const DANGEROUS_CHAIN_PATTERNS: readonly string[] = [
  ' && rm ',
  ' && git push',
  ' && git checkout',
  ' && git reset',
  ' && sudo ',
  ' | sh',
  ' | bash',
  ' | xargs rm',
];

/** Track retries per prefix to prevent loops */
const retryCounters = new Map<string, number>();

/**
 * Check if a command is safe to retry.
 */
function isSafeToRetry(command: string): { safe: boolean; prefix: string } {
  const trimmed = command.trim();

  // Check for dangerous compound patterns
  for (const pattern of DANGEROUS_CHAIN_PATTERNS) {
    if (trimmed.includes(pattern)) {
      return { safe: false, prefix: '' };
    }
  }

  // Check if command starts with a safe prefix
  for (const prefix of SAFE_RETRY_PREFIXES) {
    if (trimmed.startsWith(prefix) || trimmed === prefix.trim()) {
      return { safe: true, prefix };
    }
  }

  return { safe: false, prefix: '' };
}

/**
 * Retry safe Bash commands that were incorrectly denied by auto-mode.
 */
export async function safeCommandRetry(input: HookInput): Promise<HookResult> {
  // Only handle Bash denials
  if (input.tool_name !== 'Bash') {
    return outputSilentSuccess();
  }

  const command = input.tool_input?.command;
  if (!command) {
    return outputSilentSuccess();
  }

  const { safe, prefix } = isSafeToRetry(command);
  if (!safe) {
    logDebug(HOOK_NAME, `Not a safe command, skipping retry: ${command.slice(0, 60)}`);
    return outputSilentSuccess();
  }

  // Rate limit: check retry counter
  const currentCount = retryCounters.get(prefix) || 0;
  if (currentCount >= MAX_RETRIES_PER_PREFIX) {
    logWarn(
      HOOK_NAME,
      `Rate limit reached for prefix "${prefix.trim()}" (${MAX_RETRIES_PER_PREFIX} retries)`
    );
    return outputSilentSuccess();
  }

  // Increment counter and retry
  retryCounters.set(prefix, currentCount + 1);
  logInfo(
    HOOK_NAME,
    `Retrying safe command (${currentCount + 1}/${MAX_RETRIES_PER_PREFIX}): ${command.slice(0, 80)}`
  );

  return outputRetry();
}
