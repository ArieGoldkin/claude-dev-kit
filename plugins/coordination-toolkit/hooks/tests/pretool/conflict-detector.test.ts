/**
 * Tests for the conflict-detector PreToolUse hook.
 *
 * @module tests/pretool/conflict-detector
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock coordination modules
vi.mock('../../src/coordination/claims.js');
vi.mock('../../src/coordination/peers.js');

import { claimFile, getClaimOwner } from '../../src/coordination/claims.js';
import { listPeers } from '../../src/coordination/peers.js';
import { conflictDetector } from '../../src/pretool/conflict-detector.js';
import type { HookInput } from '../../src/types.js';

function makeInput(toolName: string, filePath?: string): HookInput {
  return {
    tool_name: toolName as HookInput['tool_name'],
    tool_input: filePath ? { file_path: filePath } : {},
  };
}

describe('conflict-detector', () => {
  beforeEach(() => {
    vi.stubEnv('CLAUDE_PROJECT_DIR', '/test/project');
    vi.stubEnv('CLAUDE_SESSION_ID', 'session-aaa-111');
    vi.mocked(getClaimOwner).mockReturnValue(null);
    vi.mocked(claimFile).mockResolvedValue({ success: true });
    vi.mocked(listPeers).mockReturnValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('non-write tools', () => {
    it.each(['Bash', 'Read', 'Grep'])('should return silent success for %s', async (tool) => {
      const result = await conflictDetector(makeInput(tool, '/some/file.ts'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(getClaimOwner).not.toHaveBeenCalled();
      expect(claimFile).not.toHaveBeenCalled();
    });
  });

  describe('no file path', () => {
    it('should return silent success when no file_path in input', async () => {
      const result = await conflictDetector(makeInput('Write'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(getClaimOwner).not.toHaveBeenCalled();
    });
  });

  describe('no conflict — auto-claims', () => {
    it('should call claimFile and return silent success when no existing claim', async () => {
      const result = await conflictDetector(makeInput('Edit', '/test/project/src/app.ts'));

      expect(getClaimOwner).toHaveBeenCalledWith('/test/project', '/test/project/src/app.ts');
      expect(claimFile).toHaveBeenCalledWith('/test/project', '/test/project/src/app.ts');
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('conflict detected', () => {
    it('should return notification with warning when another session owns the claim', async () => {
      vi.mocked(getClaimOwner).mockReturnValue({
        file_path: '/test/project/src/app.ts',
        claimed_by: 'session-bbb-222',
        claimed_at: '2026-04-05T10:00:00Z',
        expires_at: '2026-04-05T10:05:00Z',
      });
      vi.mocked(listPeers).mockReturnValue([
        {
          id: 'session-bbb-222',
          pid: 5678,
          cwd: '/test/project',
          branch: 'feat/new-feature',
          started_at: '2026-04-05T09:00:00Z',
          last_heartbeat: '2026-04-05T10:00:00Z',
          status: 'active',
          summary: 'Adding authentication module',
          files_editing: ['/test/project/src/app.ts'],
        },
      ]);

      const result = await conflictDetector(makeInput('Write', '/test/project/src/app.ts'));

      expect(result.continue).toBe(true);
      // User-visible notification
      expect(result.systemMessage).toContain('Conflict');
      expect(result.systemMessage).toContain('feat/new-feature');
      // Claude context with full details
      const context = result.hookSpecificOutput?.additionalContext;
      expect(context).toBeDefined();
      expect(context).toContain('/test/project/src/app.ts');
      expect(context).toContain('session-');
      expect(context).toContain('feat/new-feature');
      expect(context).toContain('Adding authentication module');
      expect(context).toContain('2026-04-05T10:05:00Z');
      // Should NOT auto-claim when conflict is detected
      expect(claimFile).not.toHaveBeenCalled();
    });
  });

  describe('own claim — no warning', () => {
    it('should auto-claim (renew) and return silent success when claim is owned by current session', async () => {
      vi.mocked(getClaimOwner).mockReturnValue({
        file_path: '/test/project/src/app.ts',
        claimed_by: 'session-aaa-111',
        claimed_at: '2026-04-05T10:00:00Z',
        expires_at: '2026-04-05T10:05:00Z',
      });

      const result = await conflictDetector(makeInput('MultiEdit', '/test/project/src/app.ts'));

      expect(claimFile).toHaveBeenCalledWith('/test/project', '/test/project/src/app.ts');
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Should NOT have warning context
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });
  });

  describe('claim failure graceful', () => {
    it('should still return silent success when claimFile throws', async () => {
      vi.mocked(claimFile).mockRejectedValue(new Error('disk full'));

      const result = await conflictDetector(makeInput('Write', '/test/project/src/app.ts'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('missing peer info', () => {
    it('should show "unknown task" and "unknown branch" when claimer has no matching peer', async () => {
      vi.mocked(getClaimOwner).mockReturnValue({
        file_path: '/test/project/src/app.ts',
        claimed_by: 'session-ccc-333',
        claimed_at: '2026-04-05T10:00:00Z',
        expires_at: '2026-04-05T10:05:00Z',
      });
      vi.mocked(listPeers).mockReturnValue([]); // no matching peer

      const result = await conflictDetector(makeInput('Edit', '/test/project/src/app.ts'));

      expect(result.systemMessage).toContain('Conflict');
      const context = result.hookSpecificOutput?.additionalContext;
      expect(context).toBeDefined();
      expect(context).toContain('unknown task');
      expect(context).toContain('unknown branch');
    });
  });
});
