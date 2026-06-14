/**
 * Tests for phi-redactor lib.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_PHI_PATTERNS, redactPhi } from '../../src/lib/phi-redactor.js';

describe('redactPhi', () => {
  describe('SSN pattern', () => {
    it('redacts a standalone SSN', () => {
      const result = redactPhi('Patient SSN: 123-45-6789 confirmed.');
      expect(result.text).toBe('Patient SSN: [SSN-REDACTED] confirmed.');
      expect(result.matchedPatterns).toContain('ssn-dashed');
      expect(result.totalSubstitutions).toBe(1);
    });

    it('redacts multiple SSNs in one message', () => {
      const result = redactPhi('First: 111-22-3333. Second: 444-55-6666.');
      expect(result.text).toBe('First: [SSN-REDACTED]. Second: [SSN-REDACTED].');
      expect(result.totalSubstitutions).toBe(2);
    });

    it('does NOT redact 9 plain digits (could be timestamp/ID)', () => {
      const result = redactPhi('Request ID: 123456789 succeeded.');
      expect(result.text).toBe('Request ID: 123456789 succeeded.');
      expect(result.totalSubstitutions).toBe(0);
    });
  });

  describe('US phone pattern', () => {
    it('redacts (###) ###-#### format', () => {
      const result = redactPhi('Call (555) 123-4567 for help.');
      expect(result.text).toBe('Call [PHONE-REDACTED] for help.');
    });

    it('redacts ###-###-#### format', () => {
      const result = redactPhi('Phone: 555-123-4567');
      expect(result.text).toBe('Phone: [PHONE-REDACTED]');
    });

    it('does NOT redact a single 3-digit token (e.g. error code)', () => {
      const result = redactPhi('HTTP 404 error');
      expect(result.text).toBe('HTTP 404 error');
      expect(result.totalSubstitutions).toBe(0);
    });
  });

  describe('credit card pattern', () => {
    it('redacts space-separated CC number', () => {
      const result = redactPhi('Card: 4111 1111 1111 1111 charged.');
      expect(result.text).toBe('Card: [CC-REDACTED] charged.');
    });

    it('redacts dash-separated CC number', () => {
      const result = redactPhi('Card: 4111-1111-1111-1111');
      expect(result.text).toBe('Card: [CC-REDACTED]');
    });
  });

  describe('mixed and pass-through cases', () => {
    it('returns input unchanged when nothing matches', () => {
      const input = 'No sensitive data here at all.';
      const result = redactPhi(input);
      expect(result.text).toBe(input);
      expect(result.totalSubstitutions).toBe(0);
      expect(result.matchedPatterns).toEqual([]);
    });

    it('handles empty string gracefully', () => {
      const result = redactPhi('');
      expect(result.text).toBe('');
      expect(result.totalSubstitutions).toBe(0);
    });

    it('redacts mixed patterns in one pass', () => {
      const result = redactPhi(
        'Patient 123-45-6789 reached at (555) 123-4567.'
      );
      expect(result.text).toBe(
        'Patient [SSN-REDACTED] reached at [PHONE-REDACTED].'
      );
      expect(result.totalSubstitutions).toBe(2);
      expect(result.matchedPatterns).toEqual(
        expect.arrayContaining(['ssn-dashed', 'us-phone-parens'])
      );
    });

    it('is idempotent — running twice does not double-redact', () => {
      const once = redactPhi('SSN 123-45-6789');
      const twice = redactPhi(once.text);
      expect(twice.text).toBe(once.text);
      expect(twice.totalSubstitutions).toBe(0);
    });

    it('handles repeated calls safely (regex lastIndex reset)', () => {
      const input = 'SSN 123-45-6789 here.';
      for (let i = 0; i < 3; i++) {
        const r = redactPhi(input);
        expect(r.totalSubstitutions).toBe(1);
      }
    });
  });

  describe('false-positive guards', () => {
    it('does NOT match ISO timestamps as dates', () => {
      const input = 'Event at 2026-05-27 14:30:00 UTC';
      const result = redactPhi(input);
      expect(result.text).toBe(input);
    });

    it('does NOT match version strings', () => {
      const input = 'Release v2.1.152 shipped';
      const result = redactPhi(input);
      expect(result.text).toBe(input);
    });

    it('does NOT match commit emails (no email pattern by design)', () => {
      const input = 'See commit by alice@example.com';
      const result = redactPhi(input);
      expect(result.text).toBe(input);
    });
  });

  describe('custom pattern injection', () => {
    it('accepts a custom pattern set', () => {
      const custom = [
        {
          id: 'fake-id',
          regex: /MRN-\d{5}/g,
          replacement: '[MRN-REDACTED]',
        },
      ];
      const result = redactPhi('Patient MRN-12345 admitted.', custom);
      expect(result.text).toBe('Patient [MRN-REDACTED] admitted.');
      expect(result.matchedPatterns).toEqual(['fake-id']);
    });

    it('default pattern list has at least 4 entries', () => {
      expect(DEFAULT_PHI_PATTERNS.length).toBeGreaterThanOrEqual(4);
    });
  });
});
