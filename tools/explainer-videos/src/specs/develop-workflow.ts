// Spec for the /etk:develop Workflow Explainer (~103s).
// Audience: developers evaluating/onboarding to the plugin.
// Structure: Title → Overview Diagram → Step-by-Step Walkthrough → Recap → CTA.
//
// Mirrors specs/review-mr-workflow.ts (post-v2 deepening). Same scene
// shape, same step-by-step renderer, same recap/CTA layout — only the
// content describes /etk:develop instead of /etk:review-mr.
//
// The 7 steps below condense the 6-phase /etk:develop pipeline into the
// user-facing arc that matters on first watch:
//   1. Trigger          → ticket fetch + mode detection
//   2. Quality Gate     → pre-checks block before any phase runs
//   3. Plan Fan-Out     → tasks fanned out from the plan
//   4. Task Shape       → close-up of one structured task          (mirror)
//   5. Approval Gate    → human checkpoint between phases          (mirror)
//   6. TDD Build        → red → green → refactor across tasks
//   7. Verify + Done    → run all gates, evidence-based STATUS

export type StepVisualKind =
  | "icon"
  | "code"
  | "agents"
  | "task-card"
  | "approval-checkpoint";

export type TaskCardPayload = {
  kind: "task-card";
  id: string;
  title: string;
  files: string[];
  gates: string[];
  testStrategy: string;
  blockedBy: string[];
  estimate: "S" | "M" | "L";
};

export type ApprovalCheckpointPayload = {
  kind: "approval-checkpoint";
  checks: Array<{
    id: string;
    label: string;
    type: "auto" | "human";
    decision: "pass" | "wait";
    waitPrompt?: string;
  }>;
};

export type Step = {
  id: string;
  index: number;
  title: string;
  description: string;
  visualKind: StepVisualKind;
  payload:
    | { kind: "icon"; glyph: string; caption: string }
    | { kind: "code"; lang: string; lines: string[] }
    | {
        kind: "agents";
        agents: { id: string; label: string }[];
        highlightId: string;
      }
    | TaskCardPayload
    | ApprovalCheckpointPayload;
  durationSeconds: number;
};

export type DevelopWorkflowSpec = {
  title: string;
  subtitle: string;
  fps: number;
  scenes: {
    title: { from: 0; durationSeconds: number };
    overview: { durationSeconds: number };
    walkthrough: { durationSeconds: number };
    recap: { durationSeconds: number };
    cta: { durationSeconds: number };
  };
  steps: Step[];
};

const FPS = 30;

const STEPS: Step[] = [
  {
    id: "trigger",
    index: 1,
    title: "Trigger",
    description:
      "Run /etk:develop — the agent fetches the ticket, detects mode, sizes the work.",
    visualKind: "code",
    durationSeconds: 9,
    payload: {
      kind: "code",
      lang: "bash",
      lines: [
        "$ /etk:develop PROJ-417",
        "",
        "→ glab issue view 417     # ticket + acceptance",
        "→ jira sprint context     # current focus",
        "→ mode: greenfield        # 6 phases, ~30 min",
      ],
    },
  },
  {
    id: "gate",
    index: 2,
    title: "Quality Gate",
    description:
      "Pre-checks block the pipeline before phase 0 runs — clean tree, lint, typecheck, tests.",
    visualKind: "code",
    durationSeconds: 9,
    payload: {
      kind: "code",
      lang: "bash",
      lines: [
        "+ git:        tree clean",
        "+ ruff:       clean",
        "+ tsc:        0 errors",
        "+ pytest:     217 passed",
        "+ unknowns:   2 / 5  (allowed)",
      ],
    },
  },
  {
    id: "tasks",
    index: 3,
    title: "Plan Fan-Out",
    description:
      "Phase 3 splits the work into atomic tasks — each with its own gates and tests.",
    visualKind: "agents",
    durationSeconds: 11,
    payload: {
      kind: "agents",
      agents: [
        { id: "t1", label: "T-001 · Schema" },
        { id: "t2", label: "T-002 · Auth Lib" },
        { id: "t3", label: "T-003 · /me Route" },
        { id: "t4", label: "T-004 · Audit" },
        { id: "t5", label: "T-005 · Cookie" },
        { id: "t6", label: "T-006 · Retry" },
        { id: "t7", label: "T-007 · WebView" },
        { id: "t8", label: "T-008 · Logout" },
        { id: "t9", label: "T-009 · Telemetry" },
        { id: "t10", label: "★ T-014 · JWT Refresh" },
      ],
      highlightId: "t10",
    },
  },
  {
    id: "task-shape",
    index: 4,
    title: "Task Shape",
    description:
      "Each task carries its own gates, test strategy, blockers, and estimate — structured, not free-text.",
    visualKind: "task-card",
    durationSeconds: 12,
    payload: {
      kind: "task-card",
      id: "T-014",
      title: "Add JWT refresh on 401",
      files: [
        "src/auth/client.ts",
        "src/auth/__tests__/client.test.ts",
      ],
      gates: ["lint", "typecheck", "unit", "integration"],
      testStrategy:
        "Mock Cognito refresh; assert silent retry + audit row written.",
      blockedBy: [],
      estimate: "M",
    },
  },
  {
    id: "approval",
    index: 5,
    title: "Approval Gate",
    description:
      "Each phase ends with a human checkpoint — the agent halts until you say go.",
    visualKind: "approval-checkpoint",
    durationSeconds: 12,
    payload: {
      kind: "approval-checkpoint",
      checks: [
        {
          id: "c1",
          label: "design captures the ticket",
          type: "auto",
          decision: "pass",
        },
        {
          id: "c2",
          label: "scope alignment",
          type: "auto",
          decision: "pass",
        },
        {
          id: "c3",
          label: "approve scope?",
          type: "human",
          decision: "wait",
          waitPrompt: "[Y/n]",
        },
      ],
    },
  },
  {
    id: "tdd",
    index: 6,
    title: "TDD Build",
    description:
      "Each task ships with a failing test first, then minimum code, then refactor under green.",
    visualKind: "code",
    durationSeconds: 9,
    payload: {
      kind: "code",
      lang: "bash",
      lines: [
        "+ red:       test_jwt_refresh_on_401  FAIL",
        "+ green:     test_jwt_refresh_on_401  PASS",
        "+ refactor:  extract retry helper      PASS",
        "",
        "tasks: 8/8 green",
      ],
    },
  },
  {
    id: "verify",
    index: 7,
    title: "Verify + Done",
    description:
      "Phase 5 runs every gate and collects evidence. Status: DONE on evidence, not vibes.",
    visualKind: "code",
    durationSeconds: 9,
    payload: {
      kind: "code",
      lang: "bash",
      lines: [
        "+ tests:      217 passed ✓",
        "+ lint:       0 errors ✓",
        "+ typecheck:  clean ✓",
        "+ coverage:   87% (+2%) ✓",
        "",
        "STATUS: DONE",
      ],
    },
  },
];

const WALKTHROUGH_SECONDS = STEPS.reduce((s, x) => s + x.durationSeconds, 0);

export const developWorkflowSpec: DevelopWorkflowSpec = {
  title: "develop",
  subtitle: "How the develop pipeline works",
  fps: FPS,
  scenes: {
    title: { from: 0, durationSeconds: 5 },
    overview: { durationSeconds: 15 },
    walkthrough: { durationSeconds: WALKTHROUGH_SECONDS }, // 71s
    recap: { durationSeconds: 7 },
    cta: { durationSeconds: 5 },
  },
  steps: STEPS,
};

export const sceneStartFrames = (spec: DevelopWorkflowSpec) => {
  const fps = spec.fps;
  const t = spec.scenes.title.durationSeconds * fps;
  const o = spec.scenes.overview.durationSeconds * fps;
  const w = spec.scenes.walkthrough.durationSeconds * fps;
  const r = spec.scenes.recap.durationSeconds * fps;
  return {
    title: 0,
    overview: t,
    walkthrough: t + o,
    recap: t + o + w,
    cta: t + o + w + r,
    total: t + o + w + r + spec.scenes.cta.durationSeconds * fps,
  };
};

export const stepStartFramesInWalkthrough = (spec: DevelopWorkflowSpec) => {
  let acc = 0;
  return spec.steps.map((step) => {
    const start = acc;
    acc += step.durationSeconds * spec.fps;
    return start;
  });
};

export const totalFrames = (spec: DevelopWorkflowSpec) =>
  sceneStartFrames(spec).total;
