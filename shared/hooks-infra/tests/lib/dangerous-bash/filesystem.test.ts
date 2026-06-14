/**
 * Tests for the filesystem-destructive dangerous-bash patterns.
 *
 * Focus: the audit-P1 hardening — split rm flags ("rm -r -f /"), binary-path
 * and `command`-builtin anchors ("/bin/rm", "command rm"), and the chmod
 * home-directory target ("chmod -R 777 ~"). Also pins false-positive
 * behavior so benign commands stay unblocked.
 *
 * @module tests/lib/dangerous-bash/filesystem
 */

import { describe, expect, it } from 'vitest';
import { FILESYSTEM_PATTERNS, matchDangerousBash } from '../../../src/lib/dangerous-bash/index.js';

function expectFilesystemMatch(command: string): void {
  const match = matchDangerousBash(command);
  expect(match, `expected a filesystem match for: ${command}`).not.toBeNull();
  expect(match?.pattern.category).toBe('filesystem');
}

function expectNoMatch(command: string): void {
  const match = matchDangerousBash(command);
  expect(match, `expected NO match for: ${command}`).toBeNull();
}

// =============================================================================
// FILESYSTEM_PATTERNS shape
// =============================================================================

describe('FILESYSTEM_PATTERNS', () => {
  it('should be a non-empty array tagged category="filesystem"', () => {
    expect(FILESYSTEM_PATTERNS.length).toBeGreaterThan(0);
    for (const pattern of FILESYSTEM_PATTERNS) {
      expect(pattern.category).toBe('filesystem');
      expect(pattern.description.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// combined-flag rm (pre-existing behavior, still pinned)
// =============================================================================

describe('rm with combined flags', () => {
  it('matches rm -rf /', () => {
    expectFilesystemMatch('rm -rf /');
  });

  it('matches sudo rm -rf /', () => {
    expectFilesystemMatch('sudo rm -rf /');
  });

  it('matches compound "cd /tmp && rm -rf /"', () => {
    expectFilesystemMatch('cd /tmp && rm -rf /');
  });

  it('matches rm -rf ~ and rm -fr ~', () => {
    expectFilesystemMatch('rm -rf ~');
    expectFilesystemMatch('rm -fr ~');
  });

  it('matches interleaved combined flags on home (rm -rfv ~)', () => {
    expectFilesystemMatch('rm -rfv ~');
  });
});

// =============================================================================
// split-flag rm (audit P1: flag tokenization)
// =============================================================================

describe('rm with split flags (audit P1)', () => {
  it('matches rm -r -f /', () => {
    expectFilesystemMatch('rm -r -f /');
  });

  it('matches rm -f -r /', () => {
    expectFilesystemMatch('rm -f -r /');
  });

  it('matches rm -r -f ~', () => {
    expectFilesystemMatch('rm -r -f ~');
  });

  it('matches rm --recursive --force /', () => {
    expectFilesystemMatch('rm --recursive --force /');
  });

  it('matches rm --force --recursive ~', () => {
    expectFilesystemMatch('rm --force --recursive ~');
  });

  it('matches split flags with an interleaved benign flag (rm -r -v -f /)', () => {
    expectFilesystemMatch('rm -r -v -f /');
  });

  it('matches sudo rm -r -f /', () => {
    expectFilesystemMatch('sudo rm -r -f /');
  });
});

// =============================================================================
// anchor hardening (audit P1: binary paths + command builtin)
// =============================================================================

describe('rm anchor hardening (audit P1)', () => {
  it('matches /bin/rm -rf /', () => {
    expectFilesystemMatch('/bin/rm -rf /');
  });

  it('matches /usr/bin/rm -rf /', () => {
    expectFilesystemMatch('/usr/bin/rm -rf /');
  });

  it('matches command rm -rf /', () => {
    expectFilesystemMatch('command rm -rf /');
  });

  it('matches command rm -r -f /', () => {
    expectFilesystemMatch('command rm -r -f /');
  });

  it('matches /bin/rm -r -f ~', () => {
    expectFilesystemMatch('/bin/rm -r -f ~');
  });
});

// =============================================================================
// chmod (audit P1: ~ target + anchors)
// =============================================================================

describe('chmod hardening (audit P1)', () => {
  it('matches chmod -R 777 /', () => {
    expectFilesystemMatch('chmod -R 777 /');
  });

  it('matches chmod -R 777 ~', () => {
    expectFilesystemMatch('chmod -R 777 ~');
  });

  it('matches /bin/chmod -R 777 /', () => {
    expectFilesystemMatch('/bin/chmod -R 777 /');
  });

  it('matches command chmod -R 777 ~', () => {
    expectFilesystemMatch('command chmod -R 777 ~');
  });
});

// =============================================================================
// false-positive pins
// =============================================================================

describe('filesystem false positives stay unblocked', () => {
  it('does not match rm on a relative path', () => {
    expectNoMatch('rm -rf node_modules');
    expectNoMatch('rm -r -f ./build');
  });

  it('does not match rm without the force flag', () => {
    expectNoMatch('rm -r ./dist');
  });

  it('does not match words ending in "rm" (confirm, firm)', () => {
    expectNoMatch('confirm -rf /');
    expectNoMatch('./firm -r -f /');
  });

  it('does not match a binary whose name merely ends in rm (/bin/confirm)', () => {
    expectNoMatch('/usr/bin/confirm -rf /');
  });

  it('does not match chmod with a normal mode on a relative path', () => {
    expectNoMatch('chmod -R 755 ./scripts');
    expectNoMatch('chmod 644 README.md');
  });
});
