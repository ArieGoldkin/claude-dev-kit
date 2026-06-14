/**
 * Terminal escape sequence helpers for the `terminalSequence` hook output
 * field (Claude Code v2.1.141+).
 *
 * CC restricts emitted sequences to OSC 0/1/2/9/99/777 and BEL. Anything
 * outside that allowlist is silently dropped by CC.
 *
 * @module lib/terminal-sequence
 */

/** OSC 2 — set window title. Pairs with BEL terminator. */
const OSC_SET_WINDOW_TITLE = '\x1b]2;';

/** BEL — terminator for OSC sequences and a standalone alert. */
const BEL = '\x07';

/**
 * Maximum title length. Most terminals truncate well before this, but
 * 200 chars is a reasonable safety bound that prevents accidentally
 * shoving a multi-KB string into the terminal stream.
 */
const MAX_TITLE_LENGTH = 200;

/**
 * Sanitize a title segment for inclusion in an OSC window-title sequence.
 *
 * Rejects characters that could break the escape sequence or smuggle
 * additional control codes:
 *
 *  - Control characters (anything < 0x20 except space) — would prematurely
 *    terminate or chain into another escape.
 *  - DEL (0x7F) — same risk.
 *  - The BEL terminator itself — would close the OSC early.
 *
 * Returns the cleaned segment. If sanitization would empty the segment,
 * returns an empty string and the caller should skip emitting the sequence.
 */
export function sanitizeTitleSegment(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  // Strip all C0 control codes (0x00–0x1F) and DEL (0x7F). The BEL (0x07)
  // and ESC (0x1B) are both inside that range, so they're caught here.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars is the point
  return input.replace(/[\x00-\x1f\x7f]/g, '').trim();
}

/**
 * Build a window-title terminal sequence from one or more title segments.
 *
 * Segments are joined with ` · ` (U+00B7 middle dot) and the result is
 * truncated at MAX_TITLE_LENGTH characters. Returns an empty string if all
 * segments sanitize to empty — caller should check and skip emitting.
 *
 * @param segments — title parts in display order, e.g. `["myproject", "main"]`
 * @returns the full escape sequence, or `""` if nothing renderable
 *
 * @example
 *   buildWindowTitleSequence(['ctk', 'feat/auth'])
 *   // → "\x1b]2;ctk · feat/auth\x07"
 */
export function buildWindowTitleSequence(segments: ReadonlyArray<string>): string {
  const cleaned = segments.map(sanitizeTitleSegment).filter((s) => s.length > 0);

  if (cleaned.length === 0) {
    return '';
  }

  let title = cleaned.join(' · ');
  if (title.length > MAX_TITLE_LENGTH) {
    title = title.slice(0, MAX_TITLE_LENGTH);
  }

  return `${OSC_SET_WINDOW_TITLE}${title}${BEL}`;
}
