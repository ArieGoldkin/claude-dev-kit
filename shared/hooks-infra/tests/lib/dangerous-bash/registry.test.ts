/**
 * Tests for the dangerous-bash registry walker (matchDangerousBash).
 *
 * Verifies category opt-out via CTK_DISABLE_CATEGORY and evaluation order
 * (filesystem → http → aws → terraform) so first-match semantics are
 * preserved across the refactor and across category additions.
 *
 * @module tests/lib/dangerous-bash/registry
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AWS_PATTERNS,
  FILESYSTEM_PATTERNS,
  HTTP_PATTERNS,
  TERRAFORM_PATTERNS,
  matchDangerousBash,
} from '../../../src/lib/dangerous-bash/index.js';

describe('matchDangerousBash', () => {
  const original = process.env['CTK_DISABLE_CATEGORY'];

  beforeEach(() => {
    delete process.env['CTK_DISABLE_CATEGORY'];
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env['CTK_DISABLE_CATEGORY'];
    } else {
      process.env['CTK_DISABLE_CATEGORY'] = original;
    }
  });

  describe('benign input', () => {
    it('returns null for a totally benign command', () => {
      expect(matchDangerousBash('git status')).toBeNull();
    });

    it('returns null for a safe rm on a relative path', () => {
      expect(matchDangerousBash('rm -rf ./node_modules')).toBeNull();
    });

    it('returns null for a safe curl GET', () => {
      expect(matchDangerousBash('curl https://api.example.com/items')).toBeNull();
    });
  });

  describe('first-match semantics', () => {
    it('returns the first matching pattern across categories (filesystem first)', () => {
      // A command that matches a filesystem pattern AND happens to mention curl;
      // the filesystem rule must win because filesystem is evaluated first.
      const match = matchDangerousBash('rm -rf / && curl -X DELETE https://api.example.com/x');
      expect(match).not.toBeNull();
      expect(match?.pattern.category).toBe('filesystem');
    });

    it('returns http match when no filesystem pattern matches', () => {
      const match = matchDangerousBash('curl -X DELETE https://api.example.com/items/123');
      expect(match).not.toBeNull();
      expect(match?.pattern.category).toBe('http');
    });

    it('returns matchedText that is a substring of the input', () => {
      const command = 'echo hi && curl -X DELETE https://api.example.com/items';
      const match = matchDangerousBash(command);
      expect(match).not.toBeNull();
      expect(command).toContain(match?.matchedText ?? '');
    });
  });

  describe('CTK_DISABLE_CATEGORY single-category', () => {
    it('skips http when CTK_DISABLE_CATEGORY=http', () => {
      process.env['CTK_DISABLE_CATEGORY'] = 'http';
      expect(matchDangerousBash('curl -X DELETE https://api.example.com/x')).toBeNull();
    });

    it('still matches filesystem when only http is disabled', () => {
      process.env['CTK_DISABLE_CATEGORY'] = 'http';
      const match = matchDangerousBash('rm -rf /');
      expect(match?.pattern.category).toBe('filesystem');
    });

    it('skips filesystem when CTK_DISABLE_CATEGORY=filesystem', () => {
      process.env['CTK_DISABLE_CATEGORY'] = 'filesystem';
      expect(matchDangerousBash('rm -rf /')).toBeNull();
    });
  });

  describe('CTK_DISABLE_CATEGORY multi-category', () => {
    it('skips both categories when comma-separated', () => {
      process.env['CTK_DISABLE_CATEGORY'] = 'filesystem,http';
      expect(matchDangerousBash('rm -rf /')).toBeNull();
      expect(matchDangerousBash('curl -X DELETE https://api.example.com/x')).toBeNull();
    });

    it('handles whitespace around comma-separated values', () => {
      process.env['CTK_DISABLE_CATEGORY'] = ' filesystem , http ';
      expect(matchDangerousBash('rm -rf /')).toBeNull();
      expect(matchDangerousBash('curl -X DELETE https://api.example.com/x')).toBeNull();
    });

    it('ignores unknown category names silently', () => {
      process.env['CTK_DISABLE_CATEGORY'] = 'bogus,nope';
      const match = matchDangerousBash('rm -rf /');
      expect(match?.pattern.category).toBe('filesystem');
    });

    it('skips aws + terraform when both are listed', () => {
      process.env['CTK_DISABLE_CATEGORY'] = 'aws,terraform';
      expect(matchDangerousBash('aws ec2 terminate-instances --instance-ids i-1')).toBeNull();
      expect(matchDangerousBash('terraform destroy')).toBeNull();
    });

    it('skips all four categories when all are listed', () => {
      process.env['CTK_DISABLE_CATEGORY'] = 'filesystem,http,aws,terraform';
      expect(matchDangerousBash('rm -rf /')).toBeNull();
      expect(matchDangerousBash('curl -X DELETE https://api.example.com/x')).toBeNull();
      expect(matchDangerousBash('aws ec2 terminate-instances --instance-ids i-1')).toBeNull();
      expect(matchDangerousBash('terraform destroy')).toBeNull();
    });
  });

  describe('evaluation order across categories', () => {
    it('returns aws match when input only matches aws', () => {
      const match = matchDangerousBash('aws cloudformation delete-stack --stack-name prod');
      expect(match?.pattern.category).toBe('aws');
    });

    it('returns terraform match when input only matches terraform', () => {
      const match = matchDangerousBash('terraform destroy');
      expect(match?.pattern.category).toBe('terraform');
    });

    it('filesystem still wins over aws when both could match', () => {
      // rm -rf / matches filesystem; the AWS-shaped suffix is irrelevant because
      // filesystem is checked first.
      const match = matchDangerousBash('rm -rf / && aws ec2 terminate-instances --instance-ids i-1');
      expect(match?.pattern.category).toBe('filesystem');
    });
  });

  describe('registry composition', () => {
    it('exports FILESYSTEM_PATTERNS with at least one entry', () => {
      expect(FILESYSTEM_PATTERNS.length).toBeGreaterThan(0);
    });

    it('exports HTTP_PATTERNS with at least one entry', () => {
      expect(HTTP_PATTERNS.length).toBeGreaterThan(0);
    });

    it('exports AWS_PATTERNS with at least one entry', () => {
      expect(AWS_PATTERNS.length).toBeGreaterThan(0);
    });

    it('exports TERRAFORM_PATTERNS with at least one entry', () => {
      expect(TERRAFORM_PATTERNS.length).toBeGreaterThan(0);
    });
  });
});
