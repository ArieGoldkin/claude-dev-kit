/**
 * Tests for coordination lifecycle hooks.
 *
 * @module tests/lifecycle/lifecycle
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock coordination modules
vi.mock('../../src/coordination/peers.js');
vi.mock('../../src/coordination/claims.js');

import { gcOrphanedClaims, releaseAllClaims } from '../../src/coordination/claims.js';
import { deregisterPeer, listPeers, registerPeer } from '../../src/coordination/peers.js';
import { inFlightWorkReason, peerDeregister } from '../../src/lifecycle/peer-deregister.js';
import { peerRegister } from '../../src/lifecycle/peer-register.js';
import type { HookInput } from '../../src/types.js';

function makeInput(): HookInput {
  return {
    tool_name: 'Bash',
    tool_input: {},
  };
}

describe('peer lifecycle hooks', () => {
  beforeEach(() => {
    vi.stubEnv('CLAUDE_PROJECT_DIR', '/test/project');
    vi.mocked(registerPeer).mockResolvedValue({
      id: 'test-session',
      name: 'main-test',
      pid: 1234,
      cwd: '/test/project',
      branch: 'main',
      started_at: '2026-04-05T00:00:00Z',
      last_heartbeat: '2026-04-05T00:00:00Z',
      status: 'active',
      summary: null,
      files_editing: [],
    });
    vi.mocked(listPeers).mockReturnValue([]);
    vi.mocked(gcOrphanedClaims).mockReturnValue(0);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('peerRegister (SessionStart)', () => {
    it('should call registerPeer and show session name', async () => {
      const result = await peerRegister(makeInput());

      expect(registerPeer).toHaveBeenCalledWith('/test/project');
      expect(result.continue).toBe(true);
      expect(result.systemMessage).toContain('main-test');
    });

    it('should use cwd as fallback when CLAUDE_PROJECT_DIR not set', async () => {
      vi.stubEnv('CLAUDE_PROJECT_DIR', '');

      await peerRegister(makeInput());

      expect(registerPeer).toHaveBeenCalledWith('.');
    });

    it('should not fail when registerPeer throws', async () => {
      vi.mocked(registerPeer).mockRejectedValue(new Error('disk full'));

      const result = await peerRegister(makeInput());

      expect(result.continue).toBe(true);
    });

    it('should call gcOrphanedClaims after registration', async () => {
      await peerRegister(makeInput());

      expect(gcOrphanedClaims).toHaveBeenCalledWith('/test/project');
    });

    it('should show commands on first use (no .welcomed marker)', async () => {
      const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-test-'));
      vi.stubEnv('CLAUDE_PROJECT_DIR', tmpProject);

      const result = await peerRegister(makeInput());

      expect(result.systemMessage).toContain('/peers');
      expect(result.systemMessage).toContain('/coordinate');

      fs.rmSync(tmpProject, { recursive: true, force: true });
    });

    it('should add .claude/coordination/ to .gitignore on first use', async () => {
      const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-test-'));
      vi.stubEnv('CLAUDE_PROJECT_DIR', tmpProject);

      await peerRegister(makeInput());

      const gitignore = fs.readFileSync(path.join(tmpProject, '.gitignore'), 'utf8');
      expect(gitignore).toContain('.claude/coordination/');

      fs.rmSync(tmpProject, { recursive: true, force: true });
    });

    it('should not duplicate .gitignore entry if already present', async () => {
      const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-test-'));
      vi.stubEnv('CLAUDE_PROJECT_DIR', tmpProject);

      // Create a .gitignore that already has the entry
      fs.writeFileSync(path.join(tmpProject, '.gitignore'), '.claude/coordination/\n');

      await peerRegister(makeInput());

      const gitignore = fs.readFileSync(path.join(tmpProject, '.gitignore'), 'utf8');
      const matches = gitignore.match(/\.claude\/coordination\//g);
      expect(matches).toHaveLength(1);

      fs.rmSync(tmpProject, { recursive: true, force: true });
    });

    it('should not show commands when .welcomed marker exists', async () => {
      const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-test-'));
      vi.stubEnv('CLAUDE_PROJECT_DIR', tmpProject);

      // Create the marker file
      const coordDir = path.join(tmpProject, '.claude', 'coordination');
      fs.mkdirSync(coordDir, { recursive: true });
      fs.writeFileSync(path.join(coordDir, '.welcomed'), new Date().toISOString());

      const result = await peerRegister(makeInput());

      expect(result.systemMessage).not.toContain('/coordinate');

      fs.rmSync(tmpProject, { recursive: true, force: true });
    });
  });

  describe('peerDeregister (SessionEnd/Stop/StopFailure)', () => {
    it('should call releaseAllClaims then deregisterPeer', async () => {
      const callOrder: string[] = [];
      vi.mocked(releaseAllClaims).mockImplementation(() => {
        callOrder.push('releaseAllClaims');
      });
      vi.mocked(deregisterPeer).mockImplementation(() => {
        callOrder.push('deregisterPeer');
      });

      const result = await peerDeregister(makeInput());

      expect(callOrder).toEqual(['releaseAllClaims', 'deregisterPeer']);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should not fail when cleanup throws', async () => {
      vi.mocked(releaseAllClaims).mockImplementation(() => {
        throw new Error('cleanup error');
      });

      const result = await peerDeregister(makeInput());

      expect(result.continue).toBe(true);
    });

    describe('in-flight work guard (CC v2.1.145 background_tasks + session_crons)', () => {
      beforeEach(() => {
        // Reset mock implementations leaked from sibling tests (the
        // "cleanup throws" test installs a throwing implementation).
        vi.mocked(releaseAllClaims).mockReset();
        vi.mocked(deregisterPeer).mockReset();
      });

      it('should SKIP deregistration when Stop has background_tasks', async () => {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: {},
          hook_event_name: 'Stop',
          background_tasks: [{ id: 'shell-1', description: 'long-running build' }],
        };
        await peerDeregister(input);
        expect(releaseAllClaims).not.toHaveBeenCalled();
        expect(deregisterPeer).not.toHaveBeenCalled();
      });

      it('should SKIP deregistration when Stop has session_crons', async () => {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: {},
          hook_event_name: 'Stop',
          session_crons: [{ id: 'cron-1', schedule: '*/30 * * * *', command: '/save-state' }],
        };
        await peerDeregister(input);
        expect(releaseAllClaims).not.toHaveBeenCalled();
        expect(deregisterPeer).not.toHaveBeenCalled();
      });

      it('should SKIP deregistration on SubagentStop with background_tasks', async () => {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: {},
          hook_event_name: 'SubagentStop',
          background_tasks: [{ id: 'task-1' }],
        };
        await peerDeregister(input);
        expect(releaseAllClaims).not.toHaveBeenCalled();
      });

      it('should proceed when Stop fires with EMPTY background_tasks and session_crons', async () => {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: {},
          hook_event_name: 'Stop',
          background_tasks: [],
          session_crons: [],
        };
        await peerDeregister(input);
        expect(releaseAllClaims).toHaveBeenCalled();
        expect(deregisterPeer).toHaveBeenCalled();
      });

      it('should proceed on SessionEnd even if background_tasks were present (terminal shutdown)', async () => {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: {},
          hook_event_name: 'SessionEnd',
          // Hypothetical: even if CC ever populated these on SessionEnd,
          // we still cleanup because SessionEnd is terminal.
          background_tasks: [{ id: 'orphan' }],
        };
        await peerDeregister(input);
        expect(releaseAllClaims).toHaveBeenCalled();
        expect(deregisterPeer).toHaveBeenCalled();
      });

      it('should proceed on StopFailure regardless of background_tasks (turn crashed)', async () => {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: {},
          hook_event_name: 'StopFailure',
          background_tasks: [{ id: 'orphan' }],
        };
        await peerDeregister(input);
        expect(releaseAllClaims).toHaveBeenCalled();
        expect(deregisterPeer).toHaveBeenCalled();
      });
    });

    describe('inFlightWorkReason (unit)', () => {
      it('returns null when not Stop/SubagentStop', () => {
        expect(
          inFlightWorkReason({
            tool_name: 'Bash',
            tool_input: {},
            hook_event_name: 'SessionEnd',
            background_tasks: [{ id: 'x' }],
          })
        ).toBeNull();
      });
      it('returns null when both arrays empty on Stop', () => {
        expect(
          inFlightWorkReason({
            tool_name: 'Bash',
            tool_input: {},
            hook_event_name: 'Stop',
          })
        ).toBeNull();
      });
      it('returns reason with task count', () => {
        const r = inFlightWorkReason({
          tool_name: 'Bash',
          tool_input: {},
          hook_event_name: 'Stop',
          background_tasks: [{ id: '1' }, { id: '2' }],
        });
        expect(r).toContain('2 background task');
      });
      it('returns reason with both counts when both present', () => {
        const r = inFlightWorkReason({
          tool_name: 'Bash',
          tool_input: {},
          hook_event_name: 'Stop',
          background_tasks: [{ id: '1' }],
          session_crons: [{ id: 'c1' }, { id: 'c2' }],
        });
        expect(r).toContain('1 background task');
        expect(r).toContain('2 scheduled cron');
      });
    });
  });
});
