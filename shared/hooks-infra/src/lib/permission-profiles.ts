/**
 * Permission Profiles Library
 *
 * Provides loading and evaluation of declarative permission profiles.
 * Profiles define auto_approve, require_approval, and deny rules
 * for tools, paths, and commands.
 *
 * @module lib/permission-profiles
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logDebug, logError } from './logging.js';

const HOOK_NAME = 'permission-profiles';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Permission decision types.
 */
export type ProfilePermissionDecision = 'allow' | 'deny' | 'require_approval' | null;

/**
 * Permission rules for a specific action type.
 */
export interface PermissionRules {
  /**
   * Tools that this rule applies to.
   */
  tools?: string[];

  /**
   * Path patterns (glob-like) that this rule applies to.
   * $PROJECT is replaced with the project directory.
   */
  paths?: string[];

  /**
   * Command prefixes that this rule applies to.
   */
  commands?: string[];
}

/**
 * Permission profile configuration.
 */
export interface PermissionProfile {
  /**
   * Schema reference (optional).
   */
  $schema?: string;

  /**
   * Profile name.
   */
  name: string;

  /**
   * Profile description.
   */
  description?: string;

  /**
   * Profile version.
   */
  version?: string;

  /**
   * Rules for auto-approved operations.
   */
  auto_approve?: PermissionRules;

  /**
   * Rules for operations requiring approval.
   */
  require_approval?: PermissionRules;

  /**
   * Rules for denied operations.
   */
  deny?: PermissionRules;
}

// =============================================================================
// CACHE
// =============================================================================

/**
 * Cache for loaded permission profiles.
 */
const profileCache: Map<string, PermissionProfile> = new Map();

/**
 * Clear the profile cache.
 */
export function clearProfileCache(): void {
  profileCache.clear();
  logDebug(HOOK_NAME, 'Profile cache cleared');
}

// =============================================================================
// FILE LOADING
// =============================================================================

/**
 * Get the path to the permission profile file.
 *
 * @param projectDir - The project directory
 * @param profileName - The profile name (defaults to 'default')
 * @returns Path to the profile JSON file
 */
export function getProfilePath(projectDir: string, profileName = 'default'): string {
  return path.join(projectDir, '.claude', 'permissions', `${profileName}.json`);
}

/**
 * Load a permission profile.
 *
 * Checks the following locations in order:
 * 1. Project directory: $CLAUDE_PROJECT_DIR/.claude/permissions/default.json
 * 2. Plugin directory: $CLAUDE_PLUGIN_ROOT/.claude/permissions/default.json (fallback)
 *
 * @param projectDir - The project directory
 * @param profileName - The profile name (defaults to 'default')
 * @returns PermissionProfile or null if not found
 */
export async function loadPermissionProfile(
  projectDir?: string,
  profileName = 'default'
): Promise<PermissionProfile | null> {
  const cwd = projectDir || process.env['CLAUDE_PROJECT_DIR'] || '.';
  const cacheKey = `${cwd}:${profileName}`;

  // Check cache
  if (profileCache.has(cacheKey)) {
    logDebug(HOOK_NAME, 'Using cached permission profile');
    return profileCache.get(cacheKey) || null;
  }

  // Try project directory first
  let profilePath = getProfilePath(cwd, profileName);

  // If not found in project, try plugin directory as fallback
  if (!fs.existsSync(profilePath)) {
    const pluginRoot = process.env['CLAUDE_PLUGIN_ROOT'];
    if (pluginRoot) {
      const pluginProfilePath = getProfilePath(pluginRoot, profileName);
      if (fs.existsSync(pluginProfilePath)) {
        logDebug(HOOK_NAME, 'Using plugin default permission profile');
        profilePath = pluginProfilePath;
      }
    }
  }

  if (!fs.existsSync(profilePath)) {
    logDebug(HOOK_NAME, `Permission profile not found: ${profilePath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(profilePath, 'utf-8');
    const profile = JSON.parse(content) as PermissionProfile;

    // Validate basic structure
    if (!profile.name) {
      logError(HOOK_NAME, 'Invalid permission profile: missing name');
      return null;
    }

    // Cache the result
    profileCache.set(cacheKey, profile);
    logDebug(HOOK_NAME, `Loaded permission profile: ${profile.name}`);

    return profile;
  } catch (error) {
    logError(HOOK_NAME, `Failed to load permission profile: ${error}`);
    return null;
  }
}

// =============================================================================
// PATTERN MATCHING
// =============================================================================

/**
 * Convert a glob-like pattern to a regex.
 * Supports * (any chars within a segment) and ** (zero or more segments).
 * A trailing '/**' therefore also matches the bare directory path itself
 * (e.g. 'a/src/**' matches 'a/src') — deliberate: deny/require_approval
 * rules must cover the directory node, and a Write targeting a bare
 * directory path fails at the filesystem anyway (review !209 finding #2).
 * Replaces $PROJECT with the project directory.
 *
 * @param pattern - The glob pattern
 * @param projectDir - The project directory
 * @returns RegExp for matching
 */
function patternToRegex(pattern: string, projectDir: string): RegExp {
  // Replace $PROJECT with a placeholder so the project path is escaped
  // exactly once. Substituting the pre-escaped path here would let the
  // escape pass below re-escape its backslashes, breaking matching for
  // any project path with a regex-special char (e.g. a dotted dirname).
  let regexStr = pattern.replace(/\$PROJECT/g, '<<<PROJECT>>>');

  // Escape special regex chars (except * which we handle specially)
  regexStr = regexStr
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    // Convert ** to a placeholder
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    // Convert single * to [^/]*
    .replace(/\*/g, '[^/]*')
    // Globstar matches ZERO or more path segments (standard glob semantics).
    // A bare '.*' substitution left a mandatory '/' beside it, so patterns
    // like 'a/**/b.json' could never match the direct child 'a/b.json' —
    // shipped require_approval rules failed open on exactly that shape.
    .replace(/<<<GLOBSTAR>>>\//g, '(?:.*\\/)?')
    .replace(/\/<<<GLOBSTAR>>>/g, '(?:\\/.*)?')
    .replace(/<<<GLOBSTAR>>>/g, '.*');

  // Splice in the once-escaped project directory after the escape pass.
  // Function replacement avoids `$&`/`$1` semantics in replacement strings.
  const escapedProjectDir = projectDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  regexStr = regexStr.replace(/<<<PROJECT>>>/g, () => escapedProjectDir);

  // nosemgrep: javascript.lang.security.audit.non-literal-regexp
  // regexStr is built from a project-controlled glob pattern that has
  // been escape-sanitized above (lines 199, 203). The remaining wildcards
  // (`[^/]*`, `.*`) come from controlled `*`/`**` substitution. Not
  // user-controlled at runtime; safe from ReDoS for realistic patterns.
  return new RegExp(`^${regexStr}$`);
}

/**
 * Check if a path matches any of the given patterns.
 *
 * @param filePath - The file path to check
 * @param patterns - Array of glob patterns
 * @param projectDir - The project directory
 * @returns True if path matches any pattern
 */
export function matchesPathPattern(
  filePath: string,
  patterns: string[],
  projectDir: string
): boolean {
  if (!filePath || !patterns || patterns.length === 0) {
    return false;
  }

  // Normalize the path
  const normalizedPath = path.resolve(filePath);

  for (const pattern of patterns) {
    const regex = patternToRegex(pattern, projectDir);
    if (regex.test(normalizedPath)) {
      logDebug(HOOK_NAME, `Path '${filePath}' matches pattern '${pattern}'`);
      return true;
    }
  }

  return false;
}

/**
 * Check if a command matches any of the given prefixes.
 *
 * @param command - The command to check
 * @param prefixes - Array of command prefixes
 * @returns True if command starts with any prefix
 */
export function matchesCommandPattern(command: string, prefixes: string[]): boolean {
  if (!command || !prefixes || prefixes.length === 0) {
    return false;
  }

  const trimmedCommand = command.trim();

  for (const prefix of prefixes) {
    if (trimmedCommand.startsWith(prefix) || trimmedCommand.includes(` ${prefix}`)) {
      logDebug(HOOK_NAME, `Command matches prefix '${prefix}'`);
      return true;
    }
  }

  return false;
}

/**
 * Check if a tool name matches any in the list.
 *
 * @param toolName - The tool name to check
 * @param tools - Array of tool names
 * @returns True if tool matches
 */
export function matchesToolPattern(toolName: string, tools: string[]): boolean {
  if (!toolName || !tools || tools.length === 0) {
    return false;
  }

  return tools.includes(toolName);
}

// =============================================================================
// PERMISSION EVALUATION HELPERS
// =============================================================================

/**
 * Check if rules match for a given operation.
 */
function checkRulesMatch(
  rules: PermissionRules | undefined,
  toolName: string,
  filePath: string | undefined,
  command: string | undefined,
  project: string
): boolean {
  if (!rules) {
    return false;
  }

  // Check tool match
  if (rules.tools && matchesToolPattern(toolName, rules.tools)) {
    return true;
  }

  // Check path match
  if (filePath && rules.paths && matchesPathPattern(filePath, rules.paths, project)) {
    return true;
  }

  // Check command match
  if (command && rules.commands && matchesCommandPattern(command, rules.commands)) {
    return true;
  }

  return false;
}

// =============================================================================
// PERMISSION EVALUATION
// =============================================================================

/**
 * Evaluate permission based on a profile.
 *
 * Checks in order:
 * 1. deny rules (if matched, return 'deny')
 * 2. require_approval rules (if matched, return 'require_approval')
 * 3. auto_approve rules (if matched, return 'allow')
 * 4. No match returns null (defer to other hooks)
 *
 * @param profile - The permission profile
 * @param toolName - The tool being invoked
 * @param filePath - The file path (optional, for file operations)
 * @param command - The command (optional, for Bash)
 * @param projectDir - The project directory
 * @returns Permission decision or null if no rule matched
 */
export function evaluatePermission(
  profile: PermissionProfile,
  toolName: string,
  filePath?: string,
  command?: string,
  projectDir?: string
): ProfilePermissionDecision {
  const project = projectDir || process.env['CLAUDE_PROJECT_DIR'] || '.';

  // 1. Check deny rules first (highest priority)
  if (checkRulesMatch(profile.deny, toolName, filePath, command, project)) {
    logDebug(HOOK_NAME, 'Permission denied: matches deny rule');
    return 'deny';
  }

  // 2. Check require_approval rules
  if (checkRulesMatch(profile.require_approval, toolName, filePath, command, project)) {
    logDebug(HOOK_NAME, 'Permission requires approval: matches require_approval rule');
    return 'require_approval';
  }

  // 3. Check auto_approve rules
  if (checkRulesMatch(profile.auto_approve, toolName, filePath, command, project)) {
    logDebug(HOOK_NAME, 'Permission allowed: matches auto_approve rule');
    return 'allow';
  }

  // No rule matched - defer to other hooks
  logDebug(HOOK_NAME, 'No permission rule matched, deferring');
  return null;
}
