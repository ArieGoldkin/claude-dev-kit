/**
 * Shared Plugin - Structured Logging Library
 *
 * TypeScript port of scripts/lib/logging.sh.
 * Provides logging functions with rotation and permission audit trail.
 *
 * Uses CLAUDE_PLUGIN_DATA env var for persistent log storage when available,
 * falling back to ~/.claude/logs/<plugin-name>/ for backward compatibility.
 * Uses CLAUDE_PLUGIN_NAME env var (set by each plugin's run-hook-wrapper.sh)
 * to determine the fallback log directory and log level env var prefix.
 * Defaults to 'plugin' when unset.
 *
 * @module logging
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AgentContext, HookLogger, LogLevel, PermissionLogEntry } from '../types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Plugin name from environment, defaulting to 'plugin' when unset.
 * Each plugin's run-hook-wrapper.sh sets this to the specific plugin name.
 */
const PLUGIN_NAME = process.env['CLAUDE_PLUGIN_NAME'] || 'plugin';

/**
 * Compute the log directory path.
 *
 * Prefers CLAUDE_PLUGIN_DATA env var (persistent across plugin updates) with a
 * `logs/` subdirectory. Falls back to `~/.claude/logs/<plugin-name>/` for
 * backward compatibility when the env var is not set.
 */
function computeLogDir(): string {
  const pluginDataDir = process.env['CLAUDE_PLUGIN_DATA'];
  return pluginDataDir
    ? path.join(pluginDataDir, 'logs')
    : path.join(process.env['HOME'] || '/tmp', '.claude', 'logs', PLUGIN_NAME);
}

/**
 * Cached log directory path. Lazily computed and reset via resetLogDir().
 */
let cachedLogDir: string | null = null;

/**
 * Get the resolved log directory, caching after first call.
 */
function resolveLogDir(): string {
  if (cachedLogDir === null) {
    cachedLogDir = computeLogDir();
  }
  return cachedLogDir;
}

/**
 * Get the path to the main hooks log file.
 */
function resolveHookLogFile(): string {
  return path.join(resolveLogDir(), 'hooks.log');
}

/**
 * Get the path to the permission audit log file.
 */
function resolvePermissionLogFile(): string {
  return path.join(resolveLogDir(), 'permission-feedback.log');
}

/**
 * Maximum size for hooks.log before rotation (200KB).
 */
const HOOK_LOG_MAX_SIZE = 204800;

/**
 * Maximum size for permission-feedback.log before rotation (100KB).
 */
const PERMISSION_LOG_MAX_SIZE = 102400;

/**
 * Log level numeric values for comparison.
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// =============================================================================
// INTERNAL STATE
// =============================================================================

/**
 * Current log level, cached from environment variable.
 */
let currentLogLevel: LogLevel | null = null;

/**
 * Flag to track if log directory has been created.
 */
let logDirCreated = false;

// =============================================================================
// INTERNAL FUNCTIONS
// =============================================================================

/**
 * Get the current log level from environment variable.
 * Defaults to 'warn' if not set or invalid.
 *
 * @returns The current log level
 */
function getLogLevel(): LogLevel {
  if (currentLogLevel !== null) {
    return currentLogLevel;
  }

  const envVarName = `${PLUGIN_NAME.toUpperCase()}_LOG_LEVEL`;
  const envLevel = process.env[envVarName]?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVEL_VALUES) {
    currentLogLevel = envLevel as LogLevel;
  } else {
    currentLogLevel = 'warn';
  }

  return currentLogLevel;
}

/**
 * Check if a message should be logged at the given level.
 *
 * @param level - The level of the message
 * @returns True if the message should be logged
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevelNum = LOG_LEVEL_VALUES[getLogLevel()];
  const requestedLevelNum = LOG_LEVEL_VALUES[level];
  return requestedLevelNum >= currentLevelNum;
}

/**
 * Ensure the log directory exists.
 * Creates it if it doesn't exist, handling errors silently.
 */
function ensureLogDir(): void {
  if (logDirCreated) {
    return;
  }

  try {
    const logDir = resolveLogDir();
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    logDirCreated = true;
  } catch {
    // Silently ignore errors - logging should not break the hook
  }
}

/**
 * Get the size of a file, returning 0 if the file doesn't exist or on error.
 *
 * @param filePath - Path to the file
 * @returns File size in bytes, or 0 on error
 */
function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Rotate a log file if it exceeds the maximum size.
 * Renames the file with a timestamp suffix.
 *
 * @param logFile - Path to the log file
 * @param maxSize - Maximum size in bytes before rotation
 */
function rotateLog(logFile: string, maxSize: number): void {
  try {
    const size = getFileSize(logFile);
    if (size > maxSize) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const rotatedFile = `${logFile}.old.${timestamp}`;
      fs.renameSync(logFile, rotatedFile);
    }
  } catch {
    // Silently ignore rotation errors
  }
}

/**
 * Get an ISO8601 timestamp with milliseconds.
 *
 * @returns Timestamp string in format YYYY-MM-DDTHH:mm:ss.sssZ
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Write a line to a log file with proper error handling.
 * Uses synchronous file append for consistency.
 *
 * @param logFile - Path to the log file
 * @param line - The line to write (newline will be appended)
 */
function writeLogLine(logFile: string, line: string): void {
  try {
    fs.appendFileSync(logFile, `${line}\n`, { encoding: 'utf8' });
  } catch {
    // Silently ignore write errors - logging should not break the hook
  }
}

// =============================================================================
// PUBLIC LOGGING FUNCTIONS
// =============================================================================

/**
 * Log a debug message. Only logged if {PLUGIN_NAME}_LOG_LEVEL=debug.
 *
 * @param hookName - Name of the hook generating the log
 * @param message - The message to log
 *
 * @example
 * ```typescript
 * logDebug('pre-tool-use-security', 'Processing Write tool');
 * // Output: 2024-01-28T12:34:56.789Z [DEBUG] [pre-tool-use-security] Processing Write tool
 * ```
 */
export function logDebug(hookName: string, message: string): void {
  if (!shouldLog('debug')) {
    return;
  }

  ensureLogDir();
  rotateLog(resolveHookLogFile(), HOOK_LOG_MAX_SIZE);

  const timestamp = getTimestamp();
  const line = `${timestamp} [DEBUG] [${hookName}] ${message}`;
  writeLogLine(resolveHookLogFile(), line);
}

/**
 * Log an info message. Logged if {PLUGIN_NAME}_LOG_LEVEL is debug or info.
 *
 * @param hookName - Name of the hook generating the log
 * @param message - The message to log
 *
 * @example
 * ```typescript
 * logInfo('session-start', 'Session initialized');
 * // Output: 2024-01-28T12:34:56.789Z [INFO] [session-start] Session initialized
 * ```
 */
export function logInfo(hookName: string, message: string): void {
  if (!shouldLog('info')) {
    return;
  }

  ensureLogDir();
  rotateLog(resolveHookLogFile(), HOOK_LOG_MAX_SIZE);

  const timestamp = getTimestamp();
  const line = `${timestamp} [INFO] [${hookName}] ${message}`;
  writeLogLine(resolveHookLogFile(), line);
}

/**
 * Log a warning message. Logged if {PLUGIN_NAME}_LOG_LEVEL is debug, info, or warn.
 *
 * @param hookName - Name of the hook generating the log
 * @param message - The message to log
 *
 * @example
 * ```typescript
 * logWarn('pre-tool-use-security', 'Suspicious path pattern detected');
 * // Output: 2024-01-28T12:34:56.789Z [WARN] [pre-tool-use-security] Suspicious path pattern detected
 * ```
 */
export function logWarn(hookName: string, message: string): void {
  if (!shouldLog('warn')) {
    return;
  }

  ensureLogDir();
  rotateLog(resolveHookLogFile(), HOOK_LOG_MAX_SIZE);

  const timestamp = getTimestamp();
  const line = `${timestamp} [WARN] [${hookName}] ${message}`;
  writeLogLine(resolveHookLogFile(), line);
}

/**
 * Log an error message. Always logged regardless of log level.
 *
 * @param hookName - Name of the hook generating the log
 * @param message - The message to log
 *
 * @example
 * ```typescript
 * logError('pre-tool-use-security', 'Failed to parse hook input');
 * // Output: 2024-01-28T12:34:56.789Z [ERROR] [pre-tool-use-security] Failed to parse hook input
 * ```
 */
export function logError(hookName: string, message: string): void {
  if (!shouldLog('error')) {
    return;
  }

  ensureLogDir();
  rotateLog(resolveHookLogFile(), HOOK_LOG_MAX_SIZE);

  const timestamp = getTimestamp();
  const line = `${timestamp} [ERROR] [${hookName}] ${message}`;
  writeLogLine(resolveHookLogFile(), line);
}

/**
 * Log a permission decision for audit trail.
 * Always logged regardless of log level (security audit requirement).
 *
 * @param decision - The permission decision: 'allow' or 'deny'
 * @param reason - The reason for the decision
 * @param tool - The tool that was evaluated
 * @param sessionId - Optional session ID. Defaults to CLAUDE_CODE_SESSION_ID
 *   (CC v2.1.132+) and falls back to CLAUDE_SESSION_ID for older runtimes.
 *
 * @example
 * ```typescript
 * logPermission('allow', 'Safe read-only command', 'Bash', 'session-123');
 * // Output: 2024-01-28T12:34:56.789Z [PERMISSION] decision=allow tool=Bash session=session-123 reason="Safe read-only command"
 * ```
 */
export function logPermission(
  decision: 'allow' | 'deny',
  reason: string,
  tool: string,
  sessionId?: string,
  agentContext?: AgentContext
): void {
  ensureLogDir();
  rotateLog(resolvePermissionLogFile(), PERMISSION_LOG_MAX_SIZE);

  const timestamp = getTimestamp();
  const session =
    sessionId ||
    process.env['CLAUDE_CODE_SESSION_ID'] ||
    process.env['CLAUDE_SESSION_ID'] ||
    'unknown';
  // Escape quotes and newlines for consistent log parsing
  const sanitize = (s: string) => s.replace(/[\n\r]/g, ' ').replace(/"/g, '\\"');
  const escapedReason = sanitize(reason);
  let line = `${timestamp} [PERMISSION] decision=${decision} tool=${tool} session=${session}`;
  if (agentContext?.agentId) {
    line += ` agent_id=${sanitize(agentContext.agentId)}`;
  }
  if (agentContext?.agentType) {
    line += ` agent_type=${sanitize(agentContext.agentType)}`;
  }
  line += ` reason="${escapedReason}"`;
  writeLogLine(resolvePermissionLogFile(), line);
}

/**
 * Log a permission entry using the PermissionLogEntry interface.
 * Always logged regardless of log level (security audit requirement).
 *
 * @param entry - The permission log entry
 *
 * @example
 * ```typescript
 * logPermissionEntry({
 *   timestamp: new Date().toISOString(),
 *   decision: 'deny',
 *   reason: 'Environment file access blocked',
 *   tool: 'Write',
 *   sessionId: 'session-123',
 *   target: '/path/to/.env'
 * });
 * ```
 */
export function logPermissionEntry(entry: PermissionLogEntry): void {
  // Map 'warn' decision to 'allow' for the simple log format
  // since the permission log only supports allow/deny
  const decision = entry.decision === 'warn' ? 'allow' : entry.decision;
  logPermission(decision, entry.reason, entry.tool, entry.sessionId);
}

// =============================================================================
// LOGGER FACTORY
// =============================================================================

/**
 * Create a HookLogger instance for a specific hook.
 * This provides a convenient interface that matches the HookLogger type.
 *
 * @param defaultHookName - Default hook name to use for log entries
 * @returns A HookLogger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger('pre-tool-use-security');
 * logger.debug('pre-tool-use-security', 'Processing input');
 * logger.permission({
 *   timestamp: new Date().toISOString(),
 *   decision: 'allow',
 *   reason: 'Safe command',
 *   tool: 'Bash',
 *   sessionId: 'session-123'
 * });
 * ```
 */
export function createLogger(_defaultHookName: string): HookLogger {
  return {
    debug: (hookName: string, message: string) => logDebug(hookName, message),
    info: (hookName: string, message: string) => logInfo(hookName, message),
    warn: (hookName: string, message: string) => logWarn(hookName, message),
    error: (hookName: string, message: string) => logError(hookName, message),
    permission: (entry: PermissionLogEntry) => logPermissionEntry(entry),
  };
}

/**
 * Create a scoped logger that automatically uses a fixed hook name.
 * This is useful when all logging within a module uses the same hook name.
 *
 * @param hookName - The hook name to use for all log entries
 * @returns An object with scoped logging methods
 *
 * @example
 * ```typescript
 * const log = createScopedLogger('auto-approve-safe-bash');
 * log.debug('Processing command');
 * log.info('Command approved');
 * log.permission('allow', 'Read-only command', 'Bash');
 * ```
 */
export function createScopedLogger(hookName: string) {
  return {
    debug: (message: string) => logDebug(hookName, message),
    info: (message: string) => logInfo(hookName, message),
    warn: (message: string) => logWarn(hookName, message),
    error: (message: string) => logError(hookName, message),
    permission: (decision: 'allow' | 'deny', reason: string, tool: string, sessionId?: string) =>
      logPermission(decision, reason, tool, sessionId),
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Reset the cached log level.
 * Useful for testing or when environment variables change.
 */
export function resetLogLevel(): void {
  currentLogLevel = null;
}

/**
 * Reset the cached log directory path.
 * Useful for testing or when CLAUDE_PLUGIN_DATA changes.
 * Also resets the logDirCreated flag since the directory may differ.
 */
export function resetLogDir(): void {
  cachedLogDir = null;
  logDirCreated = false;
}

/**
 * Get the current effective log level.
 * Returns the log level that is currently being used.
 *
 * @returns The current log level
 */
export function getCurrentLogLevel(): LogLevel {
  return getLogLevel();
}

/**
 * Get the path to the hooks log file.
 * Useful for diagnostics.
 *
 * @returns The absolute path to the hooks log file
 */
export function getHookLogPath(): string {
  return resolveHookLogFile();
}

/**
 * Get the path to the permission log file.
 * Useful for diagnostics.
 *
 * @returns The absolute path to the permission log file
 */
export function getPermissionLogPath(): string {
  return resolvePermissionLogFile();
}

/**
 * Get the log directory path.
 * Useful for diagnostics.
 *
 * @returns The absolute path to the log directory
 */
export function getLogDir(): string {
  return resolveLogDir();
}
