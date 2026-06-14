// Block catalog — shared scene primitives for block-style explainer videos.
// Both `specs/hooks-blocks.ts` and `specs/delta-cache-blocks.ts` import from
// this file. New explainer videos add a new spec file that uses these types,
// then render through the generic `BlockExplainer.tsx` component.
//
// Seven scene kinds:
//   - intro      : title + N analogy cards (sliding in from sides)
//   - concrete-flow : input box → action box → output (4 output variants)
//   - flow-row   : N boxes in a horizontal row, arrows draw between them
//   - fan-out    : 1 source box → N target badges (arrows fan downward)
//   - recap      : 2 comparison cards + footnote callout
//   - title-card : two typewriter lines with hold-after-typing (announcement)
//   - video-clip : embedded mp4 from public/, hold-then-zoom framing
//
// Four output variants for `concrete-flow`:
//   - stamp : big rotated stamp (DENIED, ALLOWED, etc.)
//   - code  : monospace code box
//   - notes : vertical stack of icon+text cards
//   - diff  : red/green diff lines stagger in (git-style)

// Typography tokens used across atoms. Kept here so specs and atoms share one
// source of truth without a separate tokens.ts file.
export const MONO =
  '"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
export const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

// Canvas dimensions. Compositions are wired at 1920x1080 in Root.tsx.
export const W = 1920;
export const H = 1080;

export const COLORS = {
  pre: "#3fb950",
  post: "#79c0ff",
  danger: "#ff7b72",
  warn: "#f9e2af",
  neutral: "#c9d1d9",
  muted: "#6e7681",
  bgDeep: "#0a0e13",
  bgSurface: "#161b22",
  bgRaised: "#21262d",
  border: "#30363d",
} as const;

// =============================================================================
// Scene kinds
// =============================================================================

export type SceneIntro = {
  kind: "intro";
  id: string;
  durationFrames: number;
  title: string;
  subtitle: string;
  cards: Array<{ label: string; role: string; icon: string; color: string }>;
  narration: string;
};

export type SceneFlowRow = {
  kind: "flow-row";
  id: string;
  durationFrames: number;
  title: string;
  accent: string;
  boxes: Array<{
    title: string;
    sub?: string;
    bullets?: string[];
    color: string;
  }>;
  narration: string;
};

export type SceneFanOut = {
  kind: "fan-out";
  id: string;
  durationFrames: number;
  title: string;
  accent: string;
  source: { title: string; sub?: string; bullets?: string[] };
  targets: Array<{ label: string; color: string }>;
  narration: string;
};

export type SceneRecap = {
  kind: "recap";
  id: string;
  durationFrames: number;
  title: string;
  cards: Array<{ title: string; color: string; bullets: string[] }>;
  footnote: string;
  narration: string;
};

export type DiffLine = {
  text: string;
  kind: "added" | "removed" | "context";
};

export type ConcreteOutput =
  | { kind: "stamp"; text: string; sub?: string; color: string; icon: string }
  | { kind: "code"; value: string; label?: string; color: string }
  | {
      kind: "notes";
      notes: Array<{ icon: string; text: string; color: string }>;
    }
  | { kind: "diff"; label?: string; lines: DiffLine[] };

export type SceneConcreteFlow = {
  kind: "concrete-flow";
  id: string;
  durationFrames: number;
  title: string;
  accent: string;
  input: { label: string; value: string; color: string };
  action: { title: string; sub?: string; icon: string; color: string };
  output: ConcreteOutput;
  narration: string;
};

export type SceneTitleCard = {
  kind: "title-card";
  id: string;
  durationFrames: number;
  line1: string;
  line2: string;
  /** Defaults to 1 char/frame (~30 cps at 30fps). */
  charsPerFrame?: number;
  /** Frames between line1 finishing and line2 starting. Defaults to 12. */
  gapFrames?: number;
  /** Hold after both lines fully typed. Defaults to 90 (3s @ 30fps). */
  holdFrames?: number;
  /** Line1 color; defaults to neutral foreground. */
  line1Accent?: string;
  /** Line2 color; defaults to muted. */
  line2Accent?: string;
  narration?: string;
};

export type SceneVideoClip = {
  kind: "video-clip";
  id: string;
  durationFrames: number;
  /** Path inside `tools/explainer-videos/public/`, e.g. "review-mr-workflow.mp4". */
  src: string;
  /** Initial framing held for `holdAtStartFrames`. scale=1 fills canvas. */
  startFraming: { scale: number; focalX: number; focalY: number };
  /** Target framing reached at scene end via easeInOut cubic. */
  endFraming: { scale: number; focalX: number; focalY: number };
  /** Frames to hold at startFraming before zoom begins. Default 0. */
  holdAtStartFrames?: number;
  /** Seconds offset into the source video to start playing. Default 0. */
  startFromSeconds?: number;
  /** Play embedded audio. Default false (mute, narration takes priority). */
  audio?: boolean;
  /** objectFit on the underlying <Video>. Default "cover". */
  fit?: "cover" | "contain";
  /** objectPosition on the underlying <Video>. Default "top". */
  position?: string;
  narration?: string;
};

export type Scene =
  | SceneIntro
  | SceneFlowRow
  | SceneFanOut
  | SceneRecap
  | SceneConcreteFlow
  | SceneTitleCard
  | SceneVideoClip;

// =============================================================================
// Top-level spec shape
// =============================================================================

export type BlocksSpec = {
  videoTitle: string;
  videoSubtitle: string;
  durationSeconds: number;
  fps: number;
  scenes: Scene[];
  /** Footer text shown bottom-right. Defaults to "claude-dev-kit". */
  footer?: string;
  /** Background pattern variant. Defaults to "grid". */
  bgPattern?: "grid" | "dots" | "diagonal" | "none";
};

export const totalFrames = (spec: BlocksSpec): number =>
  spec.scenes.reduce((sum, s) => sum + s.durationFrames, 0);
