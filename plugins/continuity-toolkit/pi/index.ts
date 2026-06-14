/**
 * Continuity Toolkit — Pi Coding Agent adapter
 *
 * Bridges the Claude Code (CC) hook handlers in `../hooks/dist/bin/run-hook.js`
 * onto Pi's extension event system. Instead of re-implementing the handlers,
 * this adapter spawns the existing bundled CC runner as a subprocess per event,
 * translating:
 *
 *   Pi event  ──►  CC HookInput (stdin JSON)  ──►  run-hook.js <name>
 *   CC HookResult (stdout JSON)  ──►  Pi semantics (block / notify / transform)
 *
 * Why subprocess instead of importing the registry directly?
 *   - 100% handler reuse, zero duplication
 *   - Survives `npm run build` of the upstream plugin (no API coupling)
 *   - Inherits the plugin's process-level safe-fallback guarantees
 *
 * Coverage (see ../docs/plugin-hook-system.md for the CC event list):
 *   ✅ SessionStart      -> session_start
 *   ✅ PreCompact        -> session_before_compact
 *   ✅ SessionEnd        -> session_shutdown
 *   ✅ PreToolUse(block) -> tool_call            (+ updatedInput rewrite)
 *   ✅ PostToolUse       -> tool_result
 *   ✅ UserPromptSubmit  -> input               (additionalContext injection)
 *
 * Out of scope on Pi (no host event): PermissionRequest auto-approve protocol,
 * StatusLine context %, Worktree/Task/Teammate/Subagent coordination hooks,
 * MessageDisplay PHI redaction. See README for the gap matrix.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// Plugin root resolution
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, "..");
const RUN_HOOK = path.join(PLUGIN_ROOT, "hooks", "dist", "bin", "run-hook.js");

const HAVE_RUNNER = fs.existsSync(RUN_HOOK);

// ---------------------------------------------------------------------------
// CC <-> Pi protocol types (subset we use)
// ---------------------------------------------------------------------------

interface CCHookResult {
  continue: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  systemMessage?: string;
  hookSpecificOutput?: {
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
    additionalContext?: string;
    updatedInput?: Record<string, unknown>;
  };
}

const SAFE: CCHookResult = { continue: true, suppressOutput: true };

// ---------------------------------------------------------------------------
// Subprocess runner — feed CC HookInput on stdin, parse HookResult from stdout
// ---------------------------------------------------------------------------

function runHook(
  hookName: string,
  input: Record<string, unknown>,
  cwd: string,
  timeoutMs = 8000,
): Promise<CCHookResult> {
  if (!HAVE_RUNNER) return Promise.resolve(SAFE);

  return new Promise((resolve) => {
    let done = false;
    const finish = (r: CCHookResult) => {
      if (!done) {
        done = true;
        resolve(r);
      }
    };

    const child = spawn(process.execPath, [RUN_HOOK, hookName], {
      cwd,
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
        CLAUDE_PROJECT_DIR: cwd,
      },
      stdio: ["pipe", "pipe", "ignore"],
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(SAFE);
    }, timeoutMs);

    let out = "";
    child.stdout.on("data", (b) => {
      out += b.toString();
    });
    child.on("error", () => {
      clearTimeout(timer);
      finish(SAFE);
    });
    child.on("close", () => {
      clearTimeout(timer);
      // Wrapper contract: take the last line starting with '{'
      const line = out
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("{"))
        .pop();
      if (!line) return finish(SAFE);
      try {
        finish(JSON.parse(line) as CCHookResult);
      } catch {
        finish(SAFE);
      }
    });

    try {
      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    } catch {
      clearTimeout(timer);
      finish(SAFE);
    }
  });
}

// ---------------------------------------------------------------------------
// Tool name + input translation: Pi tool model -> CC tool model
// ---------------------------------------------------------------------------

const PI_TO_CC_TOOL: Record<string, string> = {
  bash: "Bash",
  read: "Read",
  write: "Write",
  edit: "Edit",
};

function piInputToCC(piTool: string, input: any): Record<string, unknown> {
  switch (piTool) {
    case "bash":
      return { command: input?.command, timeout: input?.timeout };
    case "read":
      return { file_path: input?.path };
    case "write":
      return { file_path: input?.path, content: input?.content };
    case "edit": {
      // Pi edit: { path, edits: [{ oldText, newText }] }
      const first = input?.edits?.[0] ?? {};
      return {
        file_path: input?.path,
        old_string: first.oldText,
        new_string: first.newText,
        edits: (input?.edits ?? []).map((e: any) => ({
          file_path: input?.path,
          old_string: e.oldText,
          new_string: e.newText,
        })),
      };
    }
    default:
      return { ...input };
  }
}

/** Apply CC `updatedInput` (CC field names) back onto a Pi tool input in place. */
function applyUpdatedInput(piTool: string, piInput: any, updated: Record<string, unknown>): void {
  if (!updated) return;
  switch (piTool) {
    case "bash":
      if (typeof updated.command === "string") piInput.command = updated.command;
      if (typeof updated.timeout === "number") piInput.timeout = updated.timeout;
      break;
    case "read":
      if (typeof updated.file_path === "string") piInput.path = updated.file_path;
      break;
    case "write":
      if (typeof updated.file_path === "string") piInput.path = updated.file_path;
      if (typeof updated.content === "string") piInput.content = updated.content;
      break;
    case "edit":
      if (typeof updated.file_path === "string") piInput.path = updated.file_path;
      if (typeof updated.old_string === "string" && piInput.edits?.[0])
        piInput.edits[0].oldText = updated.old_string;
      if (typeof updated.new_string === "string" && piInput.edits?.[0])
        piInput.edits[0].newText = updated.new_string;
      break;
  }
}

// Which CC pretool/posttool handlers to run per CC tool (mirrors hooks.json intent).
const PRETOOL_BY_CC: Record<string, string[]> = {
  Bash: ["pretool/bash-combined"],
  Write: ["pretool/write-combined"],
  Edit: ["pretool/write-combined"],
  Read: ["pretool/read-cache"],
};
const POSTTOOL_BY_CC: Record<string, string[]> = {
  Bash: ["posttool/secret-detector", "posttool/error-warner"],
  Write: ["posttool/dirty-state-tracker", "posttool/lint-checker"],
  Edit: ["posttool/dirty-state-tracker", "posttool/lint-checker"],
  Read: ["posttool/read-cache-writer"],
};

// ---------------------------------------------------------------------------
// Surfacing helpers
// ---------------------------------------------------------------------------

function surface(ctx: ExtensionContext, r: CCHookResult): void {
  if (r.systemMessage && ctx.hasUI) {
    ctx.ui.notify(r.systemMessage, "info");
  }
}

// ---------------------------------------------------------------------------
// Extension entry
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  if (!HAVE_RUNNER) {
    pi.on("session_start", (_e, ctx) => {
      if (ctx.hasUI)
        ctx.ui.notify(
          "continuity-toolkit: hooks bundle not built. Run `cd hooks && npm run build`.",
          "warning",
        );
    });
    return;
  }

  // --- SessionStart -> load continuity context -----------------------------
  pi.on("session_start", async (_event, ctx) => {
    const r = await runHook(
      "lifecycle/session-loader",
      { hook_event_name: "SessionStart", source: "startup", tool_input: {} },
      ctx.cwd,
    );
    surface(ctx, r);
  });

  // --- PreCompact -> save state before compaction --------------------------
  pi.on("session_before_compact", async (_event, ctx) => {
    await runHook(
      "lifecycle/pre-compact-saver",
      { hook_event_name: "PreCompact", tool_input: {} },
      ctx.cwd,
    );
  });

  // --- SessionEnd -> mark clean shutdown -----------------------------------
  pi.on("session_shutdown", async (_event, ctx) => {
    await runHook(
      "lifecycle/session-end",
      { hook_event_name: "SessionEnd", source: "exit", tool_input: {} },
      ctx.cwd,
    );
  });

  // --- PreToolUse -> block / rewrite ---------------------------------------
  pi.on("tool_call", async (event, ctx) => {
    const piTool = event.toolName;
    const ccTool = PI_TO_CC_TOOL[piTool];
    if (!ccTool) return; // unmapped tool: pass through

    const handlers = PRETOOL_BY_CC[ccTool] ?? [];
    const ccInput = piInputToCC(piTool, (event as any).input);

    for (const h of handlers) {
      const r = await runHook(
        h,
        { tool_name: ccTool, tool_input: ccInput },
        ctx.cwd,
      );

      // Rewrite tool args if requested
      const updated = r.hookSpecificOutput?.updatedInput;
      if (updated) applyUpdatedInput(piTool, (event as any).input, updated);

      const decision = r.hookSpecificOutput?.permissionDecision;
      if (r.continue === false || decision === "deny") {
        const reason =
          r.stopReason ||
          r.hookSpecificOutput?.permissionDecisionReason ||
          "Blocked by continuity-toolkit security policy";
        return { block: true, reason };
      }
      surface(ctx, r);
    }
    return;
  });

  // --- PostToolUse -> track / lint / warn ----------------------------------
  pi.on("tool_result", async (event, ctx) => {
    const piTool = event.toolName;
    const ccTool = PI_TO_CC_TOOL[piTool];
    if (!ccTool) return;

    const handlers = POSTTOOL_BY_CC[ccTool] ?? [];
    if (handlers.length === 0) return;

    const ccInput = piInputToCC(piTool, (event as any).input);
    // Flatten Pi result content to a string for CC handlers that scan output.
    const outputText = Array.isArray((event as any).content)
      ? (event as any).content
          .map((c: any) => (typeof c?.text === "string" ? c.text : ""))
          .join("\n")
      : "";

    for (const h of handlers) {
      const r = await runHook(
        h,
        {
          tool_name: ccTool,
          tool_input: ccInput,
          tool_response: { output: outputText, isError: (event as any).isError },
        },
        ctx.cwd,
      );
      surface(ctx, r);
    }
    return; // we don't rewrite the result body
  });

  // --- UserPromptSubmit -> context-window warnings -------------------------
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" as const };

    const r = await runHook(
      "prompt/context-monitor",
      {
        hook_event_name: "UserPromptSubmit",
        tool_input: {},
        prompt: event.text,
      },
      ctx.cwd,
    );

    const inject = r.hookSpecificOutput?.additionalContext;
    if (inject) {
      // Pi has no invisible-injection channel at input; append as a bracketed
      // system note so the model still receives the guidance.
      return {
        action: "transform" as const,
        text: `${event.text}\n\n[continuity] ${inject}`,
      };
    }
    surface(ctx, r);
    return { action: "continue" as const };
  });
}
