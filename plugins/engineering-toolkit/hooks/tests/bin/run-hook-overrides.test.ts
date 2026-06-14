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
      JSON.stringify({ disabled: ['posttool/lint-checker', 'prompt/context-monitor'] })
    );
    expect(isHookDisabled('posttool/lint-checker')).toBe(true);
    expect(isHookDisabled('prompt/context-monitor')).toBe(true);
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
});
