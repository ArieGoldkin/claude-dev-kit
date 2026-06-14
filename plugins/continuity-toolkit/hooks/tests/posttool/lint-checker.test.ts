/**
 * Tests for lint-checker PostToolUse hook
 *
 * @module tests/posttool/lint-checker
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyViolations,
  findLinter,
  formatMessage,
  lintChecker,
  resetLinterCache,
  runRuffCheck,
  runRuffFormat,
} from '../../src/posttool/lint-checker.js';
import type { LintResults, RuffViolation } from '../../src/posttool/lint-checker.js';
import type { HookInput } from '../../src/types.js';

// Mock child_process - both execSync (for findLinter) and execFileSync (for ruff calls)
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

// Mock fs for file existence checks
vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return {
    ...original,
    existsSync: vi.fn(() => true),
  };
});

import { execFileSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const mockExecSync = vi.mocked(execSync);
const mockExecFileSync = vi.mocked(execFileSync);
const mockExistsSync = vi.mocked(existsSync);

// =============================================================================
// TEST HELPERS
// =============================================================================

function createWriteInput(filePath: string): HookInput {
  return {
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: 'print("hello")' },
  };
}

function createEditInput(filePath: string): HookInput {
  return {
    tool_name: 'Edit',
    tool_input: { file_path: filePath, old_string: 'foo', new_string: 'bar' },
  };
}

function createMultiEditInput(filePaths: string[]): HookInput {
  return {
    tool_name: 'MultiEdit',
    tool_input: {
      edits: filePaths.map((fp) => ({
        file_path: fp,
        old_string: 'foo',
        new_string: 'bar',
      })),
    },
  };
}

function createNonWriteInput(): HookInput {
  return {
    tool_name: 'Read',
    tool_input: { file_path: '/some/file.py' },
  };
}

function makeViolation(overrides: Partial<RuffViolation> = {}): RuffViolation {
  return {
    code: 'F401',
    message: '`os` imported but unused',
    filename: '/project/handler.py',
    location: { row: 1, column: 1 },
    end_location: { row: 1, column: 10 },
    noqa_row: 1,
    ...overrides,
  };
}

function makeSecurityViolation(overrides: Partial<RuffViolation> = {}): RuffViolation {
  return {
    code: 'S105',
    message: 'Possible hardcoded password',
    filename: '/project/handler.py',
    location: { row: 12, column: 5 },
    end_location: { row: 12, column: 20 },
    noqa_row: 12,
    ...overrides,
  };
}

/** Helper: create execFileSync error with status/stdout/stderr */
function makeExecError(
  status: number,
  stdout = '',
  stderr = ''
): Error & { stdout: string; stderr: string; status: number } {
  const err = new Error('exec error') as Error & { stdout: string; stderr: string; status: number };
  err.stdout = stdout;
  err.stderr = stderr;
  err.status = status;
  return err;
}

// =============================================================================
// TESTS
// =============================================================================

describe('runRuffCheck', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when lint passes (exit 0)', () => {
    mockExecFileSync.mockReturnValue('[]');

    const result = runRuffCheck('/usr/bin/ruff', ['/project/clean.py']);
    expect(result).toEqual([]);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      '/usr/bin/ruff',
      ['check', '--output-format', 'json', '--no-cache', '/project/clean.py'],
      expect.objectContaining({ encoding: 'utf8' })
    );
  });

  it('should return violations when lint errors found (exit 1)', () => {
    const violations: RuffViolation[] = [
      makeViolation({
        code: 'F401',
        filename: '/project/handler.py',
        location: { row: 1, column: 1 },
      }),
      makeViolation({
        code: 'E711',
        message: 'Comparison to None',
        location: { row: 8, column: 5 },
      }),
    ];
    mockExecFileSync.mockImplementation(() => {
      throw makeExecError(1, JSON.stringify(violations));
    });

    const result = runRuffCheck('/usr/bin/ruff', ['/project/handler.py']);
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe('F401');
    expect(result[1].code).toBe('E711');
  });

  it('should batch multiple files in a single invocation', () => {
    mockExecFileSync.mockReturnValue('[]');

    runRuffCheck('/usr/bin/ruff', ['/project/a.py', '/project/b.py', '/project/c.py']);
    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      '/usr/bin/ruff',
      [
        'check',
        '--output-format',
        'json',
        '--no-cache',
        '/project/a.py',
        '/project/b.py',
        '/project/c.py',
      ],
      expect.any(Object)
    );
  });

  it('should return empty array on ruff config error (exit 2)', () => {
    mockExecFileSync.mockImplementation(() => {
      throw makeExecError(2, '', 'error: invalid config');
    });

    const result = runRuffCheck('/usr/bin/ruff', ['/project/file.py']);
    expect(result).toEqual([]);
  });

  it('should return empty array on timeout', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('TIMEOUT');
    });

    const result = runRuffCheck('/usr/bin/ruff', ['/project/file.py']);
    expect(result).toEqual([]);
  });

  it('should gracefully degrade on JSON parse failure', () => {
    mockExecFileSync.mockImplementation(() => {
      throw makeExecError(1, 'not valid json');
    });

    const result = runRuffCheck('/usr/bin/ruff', ['/project/file.py']);
    expect(result).toEqual([]);
  });

  it('should return empty array when JSON is not an array', () => {
    mockExecFileSync.mockImplementation(() => {
      throw makeExecError(1, '{"error": "unexpected"}');
    });

    const result = runRuffCheck('/usr/bin/ruff', ['/project/file.py']);
    expect(result).toEqual([]);
  });
});

describe('runRuffFormat', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when all files formatted (exit 0)', () => {
    mockExecFileSync.mockReturnValue('');

    const result = runRuffFormat('/usr/bin/ruff', ['/project/clean.py']);
    expect(result).toEqual([]);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      '/usr/bin/ruff',
      ['format', '--check', '/project/clean.py'],
      expect.objectContaining({ encoding: 'utf8' })
    );
  });

  it('should return files needing formatting (exit 1)', () => {
    mockExecFileSync.mockImplementation(() => {
      throw makeExecError(
        1,
        'Would reformat: /project/handler.py\nWould reformat: /project/utils.py\n2 files would be reformatted\n'
      );
    });

    const result = runRuffFormat('/usr/bin/ruff', ['/project/handler.py', '/project/utils.py']);
    expect(result).toEqual(['/project/handler.py', '/project/utils.py']);
  });

  it('should strip prefix and ignore summary line', () => {
    mockExecFileSync.mockImplementation(() => {
      throw makeExecError(
        1,
        'Would reformat: /project/handler.py\n1 file would be reformatted, 2 files already formatted\n'
      );
    });

    const result = runRuffFormat('/usr/bin/ruff', ['/project/handler.py']);
    expect(result).toEqual(['/project/handler.py']);
  });

  it('should return empty array on any error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('TIMEOUT');
    });

    const result = runRuffFormat('/usr/bin/ruff', ['/project/file.py']);
    expect(result).toEqual([]);
  });
});

describe('classifyViolations', () => {
  it('should partition S-prefix violations as security', () => {
    const violations: RuffViolation[] = [
      makeViolation({ code: 'F401' }),
      makeSecurityViolation({ code: 'S105' }),
      makeViolation({ code: 'E711' }),
      makeSecurityViolation({ code: 'S608' }),
    ];

    const result = classifyViolations(violations);
    expect(result.security).toHaveLength(2);
    expect(result.general).toHaveLength(2);
    expect(result.totalCount).toBe(4);
    expect(result.security[0].code).toBe('S105');
    expect(result.security[1].code).toBe('S608');
    expect(result.general[0].code).toBe('F401');
    expect(result.general[1].code).toBe('E711');
  });

  it('should handle all security violations', () => {
    const violations = [
      makeSecurityViolation({ code: 'S105' }),
      makeSecurityViolation({ code: 'S608' }),
    ];
    const result = classifyViolations(violations);
    expect(result.security).toHaveLength(2);
    expect(result.general).toHaveLength(0);
    expect(result.totalCount).toBe(2);
  });

  it('should handle all general violations', () => {
    const violations = [makeViolation({ code: 'F401' }), makeViolation({ code: 'E711' })];
    const result = classifyViolations(violations);
    expect(result.security).toHaveLength(0);
    expect(result.general).toHaveLength(2);
    expect(result.totalCount).toBe(2);
  });

  it('should handle empty violations', () => {
    const result = classifyViolations([]);
    expect(result.security).toHaveLength(0);
    expect(result.general).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });
});

describe('formatMessage', () => {
  it('should return empty string when nothing to report', () => {
    const results: LintResults = {
      violations: { security: [], general: [], totalCount: 0 },
      formatIssueFiles: [],
    };
    expect(formatMessage(results, 1)).toBe('');
  });

  it('should show security violations with security header', () => {
    const results: LintResults = {
      violations: {
        security: [makeSecurityViolation({ code: 'S105', message: 'Possible hardcoded password' })],
        general: [],
        totalCount: 1,
      },
      formatIssueFiles: [],
    };
    const msg = formatMessage(results, 1);
    expect(msg).toContain('Security lint violations (1) -- fix immediately:');
    expect(msg).toContain('S105');
    expect(msg).toContain('Possible hardcoded password');
  });

  it('should show fix hints based on applicability', () => {
    const results: LintResults = {
      violations: {
        security: [],
        general: [
          makeViolation({ code: 'F401', fix: { applicability: 'safe' } }),
          makeViolation({ code: 'E711', fix: { applicability: 'unsafe' } }),
          makeViolation({ code: 'W291' }),
        ],
        totalCount: 3,
      },
      formatIssueFiles: [],
    };
    const msg = formatMessage(results, 1);
    expect(msg).toContain('[safe fix]');
    expect(msg).toContain('[unsafe fix]');
    expect(msg).toContain('[no auto-fix]');
  });

  it('should show format issues section', () => {
    const results: LintResults = {
      violations: { security: [], general: [], totalCount: 0 },
      formatIssueFiles: ['/project/handler.py'],
    };
    const msg = formatMessage(results, 1);
    expect(msg).toContain('Format issues (1 file):');
    expect(msg).toContain('handler.py needs formatting');
    expect(msg).toContain('ruff format');
  });

  it('should show summary line with counts', () => {
    const results: LintResults = {
      violations: {
        security: [makeSecurityViolation()],
        general: [makeViolation(), makeViolation({ code: 'E711' })],
        totalCount: 3,
      },
      formatIssueFiles: ['/project/handler.py'],
    };
    const msg = formatMessage(results, 2);
    expect(msg).toContain('Total: 3 lint issues (1 security), 1 formatting issue in 2 files.');
  });

  it('should truncate general violations after security fills quota', () => {
    // 20 security violations = no room for general
    const security = Array.from({ length: 20 }, (_, i) =>
      makeSecurityViolation({ code: `S${100 + i}` })
    );
    const general = [makeViolation({ code: 'F401' })];
    const results: LintResults = {
      violations: { security, general, totalCount: 21 },
      formatIssueFiles: [],
    };
    const msg = formatMessage(results, 1);
    // Security shown (up to 10)
    expect(msg).toContain('Security lint violations (20)');
    expect(msg).toContain('... and 10 more security issues');
    // General truncated to 0 shown
    expect(msg).toContain('Lint violations (1):');
    expect(msg).toContain('... and 1 more');
  });

  it('should cap message at MAX_MESSAGE_LENGTH', () => {
    // Generate many violations with long messages to exceed 3000 chars
    const general = Array.from({ length: 50 }, (_, i) =>
      makeViolation({
        code: `F${400 + i}`,
        message: 'A'.repeat(200),
        filename: `/project/file${i}.py`,
      })
    );
    const results: LintResults = {
      violations: { security: [], general, totalCount: 50 },
      formatIssueFiles: [],
    };
    const msg = formatMessage(results, 50);
    // Should end with truncation marker
    expect(msg).toContain('... (truncated)');
    // Total length should be capped (3000 + truncation text)
    expect(msg.length).toBeLessThanOrEqual(3020);
  });

  it('should handle singular forms correctly', () => {
    const results: LintResults = {
      violations: {
        security: [],
        general: [makeViolation()],
        totalCount: 1,
      },
      formatIssueFiles: [],
    };
    const msg = formatMessage(results, 1);
    expect(msg).toContain('1 lint issue in 1 file.');
  });
});

describe('lintChecker', () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetLinterCache();
    delete process.env['CLAUDE_PROJECT_DIR'];
  });

  describe('tool filtering', () => {
    it('should skip non-write tools', async () => {
      const result = await lintChecker(createNonWriteInput());
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should skip Bash tool', async () => {
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'ruff check .' },
      };
      const result = await lintChecker(input);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('file extension filtering', () => {
    it('should skip non-Python files', async () => {
      const input = createWriteInput('/project/src/index.ts');
      const result = await lintChecker(input);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should skip JavaScript files', async () => {
      const input = createWriteInput('/project/src/app.js');
      const result = await lintChecker(input);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should skip markdown files', async () => {
      const input = createWriteInput('/project/README.md');
      const result = await lintChecker(input);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should process .py files', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      mockExistsSync.mockReturnValue(true);
      // findLinter: venv ruff exists -> runRuffCheck clean -> runRuffFormat clean
      mockExecFileSync.mockReturnValue('');

      const input = createWriteInput('/project/src/handler.py');
      const result = await lintChecker(input);

      expect(result.continue).toBe(true);
    });

    it('should process .pyi files', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockReturnValue('');

      const input = createWriteInput('/project/src/types.pyi');
      const result = await lintChecker(input);

      expect(result.continue).toBe(true);
      // Should have called execFileSync for ruff check and format
      expect(mockExecFileSync).toHaveBeenCalled();
    });
  });

  describe('linter discovery', () => {
    it('should skip if no linter found', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const input = createWriteInput('/project/lambda.py');
      const result = await lintChecker(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('lint results', () => {
    it('should return silent success when lint is clean', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      mockExistsSync.mockReturnValue(true);
      // ruff check and format both clean
      mockExecFileSync.mockReturnValue('');

      const input = createWriteInput('/project/handler.py');
      const result = await lintChecker(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should report lint errors with JSON data', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      mockExistsSync.mockReturnValue(true);

      const violations: RuffViolation[] = [
        makeViolation({
          code: 'F401',
          message: '`os` imported but unused',
          filename: '/project/handler.py',
        }),
        makeViolation({
          code: 'E711',
          message: 'Comparison to None',
          filename: '/project/handler.py',
          location: { row: 8, column: 5 },
        }),
      ];

      mockExecFileSync.mockImplementation((_cmd, args) => {
        const argsArr = args as string[];
        if (argsArr[0] === 'check') {
          throw makeExecError(1, JSON.stringify(violations));
        }
        // format --check clean
        return '';
      });

      const input = createWriteInput('/project/handler.py');
      const result = await lintChecker(input);

      expect(result.continue).toBe(true);
      // User-facing summary in systemMessage
      const msg = result.systemMessage ?? '';
      expect(msg).toContain('ruff:');
      expect(msg).toContain('2 lint issues');
      expect(msg).toContain('fix before continuing');
      // Full details in additionalContext for Claude
      const ctx = result.hookSpecificOutput?.additionalContext ?? '';
      expect(ctx).toContain('Lint issues found');
      expect(ctx).toContain('F401');
      expect(ctx).toContain('E711');
    });

    it('should highlight security violations', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      mockExistsSync.mockReturnValue(true);

      const violations: RuffViolation[] = [
        makeSecurityViolation({ code: 'S105', message: 'Possible hardcoded password' }),
        makeViolation({ code: 'F401', message: '`os` imported but unused' }),
      ];

      mockExecFileSync.mockImplementation((_cmd, args) => {
        const argsArr = args as string[];
        if (argsArr[0] === 'check') {
          throw makeExecError(1, JSON.stringify(violations));
        }
        return '';
      });

      const input = createWriteInput('/project/handler.py');
      const result = await lintChecker(input);

      // User summary mentions security count
      const msg = result.systemMessage ?? '';
      expect(msg).toContain('ruff:');
      expect(msg).toContain('1 security');
      // Full details in additionalContext for Claude
      const ctx = result.hookSpecificOutput?.additionalContext ?? '';
      expect(ctx).toContain('Security lint violations');
      expect(ctx).toContain('S105');
      expect(ctx).toContain('Possible hardcoded password');
    });

    it('should always continue (never block)', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      mockExistsSync.mockReturnValue(true);

      const violations = [makeViolation()];
      mockExecFileSync.mockImplementation((_cmd, args) => {
        const argsArr = args as string[];
        if (argsArr[0] === 'check') {
          throw makeExecError(1, JSON.stringify(violations));
        }
        return '';
      });

      const input = createWriteInput('/project/handler.py');
      const result = await lintChecker(input);

      expect(result.continue).toBe(true);
    });

    it('should report format issues', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      mockExistsSync.mockReturnValue(true);

      mockExecFileSync.mockImplementation((_cmd, args) => {
        const argsArr = args as string[];
        if (argsArr[0] === 'check') {
          // No lint violations
          return '[]';
        }
        if (argsArr[0] === 'format') {
          throw makeExecError(
            1,
            'Would reformat: /project/handler.py\n1 file would be reformatted\n'
          );
        }
        return '';
      });

      const input = createWriteInput('/project/handler.py');
      const result = await lintChecker(input);

      // User summary mentions formatting
      const msg = result.systemMessage ?? '';
      expect(msg).toContain('ruff:');
      expect(msg).toContain('1 formatting');
      // Full details in additionalContext for Claude
      const ctx = result.hookSpecificOutput?.additionalContext ?? '';
      expect(ctx).toContain('Format issues');
      expect(ctx).toContain('handler.py needs formatting');
    });

    it('should gracefully degrade on JSON parse failure', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      mockExistsSync.mockReturnValue(true);

      mockExecFileSync.mockImplementation((_cmd, args) => {
        const argsArr = args as string[];
        if (argsArr[0] === 'check') {
          // Old ruff that doesn't support --output-format json
          throw makeExecError(1, 'handler.py:1:1: F401 unused import\n');
        }
        return '';
      });

      const input = createWriteInput('/project/handler.py');
      const result = await lintChecker(input);

      // Should silently skip -- no JSON parse = no violations
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('MultiEdit support', () => {
    it('should batch all Python files in a single ruff call', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      mockExistsSync.mockReturnValue(true);

      const violations = [makeViolation({ code: 'F401', filename: '/project/b.py' })];

      mockExecFileSync.mockImplementation((_cmd, args) => {
        const argsArr = args as string[];
        if (argsArr[0] === 'check') {
          throw makeExecError(1, JSON.stringify(violations));
        }
        return '';
      });

      const input = createMultiEditInput(['/project/a.py', '/project/b.py']);
      const result = await lintChecker(input);

      expect(result.continue).toBe(true);
      // Violation details now in additionalContext (dual-channel output)
      expect(result.hookSpecificOutput?.additionalContext ?? '').toContain('F401');

      // Verify single batch call for check (and one for format)
      const checkCalls = mockExecFileSync.mock.calls.filter(
        (call) => (call[1] as string[])[0] === 'check'
      );
      expect(checkCalls).toHaveLength(1);
      expect(checkCalls[0][1]).toContain('/project/a.py');
      expect(checkCalls[0][1]).toContain('/project/b.py');
    });

    it('should skip non-Python files in MultiEdit', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      const input = createMultiEditInput(['/project/a.ts', '/project/b.js']);
      const result = await lintChecker(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('Edit tool', () => {
    it('should check Python files on Edit', async () => {
      process.env['CLAUDE_PROJECT_DIR'] = '/project';
      mockExistsSync.mockReturnValue(true);

      const violations = [makeViolation({ code: 'F401', filename: '/project/utils.py' })];
      mockExecFileSync.mockImplementation((_cmd, args) => {
        const argsArr = args as string[];
        if (argsArr[0] === 'check') {
          throw makeExecError(1, JSON.stringify(violations));
        }
        return '';
      });

      const input = createEditInput('/project/utils.py');
      const result = await lintChecker(input);

      // Violation details now in additionalContext (dual-channel output)
      expect(result.hookSpecificOutput?.additionalContext ?? '').toContain('F401');
    });
  });

  describe('missing file path', () => {
    it('should return silent success when no file_path', async () => {
      const input: HookInput = {
        tool_name: 'Write',
        tool_input: {},
      };
      const result = await lintChecker(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });
});

describe('findLinter', () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetLinterCache();
  });

  it('should find ruff in project venv', () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('.venv/bin/ruff'));

    const result = findLinter('/project');
    expect(result).toBe('/project/.venv/bin/ruff');
  });

  it('should find ruff in mise shims', () => {
    mockExistsSync.mockImplementation((p) => String(p).includes('mise/shims/ruff'));

    const result = findLinter('/project');
    expect(result).toContain('mise/shims/ruff');
  });

  it('should find ruff in PATH via which', () => {
    mockExistsSync.mockReturnValue(false);
    mockExecSync.mockImplementation(((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('which ruff')) {
        return '/usr/local/bin/ruff';
      }
      throw new Error('not found');
    }) as typeof execSync);

    const result = findLinter('/project');
    expect(result).toBe('/usr/local/bin/ruff');
  });

  it('should return undefined when ruff not found', () => {
    mockExistsSync.mockReturnValue(false);
    mockExecSync.mockImplementation(() => {
      throw new Error('not found');
    });

    const result = findLinter('/project');
    expect(result).toBeUndefined();
  });

  it('should cache linter path', () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('.venv/bin/ruff'));

    findLinter('/project');
    findLinter('/project'); // second call should use cache

    // existsSync only called once (for venv path, first discovery)
    expect(mockExistsSync).toHaveBeenCalledTimes(1);
  });
});
