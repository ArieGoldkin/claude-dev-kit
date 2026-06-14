/**
 * Tests for the phi-output-redactor MessageDisplay hook.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  extractAssistantMessage,
  phiOutputRedactor,
} from '../../src/messagedisplay/phi-output-redactor.js';
import type { HookInput } from '../../src/types.js';

const OPT_IN_ENV_VAR = 'CONTINUITY_PHI_OUTPUT_REDACT';

function makeInput(message: string | null, extras: Partial<HookInput> = {}): HookInput {
  const base = {
    tool_name: 'Bash',
    tool_input: {},
    hook_event_name: 'MessageDisplay',
    ...extras,
  } as HookInput;
  if (message !== null) {
    (base as unknown as Record<string, unknown>)['message'] = message;
  }
  return base;
}

describe('extractAssistantMessage', () => {
  it('reads top-level `message`', () => {
    const input = makeInput('hello world');
    expect(extractAssistantMessage(input)).toBe('hello world');
  });

  it('reads top-level `text` as fallback', () => {
    const input = { tool_name: 'Bash', tool_input: {}, text: 'from text' } as unknown as HookInput;
    expect(extractAssistantMessage(input)).toBe('from text');
  });

  it('reads `last_assistant_message` as fallback', () => {
    const input: HookInput = {
      tool_name: 'Bash',
      tool_input: {},
      last_assistant_message: 'tail-message',
    };
    expect(extractAssistantMessage(input)).toBe('tail-message');
  });

  it('returns null when nothing is present', () => {
    const input: HookInput = { tool_name: 'Bash', tool_input: {} };
    expect(extractAssistantMessage(input)).toBeNull();
  });

  it('returns null on empty string', () => {
    const input = makeInput('');
    expect(extractAssistantMessage(input)).toBeNull();
  });
});

describe('phiOutputRedactor', () => {
  beforeEach(() => {
    delete process.env[OPT_IN_ENV_VAR];
  });
  afterEach(() => {
    delete process.env[OPT_IN_ENV_VAR];
  });

  describe('opt-in gating', () => {
    it('returns silent success when env var is unset', async () => {
      const input = makeInput('SSN 123-45-6789 here.');
      const result = await phiOutputRedactor(input);
      expect(result.hookSpecificOutput).toBeUndefined();
      expect(result.continue).toBe(true);
    });

    it('returns silent success when env var is set to "0"', async () => {
      process.env[OPT_IN_ENV_VAR] = '0';
      const input = makeInput('SSN 123-45-6789 here.');
      const result = await phiOutputRedactor(input);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('activates when env var is exactly "1"', async () => {
      process.env[OPT_IN_ENV_VAR] = '1';
      const input = makeInput('SSN 123-45-6789 here.');
      const result = await phiOutputRedactor(input);
      expect(result.hookSpecificOutput?.hookEventName).toBe('MessageDisplay');
    });

    it('does NOT activate on truthy-ish values other than "1"', async () => {
      process.env[OPT_IN_ENV_VAR] = 'true';
      const input = makeInput('SSN 123-45-6789 here.');
      const result = await phiOutputRedactor(input);
      expect(result.hookSpecificOutput).toBeUndefined();
    });
  });

  describe('redaction behavior (env on)', () => {
    beforeEach(() => {
      process.env[OPT_IN_ENV_VAR] = '1';
    });

    it('redacts a single SSN and returns transformedMessage', async () => {
      const input = makeInput('Patient SSN 123-45-6789 admitted.');
      const result = await phiOutputRedactor(input);
      expect(result.hookSpecificOutput?.['transformedMessage']).toBe(
        'Patient SSN [SSN-REDACTED] admitted.'
      );
    });

    it('returns silent success when nothing matches (no transform needed)', async () => {
      const input = makeInput('All clear, no sensitive data.');
      const result = await phiOutputRedactor(input);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('returns silent success when no message text is present', async () => {
      const input = makeInput(null);
      const result = await phiOutputRedactor(input);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('redacts mixed PHI patterns', async () => {
      const input = makeInput(
        'Patient 123-45-6789 reached at (555) 123-4567 via card 4111-1111-1111-1111.'
      );
      const result = await phiOutputRedactor(input);
      const out = result.hookSpecificOutput?.['transformedMessage'] as string;
      expect(out).toContain('[SSN-REDACTED]');
      expect(out).toContain('[PHONE-REDACTED]');
      expect(out).toContain('[CC-REDACTED]');
    });
  });
});
