/**
 * Engineering Toolkit Plugin - Hook System Entry Point
 *
 * This module provides the hook registry and exports all public APIs
 * for the TypeScript hook system. Registers the review-logger hook.
 *
 * @module engineering-toolkit-hooks
 *
 * @example
 * ```typescript
 * import { registerHook, getHook, listHooks } from 'engineering-toolkit-hooks';
 *
 * // Register a custom hook
 * registerHook('my-hook', 'Description', async (input) => {
 *   return { continue: true, suppressOutput: true };
 * });
 *
 * // Get and execute a hook
 * const hook = getHook('my-hook');
 * if (hook) {
 *   const result = await hook.handler(input);
 * }
 * ```
 */

import type { HookFunction } from './types.js';

// =============================================================================
// HOOK METADATA TYPE
// =============================================================================

/**
 * Hook metadata stored in the registry.
 * Contains the hook name, description, and handler function.
 */
export interface RegisteredHookMetadata {
  /**
   * Unique identifier for the hook.
   */
  name: string;

  /**
   * Human-readable description of what the hook does.
   */
  description: string;

  /**
   * The hook handler function.
   */
  handler: HookFunction;
}

// =============================================================================
// HOOK REGISTRY
// =============================================================================

/**
 * Global hook registry.
 * Maps hook names to their metadata.
 */
const hooks: Map<string, RegisteredHookMetadata> = new Map();

/**
 * Register a hook in the global registry.
 *
 * @param name - Unique identifier for the hook
 * @param description - Human-readable description
 * @param handler - The hook handler function
 */
export function registerHook(name: string, description: string, handler: HookFunction): void {
  hooks.set(name, { name, description, handler });
}

/**
 * Get a hook by name from the registry.
 *
 * @param name - Hook name to look up
 * @returns Hook metadata or undefined if not found
 */
export function getHook(name: string): RegisteredHookMetadata | undefined {
  return hooks.get(name);
}

/**
 * List all registered hook names.
 *
 * @returns Array of hook names
 */
export function listHooks(): string[] {
  return Array.from(hooks.keys());
}

/**
 * Check if a hook is registered.
 *
 * @param name - Hook name to check
 * @returns True if the hook is registered
 */
export function hasHook(name: string): boolean {
  return hooks.has(name);
}

/**
 * Unregister a hook from the registry.
 * Primarily used for testing.
 *
 * @param name - Hook name to remove
 * @returns True if the hook was removed
 */
export function unregisterHook(name: string): boolean {
  return hooks.delete(name);
}

/**
 * Clear all registered hooks.
 * Primarily used for testing.
 */
export function clearHooks(): void {
  hooks.clear();
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Export all library utilities
export {
  outputSilentSuccess,
  outputSuccess,
  outputWarning,
  outputDeny,
  outputAllow,
  outputAllowWithContext,
  outputAsk,
  outputPromptContext,
  outputWithContext,
  outputStderrWarning,
  outputWithNotification,
} from './lib/output.js';

export {
  readHookInput,
  readHookInputAsync, // Backward compatibility alias
  parseHookInput,
  getToolName,
  getFilePath,
  getCommand,
  getSessionId,
  getProjectDir,
  getContent,
  getPattern,
  getOldString,
  getNewString,
  getField,
  getToolInput,
  getProviderInfo,
} from './lib/input.js';

export type { ProviderInfo } from './lib/input.js';

export {
  logDebug,
  logInfo,
  logWarn,
  logError,
  logPermission,
  logPermissionEntry,
  createLogger,
  createScopedLogger,
  resetLogLevel,
  getCurrentLogLevel,
  getHookLogPath,
  getPermissionLogPath,
  getLogDir,
} from './lib/logging.js';

// Export all types
export type {
  ToolName,
  FileWriteToolName,
  ReadOnlyToolName,
  HookInput,
  ToolInput,
  BashToolInput,
  FileToolInput,
  UserPromptInput,
  PermissionDecision,
  HookSpecificOutput,
  HookResult,
  HookFunction,
  AsyncHookFunction,
  SyncHookFunction,
  HookEvent,
  HookConfig,
  HookMatcher,
  HooksConfig,
  HookMetadata,
  HookRegistry,
  HookEnvironment,
  SecurityPatterns,
  LogLevel,
  PermissionLogEntry,
  HookLogger,
  SessionHeartbeat,
  DirtyTracking,
  SharedContext,
} from './types.js';

// Export type guards from types
export {
  isBashToolInput,
  isFileToolInput,
  isUserPromptInput,
  getHookEnvironment,
} from './types.js';

// =============================================================================
// HOOK REGISTRATION
// =============================================================================

import { continuityRecommendation } from './lifecycle/continuity-recommendation.js';
registerHook(
  'lifecycle/continuity-recommendation',
  'Recommend installing ctk for full hook coverage',
  continuityRecommendation
);
