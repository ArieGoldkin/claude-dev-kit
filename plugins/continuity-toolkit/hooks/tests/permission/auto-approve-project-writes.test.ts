/**
 * Tests for auto-approve-project-writes hook
 *
 * @module tests/permission/auto-approve-project-writes
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FILE_TOOLS,
  HOOK_NAME,
  PROTECTED_DIRS,
  PROTECTED_FILE_PATTERNS,
  SAFE_EXTENSIONS,
  autoApproveProjectWrites,
  hasSafeExtension,
  isProtectedDirectory,
  isProtectedFile,
} from '../../src/permission/auto-approve-project-writes.js';
import type { HookInput, ToolName } from '../../src/types.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockInput(toolName: ToolName, filePath?: string): HookInput {
  const input: HookInput = {
    tool_name: toolName,
    tool_input: {},
  };

  if (filePath !== undefined) {
    input.tool_input.file_path = filePath;
  }

  return input;
}

function createTempProjectDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-approve-writes-test-'));
  return tempDir;
}

function createFile(baseDir: string, relativePath: string, content = ''): string {
  const fullPath = path.join(baseDir, relativePath);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content);
  return fullPath;
}

function createSymlink(baseDir: string, linkPath: string, targetPath: string): string {
  const fullLinkPath = path.join(baseDir, linkPath);
  const dir = path.dirname(fullLinkPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.symlinkSync(targetPath, fullLinkPath);
  return fullLinkPath;
}

function cleanupTempDir(tempDir: string): void {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('auto-approve-project-writes', () => {
  const originalEnv = { ...process.env };
  let tempDir: string | null = null;

  beforeEach(() => {
    delete process.env['CLAUDE_PROJECT_DIR'];
  });

  afterEach(() => {
    process.env = { ...originalEnv };

    if (tempDir) {
      cleanupTempDir(tempDir);
      tempDir = null;
    }
  });

  describe('constants', () => {
    it('should export HOOK_NAME', () => {
      expect(HOOK_NAME).toBe('auto-approve-project-writes');
    });

    it('should have expected file tools', () => {
      expect(FILE_TOOLS.has('Write')).toBe(true);
      expect(FILE_TOOLS.has('Edit')).toBe(true);
      expect(FILE_TOOLS.has('MultiEdit')).toBe(true);
      expect(FILE_TOOLS.has('Bash' as ToolName)).toBe(false);
    });

    it('should have protected directories', () => {
      expect(PROTECTED_DIRS).toContain('node_modules/');
      expect(PROTECTED_DIRS).toContain('.git/');
      expect(PROTECTED_DIRS).toContain('.env/');
      expect(PROTECTED_DIRS).toContain('dist/');
    });

    it('should have protected file patterns', () => {
      expect(PROTECTED_FILE_PATTERNS.length).toBeGreaterThan(0);
      const envPattern = PROTECTED_FILE_PATTERNS.find((p) => p.test('.env'));
      expect(envPattern).toBeDefined();
    });

    it('should have safe extensions', () => {
      expect(SAFE_EXTENSIONS).toContain('.ts');
      expect(SAFE_EXTENSIONS).toContain('.tsx');
      expect(SAFE_EXTENSIONS).toContain('.js');
      expect(SAFE_EXTENSIONS).toContain('.py');
      expect(SAFE_EXTENSIONS).toContain('.md');
    });
  });

  describe('isProtectedDirectory', () => {
    it('should return true for node_modules', () => {
      expect(isProtectedDirectory('foo/node_modules/bar')).toBe(true);
      expect(isProtectedDirectory('node_modules/package')).toBe(true);
    });

    it('should return true for .git', () => {
      expect(isProtectedDirectory('.git/config')).toBe(true);
      expect(isProtectedDirectory('foo/.git/HEAD')).toBe(true);
    });

    it('should return true for __pycache__', () => {
      expect(isProtectedDirectory('__pycache__/module.pyc')).toBe(true);
    });

    it('should return true for virtual environments', () => {
      expect(isProtectedDirectory('.venv/lib/python')).toBe(true);
      expect(isProtectedDirectory('venv/bin/python')).toBe(true);
    });

    it('should return true for build directories', () => {
      expect(isProtectedDirectory('dist/bundle.js')).toBe(true);
      expect(isProtectedDirectory('build/output')).toBe(true);
      expect(isProtectedDirectory('.next/static')).toBe(true);
    });

    it('should return false for regular directories', () => {
      expect(isProtectedDirectory('src/components')).toBe(false);
      expect(isProtectedDirectory('lib/utils.ts')).toBe(false);
      expect(isProtectedDirectory('tests/unit')).toBe(false);
    });
  });

  describe('isProtectedFile', () => {
    it('should return true for .env files', () => {
      expect(isProtectedFile('.env')).toBe(true);
      expect(isProtectedFile('config/.env')).toBe(true);
      expect(isProtectedFile('.env.local')).toBe(true);
      expect(isProtectedFile('.env.production')).toBe(true);
    });

    it('should return true for .envrc files', () => {
      expect(isProtectedFile('.envrc')).toBe(true);
    });

    it('should return true for credential files (case insensitive)', () => {
      expect(isProtectedFile('credentials.json')).toBe(true);
      expect(isProtectedFile('CREDENTIALS.yaml')).toBe(true);
      expect(isProtectedFile('aws-credentials')).toBe(true);
    });

    it('should return true for secrets files (case insensitive)', () => {
      expect(isProtectedFile('secrets.yaml')).toBe(true);
      expect(isProtectedFile('SECRETS.json')).toBe(true);
      expect(isProtectedFile('app-secrets')).toBe(true);
    });

    it('should return true for certificate and key files', () => {
      expect(isProtectedFile('server.pem')).toBe(true);
      expect(isProtectedFile('private.key')).toBe(true);
      expect(isProtectedFile('cert.crt')).toBe(true);
    });

    it('should return true for SSH key files', () => {
      expect(isProtectedFile('id_rsa')).toBe(true);
      expect(isProtectedFile('id_ed25519')).toBe(true);
      expect(isProtectedFile('id_dsa')).toBe(true);
      expect(isProtectedFile('id_ecdsa')).toBe(true);
    });

    it('should return true for package manager config files', () => {
      expect(isProtectedFile('.npmrc')).toBe(true);
      expect(isProtectedFile('.pypirc')).toBe(true);
    });

    it('should return true for database credential files', () => {
      expect(isProtectedFile('.netrc')).toBe(true);
      expect(isProtectedFile('.pgpass')).toBe(true);
    });

    // CC v2.1.160 alignment: build-tool configs that grant code execution.
    // Without explicit patterns these auto-approved via SAFE_EXTENSIONS
    // (.toml/.yaml/.yml) — found in the CC v2.1.173 audit.
    it('should return true for build-tool config files granting code execution', () => {
      expect(isProtectedFile('bunfig.toml')).toBe(true);
      expect(isProtectedFile('.yarnrc')).toBe(true);
      expect(isProtectedFile('.yarnrc.yml')).toBe(true);
      expect(isProtectedFile('.yarnrc.yaml')).toBe(true);
      expect(isProtectedFile('.pre-commit-config.yaml')).toBe(true);
      expect(isProtectedFile('.pre-commit-config.yml')).toBe(true);
      expect(isProtectedFile('.bazelrc')).toBe(true);
    });

    it('should return true for build-tool configs with case variants', () => {
      expect(isProtectedFile('Bunfig.TOML')).toBe(true);
      expect(isProtectedFile('.YARNRC.YML')).toBe(true);
      expect(isProtectedFile('.Pre-Commit-Config.yaml')).toBe(true);
    });

    it('should return true for shell startup files (defense-in-depth)', () => {
      expect(isProtectedFile('.zshenv')).toBe(true);
      expect(isProtectedFile('.zlogin')).toBe(true);
      expect(isProtectedFile('.zshrc')).toBe(true);
      expect(isProtectedFile('.bash_login')).toBe(true);
      expect(isProtectedFile('.bash_profile')).toBe(true);
      expect(isProtectedFile('.bashrc')).toBe(true);
    });

    it('should not flag near-miss filenames for build-tool patterns', () => {
      expect(isProtectedFile('config.toml')).toBe(false);
      expect(isProtectedFile('docker-compose.yaml')).toBe(false);
      expect(isProtectedFile('my-bashrc-notes.md')).toBe(false);
      // Review !209 finding #4: basename-anchored — prefixed near-misses
      // are NOT the files the tools read, so they stay auto-approvable
      expect(isProtectedFile('my-bunfig.toml')).toBe(false);
      expect(isProtectedFile('my.bashrc')).toBe(false);
      expect(isProtectedFile('not-lefthook.yml')).toBe(false);
    });

    it('should protect anchored basenames in subdirectories', () => {
      expect(isProtectedFile('config/bunfig.toml')).toBe(true);
      expect(isProtectedFile('packages/app/.yarnrc.yml')).toBe(true);
    });

    it('should protect lefthook configs (git-hook manager — code execution)', () => {
      expect(isProtectedFile('lefthook.yml')).toBe(true);
      expect(isProtectedFile('lefthook.yaml')).toBe(true);
    });

    it('should return false for regular files', () => {
      expect(isProtectedFile('index.ts')).toBe(false);
      expect(isProtectedFile('README.md')).toBe(false);
      expect(isProtectedFile('package.json')).toBe(false);
    });
  });

  describe('hasSafeExtension', () => {
    it('should return true for TypeScript files', () => {
      expect(hasSafeExtension('index.ts')).toBe(true);
      expect(hasSafeExtension('component.tsx')).toBe(true);
    });

    it('should return true for JavaScript files', () => {
      expect(hasSafeExtension('index.js')).toBe(true);
      expect(hasSafeExtension('component.jsx')).toBe(true);
    });

    it('should return true for Python files', () => {
      expect(hasSafeExtension('app.py')).toBe(true);
    });

    it('should return true for JSON and YAML files', () => {
      expect(hasSafeExtension('package.json')).toBe(true);
      expect(hasSafeExtension('config.yaml')).toBe(true);
      expect(hasSafeExtension('config.yml')).toBe(true);
    });

    it('should return true for markdown files', () => {
      expect(hasSafeExtension('README.md')).toBe(true);
      expect(hasSafeExtension('docs.mdx')).toBe(true);
    });

    it('should return true for style files', () => {
      expect(hasSafeExtension('styles.css')).toBe(true);
      expect(hasSafeExtension('styles.scss')).toBe(true);
      expect(hasSafeExtension('styles.less')).toBe(true);
    });

    it('should return true for shell scripts', () => {
      expect(hasSafeExtension('build.sh')).toBe(true);
      expect(hasSafeExtension('setup.bash')).toBe(true);
      expect(hasSafeExtension('init.zsh')).toBe(true);
    });

    it('should return true for other programming languages', () => {
      expect(hasSafeExtension('main.go')).toBe(true);
      expect(hasSafeExtension('lib.rs')).toBe(true);
      expect(hasSafeExtension('App.java')).toBe(true);
      expect(hasSafeExtension('app.rb')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(hasSafeExtension('INDEX.TS')).toBe(true);
      expect(hasSafeExtension('README.MD')).toBe(true);
      expect(hasSafeExtension('analysis.R')).toBe(true);
    });

    it('should return false for unknown extensions', () => {
      expect(hasSafeExtension('file.xyz')).toBe(false);
      expect(hasSafeExtension('binary.exe')).toBe(false);
      expect(hasSafeExtension('archive.tar.gz')).toBe(false);
    });

    it('should return false for files without extension', () => {
      expect(hasSafeExtension('Makefile')).toBe(false);
      expect(hasSafeExtension('Dockerfile')).toBe(false);
    });
  });

  describe('non-file tools', () => {
    it('should return silent success for Bash tool', async () => {
      const input = createMockInput('Bash');
      input.tool_input.command = 'ls -la';

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('should return silent success for Read tool', async () => {
      const input = createMockInput('Read', '/some/path');

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });
  });

  describe('empty file path', () => {
    it('should return silent success for Write with no file_path', async () => {
      const input = createMockInput('Write');

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('should return silent success for Edit with empty file_path', async () => {
      const input = createMockInput('Edit', '');

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('paths outside project', () => {
    it('should return silent success for absolute path outside project', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', '/etc/passwd');

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });
  });

  describe('protected directories', () => {
    it('should return silent success for node_modules', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, 'node_modules/pkg/index.js'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('should return silent success for .git directory', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, '.git/config'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });
  });

  describe('protected file patterns', () => {
    it('should return silent success for .env file', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, '.env'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('should return silent success for credentials file', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, 'config/credentials.json'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    // CC v2.1.160 regression: these previously AUTO-APPROVED via the
    // .toml/.yaml/.yml/.json safe extensions — they must defer instead.
    it('should NOT auto-approve bunfig.toml (defers to user prompt)', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, 'bunfig.toml'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('should NOT auto-approve .pre-commit-config.yaml (defers to user prompt)', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, '.pre-commit-config.yaml'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('should NOT auto-approve .yarnrc.yml (defers to user prompt)', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, '.yarnrc.yml'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('should NOT auto-approve .devcontainer/devcontainer.json (protected dir)', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, '.devcontainer/devcontainer.json'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });
  });

  describe('safe file approval', () => {
    it('should approve .ts file within project', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, 'src/index.ts'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toEqual({
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
      });
    });

    it('should approve .json file within project', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, 'package.json'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    it('should approve .md file within project', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, 'README.md'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    it('should approve Edit tool for safe files', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Edit', path.join(tempDir, 'src/index.ts'));
      input.tool_input.old_string = 'foo';
      input.tool_input.new_string = 'bar';

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    it('should approve MultiEdit tool for safe files', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('MultiEdit', path.join(tempDir, 'src/index.ts'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });
  });

  describe('unrecognized extension — now DEFERS (allowlist, not allow-by-default)', () => {
    // Auto-approve is now an explicit allowlist of known-safe extensions.
    // Unknown / extensionless files (Makefile, Dockerfile, shebang scripts,
    // git hooks) defer to a prompt instead of auto-approving by default.
    it('should DEFER a file with an unrecognized extension', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, 'data.xyz'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('should DEFER a Makefile (no extension)', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, 'Makefile'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });
  });

  describe('symlink bypass prevention (ME-001)', () => {
    it('should NOT approve symlink inside project pointing to /etc/passwd', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      try {
        createSymlink(tempDir, 'evil-link.ts', '/etc/passwd');
      } catch {
        return;
      }

      const input = createMockInput('Write', path.join(tempDir, 'evil-link.ts'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('should approve regular file (not symlink) within project', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createFile(tempDir, 'src/index.ts', 'export const x = 1;');

      const input = createMockInput('Write', path.join(tempDir, 'src/index.ts'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    it('should approve symlink if target is also within project', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      createFile(tempDir, 'lib/utils.ts', 'export const x = 1;');

      try {
        createSymlink(tempDir, 'src/utils-link.ts', path.join(tempDir, 'lib/utils.ts'));
      } catch {
        return;
      }

      const input = createMockInput('Write', path.join(tempDir, 'src/utils-link.ts'));

      const result = await autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });
  });

  describe('HookResult structure', () => {
    it('should have correct structure for silent success', async () => {
      const input = createMockInput('Bash');

      const result = await autoApproveProjectWrites(input);

      expect(result).toEqual({
        continue: true,
        suppressOutput: true,
      });
    });

    it('should have correct structure for approval', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, 'src/index.ts'));

      const result = await autoApproveProjectWrites(input);

      expect(result).toEqual({
        continue: true,
        suppressOutput: true,
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
        },
      });
    });

    it('should produce valid JSON when stringified', async () => {
      tempDir = createTempProjectDir();
      process.env['CLAUDE_PROJECT_DIR'] = tempDir;

      const input = createMockInput('Write', path.join(tempDir, 'src/index.ts'));

      const result = await autoApproveProjectWrites(input);

      expect(() => JSON.stringify(result)).not.toThrow();

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(parsed.continue).toBe(true);
      expect(parsed.hookSpecificOutput.permissionDecision).toBe('allow');
    });
  });
});
