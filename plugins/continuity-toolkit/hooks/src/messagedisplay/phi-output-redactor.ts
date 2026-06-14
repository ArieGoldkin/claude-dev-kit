/**
 * MessageDisplay hook — output-side PHI / PII redactor (CC v2.1.152+).
 *
 * Mirrors `prompt/hipaa-context-injector` on the OUTPUT side: where
 * the input-side hook injects compliance context into Claude's view
 * of the user's prompt, this hook scans Claude's outgoing message
 * text and redacts high-confidence PHI / PII patterns before display.
 *
 * Defense in depth, not a HIPAA compliance claim. The patterns are
 * conservative (SSN, US phone, credit card) and live in the shared
 * `phi-redactor` lib so they can be reused for handoff scrubbing.
 *
 * OPT-IN. Default OFF. Enable per-project with the env var:
 *
 *   CONTINUITY_PHI_OUTPUT_REDACT=1
 *
 * Rationale for opt-in: a silent output transform is invasive UX.
 * Users on regulated codebases should turn it on knowingly; default
 * users should not see surprise `[SSN-REDACTED]` placeholders when
 * pasting example data.
 *
 * @module messagedisplay/phi-output-redactor
 */

import { logDebug, logInfo } from '../lib/logging.js';
import { outputMessageDisplay, outputSilentSuccess } from '../lib/output.js';
import { redactPhi } from '../lib/phi-redactor.js';
import type { HookInput, HookResult } from '../types.js';

const HOOK_NAME = 'phi-output-redactor';
const OPT_IN_ENV_VAR = 'CONTINUITY_PHI_OUTPUT_REDACT';

/**
 * Extract the assistant message text from MessageDisplay hook input.
 *
 * CC v2.1.152 docs are sparse on exact field naming. Try the most
 * likely fields in order: top-level `message`, `text`, then
 * `last_assistant_message` (already typed on HookInput), and fall
 * back to `tool_input.message`. Return null if no candidate found —
 * the hook then becomes a no-op.
 */
export function extractAssistantMessage(input: HookInput): string | null {
  const record = input as unknown as Record<string, unknown>;

  const candidates = [
    record['message'],
    record['text'],
    record['assistant_message'],
    input.last_assistant_message,
    (input.tool_input as Record<string, unknown> | undefined)?.['message'],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

/**
 * MessageDisplay hook entry point.
 *
 * Fast path: opt-in env var not set → returns outputSilentSuccess().
 * Slow path: scan message, redact if matched, return transformed text.
 */
export async function phiOutputRedactor(input: HookInput): Promise<HookResult> {
  // Opt-in check first — keeps the no-op path zero-cost
  if (process.env[OPT_IN_ENV_VAR] !== '1') {
    logDebug(HOOK_NAME, 'Opt-in not set, skipping');
    return outputSilentSuccess();
  }

  const message = extractAssistantMessage(input);
  if (!message) {
    logDebug(HOOK_NAME, 'No assistant message text found, skipping');
    return outputSilentSuccess();
  }

  const result = redactPhi(message);
  if (result.totalSubstitutions === 0) {
    logDebug(HOOK_NAME, `No PHI patterns matched in ${message.length}-char message`);
    return outputSilentSuccess();
  }

  logInfo(
    HOOK_NAME,
    `Redacted ${result.totalSubstitutions} match(es) across ${result.matchedPatterns.length} pattern(s): ${result.matchedPatterns.join(', ')}`
  );

  return outputMessageDisplay(result.text);
}

export default phiOutputRedactor;
