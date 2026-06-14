/**
 * Tests for hook override system in run-hook.ts.
 *
 * @module tests/bin/run-hook-overrides
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isHookDisabled } from '../../bin/run-hook.js';

describe('isHookDisabled', () => {
  const originalEnv = process.env['CLAUDE_PROJECT_DIR'];
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join('/tmp', 'hook-overrides-'));
    process.env['CLAUDE_PROJECT_DIR'] = tmpDir;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['CLAUDE_PROJECT_DIR'] = originalEnv;
    } else {
      delete process.env['CLAUDE_PROJECT_DIR'];
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return false when CLAUDE_PROJECT_DIR is not set', () => {
    delete process.env['CLAUDE_PROJECT_DIR'];
    expect(isHookDisabled('posttool/lint-checker')).toBe(false);
  });

  it('should return false when overrides file does not exist', () => {
    expect(isHookDisabled('posttool/lint-checker')).toBe(false);
  });

  it('should return false when overrides file contains invalid JSON', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'hook-overrides.json'), 'not valid json');
    expect(isHookDisabled('posttool/lint-checker')).toBe(false);
  });

  it('should return false when disabled key is missing', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'hook-overrides.json'), '{"other": true}');
    expect(isHookDisabled('posttool/lint-checker')).toBe(false);
  });

  it('should return true when hook is in disabled list', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'hook-overrides.json'),
      JSON.stringify({ disabled: ['posttool/lint-checker', 'prompt/hipaa-context-injector'] })
    );
    expect(isHookDisabled('posttool/lint-checker')).toBe(true);
    expect(isHookDisabled('prompt/hipaa-context-injector')).toBe(true);
  });

  it('should return false when hook is NOT in disabled list', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'hook-overrides.json'),
      JSON.stringify({ disabled: ['posttool/lint-checker'] })
    );
    expect(isHookDisabled('posttool/error-warner')).toBe(false);
  });

  // =========================================================================
  // NON-DISABLEABLE HOOKS (Security-critical)
  // =========================================================================

  it('should NOT allow disabling pretool/security-blocker even when listed in overrides', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'hook-overrides.json'),
      JSON.stringify({ disabled: ['pretool/security-blocker'] })
    );
    expect(isHookDisabled('pretool/security-blocker')).toBe(false);
  });

  it('should still allow disabling non-security hooks while protecting security-blocker', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'hook-overrides.json'),
      JSON.stringify({ disabled: ['pretool/security-blocker', 'posttool/lint-checker'] })
    );
    // security-blocker stays enabled
    expect(isHookDisabled('pretool/security-blocker')).toBe(false);
    // lint-checker can still be disabled
    expect(isHookDisabled('posttool/lint-checker')).toBe(true);
  });

  it('should protect security-blocker even without CLAUDE_PROJECT_DIR set', () => {
    delete process.env['CLAUDE_PROJECT_DIR'];
    // Without project dir, all hooks return false (enabled), but security-blocker
    // has the additional guard that returns false before even checking the file
    expect(isHookDisabled('pretool/security-blocker')).toBe(false);
  });
});
