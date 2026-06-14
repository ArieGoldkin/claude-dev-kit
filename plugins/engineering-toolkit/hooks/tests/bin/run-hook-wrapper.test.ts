/**
 * E2E tests for the resilient POSIX shell wrapper script.
 *
 * Tests the wrapper's defense-in-depth behavior:
 * - Valid hook execution through wrapper
 * - Missing dist/ fallback
 * - Missing CLAUDE_PLUGIN_ROOT derivation
 * - Missing hook name fallback
 *
 * @module tests/bin/run-hook-wrapper
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const WRAPPER_PATH = path.join(PLUGIN_ROOT, 'bin', 'run-hook-wrapper.sh');

/**
 * Run the wrapper script with given args and input.
 */
function runWrapper(
  hookName: string,
  input?: string,
  env?: Record<string, string>
): { stdout: string; exitCode: number } {
  const mergedEnv = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
    ...env,
  };

  try {
    const cmd = input
      ? `echo '${input.replace(/'/g, "'\\''")}' | sh "${WRAPPER_PATH}" ${hookName}`
      : `sh "${WRAPPER_PATH}" ${hookName}`;

    const stdout = execSync(cmd, {
      env: mergedEnv,
      timeout: 15000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (error: unknown) {
    // execSync throws on non-zero exit
    const execError = error as { stdout?: Buffer | string; status?: number };
    const stdout = execError.stdout
      ? typeof execError.stdout === 'string'
        ? execError.stdout
        : execError.stdout.toString('utf8')
      : '';
    return { stdout: stdout.trim(), exitCode: execError.status ?? 1 };
  }
}

describe('run-hook-wrapper.sh', () => {
  it('should execute a valid hook and return JSON', () => {
    const input = JSON.stringify({
      hook_event_name: 'SessionStart',
      source: 'test',
    });

    const { stdout, exitCode } = runWrapper('lifecycle/session-loader', input);

    expect(exitCode).toBe(0);
    expect(stdout).toBeTruthy();

    // Should be valid JSON
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('continue');
  });

  it('should return safe JSON when no hook name provided', () => {
    const { stdout, exitCode } = runWrapper('');

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.continue).toBe(true);
    expect(parsed.suppressOutput).toBe(true);
  });

  it('should return warning JSON when dist/ is missing', () => {
    // Point to a fake plugin root with no dist/
    const tmpDir = fs.mkdtempSync(path.join('/tmp', 'wrapper-test-'));
    const binDir = path.join(tmpDir, 'hooks', 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    // Copy the wrapper to temp location
    fs.copyFileSync(WRAPPER_PATH, path.join(binDir, 'run-hook-wrapper.sh'));

    try {
      const { stdout, exitCode } = runWrapper('lifecycle/session-loader', undefined, {
        CLAUDE_PLUGIN_ROOT: tmpDir,
      });

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.continue).toBe(true);
      expect(parsed.systemMessage).toContain('compiled hooks not found');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should derive CLAUDE_PLUGIN_ROOT from script location', () => {
    const input = JSON.stringify({
      hook_event_name: 'SessionStart',
      source: 'test',
    });

    // Run without CLAUDE_PLUGIN_ROOT — wrapper should derive it
    const { stdout, exitCode } = runWrapper('lifecycle/session-loader', input, {
      CLAUDE_PLUGIN_ROOT: '',
    });

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('continue');
  });

  it('should handle unknown hook names gracefully', () => {
    const input = JSON.stringify({
      hook_event_name: 'SessionStart',
      source: 'test',
    });

    const { stdout, exitCode } = runWrapper('nonexistent/hook-name', input);

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.continue).toBe(true);
  });

  it('should always exit 0', () => {
    // Even with garbage input, should exit 0
    const { exitCode } = runWrapper('lifecycle/session-loader', 'not json at all');

    expect(exitCode).toBe(0);
  });
});
