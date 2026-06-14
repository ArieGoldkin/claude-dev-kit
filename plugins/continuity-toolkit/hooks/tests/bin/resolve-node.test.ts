/**
 * Tests for the resolve_node() function in run-hook-wrapper.sh.
 *
 * Verifies Node.js binary discovery across environments:
 * - PATH lookup (regular Anthropic / Bedrock users)
 * - CLAUDE_NODE_PATH override (manual configuration)
 * - nvm directory probe (devcontainer users)
 * - fnm directory probe
 * - volta directory probe
 * - Warning throttle (once per session, not per hook)
 *
 * @module tests/bin/resolve-node
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const WRAPPER_PATH = path.join(PLUGIN_ROOT, 'bin', 'run-hook-wrapper.sh');

/**
 * A PATH that has basic POSIX tools (cat, ls, sort, grep, head, tail, touch)
 * but does NOT include node. Used to simulate "node not found" environments.
 */
const PATH_WITHOUT_NODE = '/bin:/usr/bin:/usr/sbin';

/** Try to parse JSON, return empty object on failure. */
function tryParseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/** Extract stdout string from execSync error. */
function extractStdout(error: unknown): string {
  const e = error as { stdout?: Buffer | string };
  if (!e.stdout) return '';
  return typeof e.stdout === 'string' ? e.stdout : e.stdout.toString('utf8');
}

/**
 * Run the wrapper with a controlled environment.
 * Returns parsed JSON from stdout.
 */
function runWrapper(
  hookName: string,
  opts: {
    input?: string;
    env?: Record<string, string>;
  } = {}
): { stdout: string; json: Record<string, unknown>; exitCode: number } {
  const mergedEnv: Record<string, string> = {
    HOME: process.env.HOME ?? '/tmp',
    PATH: process.env.PATH ?? '',
    CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
    CLAUDE_PLUGIN_NAME: 'continuity',
    ...opts.env,
  };

  const escapedInput = opts.input?.replace(/'/g, "'\\''") ?? '';
  const cmd = opts.input
    ? `echo '${escapedInput}' | sh "${WRAPPER_PATH}" ${hookName}`
    : `sh "${WRAPPER_PATH}" ${hookName}`;

  try {
    const stdout = execSync(cmd, {
      env: mergedEnv,
      timeout: 15000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    return { stdout, json: tryParseJson(stdout), exitCode: 0 };
  } catch (error: unknown) {
    const stdout = extractStdout(error).trim();
    const exitCode = (error as { status?: number }).status ?? 1;
    return { stdout, json: tryParseJson(stdout), exitCode };
  }
}

describe('resolve_node() in run-hook-wrapper.sh', () => {
  describe('happy path — node on PATH', () => {
    it('should find node on PATH and execute hook', () => {
      const input = JSON.stringify({
        hook_event_name: 'SessionStart',
        source: 'test',
      });

      const { json, exitCode } = runWrapper('lifecycle/session-loader', { input });

      expect(exitCode).toBe(0);
      expect(json).toHaveProperty('continue');
      // Should NOT have the "node not found" warning
      expect(json.systemMessage ?? '').not.toContain('node not found');
    });
  });

  describe('CLAUDE_NODE_PATH override', () => {
    it('should use CLAUDE_NODE_PATH when set to valid node binary', () => {
      // Find actual node path to use as override
      const nodePath = execSync('which node', { encoding: 'utf8' }).trim();

      const input = JSON.stringify({
        hook_event_name: 'SessionStart',
        source: 'test',
      });

      const { json, exitCode } = runWrapper('lifecycle/session-loader', {
        input,
        env: { CLAUDE_NODE_PATH: nodePath },
      });

      expect(exitCode).toBe(0);
      expect(json).toHaveProperty('continue');
      expect(json.systemMessage ?? '').not.toContain('node not found');
    });

    it('should ignore CLAUDE_NODE_PATH when set to non-existent path', () => {
      // With a bad CLAUDE_NODE_PATH but node still on PATH, should fall through to PATH
      const input = JSON.stringify({
        hook_event_name: 'SessionStart',
        source: 'test',
      });

      const { json, exitCode } = runWrapper('lifecycle/session-loader', {
        input,
        env: { CLAUDE_NODE_PATH: '/nonexistent/node' },
      });

      expect(exitCode).toBe(0);
      // Should still work because node is on PATH (fallback step 2)
      expect(json).toHaveProperty('continue');
    });
  });

  describe('nvm directory probe', () => {
    it('should find node via nvm directory structure', () => {
      // Create a fake nvm structure pointing to real node
      const tmpDir = fs.mkdtempSync(path.join('/tmp', 'nvm-test-'));
      const nodePath = execSync('which node', { encoding: 'utf8' }).trim();
      const fakeVersion = 'v20.0.0';
      const fakeNodeDir = path.join(tmpDir, 'versions', 'node', fakeVersion, 'bin');
      fs.mkdirSync(fakeNodeDir, { recursive: true });
      // Symlink real node into fake nvm structure
      fs.symlinkSync(nodePath, path.join(fakeNodeDir, 'node'));

      try {
        const input = JSON.stringify({
          hook_event_name: 'SessionStart',
          source: 'test',
        });

        const { json, exitCode } = runWrapper('lifecycle/session-loader', {
          input,
          env: {
            // Remove node from PATH to force nvm probe
            PATH: PATH_WITHOUT_NODE,
            NVM_DIR: tmpDir,
          },
        });

        expect(exitCode).toBe(0);
        expect(json).toHaveProperty('continue');
        expect(json.systemMessage ?? '').not.toContain('node not found');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('warning throttle', () => {
    /**
     * Create a minimal wrapper that always fails resolve_node.
     * On macOS, /usr/local/bin/node exists (Homebrew), so the real
     * wrapper always finds node. This mock forces the "not found" path.
     */
    function createNoNodeWrapper(tmpDir: string): string {
      const binDir = path.join(tmpDir, 'hooks', 'bin');
      const distDir = path.join(tmpDir, 'hooks', 'dist', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.mkdirSync(distDir, { recursive: true });
      // Fake dist so the dist-check passes
      fs.writeFileSync(path.join(distDir, 'run-hook.js'), '// fake');
      // Wrapper with resolve_node that always fails
      const wrapper = `#!/bin/sh
set -eu
SAFE_JSON='{"continue":true,"suppressOutput":true}'
CLAUDE_PLUGIN_ROOT="${tmpDir}"
HOOK_NAME="\${1:-}"
[ -z "$HOOK_NAME" ] && echo "$SAFE_JSON" && exit 0
HOOK_RUNNER="$CLAUDE_PLUGIN_ROOT/hooks/dist/bin/run-hook.js"
[ ! -f "$HOOK_RUNNER" ] && echo '{"continue":true,"systemMessage":"compiled hooks not found"}' && exit 0
resolve_node() { return 1; }
NODE_BIN=$(resolve_node) || NODE_BIN=""
if [ -z "$NODE_BIN" ]; then
  WARN_MARKER="\${CLAUDE_HOOK_WARN_MARKER:-/tmp/.claude-plugin-node-warn-\${PPID:-0}}"
  if [ ! -f "$WARN_MARKER" ]; then
    echo '{"continue":true,"systemMessage":"node not found. Set CLAUDE_NODE_PATH."}'
    touch "$WARN_MARKER" 2>/dev/null || true
  else echo "$SAFE_JSON"; fi
  exit 0
fi
`;
      const wrapperPath = path.join(binDir, 'run-hook-wrapper.sh');
      fs.writeFileSync(wrapperPath, wrapper, { mode: 0o755 });
      return wrapperPath;
    }

    function runNoNodeWrapper(
      wrapperPath: string,
      hookName: string,
      markerPath: string
    ): { json: Record<string, unknown>; exitCode: number } {
      try {
        const stdout = execSync(`sh "${wrapperPath}" ${hookName}`, {
          env: { PATH: PATH_WITHOUT_NODE, HOME: '/tmp', CLAUDE_HOOK_WARN_MARKER: markerPath },
          timeout: 5000,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { json: tryParseJson(stdout.trim()), exitCode: 0 };
      } catch (error: unknown) {
        const stdout = extractStdout(error).trim();
        const exitCode = (error as { status?: number }).status ?? 1;
        return { json: tryParseJson(stdout), exitCode };
      }
    }

    it('should warn on first call when node not found', () => {
      const tmpDir = fs.mkdtempSync(path.join('/tmp', 'throttle-test-'));
      const marker = path.join(tmpDir, 'warn-marker');
      try {
        const wrapperPath = createNoNodeWrapper(tmpDir);
        const { json, exitCode } = runNoNodeWrapper(wrapperPath, 'test-hook', marker);

        expect(exitCode).toBe(0);
        expect(json.continue).toBe(true);
        expect(String(json.systemMessage ?? '')).toContain('node not found');
        // Marker file should now exist
        expect(fs.existsSync(marker)).toBe(true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('should suppress warning on second call (same marker)', () => {
      const tmpDir = fs.mkdtempSync(path.join('/tmp', 'throttle-test-'));
      const marker = path.join(tmpDir, 'warn-marker');
      try {
        const wrapperPath = createNoNodeWrapper(tmpDir);

        // First call — warns
        const first = runNoNodeWrapper(wrapperPath, 'test-hook', marker);
        expect(String(first.json.systemMessage ?? '')).toContain('node not found');

        // Second call — same marker — silent
        const second = runNoNodeWrapper(wrapperPath, 'test-hook', marker);
        expect(second.json.continue).toBe(true);
        expect(second.json.suppressOutput).toBe(true);
        expect(second.json.systemMessage).toBeUndefined();
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('should warn again for a different session (different marker)', () => {
      const tmpDir = fs.mkdtempSync(path.join('/tmp', 'throttle-test-'));
      const marker1 = path.join(tmpDir, 'warn-marker-1');
      const marker2 = path.join(tmpDir, 'warn-marker-2');
      try {
        const wrapperPath = createNoNodeWrapper(tmpDir);

        const first = runNoNodeWrapper(wrapperPath, 'test-hook', marker1);
        expect(String(first.json.systemMessage ?? '')).toContain('node not found');

        const second = runNoNodeWrapper(wrapperPath, 'test-hook', marker2);
        expect(String(second.json.systemMessage ?? '')).toContain('node not found');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('volta probe', () => {
    it('should find node via volta directory structure', () => {
      const tmpDir = fs.mkdtempSync(path.join('/tmp', 'volta-test-'));
      const nodePath = execSync('which node', { encoding: 'utf8' }).trim();
      const voltaBin = path.join(tmpDir, 'bin');
      fs.mkdirSync(voltaBin, { recursive: true });
      fs.symlinkSync(nodePath, path.join(voltaBin, 'node'));

      try {
        const input = JSON.stringify({
          hook_event_name: 'SessionStart',
          source: 'test',
        });

        const { json, exitCode } = runWrapper('lifecycle/session-loader', {
          input,
          env: {
            PATH: PATH_WITHOUT_NODE,
            VOLTA_HOME: tmpDir,
            NVM_DIR: '/nonexistent',
          },
        });

        expect(exitCode).toBe(0);
        expect(json).toHaveProperty('continue');
        expect(json.systemMessage ?? '').not.toContain('node not found');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('fnm probe', () => {
    it('should find node via fnm directory structure', () => {
      const tmpDir = fs.mkdtempSync(path.join('/tmp', 'fnm-test-'));
      const nodePath = execSync('which node', { encoding: 'utf8' }).trim();
      const fakeVersion = 'v20.0.0';
      const fakeNodeDir = path.join(tmpDir, 'node-versions', fakeVersion, 'installation', 'bin');
      fs.mkdirSync(fakeNodeDir, { recursive: true });
      fs.symlinkSync(nodePath, path.join(fakeNodeDir, 'node'));

      try {
        const input = JSON.stringify({
          hook_event_name: 'SessionStart',
          source: 'test',
        });

        const { json, exitCode } = runWrapper('lifecycle/session-loader', {
          input,
          env: {
            PATH: PATH_WITHOUT_NODE,
            FNM_DIR: tmpDir,
            NVM_DIR: '/nonexistent',
            VOLTA_HOME: '/nonexistent',
          },
        });

        expect(exitCode).toBe(0);
        expect(json).toHaveProperty('continue');
        expect(json.systemMessage ?? '').not.toContain('node not found');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
