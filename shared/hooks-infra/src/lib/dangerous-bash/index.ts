/**
 * Dangerous-bash registry walker.
 *
 * Walks categorized pattern lists in a fixed evaluation order and returns the
 * first match. Categories can be opt-out disabled via the `CTK_DISABLE_CATEGORY`
 * environment variable (comma-separated list).
 *
 * Evaluation order: filesystem, http, aws, terraform. Filesystem is checked
 * first to preserve historical first-match semantics for pre-existing rules.
 * New categories are appended in the order they were added so a noisy regex
 * in one cannot reorder existing match priorities.
 *
 * @module lib/dangerous-bash
 */

import { AWS_PATTERNS } from './aws.js';
import { FILESYSTEM_PATTERNS } from './filesystem.js';
import { HTTP_PATTERNS } from './http.js';
import { TERRAFORM_PATTERNS } from './terraform.js';
import type { Category, Match, Pattern } from './types.js';

const ALL_CATEGORIES: Record<Category, Pattern[]> = {
  filesystem: FILESYSTEM_PATTERNS,
  http: HTTP_PATTERNS,
  aws: AWS_PATTERNS,
  terraform: TERRAFORM_PATTERNS,
};

/**
 * Read `CTK_DISABLE_CATEGORY` as a comma-separated list of categories to skip.
 * Unknown category names are silently ignored. Empty/unset → no categories
 * skipped.
 */
function getDisabledCategories(): Set<Category> {
  const raw = process.env['CTK_DISABLE_CATEGORY'];
  if (!raw) return new Set();
  const parsed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(parsed.filter((c): c is Category => c in ALL_CATEGORIES));
}

/**
 * Walk the registry and return the first matching pattern across all enabled
 * categories.
 *
 * Evaluation order is filesystem first, then http — matching the historical
 * order of the legacy `DANGEROUS_COMMAND_PATTERNS` array so the refactor
 * preserves which pattern wins on a multi-match command.
 *
 * @param command - Bash command (already unwrapped + escape-normalized)
 * @returns First matching pattern + matched substring, or null if none match
 */
export function matchDangerousBash(command: string): Match | null {
  const disabled = getDisabledCategories();
  // Explicit evaluation order — do not rely on object key iteration.
  const order: Category[] = ['filesystem', 'http', 'aws', 'terraform'];
  for (const category of order) {
    if (disabled.has(category)) continue;
    for (const pattern of ALL_CATEGORIES[category]) {
      const match = pattern.regex.exec(command);
      if (match) {
        return { pattern, matchedText: match[0] };
      }
    }
  }
  return null;
}

export type { Category, Match, Pattern } from './types.js';
export { AWS_PATTERNS } from './aws.js';
export { FILESYSTEM_PATTERNS } from './filesystem.js';
export { HTTP_PATTERNS } from './http.js';
export { TERRAFORM_PATTERNS } from './terraform.js';
