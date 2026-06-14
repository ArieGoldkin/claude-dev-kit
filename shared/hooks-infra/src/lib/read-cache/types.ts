/**
 * Read cache - shared types.
 *
 * Defines the persisted record format and the result envelope returned by
 * the diff pipeline. All runtime modules in `read-cache/` import their
 * types from this file.
 *
 * @module lib/read-cache/types
 */

/**
 * Per-file read record persisted in the per-session cache.
 *
 * Path is keyed absolute. Hash is SHA-256 hex of the content at read time.
 * `cachedContent` is the full file body at the moment of the cached read —
 * required so a later read can compute a diff without re-reading the
 * original revision from disk.
 */
export interface CachedRead {
  /** Absolute path of the file as Claude saw it. */
  absPath: string;
  /** SHA-256 hex digest of `cachedContent`. */
  contentHash: string;
  /** Byte length of the cached content (informational). */
  size: number;
  /** Filesystem mtime in milliseconds since epoch at the time of caching. */
  mtimeMs: number;
  /** Full content at last read; required to compute a unified diff later. */
  cachedContent: string;
  /** ISO-8601 timestamp when the entry was written. */
  recordedAt: string;
  /** Schema version literal — bump when the on-disk shape changes. */
  schemaVersion: 1;
}

/**
 * Result of comparing a current read against the cached entry.
 *
 * - `no-cache`   — never read this file in this session.
 * - `unchanged` — mtime/size/hash all match cached.
 * - `delta`     — small enough to inject; caller renders diff into context.
 * - `too-large` — diff exceeds budget; caller falls through to full read.
 */
export type DeltaResult =
  | { kind: 'no-cache' }
  | { kind: 'unchanged' }
  | { kind: 'delta'; diff: string; oldHash: string }
  | { kind: 'too-large'; reason: 'lines' | 'chars' };
