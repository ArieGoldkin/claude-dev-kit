// Embedded spec for the hooks-architecture-in-action explainer.
// Mirrors docs/specs/hooks-architecture-in-action.yaml in the monorepo root.
//
// Sum of duration_frames must equal duration_seconds * fps.
// 270 + 360 + 360 + 360 + 360 + 270 + 360 + 360 = 2700 = 90 * 30.

export type VisualStyle = "panel" | "code" | "terminal" | "diagram";

export type Phase = {
  id: string;
  name: string;
  description: string;
  durationFrames: number;
  visualStyle: VisualStyle;
  accentColor: string;
  // Pattern-specific payload rendered by the visual.
  payload?: PhasePayload;
};

export type PhasePayload =
  | { kind: "terminal"; lines: string[] }
  | { kind: "code"; lang: string; lines: string[] }
  | { kind: "diagram"; svg: "symlink-resolve" | "fallback-tree" }
  | { kind: "panel"; bullets: string[] };

export type FlowSpec = {
  title: string;
  subtitle: string;
  durationSeconds: number;
  fps: number;
  phases: Phase[];
};

export const hooksArchitectureSpec: FlowSpec = {
  title: "Claude Dev Kit Hooks Architecture",
  subtitle: "How a single PreToolUse hook fires across the symlinked monorepo",
  durationSeconds: 90,
  fps: 30,
  phases: [
    {
      id: "phase_0_event",
      name: "Phase 0 — Tool Call Event",
      description:
        "Claude wants to run a dangerous bash command. CC fires a PreToolUse event with the tool name and args as JSON on stdin.",
      durationFrames: 270,
      visualStyle: "terminal",
      accentColor: "#79c0ff",
      payload: {
        kind: "terminal",
        lines: [
          "# Claude requests:",
          "$ rm -rf node_modules",
          "",
          "# CC emits PreToolUse event:",
          '{"tool_name":"Bash",',
          ' "tool_input":{"command":"rm -rf node_modules"}}',
        ],
      },
    },
    {
      id: "phase_1_match",
      name: "Phase 1 — hooks.json Match",
      description:
        "CC scans every installed plugin's hooks.json. ctk's PreToolUse matcher=Bash with `if Bash(rm *)` matches. Wrapper resolves to pretool/bash-combined.",
      durationFrames: 360,
      visualStyle: "code",
      accentColor: "#d29922",
      payload: {
        kind: "code",
        lang: "json",
        lines: [
          '"PreToolUse": [{',
          '  "matcher": "Bash",',
          '  "if": "Bash(rm *) || Bash(sudo *) || Bash(dd *) || ...",',
          '  "hooks": [{',
          '    "type": "command",',
          '    "command": "sh ${CLAUDE_PLUGIN_ROOT}/hooks/bin/',
          '       run-hook-wrapper.sh pretool/bash-combined",',
          '    "timeout": 5',
          "  }]",
          "}]",
        ],
      },
    },
    {
      id: "phase_2_wrapper",
      name: "Phase 2 — Resilient Shell Wrapper",
      description:
        "run-hook-wrapper.sh runs first. POSIX. Resolves CLAUDE_PLUGIN_ROOT, exports CLAUDE_PLUGIN_NAME=continuity, probes node from PATH/nvm/fnm/volta/brew. Verifies dist/. Falls back to SAFE_JSON on any failure.",
      durationFrames: 360,
      visualStyle: "terminal",
      accentColor: "#a371f7",
      payload: {
        kind: "terminal",
        lines: [
          "$ sh run-hook-wrapper.sh pretool/bash-combined",
          "+ resolve CLAUDE_PLUGIN_ROOT",
          "+ export CLAUDE_PLUGIN_NAME=continuity",
          "+ probe node ... PATH ... nvm ... fnm ... volta",
          "  found: /Users/.../node",
          "+ check dist/bin/run-hook.js ... ok",
          "+ exec node run-hook.js bash-combined",
        ],
      },
    },
    {
      id: "phase_3_runner",
      name: "Phase 3 — Node Hook Runner",
      description:
        "run-hook.js takes over. Registers process-level uncaughtException + unhandledRejection handlers — these guarantee CC always gets valid JSON, even on catastrophic failures. Reads JSON from stdin.",
      durationFrames: 360,
      visualStyle: "code",
      accentColor: "#3fb950",
      payload: {
        kind: "code",
        lang: "ts",
        lines: [
          "process.on('uncaughtException', (err) => {",
          "  process.stdout.write(",
          '    \'{"continue":true,"suppressOutput":true}\\n\'',
          "  );",
          "  process.exit(0);",
          "});",
          "",
          "const input = await readHookInput();",
          "const hook = getHook('pretool/bash-combined');",
          "const result = await hook(input);",
          "console.log(JSON.stringify(result));",
        ],
      },
    },
    {
      id: "phase_4_symlink",
      name: "Phase 4 — Symlink Resolution",
      description:
        "The hook file in plugins/continuity-toolkit/.../security-blocker.ts is a SYMLINK. Four levels up to shared/hooks-infra/.../security-blocker.ts. preserveSymlinks: true is what makes the relative imports actually resolve.",
      durationFrames: 360,
      visualStyle: "diagram",
      accentColor: "#ff7b72",
      payload: { kind: "diagram", svg: "symlink-resolve" },
    },
    {
      id: "phase_5_decision",
      name: "Phase 5 — Pattern Match + Decision",
      description:
        "security-blocker imports lib/path-utils, lib/input, lib/output (all symlinks). Calls matchDangerousBash() with the command. Pattern matches. Returns outputDeny('refused: dangerous bash').",
      durationFrames: 270,
      visualStyle: "code",
      accentColor: "#f85149",
      payload: {
        kind: "code",
        lang: "ts",
        lines: [
          "// security-blocker.ts (a symlink)",
          "import { matchDangerousBash } from '../lib/dangerous-bash';",
          "import { outputDeny } from '../lib/output';",
          "",
          "const match = matchDangerousBash(command);",
          "if (match) {",
          "  return outputDeny(",
          "    `refused: ${match.reason}`",
          "  );",
          "}",
        ],
      },
    },
    {
      id: "phase_6_validate",
      name: "Phase 6 — JSON Validation",
      description:
        "Hook writes JSON to stdout. Wrapper verifies first line starts with `{`. If valid, that's the response. If empty / malformed / hook errored — wrapper substitutes SAFE_JSON. CC never sees a broken hook.",
      durationFrames: 360,
      visualStyle: "terminal",
      accentColor: "#a371f7",
      payload: {
        kind: "terminal",
        lines: [
          "OUTPUT=$(... node run-hook.js ...)",
          "",
          "# Validate first line is JSON",
          "if printf '%s' \"$OUTPUT\" | head -1 | grep -q '^{'; then",
          "  printf '%s' \"$OUTPUT\" | grep '^{' | tail -1",
          "else",
          '  echo \'{"continue":true,"suppressOutput":true}\'  # SAFE_JSON',
          "fi",
        ],
      },
    },
    {
      id: "phase_7_apply",
      name: "Phase 7 — Decision Applied",
      description:
        "CC reads the JSON, sees decision=deny, blocks the tool call, surfaces the reason to Claude. The dangerous rm -rf never ran. Total round-trip: low double-digit milliseconds.",
      durationFrames: 360,
      visualStyle: "panel",
      accentColor: "#3fb950",
      payload: {
        kind: "panel",
        bullets: [
          "Tool call blocked before execution",
          "Reason surfaced to Claude in next turn",
          "All 6 toolkit plugins use the same shared lib",
          "ctk owns shared hooks; others symlink",
          "preserveSymlinks: true is load-bearing",
          "Wrapper guarantees valid JSON, always",
        ],
      },
    },
  ],
};

// Helpers

export const cumulativeFrames = (phases: Phase[]): number[] => {
  let acc = 0;
  return phases.map((p) => {
    const start = acc;
    acc += p.durationFrames;
    return start;
  });
};

export const totalFrames = (phases: Phase[]): number =>
  phases.reduce((sum, p) => sum + p.durationFrames, 0);
