// Embedded spec for the /etk:develop pipeline explainer.
// Applies ftk:explainer-video v1.1 patterns:
//   - exactly one hero phase (Phase 4 Build/TDD with stack-reveal cinematic template)
//   - visual_style alternation across phases (no consecutive duplicates)
//   - descriptions ≤15 words (longer detail belongs in narration, here on-screen as subtitle)
//   - distinct accent_color per phase
// Total: 300+330+300+330+480+450 = 2190 frames = 73s @ 30fps.

export type VisualStyle = "panel" | "code" | "terminal" | "diagram";

export type Phase = {
  id: string;
  name: string;
  description: string;
  durationFrames: number;
  visualStyle: VisualStyle;
  accentColor: string;
  hero?: boolean;
  payload?: PhasePayload;
};

export type PhasePayload =
  | { kind: "terminal"; lines: string[] }
  | { kind: "code"; lang: string; lines: string[] }
  | { kind: "diagram"; svg: "plan-fanout" }
  | { kind: "panel"; bullets: string[] }
  | {
      kind: "stack-reveal";
      cards: { label: string; subtitle: string; accent: string }[];
    };

export type FlowSpec = {
  title: string;
  subtitle: string;
  durationSeconds: number;
  fps: number;
  phases: Phase[];
};

export const developPipelineSpec: FlowSpec = {
  title: "/etk:develop — From Ticket to Verified Build",
  subtitle: "Six phases. Human approval gates. TDD discipline. Evidence-based done.",
  durationSeconds: 73,
  fps: 30,
  phases: [
    {
      id: "phase_0_gate",
      name: "Phase 0 — Gate",
      description: "Detect mode. Count critical unknowns. Block if too many.",
      durationFrames: 300,
      visualStyle: "terminal",
      accentColor: "#79c0ff",
      payload: {
        kind: "terminal",
        lines: [
          '$ /etk:develop "add login flow"',
          "",
          "+ mode: greenfield",
          "+ unknowns: 2 / 5",
          "+ complexity: 3",
          "",
          "→ gate: PASS",
          "→ proceed to Design",
        ],
      },
    },
    {
      id: "phase_1_design",
      name: "Phase 1 — Design",
      description: "Brainstorm tradeoffs. Pick approach. Human approves design.",
      durationFrames: 330,
      visualStyle: "panel",
      accentColor: "#a371f7",
      payload: {
        kind: "panel",
        bullets: [
          "Brainstorm 2-3 approaches",
          "Score on feasibility, complexity, fit",
          "Pick the winner with explicit tradeoffs",
          "Human checkpoint — approve or adjust",
        ],
      },
    },
    {
      id: "phase_2_hypothesize",
      name: "Phase 2 — Hypothesize",
      description: "State assumptions, risks, success criteria. Make beliefs explicit.",
      durationFrames: 300,
      visualStyle: "code",
      accentColor: "#d29922",
      payload: {
        kind: "code",
        lang: "md",
        lines: [
          "## Assumptions",
          "- API returns JSON",
          "- Cognito session valid for 1 hour",
          "",
          "## Risks",
          "- Token expires mid-flow → 401 retry",
          "- Mobile WebView blocks third-party cookies",
          "",
          "## Success Criteria",
          "- 200 OK on /me with valid session",
          "- Audit row written for every login",
        ],
      },
    },
    {
      id: "phase_3_plan",
      name: "Phase 3 — Plan",
      description: "Break into tasks. Quality gates. Test strategy per task.",
      durationFrames: 330,
      visualStyle: "diagram",
      accentColor: "#f0b049",
      payload: { kind: "diagram", svg: "plan-fanout" },
    },
    {
      id: "phase_4_build",
      name: "Phase 4 — Build (TDD)",
      description: "Red. Green. Refactor. The discipline that makes code trustworthy.",
      durationFrames: 480, // hero gets the breathing room
      visualStyle: "panel",
      accentColor: "#f85149",
      hero: true,
      payload: {
        kind: "stack-reveal",
        cards: [
          {
            label: "RED",
            subtitle: "Write the failing test first.",
            accent: "#f85149",
          },
          {
            label: "GREEN",
            subtitle: "Make it pass — minimum code, no more.",
            accent: "#3fb950",
          },
          {
            label: "REFACTOR",
            subtitle: "Clean up with the safety net of green tests.",
            accent: "#79c0ff",
          },
        ],
      },
    },
    {
      id: "phase_5_verify",
      name: "Phase 5 — Verify",
      description: "Run tests. Lint. Typecheck. Collect evidence. STATUS: DONE.",
      durationFrames: 450,
      visualStyle: "terminal",
      accentColor: "#3fb950",
      payload: {
        kind: "terminal",
        lines: [
          "$ /etk:verify",
          "",
          "+ tests: 142 passed ✓",
          "+ lint: 0 errors ✓",
          "+ typecheck: clean ✓",
          "+ coverage: 87% (+2%) ✓",
          "",
          "STATUS: DONE",
        ],
      },
    },
  ],
};

// Helpers — same shape as hooks-architecture spec for shared composition utilities
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
