/**
 * Tests for the peer-announcer PostToolUse hook.
 *
 * @module tests/posttool/peer-announcer
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock coordination module before importing the hook
vi.mock('../../src/coordination/peers.js');

import { updateHeartbeat } from '../../src/coordination/peers.js';
import type { HookInput } from '../../src/types.js';

function makeWriteInput(filePath?: string): HookInput {
  return {
    tool_name: 'Write',
    tool_input: filePath ? { file_path: filePath } : {},
  };
}

function makeEditInput(filePath: string): HookInput {
  return {
    tool_name: 'Edit',
    tool_input: { file_path: filePath, old_string: 'a', new_string: 'b' },
  };
}

function makeBashInput(): HookInput {
  return {
    tool_name: 'Bash',
    tool_input: { command: 'ls' },
  };
}

function makeReadInput(): HookInput {
  return {
    tool_name: 'Read',
    tool_input: { file_path: '/some/file.ts' },
  };
}

describe('peerAnnouncer', () => {
  beforeEach(() => {
    vi.stubEnv('CLAUDE_PROJECT_DIR', '/test/project');
    vi.mocked(updateHeartbeat).mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('non-write tools', () => {
    it('should return silent success for Bash tool', async () => {
      const { peerAnnouncer } = await import('../../src/posttool/peer-announcer.js');

      const result = await peerAnnouncer(makeBashInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(updateHeartbeat).not.toHaveBeenCalled();
    });

    it('should return silent success for Read tool', async () => {
      const { peerAnnouncer } = await import('../../src/posttool/peer-announcer.js');

      const result = await peerAnnouncer(makeReadInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(updateHeartbeat).not.toHaveBeenCalled();
    });
  });

  describe('no file path', () => {
    it('should return silent success without calling updateHeartbeat', async () => {
      vi.resetModules();
      vi.mock('../../src/coordination/peers.js');
      const { updateHeartbeat: uh } = await import('../../src/coordination/peers.js');
      vi.mocked(uh).mockResolvedValue();
      const { peerAnnouncer } = await import('../../src/posttool/peer-announcer.js');

      const result = await peerAnnouncer(makeWriteInput());

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(uh).not.toHaveBeenCalled();
    });
  });

  describe('file edit announced', () => {
    it('should call updateHeartbeat with busy status and files_editing', async () => {
      vi.resetModules();
      vi.mock('../../src/coordination/peers.js');
      const { updateHeartbeat: uh } = await import('../../src/coordination/peers.js');
      vi.mocked(uh).mockResolvedValue();
      const { peerAnnouncer } = await import('../../src/posttool/peer-announcer.js');

      const result = await peerAnnouncer(makeWriteInput('/test/project/src/app.ts'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(uh).toHaveBeenCalledWith('/test/project', {
        status: 'busy',
        files_editing: ['/test/project/src/app.ts'],
      });
    });
  });

  describe('multiple edits accumulate', () => {
    it('should accumulate files_editing across multiple calls', async () => {
      vi.resetModules();
      vi.mock('../../src/coordination/peers.js');
      const { updateHeartbeat: uh } = await import('../../src/coordination/peers.js');
      vi.mocked(uh).mockResolvedValue();
      const { peerAnnouncer } = await import('../../src/posttool/peer-announcer.js');

      await peerAnnouncer(makeWriteInput('/test/project/src/app.ts'));
      await peerAnnouncer(makeEditInput('/test/project/src/utils.ts'));

      expect(uh).toHaveBeenCalledTimes(2);
      expect(uh).toHaveBeenLastCalledWith('/test/project', {
        status: 'busy',
        files_editing: expect.arrayContaining([
          '/test/project/src/app.ts',
          '/test/project/src/utils.ts',
        ]),
      });
      // Ensure exactly 2 files
      const lastCall = vi.mocked(uh).mock.calls[1];
      expect(lastCall[1]?.files_editing).toHaveLength(2);
    });
  });

  describe('updateHeartbeat failure', () => {
    it('should still return silent success when updateHeartbeat throws', async () => {
      vi.resetModules();
      vi.mock('../../src/coordination/peers.js');
      const { updateHeartbeat: uh } = await import('../../src/coordination/peers.js');
      vi.mocked(uh).mockRejectedValue(new Error('lock contention'));
      const { peerAnnouncer } = await import('../../src/posttool/peer-announcer.js');

      const result = await peerAnnouncer(makeWriteInput('/test/project/src/app.ts'));

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('duplicate file edit', () => {
    it('should not duplicate files_editing when same file is edited twice', async () => {
      vi.resetModules();
      vi.mock('../../src/coordination/peers.js');
      const { updateHeartbeat: uh } = await import('../../src/coordination/peers.js');
      vi.mocked(uh).mockResolvedValue();
      const { peerAnnouncer } = await import('../../src/posttool/peer-announcer.js');

      await peerAnnouncer(makeWriteInput('/test/project/src/app.ts'));
      await peerAnnouncer(makeEditInput('/test/project/src/app.ts'));

      expect(uh).toHaveBeenCalledTimes(2);
      const lastCall = vi.mocked(uh).mock.calls[1];
      expect(lastCall[1]?.files_editing).toEqual(['/test/project/src/app.ts']);
    });
  });
});
