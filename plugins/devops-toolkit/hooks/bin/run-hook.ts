#!/usr/bin/env node
/**
 * DevOps Plugin - Hook CLI Runner
 *
 * Entry point for executing TypeScript hooks from Claude Code.
 * This script is invoked by hooks.json with the hook name as an argument.
 *
 * Key improvements (v1.0.6):
 * - Synchronous stdin reading (no timeout race conditions)
 * - Never returns null - graceful fallback on invalid input
 * - Handles both tool_name and hook_event_name fields
 *
 * Usage:
 *   node hooks/dist/bin/run-hook.js <hook-name>
 *
 * The hook receives JSON input from stdin and outputs JSON to stdout.
 * Exit codes:
 *   0 - Hook completed successfully (continue=true)
 *   1 - Hook blocked operation (continue=false)
 *
 * Environment:
 *   CLAUDE_PLUGIN_ROOT - Required. Path to the plugin root directory.
 *                        Set by Claude Code when running plugin hooks.
 *
 * @module devops-hooks/bin/run-hook
 */

// Process-level error handlers — catch anything that escapes hook try/catch
// These ensure Claude Code always gets valid JSON, even on catastrophic failures
process.on('uncaughtException', (error) => {
  try {
    process.stderr.write(`[devops-hooks] Uncaught: ${error.message}\n`);
  } catch {}
  try {
    process.stdout.write('{"continue":true,"suppressOutput":true}\n');
  } catch {}
  process.exit(0);
});
process.on('unhandledRejection', (reason) => {
  try {
    const msg = reason instanceof Error ? reason.message : String(reason);
    process.stderr.write(`[devops-hooks] Unhandled: ${msg}\n`);
  } catch {}
  try {
    process.stdout.write('{"continue":true,"suppressOutput":true}\n');
  } catch {}
  process.exit(0);
});

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getHook, readHookInput } from '../src/index.js';
import type { HookResult } from '../src/types.js';

/**
 * Output a valid JSON result to stdout.
 * Always outputs valid JSON, even on error.
 */
function outputResult(result: HookResult): void {
  try {
    console.log(JSON.stringify(result));
  } catch {
    // Fallback if JSON.stringify fails (shouldn't happen with valid HookResult)
    console.log('{"continue":true,"suppressOutput":true}');
  }
}

/**
 * Create a silent success result.
 * Used when the hook should allow operation without blocking.
 */
function silentSuccess(): HookResult {
  return {
    continue: true,
    suppressOutput: true,
  };
}

/**
 * Check if a hook is disabled via project-level overrides.
 *
 * Reads `.claude/hook-overrides.json` from CLAUDE_PROJECT_DIR.
 * Expected format: { "disabled": ["posttool/lint-checker", ...] }
 *
 * Graceful degradation: missing file, invalid JSON, or missing key
 * all treated as "no overrides" (hook is enabled).
 *
 * @param hookName - The hook name to check (e.g. "posttool/lint-checker")
 * @returns true if the hook is disabled, false otherwise
 */
export function isHookDisabled(hookName: string): boolean {
  const projectDir = process.env['CLAUDE_PROJECT_DIR'];
  if (!projectDir) return false;

  const overridesPath = path.join(projectDir, '.claude', 'hook-overrides.json');

  try {
    const content = fs.readFileSync(overridesPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.disabled)) {
      return parsed.disabled.includes(hookName);
    }
  } catch {
    // Missing file, invalid JSON, or read error — treat as no overrides
  }

  return false;
}

/**
 * Main entry point.
 * Reads hook name from argv, loads the hook, and executes it.
 */
async function main(): Promise<void> {
  const hookName = process.argv[2];

  // Validate hook name argument
  if (!hookName) {
    console.error('Usage: run-hook.ts <hook-name>');
    console.error('');
    console.error('Available hooks can be listed by importing listHooks() from the module.');
    process.exit(1);
  }

  // Look up the hook in the registry
  const hook = getHook(hookName);

  if (!hook) {
    // Hook not found - don't block, just continue silently
    // This allows for graceful degradation if hooks.json references
    // a hook that hasn't been implemented yet
    outputResult(silentSuccess());
    process.exit(0);
  }

  // Check project-level overrides before executing
  if (isHookDisabled(hookName)) {
    outputResult(silentSuccess());
    process.exit(0);
  }

  try {
    // Read and parse input from stdin (synchronous, never returns null)
    const input = readHookInput();

    // Execute the hook handler
    // Even with empty tool_name, hooks should handle gracefully
    const result = await hook.handler(input);

    // Output the result
    outputResult(result);

    // Exit with appropriate code
    // 0 = continue (operation allowed)
    // 1 = blocked (operation denied)
    process.exit(result.continue ? 0 : 1);
  } catch (error: unknown) {
    // Handle any unexpected errors gracefully
    // Hooks should never crash Claude Code - always continue
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Log to stderr for debugging (visible with --debug flag)
    console.error(`[devops-hooks] Error in ${hookName}: ${message}`);

    // Output silent success to not block Claude Code
    outputResult(silentSuccess());
    process.exit(0);
  }
}

// ESM main-module guard: only run when executed directly, not when imported for testing
const isMainModule =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('run-hook.js') || process.argv[1].endsWith('run-hook.ts'));

if (isMainModule) {
  main().catch((error: unknown) => {
    // Last resort error handler
    // If even main() throws, output safe JSON and exit cleanly
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[devops-hooks] Fatal error: ${message}`);
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    process.exit(0);
  });
}
