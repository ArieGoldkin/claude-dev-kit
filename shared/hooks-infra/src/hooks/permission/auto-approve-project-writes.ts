/**
 * Shared Hooks Infra - Auto-Approve Project Writes
 *
 * TypeScript port of scripts/permission/auto-approve-project-writes.sh
 *
 * Auto-approves file writes (Write, Edit, MultiEdit) that are:
 * - Within the project directory ($CLAUDE_PROJECT_DIR)
 * - Not in protected directories (node_modules, .git, etc.)
 * - Not sensitive file types (.env, credentials, etc.)
 *
 * Defers to standard approval flow for:
 * - Files outside project directory
 * - Protected directories
 * - Protected file patterns
 *
 * SECURITY NOTE: Uses resolveRealPath to follow symlinks before checking
 * if the path is within the project directory. This prevents symlink
 * bypass attacks (ME-001).
 *
 * @module permission/auto-approve-project-writes
 */

import { guardHasFilePath, guardWriteEdit, runGuards } from '../lib/guards.js';
import { getFilePath, getSessionId, getToolName } from '../lib/input.js';
import { logDebug, logInfo, logPermission } from '../lib/logging.js';
import { outputAllow, outputSilentSuccess } from '../lib/output.js';
import { isWithinProject, normalizePath, resolveRealPath } from '../lib/path-utils.js';
import type { HookInput, HookResult, ToolName } from '../types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const HOOK_NAME = 'auto-approve-project-writes';

/**
 * File operation tools that this hook handles.
 */
const FILE_TOOLS: ReadonlySet<ToolName> = new Set(['Write', 'Edit', 'MultiEdit']);

/**
 * Directories that should never be auto-approved (require explicit approval).
 * These are either generated/cached directories or contain sensitive configuration.
 */
const PROTECTED_DIRS: readonly string[] = [
  'node_modules/',
  '.git/',
  '.husky/', // git hooks — auto-execute on commit/push (arbitrary code execution)
  '.githooks/', // alternate git hooks dir
  '.github/workflows/', // CI pipeline definitions — execute in CI (code execution)
  '.devcontainer/', // postCreateCommand etc. run on container open (code execution); CC guards this natively since v2.1.160
  '__pycache__/',
  '.venv/',
  'venv/',
  '.env/',
  'dist/',
  'build/',
  '.next/',
  '.cache/',
  'coverage/',
] as const;

/**
 * File patterns that should never be auto-approved.
 * These files typically contain secrets, credentials, or sensitive configuration.
 */
// NOTE: every pattern is case-insensitive (/i). macOS (APFS) and Windows
// default filesystems are case-insensitive, so a write to `.ENV` overwrites
// the real `.env` — a case-sensitive pattern would let that bypass the guard.
const PROTECTED_FILE_PATTERNS: readonly RegExp[] = [
  /\.env$/i,
  /\.env\./i,
  /\.envrc$/i,
  /credentials/i,
  /secrets/i,
  /\.pem$/i,
  /\.key$/i,
  /\.crt$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /id_dsa/i,
  /id_ecdsa/i,
  /\.npmrc$/i,
  /\.pypirc$/i,
  /\.netrc$/i,
  /\.pgpass$/i,
  // Build-tool configs that grant code execution (CC guards these natively
  // under acceptEdits since v2.1.160). Without these entries they auto-approve
  // via the SAFE_EXTENSIONS allowlist (.toml/.yaml/.yml). Basename-anchored
  // ((?:^|\/)) so near-miss names like my-bunfig.toml keep auto-approving
  // (review !209 finding #4) — the tools only read the exact filenames.
  /(?:^|\/)bunfig\.toml$/i,
  /(?:^|\/)\.yarnrc(\.ya?ml)?$/i,
  /(?:^|\/)\.pre-commit-config\.ya?ml$/i,
  /(?:^|\/)lefthook\.ya?ml$/i,
  /(?:^|\/)\.bazelrc$/i,
  // Shell startup files — defense-in-depth: extensionless names already defer
  // via the extension allowlist, but an explicit deny is not accidental.
  /(?:^|\/)\.(zshenv|zlogin|zshrc|bash_login|bash_profile|bashrc)$/i,
  // Security control plane: settings.json governs the permission allowlist and
  // hook registration. An auto-approved write here is privilege escalation —
  // a malicious diff could grant itself arbitrary Bash auto-approval or register
  // a hook that runs on the next tool call. (Routine .claude/continuity and
  // .claude/context writes are intentionally NOT protected.)
  /\.claude\/settings(\.local)?\.json$/i,
] as const;

/**
 * Safe extensions to auto-approve within project.
 * These are common source code, configuration, and documentation file types.
 */
const SAFE_EXTENSIONS: readonly string[] = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.json',
  '.yaml',
  '.yml',
  '.md',
  '.mdx',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.svg',
  '.txt',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
  '.graphql',
  '.gql',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
  '.xml',
  '.vue',
  '.svelte',
  '.astro',
  '.rs',
  '.go',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.rb',
  '.php',
  '.pl',
  '.lua',
  '.r',
  '.R',
] as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if path is in a protected directory.
 *
 * @param normalizedPath - Normalized path to check
 * @returns True if the path is in a protected directory
 */
export function isProtectedDirectory(normalizedPath: string): boolean {
  // Lowercase before matching — on case-insensitive filesystems (macOS/Windows)
  // `.GITHUB/workflows/` is the same dir as `.github/workflows/`, so a
  // case-sensitive check would let it bypass and auto-approve. (PROTECTED_DIRS
  // are all lowercase; mirrors hasSafeExtension's lowercasing.) Over-protecting
  // a `Build/` dir on a case-sensitive FS just defers to a prompt — fail-safe.
  const lower = normalizedPath.toLowerCase();
  // Anchor to a path boundary so `mybuild/` doesn't match `build/`. A protected
  // dir matches when it appears after a `/` or at the very start of the path.
  const path = lower.endsWith('/') ? lower : `${lower}/`;
  return PROTECTED_DIRS.some((dir) => path.includes(`/${dir}`) || path.startsWith(dir));
}

/**
 * Check if path matches a protected file pattern.
 *
 * @param normalizedPath - Normalized path to check
 * @returns True if the path matches a protected pattern
 */
export function isProtectedFile(normalizedPath: string): boolean {
  return PROTECTED_FILE_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Check if path has a safe extension.
 *
 * @param normalizedPath - Normalized path to check
 * @returns True if the path has a safe extension
 */
export function hasSafeExtension(normalizedPath: string): boolean {
  const lower = normalizedPath.toLowerCase();
  return SAFE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// =============================================================================
// MAIN HOOK FUNCTION
// =============================================================================

/**
 * Auto-approve project file writes.
 *
 * This hook evaluates Write/Edit/MultiEdit operations and auto-approves
 * files that are:
 * 1. Within the project directory (after resolving symlinks)
 * 2. Not in protected directories
 * 3. Not matching protected file patterns
 *
 * SECURITY NOTE: Uses resolveRealPath to follow symlinks before checking
 * if the path is within the project directory. This prevents symlink
 * bypass attacks (ME-001).
 *
 * @param input - Hook input from Claude Code
 * @returns HookResult with approval decision
 */
export async function autoApproveProjectWrites(input: HookInput): Promise<HookResult> {
  const skipped = runGuards(input, guardWriteEdit, guardHasFilePath);
  if (skipped) return skipped;

  const toolName = getToolName(input);
  // guardHasFilePath ensures filePath is present; narrow for TypeScript
  const filePath = getFilePath(input) as string;

  logDebug(HOOK_NAME, `Evaluating: ${filePath}`);

  // Normalize and resolve the path (CRITICAL: resolve symlinks for security)
  // CC<2.1.88 compat: filePath is now always absolute; normalization still needed for patterns
  const normalizedPath = normalizePath(filePath);
  const realPath = resolveRealPath(filePath);

  logDebug(HOOK_NAME, `Normalized: ${normalizedPath}, Resolved: ${realPath}`);

  // Check if path is within project directory (uses resolved path)
  if (!isWithinProject(realPath)) {
    logDebug(HOOK_NAME, 'Outside project directory, deferring to standard flow');
    return outputSilentSuccess();
  }

  // Check protections against BOTH the normalized AND the resolved real path.
  // An in-project symlink (e.g. cfg -> .claude) would otherwise present a
  // normalized path that dodges the pattern while resolving to a protected
  // target. security-blocker checks both; this hook must too.
  const pathsToCheck = [normalizedPath, realPath];

  // Check if in protected directory
  if (pathsToCheck.some(isProtectedDirectory)) {
    logDebug(HOOK_NAME, 'Protected directory, deferring to standard flow');
    return outputSilentSuccess();
  }

  // Check if protected file pattern
  if (pathsToCheck.some(isProtectedFile)) {
    logDebug(HOOK_NAME, 'Protected file pattern, deferring to standard flow');
    return outputSilentSuccess();
  }

  // Auto-approve ONLY recognized-safe source/config/doc extensions. Unknown or
  // extensionless files (Makefile, Dockerfile, shebang scripts, git hooks)
  // defer to a prompt — auto-approve is an explicit allowlist, not allow-by-
  // default. (Previously the else-branch auto-approved any unrecognized type.)
  if (!hasSafeExtension(normalizedPath)) {
    logDebug(HOOK_NAME, 'Unrecognized file type, deferring to standard flow');
    return outputSilentSuccess();
  }

  const sessionId = getSessionId(input);
  logInfo(HOOK_NAME, `Auto-approved: safe file within project: ${filePath}`);
  logPermission('allow', `auto-approved project file: ${filePath}`, toolName, sessionId);

  return outputAllow();
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Export pattern constants for testing.
 */
export { PROTECTED_DIRS, PROTECTED_FILE_PATTERNS, SAFE_EXTENSIONS, FILE_TOOLS, HOOK_NAME };

export default autoApproveProjectWrites;
