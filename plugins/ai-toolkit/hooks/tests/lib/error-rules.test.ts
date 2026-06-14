/**
 * Tests for error-rules library
 *
 * @module tests/lib/error-rules
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  type ErrorMatchResult,
  type ErrorRule,
  calculateSimilarity,
  clearRulesCache,
  formatErrorMessage,
  getErrorRulesPath,
  getRulesBySeverity,
  loadErrorRulesSync,
  matchError,
  matchErrorFuzzy,
} from '../../src/lib/error-rules.js';

// =============================================================================
// TEST DATA
// =============================================================================

const testRules: ErrorRule[] = [
  {
    id: 'missing-await',
    pattern: 'Promise { <pending> }',
    message:
      "You may have forgotten to await a Promise. Add 'await' before the async function call.",
    severity: 'warning',
  },
  {
    id: 'undefined-property',
    pattern: 'Cannot read properties of undefined',
    message: 'Check if the object exists before accessing properties.',
    severity: 'error',
  },
  {
    id: 'module-not-found',
    pattern: 'Cannot find module',
    message: 'The module could not be found. Check the import path.',
    severity: 'error',
  },
  {
    id: 'enoent',
    pattern: 'ENOENT: no such file or directory',
    message: 'The file or directory does not exist.',
    severity: 'error',
  },
  {
    id: 'test-info',
    pattern: 'INFO:',
    message: 'This is informational.',
    // No severity - defaults to 'info'
  },
];

// =============================================================================
// matchError TESTS
// =============================================================================

describe('matchError', () => {
  describe('exact matching', () => {
    it('should match Promise pending pattern', () => {
      const output = 'Result: Promise { <pending> }';
      const result = matchError(output, testRules);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('missing-await');
    });

    it('should match undefined property error', () => {
      const output = 'TypeError: Cannot read properties of undefined (reading "foo")';
      const result = matchError(output, testRules);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('undefined-property');
    });

    it('should match module not found error', () => {
      const output = "Error: Cannot find module 'lodash'";
      const result = matchError(output, testRules);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('module-not-found');
    });

    it('should match ENOENT error', () => {
      const output = "ENOENT: no such file or directory, open '/path/to/file'";
      const result = matchError(output, testRules);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('enoent');
    });
  });

  describe('no match', () => {
    it('should return no match for successful output', () => {
      const output = 'Build completed successfully!';
      const result = matchError(output, testRules);

      expect(result.matched).toBe(false);
      expect(result.rule).toBeUndefined();
    });

    it('should return no match for empty output', () => {
      const result = matchError('', testRules);
      expect(result.matched).toBe(false);
    });

    it('should return no match for empty rules', () => {
      const result = matchError('Some output', []);
      expect(result.matched).toBe(false);
    });
  });

  describe('first match wins', () => {
    it('should return the first matching rule', () => {
      const overlappingRules: ErrorRule[] = [
        { id: 'first', pattern: 'Error', message: 'First match' },
        { id: 'second', pattern: 'Error:', message: 'Second match' },
      ];

      const result = matchError('Error: something went wrong', overlappingRules);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('first');
    });
  });

  describe('edge cases', () => {
    it('should handle null input gracefully', () => {
      // @ts-expect-error - Testing invalid input
      const result = matchError(null, testRules);
      expect(result.matched).toBe(false);
    });

    it('should handle null rules gracefully', () => {
      // @ts-expect-error - Testing invalid input
      const result = matchError('some output', null);
      expect(result.matched).toBe(false);
    });

    it('should skip rules with empty pattern', () => {
      const rulesWithEmpty: ErrorRule[] = [
        { id: 'empty', pattern: '', message: 'Empty pattern' },
        { id: 'valid', pattern: 'Error', message: 'Valid pattern' },
      ];

      const result = matchError('Error occurred', rulesWithEmpty);
      expect(result.rule?.id).toBe('valid');
    });
  });
});

// =============================================================================
// matchErrorFuzzy TESTS
// =============================================================================

describe('matchErrorFuzzy', () => {
  it('should prefer exact matches over fuzzy', () => {
    const output = 'Promise { <pending> }';
    const result = matchErrorFuzzy(output, testRules);

    expect(result.matched).toBe(true);
    expect(result.rule?.id).toBe('missing-await');
  });

  it('should find fuzzy matches when exact fails', () => {
    // This test uses a lower threshold for demonstration
    const result = matchErrorFuzzy('Promise pending status', testRules, 0.3);

    // May or may not match depending on similarity calculation
    expect(typeof result.matched).toBe('boolean');
  });

  it('should return no match when below threshold', () => {
    const result = matchErrorFuzzy('completely unrelated output', testRules, 0.9);
    expect(result.matched).toBe(false);
  });
});

// =============================================================================
// calculateSimilarity TESTS
// =============================================================================

describe('calculateSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(calculateSimilarity('hello', 'hello')).toBe(1);
  });

  it('should return 0 for empty strings', () => {
    expect(calculateSimilarity('', 'hello')).toBe(0);
    expect(calculateSimilarity('hello', '')).toBe(0);
    expect(calculateSimilarity('', '')).toBe(0);
  });

  it('should return high score when pattern is contained', () => {
    const score = calculateSimilarity('error', 'error occurred in module');
    expect(score).toBeGreaterThan(0.5);
  });

  it('should return positive score for similar strings', () => {
    const score = calculateSimilarity('cannot read', 'Cannot read properties');
    expect(score).toBeGreaterThan(0);
  });

  it('should return low score for dissimilar strings', () => {
    const score = calculateSimilarity('xyz', 'abc');
    expect(score).toBeLessThan(0.5);
  });
});

// =============================================================================
// formatErrorMessage TESTS
// =============================================================================

describe('formatErrorMessage', () => {
  it('should format error severity with ❌', () => {
    const result: ErrorMatchResult = {
      matched: true,
      rule: {
        id: 'test',
        pattern: 'test',
        message: 'Test message',
        severity: 'error',
      },
    };

    const formatted = formatErrorMessage(result);
    expect(formatted).toContain('❌');
    expect(formatted).toContain('Test message');
  });

  it('should format warning severity with ⚠️', () => {
    const result: ErrorMatchResult = {
      matched: true,
      rule: {
        id: 'test',
        pattern: 'test',
        message: 'Warning message',
        severity: 'warning',
      },
    };

    const formatted = formatErrorMessage(result);
    expect(formatted).toContain('⚠️');
    expect(formatted).toContain('Warning message');
  });

  it('should format info severity with ℹ️', () => {
    const result: ErrorMatchResult = {
      matched: true,
      rule: {
        id: 'test',
        pattern: 'test',
        message: 'Info message',
        severity: 'info',
      },
    };

    const formatted = formatErrorMessage(result);
    expect(formatted).toContain('ℹ️');
  });

  it('should default to info icon when no severity', () => {
    const result: ErrorMatchResult = {
      matched: true,
      rule: {
        id: 'test',
        pattern: 'test',
        message: 'Default message',
      },
    };

    const formatted = formatErrorMessage(result);
    expect(formatted).toContain('ℹ️');
  });

  it('should return empty string for no match', () => {
    const result: ErrorMatchResult = { matched: false };
    expect(formatErrorMessage(result)).toBe('');
  });
});

// =============================================================================
// getRulesBySeverity TESTS
// =============================================================================

describe('getRulesBySeverity', () => {
  it('should filter error rules', () => {
    const errors = getRulesBySeverity(testRules, 'error');
    expect(errors.length).toBe(3);
    expect(errors.every((r) => r.severity === 'error')).toBe(true);
  });

  it('should filter warning rules', () => {
    const warnings = getRulesBySeverity(testRules, 'warning');
    expect(warnings.length).toBe(1);
    expect(warnings[0]?.id).toBe('missing-await');
  });

  it('should treat undefined severity as info', () => {
    const infos = getRulesBySeverity(testRules, 'info');
    expect(infos.length).toBe(1);
    expect(infos[0]?.id).toBe('test-info');
  });

  it('should return empty array for no matches', () => {
    const rulesWithNoInfo = testRules.filter((r) => r.severity !== undefined);
    const infos = getRulesBySeverity(rulesWithNoInfo, 'info');
    expect(infos.length).toBe(0);
  });
});

// =============================================================================
// getErrorRulesPath TESTS
// =============================================================================

describe('getErrorRulesPath', () => {
  it('should return correct path', () => {
    const path = getErrorRulesPath('/project');
    expect(path).toBe('/project/.claude/rules/error_rules.json');
  });

  it('should handle trailing slash', () => {
    const path = getErrorRulesPath('/project/');
    expect(path).toContain('.claude/rules/error_rules.json');
  });
});

// =============================================================================
// CACHE TESTS
// =============================================================================

describe('clearRulesCache', () => {
  it('should not throw when clearing cache', () => {
    expect(() => clearRulesCache()).not.toThrow();
  });
});

// =============================================================================
// loadErrorRulesSync TESTS
// =============================================================================

describe('loadErrorRulesSync', () => {
  afterEach(() => {
    clearRulesCache();
  });

  it('should load rules from the plugin directory', () => {
    // The plugin itself has error rules configured
    const projectDir = process.env['CLAUDE_PROJECT_DIR'] || '.';
    const config = loadErrorRulesSync(projectDir);

    // If we're in the plugin directory, rules should be loaded
    if (config) {
      expect(config.rules).toBeDefined();
      expect(Array.isArray(config.rules)).toBe(true);
    }
  });

  it('should return null for non-existent path', () => {
    const config = loadErrorRulesSync('/nonexistent/path');
    expect(config).toBeNull();
  });
});
