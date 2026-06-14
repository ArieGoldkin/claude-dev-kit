/**
 * Coordination Plugin - Hook System Entry Point
 *
 * @module coordination-hooks
 */

import type { HookFunction } from './types.js';

export interface RegisteredHookMetadata {
  name: string;
  description: string;
  handler: HookFunction;
}

const hooks: Map<string, RegisteredHookMetadata> = new Map();

export function registerHook(name: string, description: string, handler: HookFunction): void {
  hooks.set(name, { name, description, handler });
}

export function getHook(name: string): RegisteredHookMetadata | undefined {
  return hooks.get(name);
}

export function listHooks(): string[] {
  return Array.from(hooks.keys());
}

export function hasHook(name: string): boolean {
  return hooks.has(name);
}

// Re-exports from shared lib
export {
  outputSilentSuccess,
  outputSuccess,
  outputDeny,
  outputAllow,
} from './lib/output.js';

export {
  readHookInput,
  getToolName,
  getCommand,
  getSessionId,
  getProjectDir,
} from './lib/input.js';

export {
  logDebug,
  logInfo,
  logWarn,
  logError,
} from './lib/logging.js';

export type {
  HookInput,
  HookResult,
  HookFunction,
} from './types.js';

// =============================================================================
// HOOK REGISTRATION
// =============================================================================

import { peerRegister } from './lifecycle/peer-register.js';
registerHook(
  'lifecycle/peer-register',
  'Register this session as a coordination peer',
  peerRegister
);

import { peerDeregister } from './lifecycle/peer-deregister.js';
registerHook(
  'lifecycle/peer-deregister',
  'Deregister peer and release file claims on session end',
  peerDeregister
);

import { conflictDetector } from './pretool/conflict-detector.js';
registerHook(
  'pretool/conflict-detector',
  'Detect file conflicts and auto-claim files on Write/Edit/MultiEdit',
  conflictDetector
);

import { peerAnnouncer } from './posttool/peer-announcer.js';
registerHook(
  'posttool/peer-announcer',
  'Announce file edits to peer registry after Write/Edit/MultiEdit',
  peerAnnouncer
);

import { messageChecker } from './prompt/message-checker.js';
registerHook('prompt/message-checker', 'Check for unread peer messages', messageChecker);

import { bridgeMessageChecker } from './posttool/bridge-message-checker.js';
registerHook(
  'posttool/bridge-message-checker',
  'Check for unread peer messages on every tool use (throttled, opt-in)',
  bridgeMessageChecker
);

import { notificationHandler } from './lifecycle/notification-handler.js';
registerHook(
  'lifecycle/notification-handler',
  'Handle Notification events for peer messaging bridge',
  notificationHandler
);
