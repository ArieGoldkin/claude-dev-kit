/**
 * Tests for denial-logger PermissionDenied hook
 *
 * Verifies that denial events are logged to .claude/feedback/denials.jsonl.
 *
 * @module tests/permissiondenied/denial-logger
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { denialLogger } from '../../src/permissiondenied/denial-logger.js';
import type { HookInput } from '../../src/types.js';

let tmpDir: string;
const originalEnv = process.env['CLAUDE_PROJECT_DIR'];

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'denial-logger-test-'));
  process.env['CLAUDE_PROJECT_DIR'] = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (originalEnv !== undefined) {
    process.env['CLAUDE_PROJECT_DIR'] = originalEnv;
  } else {
    delete process.env['CLAUDE_PROJECT_DIR'];
  }
});

function createDenialInput(toolName: string, commandOrPath?: string): HookInput {
  const input: HookInput = {
    tool_name: toolName as HookInput['tool_name'],
    tool_input: {},
    session_id: 'test-session-123',
  };
  if (toolName === 'Bash' && commandOrPath) {
    input.tool_input = { command: commandOrPath };
  } else if (commandOrPath) {
    input.tool_input = { file_path: commandOrPath };
  }
  return input;
}

describe('denialLogger', () => {
  it('should create feedback directory and log file', async () => {
    await denialLogger(createDenialInput('Bash', 'git push'));

    const logFile = path.join(tmpDir, '.claude', 'feedback', 'denials.jsonl');
    expect(fs.existsSync(logFile)).toBe(true);
  });

  it('should log valid JSONL entries', async () => {
    await denialLogger(createDenialInput('Bash', 'git push'));

    const logFile = path.join(tmpDir, '.claude', 'feedback', 'denials.jsonl');
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0]);
    expect(entry.tool_name).toBe('Bash');
    expect(entry.command_or_path).toBe('git push');
    expect(entry.session_id).toBe('test-session-123');
    expect(entry.timestamp).toBeDefined();
  });

  it('should append multiple entries', async () => {
    await denialLogger(createDenialInput('Bash', 'git push'));
    await denialLogger(createDenialInput('Write', '/path/to/file.ts'));

    const logFile = path.join(tmpDir, '.claude', 'feedback', 'denials.jsonl');
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);

    expect(JSON.parse(lines[0]).tool_name).toBe('Bash');
    expect(JSON.parse(lines[1]).tool_name).toBe('Write');
  });

  it('should log file_path for Write denials', async () => {
    await denialLogger(createDenialInput('Write', '/project/src/file.ts'));

    const logFile = path.join(tmpDir, '.claude', 'feedback', 'denials.jsonl');
    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
    expect(entry.command_or_path).toBe('/project/src/file.ts');
  });

  it('should handle missing command/path', async () => {
    await denialLogger({ tool_name: 'Bash', tool_input: {} });

    const logFile = path.join(tmpDir, '.claude', 'feedback', 'denials.jsonl');
    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
    expect(entry.command_or_path).toBe('');
  });

  it('should always return silent success', async () => {
    const result = await denialLogger(createDenialInput('Bash', 'ls'));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('should include agent_id when present', async () => {
    const input = createDenialInput('Bash', 'git push');
    input.agent_id = 'agent-123';

    await denialLogger(input);

    const logFile = path.join(tmpDir, '.claude', 'feedback', 'denials.jsonl');
    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
    expect(entry.agent_id).toBe('agent-123');
  });
});
