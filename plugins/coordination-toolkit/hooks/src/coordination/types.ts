/**
 * Coordination-specific types and constants.
 *
 * Defines the peer registry schema, filesystem layout, and timing thresholds
 * for multi-session coordination.
 *
 * @module coordination/types
 */

export interface PeerInfo {
  id: string; // CLAUDE_SESSION_ID
  name: string; // human-friendly name (e.g., "main-a1b2" or user-set)
  pid: number; // process.pid
  cwd: string; // working directory
  branch: string | null; // git branch
  started_at: string; // ISO timestamp
  last_heartbeat: string; // ISO timestamp
  status: 'active' | 'idle' | 'busy';
  summary: string | null; // what the session is working on
  files_editing: string[]; // files currently being edited
}

export const COORDINATION_DIRS = {
  root: '.claude/coordination',
  peers: '.claude/coordination/peers',
  claims: '.claude/coordination/claims',
  messages: '.claude/coordination/messages',
  outbox: '.claude/coordination/outbox',
  experiments: '.claude/coordination/experiments',
} as const;

/** Canonical session ID written at peer registration — single source of truth across all processes. */
export const SESSION_ID_FILE = '.session-id';

/**
 * @deprecated Staleness is now determined by PID liveness checks (process-utils.ts),
 * not heartbeat thresholds. This constant is preserved for backward compatibility only.
 */
export const STALE_THRESHOLD_MS = 60_000; // 60 seconds
