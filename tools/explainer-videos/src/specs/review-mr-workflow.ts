// Spec for the /etk:review-mr Workflow Explainer (~103s, v2).
// Audience: developers evaluating/onboarding to the plugin.
// Structure: Title → Overview Diagram → Step-by-Step Walkthrough → Recap → CTA.
//
// v2 (2026-05-07): added two beats between agents and synthesis to deepen
// the process explanation requested by users — "what does ONE finding
// look like" and "how does the evidence gate decide what to keep".
//
// The 7 steps now condense the 8-phase review-mr pipeline into the
// user-facing arc that matters on first watch:
//   1. Trigger          → Phase 0 + 1 (mode policy + MR/ticket fetch)
//   2. Quality Checks   → Phase 2 + 3 (auto-fix + lint/typecheck/tests/greps)
//   3. Parallel Agents  → Phase 4 + 5 (mode dispatch + 10-agent fan-out)
//   4. Finding Shape    → close-up of one agent's structured output  (NEW)
//   5. Evidence Gate    → confidence + anchored evidence filter       (NEW)
//   6. Synthesis        → Phase 6 (dedupe, severity, composite grade)
//   7. Artifact         → Phase 7 (write YAML+MD, hand off to /etk:post-mr-comments)

export type StepVisualKind =
  | "icon"
  | "code"
  | "agents"
  | "finding-card"
  | "evidence-gate";

export type FindingPayload = {
  kind: "finding-card";
  id: string;
  agent: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  file: string;
  line: number;
  evidence: string;
  suggestion: string;
  confidence: number; // 0..1
};

export type EvidenceGatePayload = {
  kind: "evidence-gate";
  findings: Array<{
    id: string;
    label: string;
    confidence: number; // 0..1
    hasEvidence: boolean;
    decision: "pass" | "drop";
    dropReason?: string;
  }>;
};

export type Step = {
  id: string;
  index: number; // 1-based for on-screen labels
  title: string;
  description: string; // one-line, fades in word-by-word
  visualKind: StepVisualKind;
  // Visual payload — interpreted by StepVisual based on visualKind
  payload:
    | { kind: "icon"; glyph: string; caption: string }
    | { kind: "code"; lang: string; lines: string[] }
    | {
        kind: "agents";
        agents: { id: string; label: string }[];
        highlightId: string; // the centerpiece (Agent #10)
      }
    | FindingPayload
    | EvidenceGatePayload;
  // Per-step duration in seconds — together they add up to Scene 3 length.
  durationSeconds: number;
};

export type ReviewMrSpec = {
  title: string;
  subtitle: string;
  fps: number;
  // Scene boundaries in seconds (0 → end)
  scenes: {
    title: { from: 0; durationSeconds: number };
    overview: { durationSeconds: number };
    walkthrough: { durationSeconds: number }; // = sum(steps.durationSeconds)
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
      "Run /etk:review-mr — the skill fetches the diff, CI status, and the linked ticket.",
    visualKind: "code",
    durationSeconds: 9,
    payload: {
      kind: "code",
      lang: "bash",
      lines: [
        "$ /etk:review-mr 132 --deep",
        "",
        "→ glab mr view 132        # diff + CI status",
        "→ glab mr ticket-link     # Jira PROJ-417",
        "→ mode: deep              # 10 agents, ~20 min",
      ],
    },
  },
  {
    id: "quality",
    index: 2,
    title: "Quality Gate",
    description:
      "Auto-fix formatting, then run lint, typecheck, tests, and security greps as a hard gate.",
    visualKind: "code",
    durationSeconds: 9,
    payload: {
      kind: "code",
      lang: "bash",
      lines: [
        "+ biome:    clean",
        "+ ruff:     clean",
        "+ tsc:      0 errors",
        "+ pytest:   217 passed",
        "+ secrets:  none found",
      ],
    },
  },
  {
    id: "agents",
    index: 3,
    title: "Parallel Agents",
    description:
      "Ten domain-specialist agents fan out in parallel — read-only, single dispatch.",
    visualKind: "agents",
    durationSeconds: 11,
    payload: {
      kind: "agents",
      agents: [
        { id: "a1", label: "Code Quality" },
        { id: "a2", label: "Type Safety" },
        { id: "a3", label: "Security" },
        { id: "a4", label: "Test Coverage" },
        { id: "a5", label: "Backend" },
        { id: "a6", label: "Frontend" },
        { id: "a7", label: "Sec Auditor" },
        { id: "a8", label: "Database" },
        { id: "a9", label: "Logic Validator" },
        { id: "a10", label: "★ Business Context" },
      ],
      highlightId: "a10",
    },
  },
  {
    id: "finding",
    index: 4,
    title: "Finding Shape",
    description:
      "Each agent emits structured findings — severity, file:line anchor, evidence quote, suggestion, confidence.",
    visualKind: "finding-card",
    durationSeconds: 12,
    payload: {
      kind: "finding-card",
      id: "F-073",
      agent: "security",
      severity: "HIGH",
      file: "app/auth/jwt.py",
      line: 42,
      evidence:
        "secret = os.environ.get('JWT_SECRET', 'dev-key')",
      suggestion:
        "Reject startup if JWT_SECRET is unset in production.",
      confidence: 0.91,
    },
  },
  {
    id: "evidence-gate",
    index: 5,
    title: "Evidence Gate",
    description:
      "Findings without anchored evidence — or below the confidence threshold — get dropped before synthesis.",
    visualKind: "evidence-gate",
    durationSeconds: 12,
    payload: {
      kind: "evidence-gate",
      findings: [
        {
          id: "F-073",
          label: "security · HIGH · jwt.py:42",
          confidence: 0.91,
          hasEvidence: true,
          decision: "pass",
        },
        {
          id: "F-094",
          label: "type-safety · MED · api.ts:118",
          confidence: 0.84,
          hasEvidence: true,
          decision: "pass",
        },
        {
          id: "F-101",
          label: "code-quality · LOW · utils.py:5",
          confidence: 0.42,
          hasEvidence: false,
          decision: "drop",
          dropReason: "asserts without evidence",
        },
      ],
    },
  },
  {
    id: "synthesis",
    index: 6,
    title: "Synthesis",
    description:
      "Surviving findings are deduped, severity-normalized, and rolled up into a composite grade.",
    visualKind: "code",
    durationSeconds: 9,
    payload: {
      kind: "code",
      lang: "yaml",
      lines: [
        "blocking:  3   # gate the merge",
        "issues:    7   # fix before approve",
        "nits:     12   # optional cleanups",
        "",
        "grade: B+   confidence: 0.84",
      ],
    },
  },
  {
    id: "artifact",
    index: 7,
    title: "Artifact + Post",
    description:
      "Writes YAML + Markdown to .claude/reviews/. You inspect, then post inline via /etk:post-mr-comments.",
    visualKind: "code",
    durationSeconds: 9,
    payload: {
      kind: "code",
      lang: "bash",
      lines: [
        "+ .claude/reviews/mr-132-findings.yaml",
        "+ .claude/reviews/mr-132-findings.md",
        "",
        "$ /etk:post-mr-comments 132 --dry-run",
        "$ /etk:post-mr-comments 132 --severity blocking",
      ],
    },
  },
];

const WALKTHROUGH_SECONDS = STEPS.reduce((s, x) => s + x.durationSeconds, 0);

export const reviewMrSpec: ReviewMrSpec = {
  title: "review-mr",
  subtitle: "How the review-mr workflow works",
  fps: FPS,
  scenes: {
    title: { from: 0, durationSeconds: 5 },
    overview: { durationSeconds: 15 },
    walkthrough: { durationSeconds: WALKTHROUGH_SECONDS }, // 47s
    recap: { durationSeconds: 7 },
    cta: { durationSeconds: 5 },
  },
  steps: STEPS,
};

// Scene start frames (cumulative)
export const sceneStartFrames = (spec: ReviewMrSpec) => {
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

// Cumulative step start frames within Scene 3
export const stepStartFramesInWalkthrough = (spec: ReviewMrSpec) => {
  let acc = 0;
  return spec.steps.map((step) => {
    const start = acc;
    acc += step.durationSeconds * spec.fps;
    return start;
  });
};

export const totalFrames = (spec: ReviewMrSpec) =>
  sceneStartFrames(spec).total;
