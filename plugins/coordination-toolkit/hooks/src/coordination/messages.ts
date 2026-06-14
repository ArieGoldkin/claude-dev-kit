/**
 * Message passing for multi-session coordination.
 *
 * Sessions can send short text messages to each other via JSON files
 * stored under `.claude/coordination/messages/`. Messages expire after
 * MESSAGE_TTL_MS and are automatically cleaned up on read.
 *
 * @module coordination/messages
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { logDebug, logInfo } from '../lib/logging.js';
import { COORDINATION_DIRS, SESSION_ID_FILE } from './types.js';

const MODULE = 'messages';
const MESSAGE_TTL_MS = 60 * 60 * 1000; // 1 hour
const BRIDGE_ENABLED_MARKER = '.bridge-enabled';

export function isBridgeEnabled(projectDir: string): boolean {
  return fs.existsSync(path.join(projectDir, COORDINATION_DIRS.root, BRIDGE_ENABLED_MARKER));
}

export type MessageType = 'query' | 'response' | 'notification';

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: string;
  read: boolean;
  type?: MessageType;
  inReplyTo?: string;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Stable session ID resolution — reads the marker file written by registerPeer()
 * first, so all processes (node hooks, bash scripts) share the same identity.
 * Falls back to env var, then pid-based ID as a last resort.
 */
function getSessionId(projectDir: string): string {
  // Env var takes priority — set by wrapper to stable PPID, unique per session
  // even when multiple sessions share the same project directory.
  const envId = process.env['CLAUDE_SESSION_ID'];
  if (envId) return envId;
  // Marker file fallback for bash scripts that don't inherit the env var.
  try {
    const markerPath = path.join(projectDir, COORDINATION_DIRS.root, SESSION_ID_FILE);
    const id = fs.readFileSync(markerPath, 'utf8').trim();
    if (id) return id;
  } catch {
    // marker not written yet — continue to fallbacks
  }
  return `${process.pid}`;
}

/**
 * All IDs this session might legitimately be addressed as.
 * Senders may have used any of these before the canonical ID was known.
 */
function getOwnAliases(projectDir: string): Set<string> {
  const aliases = new Set<string>();
  aliases.add(getSessionId(projectDir));
  // Always include pid-based fallback — used before marker file exists
  aliases.add(`${process.pid}`);
  const envId = process.env['CLAUDE_SESSION_ID'];
  if (envId) aliases.add(envId);
  return aliases;
}

export interface SendOptions {
  type?: MessageType;
  inReplyTo?: string;
}

export function sendMessage(
  projectDir: string,
  toSessionId: string,
  content: string,
  options: SendOptions = {}
): Message {
  const messagesDir = path.join(projectDir, COORDINATION_DIRS.messages);
  ensureDir(messagesDir);

  const fromId = getSessionId(projectDir);
  const now = new Date();
  const nonce = crypto.randomBytes(4).toString('hex');
  const id = `${now.getTime()}-${fromId.slice(0, 8)}-${toSessionId.slice(0, 8)}-${nonce}`;

  const message: Message = {
    id,
    from: fromId,
    to: toSessionId,
    content,
    timestamp: now.toISOString(),
    read: false,
    ...(options.type && { type: options.type }),
    ...(options.inReplyTo && { inReplyTo: options.inReplyTo }),
  };

  const filePath = path.join(messagesDir, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(message, null, 2));

  // Outbox audit copy
  try {
    const outboxDir = path.join(projectDir, COORDINATION_DIRS.outbox);
    ensureDir(outboxDir);
    fs.writeFileSync(path.join(outboxDir, `${id}.json`), JSON.stringify(message, null, 2));
  } catch {
    logDebug(MODULE, `Failed to write outbox copy for ${id}`);
  }

  logInfo(MODULE, `Sent message to ${toSessionId.slice(0, 8)}: ${content.slice(0, 50)}`);
  return message;
}

export function getMessages(projectDir: string, sinceTimestamp?: string): Message[] {
  const messagesDir = path.join(projectDir, COORDINATION_DIRS.messages);
  if (!fs.existsSync(messagesDir)) return [];

  const ownAliases = getOwnAliases(projectDir);
  const sinceMs = sinceTimestamp ? new Date(sinceTimestamp).getTime() : 0;
  const now = Date.now();

  const files = fs.readdirSync(messagesDir).filter((f) => f.endsWith('.json'));
  const messages: Message[] = [];

  for (const file of files) {
    const filePath = path.join(messagesDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const msg = JSON.parse(content) as Message;

      // Auto-expire old messages
      if (now - new Date(msg.timestamp).getTime() > MESSAGE_TTL_MS) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
        continue;
      }

      // Match any alias — sender may have used a stale/fallback ID
      if (ownAliases.has(msg.to) && !msg.read && new Date(msg.timestamp).getTime() > sinceMs) {
        messages.push(msg);
      }
    } catch {
      // Skip corrupt files
    }
  }

  return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function markRead(projectDir: string, messageId: string): void {
  const messagesDir = path.join(projectDir, COORDINATION_DIRS.messages);
  const filePath = path.join(messagesDir, `${messageId}.json`);

  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const msg = JSON.parse(content) as Message;
    msg.read = true;
    fs.writeFileSync(filePath, JSON.stringify(msg, null, 2));
    logDebug(MODULE, `Marked message ${messageId} as read`);
  } catch {
    // ignore
  }
}
