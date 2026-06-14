import { COLORS, type BlocksSpec, totalFrames } from "../blocks/catalog";

export { totalFrames };

// All-block explainer for ctk's delta-cache PreToolUse hook.
// 60s @ 30fps = 1800 frames.
// Analogy: librarian (full book on first read) vs. sticky note (just the diff on re-read).

export const deltaCacheBlocksSpec: BlocksSpec = {
  videoTitle: "ctk delta-cache",
  videoSubtitle: "Read once. Track changes. Save tokens.",
  durationSeconds: 60,
  fps: 30,
  footer: "claude-dev-kit • ctk",
  scenes: [
    {
      kind: "intro",
      id: "intro",
      durationFrames: 180,
      title: "ctk delta-cache",
      subtitle: "Don't re-read the file. Track what changed.",
      cards: [
        {
          label: "WITHOUT CACHE",
          role: "FULL FILE",
          icon: "📚",
          color: COLORS.muted,
        },
        {
          label: "WITH CACHE",
          role: "JUST THE DIFF",
          icon: "📌",
          color: COLORS.pre,
        },
      ],
      narration: "Stop re-reading the same file.",
    },
    {
      kind: "concrete-flow",
      id: "first-read",
      durationFrames: 210,
      title: "First read — full content",
      accent: COLORS.post,
      input: {
        label: "READ",
        value: "business-invariants.md",
        color: COLORS.neutral,
      },
      action: {
        title: "delta-cache",
        sub: "no snapshot yet",
        icon: "📚",
        color: COLORS.post,
      },
      output: {
        kind: "stamp",
        text: "FULL FILE",
        sub: "~3,000 tokens",
        color: COLORS.post,
        icon: "📖",
      },
      narration: "First time? You get the whole book.",
    },
    {
      kind: "flow-row",
      id: "first-flow",
      durationFrames: 240,
      title: "How a first read works",
      accent: COLORS.post,
      boxes: [
        {
          title: "Read",
          sub: "tool call",
          color: COLORS.warn,
        },
        {
          title: "Cache",
          sub: "MISS — first time",
          bullets: ["save snapshot", "remember path", "pass through"],
          color: COLORS.post,
        },
        {
          title: "Full content",
          sub: "delivered to Claude",
          color: COLORS.neutral,
        },
      ],
      narration: "Cache miss? Snapshot it. Pass through.",
    },
    {
      kind: "concrete-flow",
      id: "second-read",
      durationFrames: 240,
      title: "Read again — just the diff",
      accent: COLORS.pre,
      input: {
        label: "READ AGAIN",
        value: "business-invariants.md",
        color: COLORS.muted,
      },
      action: {
        title: "delta-cache",
        sub: "snapshot exists",
        icon: "📌",
        color: COLORS.pre,
      },
      output: {
        kind: "diff",
        label: "DIFF ONLY",
        lines: [
          { text: "@@ -3,1 +3,1 @@", kind: "context" },
          { text: "- Member email is the primary key.", kind: "removed" },
          { text: "+ Member id is the primary key.", kind: "added" },
        ],
      },
      narration: "Same file again? Send only what changed.",
    },
    {
      kind: "flow-row",
      id: "second-flow",
      durationFrames: 210,
      title: "How a redundant read works",
      accent: COLORS.pre,
      boxes: [
        {
          title: "Read",
          sub: "same file again",
          color: COLORS.warn,
        },
        {
          title: "Cache",
          sub: "HIT — got the snapshot",
          bullets: ["diff vs current", "return only delta"],
          color: COLORS.pre,
        },
        {
          title: "Diff only",
          sub: "delivered to Claude",
          color: COLORS.neutral,
        },
      ],
      narration: "Cache hit? Compute the diff. Return only that.",
    },
    {
      kind: "concrete-flow",
      id: "savings",
      durationFrames: 210,
      title: "Same fidelity. Less context.",
      accent: COLORS.warn,
      input: {
        label: "WITHOUT",
        value: "3,000 tokens",
        color: COLORS.danger,
      },
      action: {
        title: "delta-cache",
        sub: "diff replaces full",
        icon: "⚡",
        color: COLORS.warn,
      },
      output: {
        kind: "stamp",
        text: "50 TOKENS",
        sub: "98% smaller",
        color: COLORS.pre,
        icon: "📉",
      },
      narration: "Three thousand tokens... or fifty.",
    },
    {
      kind: "fan-out",
      id: "fanout",
      durationFrames: 240,
      title: "EVERY rereadable file",
      accent: COLORS.post,
      source: {
        title: "ctk PreToolUse hook",
        sub: "intercepts every Read",
        bullets: ["transparent to Claude", "session-wide", "all file types"],
      },
      targets: [
        { label: "CLAUDE.md", color: COLORS.warn },
        { label: "package.json", color: COLORS.post },
        { label: "tsconfig.json", color: COLORS.pre },
        { label: "*.spec.ts", color: COLORS.danger },
        { label: "README.md", color: COLORS.neutral },
        { label: "src/*", color: COLORS.warn },
        { label: "…", color: COLORS.muted },
      ],
      narration: "Works on every file Claude re-reads.",
    },
    {
      kind: "recap",
      id: "recap",
      durationFrames: 270,
      title: "The takeaway",
      cards: [
        {
          title: "How it works",
          color: COLORS.post,
          bullets: [
            "PreToolUse hook on every Read",
            "Cache MISS → store snapshot",
            "Cache HIT → return diff only",
          ],
        },
        {
          title: "What you get",
          color: COLORS.pre,
          bullets: [
            "Same fidelity for Claude",
            "Up to 98% fewer tokens",
            "Longer effective sessions",
          ],
        },
      ],
      footnote: "Read once. Track the rest.",
      narration: "Read the file once. Track changes after.",
    },
  ],
};
