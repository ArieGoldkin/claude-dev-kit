/**
 * Tests for composable guard functions.
 *
 * @module tests/lib/guards
 */

import { describe, expect, it } from 'vitest';
import {
  guardBash,
  guardFileExtension,
  guardHasCommand,
  guardHasFilePath,
  guardSkipInternal,
  guardTool,
  guardWithinProject,
  guardWriteEdit,
  runGuards,
} from '../../src/lib/guards.js';
import type { HookInput, ToolName } from '../../src/types.js';

// =============================================================================
// HELPERS
// =============================================================================

function makeInput(toolName: ToolName, extra: Record<string, unknown> = {}): HookInput {
  return {
    tool_name: toolName,
    tool_input: extra,
    session_id: 'test',
  };
}

function bashInput(command?: string): HookInput {
  return makeInput('Bash', command ? { command } : {});
}

function writeInput(filePath?: string): HookInput {
  return makeInput('Write', filePath ? { file_path: filePath } : {});
}

function editInput(filePath?: string): HookInput {
  return makeInput('Edit', filePath ? { file_path: filePath } : {});
}

// =============================================================================
// runGuards
// =============================================================================

describe('runGuards', () => {
  it('should return null when no guards provided', () => {
    const result = runGuards(bashInput('ls'));
    expect(result).toBeNull();
  });

  it('should return null when all guards pass', () => {
    const result = runGuards(bashInput('ls'), guardBash, guardHasCommand);
    expect(result).toBeNull();
  });

  it('should return first non-null result', () => {
    const result = runGuards(writeInput('/tmp/file.ts'), guardBash);
    expect(result).not.toBeNull();
    expect(result?.continue).toBe(true);
  });

  it('should short-circuit on first failing guard', () => {
    let secondCalled = false;
    const secondGuard = (_input: HookInput) => {
      secondCalled = true;
      return null;
    };
    // guardBash will fail for Write tool, so secondGuard shouldn't run
    runGuards(writeInput('/tmp/file.ts'), guardBash, secondGuard);
    expect(secondCalled).toBe(false);
  });
});

// =============================================================================
// guardTool
// =============================================================================

describe('guardTool', () => {
  it('should return null when tool matches', () => {
    expect(guardTool(bashInput('ls'), 'Bash')).toBeNull();
  });

  it('should return null when tool matches one of many', () => {
    expect(guardTool(writeInput(), 'Write', 'Edit', 'MultiEdit')).toBeNull();
  });

  it('should return silent success when tool does not match', () => {
    const result = guardTool(writeInput(), 'Bash');
    expect(result).not.toBeNull();
    expect(result?.continue).toBe(true);
    expect(result?.suppressOutput).toBe(true);
  });

  it('should return silent success for empty tool name', () => {
    const input = makeInput('' as ToolName);
    expect(guardTool(input, 'Bash')).not.toBeNull();
  });
});

// =============================================================================
// guardBash
// =============================================================================

describe('guardBash', () => {
  it('should return null for Bash tool', () => {
    expect(guardBash(bashInput('ls'))).toBeNull();
  });

  it('should skip for Write tool', () => {
    expect(guardBash(writeInput())).not.toBeNull();
  });

  it('should skip for Edit tool', () => {
    expect(guardBash(editInput())).not.toBeNull();
  });
});

// =============================================================================
// guardWriteEdit
// =============================================================================

describe('guardWriteEdit', () => {
  it('should return null for Write tool', () => {
    expect(guardWriteEdit(writeInput())).toBeNull();
  });

  it('should return null for Edit tool', () => {
    expect(guardWriteEdit(editInput())).toBeNull();
  });

  it('should return null for MultiEdit tool', () => {
    expect(guardWriteEdit(makeInput('MultiEdit'))).toBeNull();
  });

  it('should skip for Bash tool', () => {
    expect(guardWriteEdit(bashInput())).not.toBeNull();
  });

  it('should skip for Read tool', () => {
    expect(guardWriteEdit(makeInput('Read'))).not.toBeNull();
  });
});

// =============================================================================
// guardHasCommand
// =============================================================================

describe('guardHasCommand', () => {
  it('should return null when command is present', () => {
    expect(guardHasCommand(bashInput('git status'))).toBeNull();
  });

  it('should skip when command is missing', () => {
    expect(guardHasCommand(bashInput())).not.toBeNull();
  });

  it('should skip when command is empty string', () => {
    expect(guardHasCommand(bashInput(''))).not.toBeNull();
  });
});

// =============================================================================
// guardHasFilePath
// =============================================================================

describe('guardHasFilePath', () => {
  it('should return null when file_path is present', () => {
    expect(guardHasFilePath(writeInput('/tmp/file.ts'))).toBeNull();
  });

  it('should skip when file_path is missing', () => {
    expect(guardHasFilePath(writeInput())).not.toBeNull();
  });

  it('should return null when path is present (alternative field)', () => {
    const input = makeInput('Read', { path: '/tmp/dir' });
    expect(guardHasFilePath(input)).toBeNull();
  });
});

// =============================================================================
// guardFileExtension
// =============================================================================

describe('guardFileExtension', () => {
  it('should return null when extension matches', () => {
    expect(guardFileExtension(writeInput('/src/app.py'), '.py')).toBeNull();
  });

  it('should return null when extension matches one of many', () => {
    expect(guardFileExtension(writeInput('/src/app.ts'), '.py', '.ts', '.js')).toBeNull();
  });

  it('should skip when extension does not match', () => {
    expect(guardFileExtension(writeInput('/src/app.rs'), '.py', '.ts')).not.toBeNull();
  });

  it('should be case-insensitive', () => {
    expect(guardFileExtension(writeInput('/src/app.PY'), '.py')).toBeNull();
  });

  it('should skip when no file path present', () => {
    expect(guardFileExtension(writeInput(), '.py')).not.toBeNull();
  });
});

// =============================================================================
// guardWithinProject
// =============================================================================

describe('guardWithinProject', () => {
  it('should skip when no file path present', () => {
    expect(guardWithinProject(writeInput())).not.toBeNull();
  });

  it('should skip for path outside project', () => {
    const result = guardWithinProject(writeInput('/etc/passwd'));
    expect(result).not.toBeNull();
  });
});

// =============================================================================
// guardSkipInternal
// =============================================================================

describe('guardSkipInternal', () => {
  it('should skip node_modules paths', () => {
    expect(guardSkipInternal(writeInput('/project/node_modules/foo/index.js'))).not.toBeNull();
  });

  it('should skip .git paths', () => {
    expect(guardSkipInternal(writeInput('/project/.git/config'))).not.toBeNull();
  });

  it('should skip __pycache__ paths', () => {
    expect(guardSkipInternal(writeInput('/project/__pycache__/mod.pyc'))).not.toBeNull();
  });

  it('should skip .venv paths', () => {
    expect(guardSkipInternal(writeInput('/project/.venv/lib/python3.11/site.py'))).not.toBeNull();
  });

  it('should return null for normal project paths', () => {
    expect(guardSkipInternal(writeInput('/project/src/app.ts'))).toBeNull();
  });

  it('should skip when no file path present', () => {
    expect(guardSkipInternal(writeInput())).not.toBeNull();
  });
});
