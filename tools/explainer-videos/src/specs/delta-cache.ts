// Spec for the ctk delta-cache explainer (~45s short).
// Audience: engineers evaluating ctk's PreToolUse delta-cache hook.
//
// Applies ftk:explainer-video v1.2 patterns end-to-end:
//   - typewriter via string-slice (NOT per-char opacity) — scenes 1, 2
//   - per-word stagger — scene 4 headline
//   - keyword highlighting (animated background-position) — scene 2 "intercept"
//   - <TransitionSeries> between scenes with springTiming({ damping: 200 })
//   - explanation pacing: 2s+ hold after motion settles, dim-don't-cut, springTiming
//
// Plus v1.1 patterns:
//   - exactly one hero scene (scene 3 split-screen, GOLD accent)
//   - visual variety: terminal → code → split-screen → panel (no consecutive duplicates)
//   - description ≤ 15 words per scene
//   - distinct accent_color per scene
//
// Total: 1350 frames @ 30fps = 45s. Silent.

export type SceneKind = "terminal" | "code" | "split-screen" | "panel";

export type TerminalPayload = {
  kind: "terminal";
  // Lines that type out via string-slice typewriter
  lines: string[];
  // Token counter ticks up to this final value during scene
  finalTokens: number;
};

export type CodePayload = {
  kind: "code";
  lang: string;
  lines: string[];
  // Word inside the lines that gets the keyword-highlight background-pen
  highlightWord: string;
};

export type SplitScreenPayload = {
  kind: "split-screen";
  left: {
    label: string;
    sublabel: string;
    contentLines: string[]; // streams in like terminal
    tokenCount: number;
  };
  right: {
    label: string;
    sublabel: string;
    diffLines: string[]; // unified diff lines (prefixed +/-/@)
    tokenCount: number;
  };
};

export type PanelPayload = {
  kind: "panel";
  headline: string; // per-word stagger
  subline: string; // standard fade-in
};

export type ScenePayload =
  | TerminalPayload
  | CodePayload
  | SplitScreenPayload
  | PanelPayload;

export type Scene = {
  id: string;
  index: number; // 1-based
  name: string;
  description: string;
  durationFrames: number;
  visualStyle: SceneKind;
  accentColor: string;
  hero?: boolean;
  payload: ScenePayload;
};

export type DeltaCacheSpec = {
  title: string;
  subtitle: string;
  fps: number;
  scenes: Scene[];
};

const FPS = 30;

const SCENES: Scene[] = [
  {
    id: "scene_1_setup",
    index: 1,
    name: "Setup",
    description: "Claude reads a file. ~3000 tokens.",
    durationFrames: 300, // 10s
    visualStyle: "terminal",
    accentColor: "#79c0ff", // blue
    payload: {
      kind: "terminal",
      finalTokens: 3000,
      lines: [
        "$ Read business-invariants.md",
        "",
        "# Business Invariants",
        "",
        "1. Member email is the primary key.",
        "2. PHI never leaves the HIPAA boundary.",
        "3. Coach assignments are 1:N (one coach,",
        "   many members).",
        "4. Subscription state is event-sourced.",
        "",
      ],
    },
  },
  {
    id: "scene_2_intercept",
    index: 2,
    name: "The Intercept",
    description: "PreToolUse hook checks the cache.",
    durationFrames: 450, // 15s
    visualStyle: "code",
    accentColor: "#a371f7", // purple
    payload: {
      kind: "code",
      lang: "typescript",
      highlightWord: "intercept",
      lines: [
        "// PreToolUse hook — runs before every Read",
        "export async function preToolUse(input) {",
        "  if (input.tool !== 'Read') return allow();",
        "",
        "  const path = input.file_path;",
        "  const cached = await cache.get(path);",
        "",
        "  if (!cached) return allow();   // first read",
        "",
        "  // intercept the redundant Read — return diff",
        "  const diff = unifiedDiff(cached, current(path));",
        "  return deny({ replace_with: diff });",
        "}",
      ],
    },
  },
  {
    id: "scene_3_diff_vs_full",
    index: 3,
    name: "Diff vs Full",
    description: "Same fidelity. A fraction of the tokens.",
    durationFrames: 450, // 15s
    visualStyle: "split-screen",
    accentColor: "#f0b049", // GOLD — hero punchline
    hero: true,
    payload: {
      kind: "split-screen",
      left: {
        label: "WITHOUT delta-cache",
        sublabel: "full file content streamed",
        tokenCount: 3000,
        contentLines: [
          "# Business Invariants",
          "",
          "1. Member email is the primary key.",
          "2. PHI never leaves the HIPAA boundary.",
          "3. Coach assignments are 1:N (one coach,",
          "   many members).",
          "4. Subscription state is event-sourced.",
        ],
      },
      right: {
        label: "WITH delta-cache",
        sublabel: "unified diff — only what changed",
        tokenCount: 50,
        diffLines: [
          "@@ -3,1 +3,1 @@",
          "-1. Member email is the primary key.",
          "+1. Member id is the primary key.",
        ],
      },
    },
  },
  {
    id: "scene_4_impact",
    index: 4,
    name: "Impact",
    description: "95% less context per redundant Read.",
    durationFrames: 150, // 5s
    visualStyle: "panel",
    accentColor: "#3fb950", // green
    payload: {
      kind: "panel",
      headline: "Same fidelity. 95% less context.",
      subline: "On every redundant Read this session.",
    },
  },
];

export const deltaCacheSpec: DeltaCacheSpec = {
  title: "ctk delta-cache",
  subtitle: "How the PreToolUse hook trims redundant Reads",
  fps: FPS,
  scenes: SCENES,
};

// Helpers
export const cumulativeFrames = (scenes: Scene[]): number[] => {
  let acc = 0;
  return scenes.map((s) => {
    const start = acc;
    acc += s.durationFrames;
    return start;
  });
};

export const totalFrames = (scenes: Scene[]): number =>
  scenes.reduce((sum, s) => sum + s.durationFrames, 0);
