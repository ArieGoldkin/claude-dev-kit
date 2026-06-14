/**
 * Dangerous-bash registry types.
 *
 * The registry categorizes patterns so users can selectively disable categories
 * via `CTK_DISABLE_CATEGORY` (comma-separated list). Patterns within a category
 * are evaluated in declaration order.
 *
 * @module lib/dangerous-bash/types
 */

export type Category = 'filesystem' | 'http' | 'aws' | 'terraform';

export interface Pattern {
  /** Regex tested against the (already-unwrapped, already-normalized) command string. */
  regex: RegExp;
  /** Stable category for opt-out via CTK_DISABLE_CATEGORY. */
  category: Category;
  /** Human-readable explanation included in the deny reason. */
  description: string;
}

export interface Match {
  pattern: Pattern;
  /** The substring of the command that matched, for debugging/log output. */
  matchedText: string;
}
