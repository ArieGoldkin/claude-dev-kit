/**
 * Error Rules Library
 *
 * Provides loading and matching of error patterns against command output.
 * Used by the error-warner PostToolUse hook to provide helpful tips.
 *
 * @module lib/error-rules
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logDebug, logError } from './logging.js';

const HOOK_NAME = 'error-rules';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Severity level for error rules.
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * A single error rule definition.
 */
export interface ErrorRule {
  /**
   * Unique identifier for the rule.
   */
  id: string;

  /**
   * Pattern to match against command output.
   * Can be a string (substring match) or regex pattern.
   */
  pattern: string;

  /**
   * Helpful message to display when pattern matches.
   */
  message: string;

  /**
   * Severity level of the error.
   */
  severity?: ErrorSeverity;
}

/**
 * Configuration file structure for error rules.
 */
export interface ErrorRulesConfig {
  /**
   * Schema reference (optional).
   */
  $schema?: string;

  /**
   * Description of the rules file.
   */
  description?: string;

  /**
   * Version of the rules configuration.
   */
  version?: string;

  /**
   * Array of error rules.
   */
  rules: ErrorRule[];
}

/**
 * Result of matching an error pattern.
 */
export interface ErrorMatchResult {
  /**
   * Whether a match was found.
   */
  matched: boolean;

  /**
   * The rule that matched (if any).
   */
  rule?: ErrorRule;

  /**
   * The matched text (if any).
   */
  matchedText?: string;
}

// =============================================================================
// CACHE
// =============================================================================

/**
 * Cache for loaded error rules.
 * Key is the project directory.
 */
const rulesCache: Map<string, ErrorRulesConfig> = new Map();

/**
 * Clear the rules cache.
 * Useful for testing or when rules file changes.
 */
export function clearRulesCache(): void {
  rulesCache.clear();
  logDebug(HOOK_NAME, 'Rules cache cleared');
}

// =============================================================================
// FILE LOADING
// =============================================================================

/**
 * Get the path to the error rules file.
 *
 * @param projectDir - The project directory
 * @returns Path to the error_rules.json file
 */
export function getErrorRulesPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'rules', 'error_rules.json');
}

/**
 * Load error rules from the project's .claude/rules directory.
 *
 * Checks the following locations in order:
 * 1. Project directory: $CLAUDE_PROJECT_DIR/.claude/rules/error_rules.json
 * 2. Plugin directory: $CLAUDE_PLUGIN_ROOT/.claude/rules/error_rules.json (fallback)
 *
 * Returns cached rules if available. If the file doesn't exist or
 * is invalid, returns null without throwing.
 *
 * @param projectDir - The project directory (defaults to CLAUDE_PROJECT_DIR or '.')
 * @returns ErrorRulesConfig or null if not found/invalid
 */
export async function loadErrorRules(projectDir?: string): Promise<ErrorRulesConfig | null> {
  const cwd = projectDir || process.env['CLAUDE_PROJECT_DIR'] || '.';

  // Check cache
  if (rulesCache.has(cwd)) {
    logDebug(HOOK_NAME, 'Using cached error rules');
    return rulesCache.get(cwd) || null;
  }

  // Try project directory first
  let rulesPath = getErrorRulesPath(cwd);

  // If not found in project, try plugin directory as fallback
  if (!fs.existsSync(rulesPath)) {
    const pluginRoot = process.env['CLAUDE_PLUGIN_ROOT'];
    if (pluginRoot) {
      const pluginRulesPath = getErrorRulesPath(pluginRoot);
      if (fs.existsSync(pluginRulesPath)) {
        logDebug(HOOK_NAME, 'Using plugin default error rules');
        rulesPath = pluginRulesPath;
      }
    }
  }

  // Check if file exists
  if (!fs.existsSync(rulesPath)) {
    logDebug(HOOK_NAME, `Error rules file not found: ${rulesPath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(rulesPath, 'utf-8');
    const config = JSON.parse(content) as ErrorRulesConfig;

    // Validate basic structure
    if (!config.rules || !Array.isArray(config.rules)) {
      logError(HOOK_NAME, 'Invalid error rules: missing rules array');
      return null;
    }

    // Cache the result
    rulesCache.set(cwd, config);
    logDebug(HOOK_NAME, `Loaded ${config.rules.length} error rules`);

    return config;
  } catch (error) {
    logError(HOOK_NAME, `Failed to load error rules: ${error}`);
    return null;
  }
}

/**
 * Load error rules synchronously.
 *
 * @param projectDir - The project directory
 * @returns ErrorRulesConfig or null if not found/invalid
 */
export function loadErrorRulesSync(projectDir?: string): ErrorRulesConfig | null {
  const cwd = projectDir || process.env['CLAUDE_PROJECT_DIR'] || '.';

  // Check cache
  if (rulesCache.has(cwd)) {
    return rulesCache.get(cwd) || null;
  }

  // Try project directory first
  let rulesPath = getErrorRulesPath(cwd);

  // If not found in project, try plugin directory as fallback
  if (!fs.existsSync(rulesPath)) {
    const pluginRoot = process.env['CLAUDE_PLUGIN_ROOT'];
    if (pluginRoot) {
      const pluginRulesPath = getErrorRulesPath(pluginRoot);
      if (fs.existsSync(pluginRulesPath)) {
        rulesPath = pluginRulesPath;
      }
    }
  }

  if (!fs.existsSync(rulesPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(rulesPath, 'utf-8');
    const config = JSON.parse(content) as ErrorRulesConfig;

    if (!config.rules || !Array.isArray(config.rules)) {
      return null;
    }

    rulesCache.set(cwd, config);
    return config;
  } catch {
    return null;
  }
}

// =============================================================================
// PATTERN MATCHING
// =============================================================================

/**
 * Match command output against error rules.
 *
 * Iterates through rules and returns the first match found.
 * Uses simple substring matching for efficiency.
 *
 * @param output - The command output to check
 * @param rules - Array of error rules to match against
 * @returns ErrorMatchResult indicating if a match was found
 */
export function matchError(output: string, rules: ErrorRule[]): ErrorMatchResult {
  if (!output || !rules || rules.length === 0) {
    return { matched: false };
  }

  for (const rule of rules) {
    if (!rule.pattern) {
      continue;
    }

    // Simple substring matching (case-sensitive)
    if (output.includes(rule.pattern)) {
      logDebug(HOOK_NAME, `Matched error rule: ${rule.id}`);
      return {
        matched: true,
        rule,
        matchedText: rule.pattern,
      };
    }
  }

  return { matched: false };
}

/**
 * Match command output against error rules with similarity scoring.
 *
 * This version uses fuzzy matching for partial matches.
 * Useful when exact pattern matching fails.
 *
 * @param output - The command output to check
 * @param rules - Array of error rules to match against
 * @param threshold - Minimum similarity score (0-1) for a match
 * @returns ErrorMatchResult indicating if a match was found
 */
export function matchErrorFuzzy(
  output: string,
  rules: ErrorRule[],
  threshold = 0.8
): ErrorMatchResult {
  if (!output || !rules || rules.length === 0) {
    return { matched: false };
  }

  // First try exact matching
  const exactMatch = matchError(output, rules);
  if (exactMatch.matched) {
    return exactMatch;
  }

  // Try fuzzy matching
  for (const rule of rules) {
    if (!rule.pattern) {
      continue;
    }

    const similarity = calculateSimilarity(rule.pattern.toLowerCase(), output.toLowerCase());
    if (similarity >= threshold) {
      logDebug(HOOK_NAME, `Fuzzy matched error rule: ${rule.id} (similarity: ${similarity})`);
      return {
        matched: true,
        rule,
        matchedText: rule.pattern,
      };
    }
  }

  return { matched: false };
}

/**
 * Calculate string similarity using Dice coefficient.
 *
 * Returns a value between 0 (no similarity) and 1 (identical).
 * Useful for fuzzy matching.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score between 0 and 1
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) {
    return 0;
  }

  if (str1 === str2) {
    return 1;
  }

  // Check if one contains the other
  if (str2.includes(str1)) {
    // Higher score if the pattern is a significant portion
    return str1.length / str2.length + 0.5;
  }

  // Use bigram-based Dice coefficient for other cases
  const bigrams1 = getBigrams(str1);
  const bigrams2 = getBigrams(str2);

  if (bigrams1.size === 0 || bigrams2.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) {
      intersectionSize++;
    }
  }

  return (2 * intersectionSize) / (bigrams1.size + bigrams2.size);
}

/**
 * Get bigrams (2-character substrings) from a string.
 *
 * @param str - Input string
 * @returns Set of bigrams
 */
function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();

  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.slice(i, i + 2));
  }

  return bigrams;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format an error match result as a helpful message.
 *
 * @param result - The match result
 * @returns Formatted message string
 */
export function formatErrorMessage(result: ErrorMatchResult): string {
  if (!result.matched || !result.rule) {
    return '';
  }

  const severity = result.rule.severity || 'info';
  const icon = severity === 'error' ? '❌' : severity === 'warning' ? '⚠️' : 'ℹ️';

  return `${icon} ${result.rule.message}`;
}

/**
 * Get all rules with a specific severity.
 *
 * @param rules - Array of error rules
 * @param severity - Severity level to filter by
 * @returns Filtered array of rules
 */
export function getRulesBySeverity(rules: ErrorRule[], severity: ErrorSeverity): ErrorRule[] {
  return rules.filter((rule) => (rule.severity || 'info') === severity);
}
