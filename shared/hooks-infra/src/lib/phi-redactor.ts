/**
 * PHI / PII redactor — pure functions for output-side scrubbing.
 *
 * Designed for the CC v2.1.152 MessageDisplay hook event. Scans
 * assistant message text for high-confidence PHI / PII patterns and
 * replaces matches with stable placeholders. Conservative by design:
 * only patterns with very low false-positive rates are included by
 * default. Email and date heuristics are deliberately excluded — they
 * over-match on technical content (commit emails, ISO timestamps).
 *
 * Stays purely synchronous and dependency-free so it can be reused
 * outside the hook (e.g., handoff scrubbing).
 *
 * @module lib/phi-redactor
 */

export interface PhiPattern {
  /** Stable identifier used in logs. */
  id: string;
  /** Regex (with `g` flag) describing the pattern. */
  regex: RegExp;
  /** Replacement placeholder (does not need to be the same length). */
  replacement: string;
}

/**
 * Default conservative pattern set. Each pattern is high-confidence:
 * the surface form is rarely produced by non-PHI content.
 *
 * NOT included (deliberately):
 * - Generic email (false-positives on commit / CI emails).
 * - Generic date (false-positives on log timestamps, version strings).
 * - Names (impossible without an NLP dependency).
 * - MRN / chart numbers (format varies by EHR vendor).
 */
export const DEFAULT_PHI_PATTERNS: ReadonlyArray<PhiPattern> = [
  {
    id: 'ssn-dashed',
    // ###-##-#### — explicit dashes only, to avoid matching arbitrary 9-digit
    // numbers (timestamps, IDs).
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN-REDACTED]',
  },
  {
    id: 'us-phone-parens',
    // (###) ###-#### with optional space
    regex: /\(\d{3}\)\s?\d{3}-\d{4}/g,
    replacement: '[PHONE-REDACTED]',
  },
  {
    id: 'us-phone-dashed',
    // ###-###-#### — three dashed groups
    regex: /\b\d{3}-\d{3}-\d{4}\b/g,
    replacement: '[PHONE-REDACTED]',
  },
  {
    id: 'credit-card-spaced',
    // #### #### #### #### (Visa/MC/Discover formatting)
    regex: /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/g,
    replacement: '[CC-REDACTED]',
  },
] as const;

export interface RedactionResult {
  /** The redacted text (input unchanged when nothing matched). */
  text: string;
  /** Pattern IDs that matched at least once. */
  matchedPatterns: string[];
  /** Total number of substitutions applied across all patterns. */
  totalSubstitutions: number;
}

/**
 * Apply a set of redaction patterns to a string. Returns the redacted
 * text plus diagnostic counters (which patterns matched, how many
 * substitutions in total). Original text is returned unchanged when
 * no patterns match — useful for the hook's fast path.
 *
 * Patterns are applied in the order given. The regexes are reset
 * (`lastIndex = 0`) before each use so the function is safe to call
 * repeatedly even with shared global-flag regexes.
 */
export function redactPhi(
  text: string,
  patterns: ReadonlyArray<PhiPattern> = DEFAULT_PHI_PATTERNS
): RedactionResult {
  if (!text) {
    return { text, matchedPatterns: [], totalSubstitutions: 0 };
  }

  const matchedPatterns: string[] = [];
  let totalSubstitutions = 0;
  let current = text;

  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    const matches = current.match(pattern.regex);
    if (matches && matches.length > 0) {
      matchedPatterns.push(pattern.id);
      totalSubstitutions += matches.length;
      pattern.regex.lastIndex = 0;
      current = current.replace(pattern.regex, pattern.replacement);
    }
  }

  return { text: current, matchedPatterns, totalSubstitutions };
}
