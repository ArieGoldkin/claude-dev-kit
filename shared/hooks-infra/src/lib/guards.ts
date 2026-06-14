/**
 * Shared Hooks Infra - Composable Guard Functions
 *
 * Guards replace ad-hoc inline tool-name and field-presence checks at the
 * top of every hook. Each guard returns null to continue or a HookResult
 * to short-circuit.
 *
 * @module hooks/lib/guards
 */

import type { HookInput, HookResult, ToolName } from '../types.js';
import { getCommand, getFilePath, getToolName } from './input.js';
import { outputSilentSuccess } from './output.js';
import { isWithinProject } from './path-utils.js';

/**
 * Guard result: null means "continue to next guard / hook body",
 * a HookResult means "short-circuit with this response".
 */
export type GuardResult = HookResult | null;

/**
 * A guard function receives hook input and returns a GuardResult.
 */
export type GuardFn = (input: HookInput) => GuardResult;

// =============================================================================
// RUNNER
// =============================================================================

/**
 * Run guards in sequence. Returns the first non-null result,
 * or null if all guards pass.
 *
 * @param input - Hook input
 * @param guards - Guard functions to run in order
 * @returns First non-null GuardResult, or null if all pass
 */
export function runGuards(input: HookInput, ...guards: GuardFn[]): GuardResult {
  for (const guard of guards) {
    const result = guard(input);
    if (result !== null) {
      return result;
    }
  }
  return null;
}

// =============================================================================
// TOOL-NAME GUARDS
// =============================================================================

/**
 * Skip (silent success) if the tool name is NOT in the given list.
 */
export function guardTool(input: HookInput, ...toolNames: ToolName[]): GuardResult {
  const toolName = getToolName(input);
  if (!toolNames.includes(toolName)) {
    return outputSilentSuccess();
  }
  return null;
}

/**
 * Skip if tool is not Bash.
 */
export function guardBash(input: HookInput): GuardResult {
  return guardTool(input, 'Bash');
}

/**
 * Skip if tool is not Write, Edit, or MultiEdit.
 */
export function guardWriteEdit(input: HookInput): GuardResult {
  return guardTool(input, 'Write', 'Edit', 'MultiEdit');
}

// =============================================================================
// FIELD-PRESENCE GUARDS
// =============================================================================

/**
 * Skip if no command is present in tool input.
 */
export function guardHasCommand(input: HookInput): GuardResult {
  const command = getCommand(input);
  if (!command) {
    return outputSilentSuccess();
  }
  return null;
}

/**
 * Skip if no file path is present in tool input.
 */
export function guardHasFilePath(input: HookInput): GuardResult {
  const filePath = getFilePath(input);
  if (!filePath) {
    return outputSilentSuccess();
  }
  return null;
}

// =============================================================================
// PATH GUARDS
// =============================================================================

/**
 * Skip if file extension does not match any of the given extensions.
 * Extensions should include the dot (e.g., '.py', '.ts').
 */
export function guardFileExtension(input: HookInput, ...exts: string[]): GuardResult {
  const filePath = getFilePath(input);
  if (!filePath) {
    return outputSilentSuccess();
  }

  const lower = filePath.toLowerCase();
  const matches = exts.some((ext) => lower.endsWith(ext));
  if (!matches) {
    return outputSilentSuccess();
  }
  return null;
}

/**
 * Skip if the file path is outside the project directory.
 */
export function guardWithinProject(input: HookInput): GuardResult {
  const filePath = getFilePath(input);
  if (!filePath) {
    return outputSilentSuccess();
  }

  if (!isWithinProject(filePath)) {
    return outputSilentSuccess();
  }
  return null;
}

/**
 * Internal path patterns to skip (generated/cached directories).
 */
const INTERNAL_PATTERNS = ['/node_modules/', '/.git/', '/__pycache__/', '/.venv/'] as const;

/**
 * Skip if file path is inside node_modules, .git, __pycache__, or .venv.
 */
export function guardSkipInternal(input: HookInput): GuardResult {
  const filePath = getFilePath(input);
  if (!filePath) {
    return outputSilentSuccess();
  }

  for (const pattern of INTERNAL_PATTERNS) {
    if (filePath.includes(pattern)) {
      return outputSilentSuccess();
    }
  }
  return null;
}
