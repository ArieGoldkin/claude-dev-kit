import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
  useVideoConfig,
} from "remotion";
import {
  developWorkflowSpec,
  sceneStartFrames,
  stepStartFramesInWalkthrough,
  type ApprovalCheckpointPayload,
  type Step,
  type TaskCardPayload,
} from "./specs/develop-workflow";

// =============================================================================
// Design tokens — locked to the prompt's IDE-aesthetic palette
// =============================================================================

const COLORS = {
  bg: "#0F1419",
  text: "#F8FAFC",
  textDim: "#94A3B8",
  textMuted: "#64748B",
  active: "#3B82F6",
  inactive: "#475569",
  inactiveBg: "#1E293B",
  past: "#334155",
  arrow: "#475569",
  arrowActive: "#3B82F6",
  card: "#111827",
  border: "#1F2937",
} as const;

const FONT =
  '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif';
const MONO = '"SF Mono", Menlo, Consolas, "Roboto Mono", monospace';

// Shared easing for color/position transitions per the prompt
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

// =============================================================================
// Top-level composition
// =============================================================================

export const DevelopWorkflow: React.FC = () => {
  const spec = developWorkflowSpec;
  const { fps } = useVideoConfig();
  const starts = sceneStartFrames(spec);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        color: COLORS.text,
        fontFamily: FONT,
      }}
    >
      <Sequence
        from={starts.title}
        durationInFrames={spec.scenes.title.durationSeconds * fps}
      >
        <SceneTitle />
      </Sequence>

      <Sequence
        from={starts.overview}
        durationInFrames={spec.scenes.overview.durationSeconds * fps}
      >
        <SceneOverview />
      </Sequence>

      <Sequence
        from={starts.walkthrough}
        durationInFrames={spec.scenes.walkthrough.durationSeconds * fps}
      >
        <SceneWalkthrough />
      </Sequence>

      <Sequence
        from={starts.recap}
        durationInFrames={spec.scenes.recap.durationSeconds * fps}
      >
        <SceneRecap />
      </Sequence>

      <Sequence
        from={starts.cta}
        durationInFrames={spec.scenes.cta.durationSeconds * fps}
      >
        <SceneCTA />
      </Sequence>
    </AbsoluteFill>
  );
};

// =============================================================================
// Scene 1 — Title (0:00 – 0:05)
// =============================================================================

const SceneTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Plugin name spring-fades in
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 110 },
    from: 0,
    to: 1,
  });
  const titleY = interpolate(titleSpring, [0, 1], [12, 0]);

  // Subtitle slightly delayed
  const subOpacity = interpolate(frame, [18, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subY = interpolate(frame, [18, 36], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  // Both fade out at end of scene
  const exit = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity: titleSpring * exit,
          transform: `translateY(${titleY}px)`,
          fontSize: 128,
          fontWeight: 800,
          letterSpacing: -3,
          color: COLORS.text,
          fontFamily: MONO,
        }}
      >
        develop
      </div>
      <div
        style={{
          opacity: subOpacity * exit,
          transform: `translateY(${subY}px)`,
          marginTop: 24,
          fontSize: 32,
          fontWeight: 400,
          color: COLORS.textDim,
          letterSpacing: -0.3,
        }}
      >
        How the develop pipeline works
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// Scene 2 — Overview Diagram (0:05 – 0:20)
// =============================================================================

const SceneOverview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Diagram nodes appear left-to-right with stagger; activeStepIndex = -1
  // (no highlight in this scene). Once all nodes are in (~3s), gentle pulse.

  const allInFrame = 4 + (developWorkflowSpec.steps.length - 1) * 5 + 30; // ~3s
  const pulseStart = allInFrame + 12;
  const pulse = spring({
    frame: Math.max(0, frame - pulseStart),
    fps,
    config: { damping: 18, stiffness: 60, mass: 1.2 },
    from: 1,
    to: 1.025,
  });
  const pulseDecay = spring({
    frame: Math.max(0, frame - pulseStart - 24),
    fps,
    config: { damping: 18, stiffness: 60, mass: 1.2 },
    from: 1,
    to: 1 / 1.025,
  });
  const diagramScale = pulse * pulseDecay;

  // Soft scene-wide fade in/out
  const sceneOpacity = interpolate(
    frame,
    [0, 18, 15 * 30 - 24, 15 * 30],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: sceneOpacity,
        gap: 36,
      }}
    >
      <div
        style={{
          fontSize: 22,
          color: COLORS.textDim,
          letterSpacing: 4,
          textTransform: "uppercase",
          fontFamily: MONO,
          opacity: interpolate(frame, [0, 24], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        the workflow
      </div>
      <div
        style={{
          transform: `scale(${diagramScale})`,
          transformOrigin: "center",
        }}
      >
        <WorkflowDiagram
          activeStepIndex={-1}
          // nodes appear staggered in this scene
          revealFromFrame={4}
          revealStaggerFrames={5}
          size="large"
        />
      </div>
      <div
        style={{
          fontSize: 22,
          color: COLORS.textMuted,
          opacity: interpolate(frame, [allInFrame, allInFrame + 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {developWorkflowSpec.steps.length} steps. One command.
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// Scene 3 — Step-by-Step Walkthrough (0:20 – 1:07)
// =============================================================================

const SceneWalkthrough: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stepStarts = stepStartFramesInWalkthrough(developWorkflowSpec);

  // Determine active step index based on frame within Scene 3
  const activeIdx = (() => {
    for (let i = developWorkflowSpec.steps.length - 1; i >= 0; i--) {
      if (frame >= stepStarts[i]) return i;
    }
    return 0;
  })();

  // Diagram pinned to top, smaller. activeStepIndex updates as steps advance.
  return (
    <AbsoluteFill>
      {/* Top: pinned diagram */}
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <WorkflowDiagram
          activeStepIndex={activeIdx}
          revealFromFrame={-1} // already revealed
          revealStaggerFrames={0}
          size="small"
        />
      </div>

      {/* Bottom: per-step content */}
      {developWorkflowSpec.steps.map((step, i) => (
        <Sequence
          key={step.id}
          from={stepStarts[i]}
          durationInFrames={step.durationSeconds * fps}
        >
          <StepBody step={step} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// =============================================================================
// Scene 4 — Recap (1:07 – 1:14)
// =============================================================================

const SceneRecap: React.FC = () => {
  const frame = useCurrentFrame();

  // Diagram returns to center, full size. Light up nodes in fast sequence.
  const flashEvery = 8; // frames between successive node lights
  const flashStart = 24;
  const cyclingActive = (() => {
    if (frame < flashStart) return -1;
    const idx = Math.floor((frame - flashStart) / flashEvery);
    if (idx >= developWorkflowSpec.steps.length) return -1; // all on then dim back
    return idx;
  })();

  // After the cycle, all light blue together (held to "all done")
  const allLitStart = flashStart + developWorkflowSpec.steps.length * flashEvery + 6;
  const allLit = frame >= allLitStart && frame < allLitStart + 60;

  const taglineOpacity = interpolate(
    frame,
    [allLitStart - 6, allLitStart + 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const taglineY = interpolate(
    frame,
    [allLitStart - 6, allLitStart + 18],
    [10, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE },
  );

  // Scene-wide soft fade
  const sceneOpacity = interpolate(
    frame,
    [0, 12, 7 * 30 - 18, 7 * 30],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 56,
        opacity: sceneOpacity,
      }}
    >
      <WorkflowDiagram
        activeStepIndex={allLit ? "all" : cyclingActive}
        revealFromFrame={-1}
        revealStaggerFrames={0}
        size="large"
      />
      <div
        style={{
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          fontSize: 44,
          fontWeight: 700,
          letterSpacing: -0.5,
          color: COLORS.text,
        }}
      >
        From ticket to verified build.
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// Scene 5 — CTA (1:14 – 1:19)
// =============================================================================

const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 110 },
    from: 0,
    to: 1,
  });
  const headlineY = interpolate(headlineSpring, [0, 1], [12, 0]);

  const cmdOpacity = interpolate(frame, [18, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exit = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      <div
        style={{
          opacity: headlineSpring * exit,
          transform: `translateY(${headlineY}px)`,
          fontSize: 68,
          fontWeight: 800,
          letterSpacing: -1.5,
          color: COLORS.text,
        }}
      >
        Try it in your repo today
      </div>
      <div
        style={{
          opacity: cmdOpacity * exit,
          padding: "20px 32px",
          backgroundColor: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          boxShadow: `0 0 0 1px ${COLORS.active}33, 0 12px 32px rgba(0,0,0,0.5)`,
          fontFamily: MONO,
          fontSize: 28,
          color: COLORS.text,
          letterSpacing: -0.3,
        }}
      >
        <span style={{ color: COLORS.textMuted }}>$</span>{" "}
        <span style={{ color: COLORS.active }}>/etk:develop</span>{" "}
        <span style={{ color: COLORS.text }}>{"<TICKET>"}</span>
      </div>
      <div
        style={{
          opacity: cmdOpacity * exit,
          fontSize: 18,
          color: COLORS.textMuted,
          fontFamily: MONO,
          letterSpacing: 0.5,
        }}
      >
        github.com/acme/claude-dev-kit
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// WorkflowDiagram — shared across Scenes 2, 3, 4
// =============================================================================
//
// activeStepIndex semantics:
//   -1     → no highlight (all inactive gray)
//   0..N-1 → that single node is active
//   "all"  → every node lit in the active accent (recap finale)
//
// revealFromFrame / revealStaggerFrames let Scene 2 stagger nodes left-to-right
// while Scenes 3/4 render them already-revealed.

type DiagramProps = {
  activeStepIndex: number | "all";
  revealFromFrame: number; // -1 disables reveal animation (treated as already-in)
  revealStaggerFrames: number;
  size: "large" | "small";
};

const NODE_W_LARGE = 200;
const NODE_H_LARGE = 88;
const GAP_LARGE = 56;

const NODE_W_SMALL = 132;
const NODE_H_SMALL = 56;
const GAP_SMALL = 32;

const WorkflowDiagram: React.FC<DiagramProps> = ({
  activeStepIndex,
  revealFromFrame,
  revealStaggerFrames,
  size,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const steps = developWorkflowSpec.steps;

  const NW = size === "large" ? NODE_W_LARGE : NODE_W_SMALL;
  const NH = size === "large" ? NODE_H_LARGE : NODE_H_SMALL;
  const GAP = size === "large" ? GAP_LARGE : GAP_SMALL;
  const totalW = steps.length * NW + (steps.length - 1) * GAP;

  return (
    <div
      style={{
        position: "relative",
        width: totalW,
        height: NH + 16, // +16 leaves room for shadow
      }}
    >
      {/* Connecting arrows: render BEFORE nodes so nodes paint on top */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: totalW,
          height: NH + 16,
          pointerEvents: "none",
        }}
      >
        {steps.slice(0, -1).map((step, i) => {
          // Arrow connects right-edge of node i to left-edge of node i+1
          const x1 = (i + 1) * NW + i * GAP;
          const x2 = (i + 1) * NW + (i + 1) * GAP;
          const y = NH / 2;

          // Reveal arrow only after both endpoints have appeared
          let revealOpacity = 1;
          if (revealFromFrame >= 0) {
            const arrowReveal =
              revealFromFrame + (i + 1) * revealStaggerFrames + 4;
            revealOpacity = interpolate(
              frame,
              [arrowReveal, arrowReveal + 8],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
          }

          // Active arrows (between past/active or active/future) get accent tint
          const isActiveLink =
            typeof activeStepIndex === "number" &&
            (activeStepIndex === i || activeStepIndex - 1 === i);
          const stroke =
            activeStepIndex === "all" || isActiveLink
              ? COLORS.arrowActive
              : COLORS.arrow;

          return (
            <g key={`arrow-${i}`} opacity={revealOpacity}>
              <line
                x1={x1}
                y1={y}
                x2={x2 - 10}
                y2={y}
                stroke={stroke}
                strokeWidth={size === "large" ? 2.5 : 1.8}
              />
              <polygon
                points={`${x2},${y} ${x2 - 10},${y - 5} ${x2 - 10},${y + 5}`}
                fill={stroke}
              />
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      {steps.map((step, i) => {
        const x = i * (NW + GAP);
        const isActive =
          activeStepIndex === "all" ||
          (typeof activeStepIndex === "number" && activeStepIndex === i);
        const isPast =
          typeof activeStepIndex === "number" &&
          activeStepIndex >= 0 &&
          i < activeStepIndex;

        // Reveal animation (Scene 2 only)
        let revealOpacity = 1;
        let revealScale = 1;
        if (revealFromFrame >= 0) {
          const nodeReveal = revealFromFrame + i * revealStaggerFrames;
          revealOpacity = interpolate(
            frame,
            [nodeReveal, nodeReveal + 12],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          revealScale = spring({
            frame: Math.max(0, frame - nodeReveal),
            fps,
            // damping ~12 per the prompt
            config: { damping: 12, stiffness: 100 },
            from: 0.85,
            to: 1,
          });
        }

        // Active scale 1.05; otherwise 1
        const activeScale = isActive ? 1.05 : 1;
        const scale = revealScale * activeScale;

        // Active glow via boxShadow; only one active at a time per the prompt
        // (recap "all" mode lights every node — that's the explicit exception).
        const bg = isActive ? COLORS.active : COLORS.inactiveBg;
        const fg = isActive ? COLORS.text : isPast ? COLORS.textDim : COLORS.textMuted;
        const border = isActive ? COLORS.active : COLORS.inactive;
        // isPast already implies activeStepIndex is a number (not "all")
        const opacity = isPast ? 0.55 : 1;

        return (
          <StepNode
            key={step.id}
            step={step}
            x={x}
            width={NW}
            height={NH}
            scale={scale}
            opacity={revealOpacity * opacity}
            bg={bg}
            fg={fg}
            border={border}
            isActive={isActive}
            size={size}
          />
        );
      })}
    </div>
  );
};

const StepNode: React.FC<{
  step: Step;
  x: number;
  width: number;
  height: number;
  scale: number;
  opacity: number;
  bg: string;
  fg: string;
  border: string;
  isActive: boolean;
  size: "large" | "small";
}> = ({ step, x, width, height, scale, opacity, bg, fg, border, isActive, size }) => {
  const titleSize = size === "large" ? 18 : 13;
  const indexSize = size === "large" ? 11 : 9;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: x,
        width,
        height,
        backgroundColor: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 12,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "8px 12px",
        boxSizing: "border-box",
        boxShadow: isActive
          ? `0 0 0 1px ${COLORS.active}66, 0 0 24px ${COLORS.active}55, 0 8px 20px rgba(0,0,0,0.5)`
          : "none",
      }}
    >
      <div
        style={{
          fontSize: indexSize,
          fontFamily: MONO,
          color: isActive ? COLORS.text : COLORS.textMuted,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          opacity: isActive ? 0.9 : 0.7,
        }}
      >
        Step {step.index}
      </div>
      <div
        style={{
          fontSize: titleSize,
          fontWeight: 700,
          color: fg,
          letterSpacing: -0.2,
          textAlign: "center",
        }}
      >
        {step.title}
      </div>
    </div>
  );
};

// =============================================================================
// StepBody — the bottom-half content rendered for each step in Scene 3
// =============================================================================

const StepBody: React.FC<{ step: Step }> = ({ step }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slide-in + fade entrance (after diagram highlight slides on top)
  const enter = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 100 },
    from: 0,
    to: 1,
  });
  const slideY = interpolate(enter, [0, 1], [24, 0]);
  const opacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Exit fade in last 12 frames of the step
  const stepFrames = step.durationSeconds * fps;
  const exit = interpolate(
    frame,
    [stepFrames - 14, stepFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 280,
        left: 0,
        right: 0,
        bottom: 80,
        opacity: opacity * exit,
        transform: `translateY(${slideY}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
        padding: "0 96px",
      }}
    >
      <div
        style={{
          fontSize: 64,
          fontWeight: 800,
          color: COLORS.text,
          letterSpacing: -1.5,
          textAlign: "center",
        }}
      >
        {step.title}
      </div>
      <DescriptionWordByWord text={step.description} />
      <StepVisual step={step} />
    </div>
  );
};

const DescriptionWordByWord: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const words = text.split(/(\s+)/);
  const startFrame = 18;
  const perWord = 3;

  return (
    <div
      style={{
        fontSize: 32,
        fontWeight: 400,
        color: COLORS.textDim,
        textAlign: "center",
        maxWidth: 1400,
        lineHeight: 1.45,
      }}
    >
      {words.map((w, i) => {
        if (/^\s+$/.test(w)) return <span key={i}>{w}</span>;
        const wordIdx = words.slice(0, i).filter((x) => !/^\s+$/.test(x)).length;
        const at = startFrame + wordIdx * perWord;
        const op = interpolate(frame, [at, at + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <span key={i} style={{ opacity: op }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

// =============================================================================
// StepVisual — switches on visualKind
// =============================================================================

const StepVisual: React.FC<{ step: Step }> = ({ step }) => {
  if (step.payload.kind === "code") {
    return (
      <CodeBlock
        lang={step.payload.lang}
        lines={step.payload.lines}
      />
    );
  }
  if (step.payload.kind === "agents") {
    return (
      <AgentGrid
        agents={step.payload.agents}
        highlightId={step.payload.highlightId}
      />
    );
  }
  if (step.payload.kind === "task-card") {
    return <TaskCard payload={step.payload} />;
  }
  if (step.payload.kind === "approval-checkpoint") {
    return <ApprovalGate payload={step.payload} />;
  }
  return null;
};

// ---- CodeBlock --------------------------------------------------------------

const CodeBlock: React.FC<{ lang: string; lines: string[] }> = ({ lang, lines }) => {
  const frame = useCurrentFrame();
  const startFrame = 24;
  const perLine = 6;

  return (
    <div
      style={{
        backgroundColor: "#020617",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 0,
        boxShadow: `0 0 0 1px ${COLORS.active}22, 0 16px 40px rgba(0,0,0,0.6)`,
        overflow: "hidden",
        minWidth: 720,
        maxWidth: 1100,
      }}
    >
      <div
        style={{
          padding: "10px 18px",
          backgroundColor: COLORS.card,
          borderBottom: `1px solid ${COLORS.border}`,
          fontFamily: MONO,
          fontSize: 13,
          color: COLORS.textMuted,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <Dot color="#ff5f56" />
        <Dot color="#ffbd2e" />
        <Dot color="#27c93f" />
        <span style={{ marginLeft: 12 }}>{lang}</span>
      </div>
      <div
        style={{
          padding: "20px 24px",
          fontFamily: MONO,
          fontSize: 22,
          lineHeight: 1.55,
        }}
      >
        {lines.map((line, i) => {
          const at = startFrame + i * perLine;
          const op = interpolate(frame, [at, at + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const isComment = line.startsWith("#");
          const isCmd = line.startsWith("$");
          const isAdd = line.startsWith("+");
          const isArrow = line.startsWith("→");
          const color = isCmd
            ? "#a5d6ff"
            : isAdd
              ? "#7ee787"
              : isArrow
                ? COLORS.active
                : isComment
                  ? COLORS.textMuted
                  : COLORS.text;
          return (
            <div
              key={i}
              style={{
                opacity: op,
                color,
                whiteSpace: "pre",
                minHeight: 32,
              }}
            >
              {line || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: color,
    }}
  />
);

// ---- AgentGrid -------------------------------------------------------------

const AgentGrid: React.FC<{
  agents: { id: string; label: string }[];
  highlightId: string;
}> = ({ agents, highlightId }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 5 columns × 2 rows
  const cols = 5;
  const cardW = 200;
  const cardH = 64;
  const gap = 18;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${cardW}px)`,
        gap,
        padding: 28,
        backgroundColor: "#020617",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        boxShadow: `0 0 0 1px ${COLORS.active}22, 0 16px 40px rgba(0,0,0,0.6)`,
      }}
    >
      {agents.map((agent, i) => {
        // Stagger fan-out: all agents enter together fast (single dispatch),
        // but stagger micro-delay for visual rhythm
        const at = 24 + i * 2;
        const op = interpolate(frame, [at, at + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const enter = spring({
          frame: Math.max(0, frame - at),
          fps,
          config: { damping: 14, stiffness: 120 },
          from: 0.92,
          to: 1,
        });
        const isHighlight = agent.id === highlightId;

        // Highlight pulse for Agent #10 — kicks in after all are placed
        const pulseStart = 24 + agents.length * 2 + 18;
        const pulse = isHighlight
          ? 1 +
            0.03 *
              Math.sin(
                ((frame - pulseStart) / fps) * Math.PI * 1.2,
              )
          : 1;
        const scale = enter * (isHighlight ? pulse : 1);

        return (
          <div
            key={agent.id}
            style={{
              width: cardW,
              height: cardH,
              opacity: op,
              transform: `scale(${scale})`,
              transformOrigin: "center",
              backgroundColor: isHighlight ? COLORS.active : COLORS.card,
              color: isHighlight ? COLORS.text : COLORS.textDim,
              border: `1.5px solid ${isHighlight ? COLORS.active : COLORS.inactive}`,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: isHighlight ? 700 : 500,
              fontSize: 17,
              fontFamily: FONT,
              letterSpacing: -0.2,
              boxShadow: isHighlight
                ? `0 0 0 1px ${COLORS.active}66, 0 0 28px ${COLORS.active}55`
                : "none",
            }}
          >
            {agent.label}
          </div>
        );
      })}
    </div>
  );
};

// ---- TaskCard ---------------------------------------------------------------
// Close-up of one structured task emitted by /etk:develop's plan phase.
// Renders as a YAML panel, fields stagger in line-by-line. Estimate gets
// a colored chip; gates render as accent-colored inline badges. Used by
// step 4 (Task Shape).

const ESTIMATE_COLORS: Record<TaskCardPayload["estimate"], string> = {
  S: "#7ee787",
  M: "#f0b049",
  L: "#f85149",
};

const TaskCard: React.FC<{ payload: TaskCardPayload }> = ({ payload }) => {
  const frame = useCurrentFrame();
  const startFrame = 18;
  const stagger = 8;
  const accent = "#a371f7";

  type Row =
    | { key: string; value: string; valueColor?: string }
    | { key: string; block: string }
    | { key: string; renderInline: () => React.ReactNode };

  const rows: Row[] = [
    { key: "id", value: payload.id, valueColor: COLORS.text },
    { key: "title", value: payload.title, valueColor: "#a5d6ff" },
    {
      key: "files",
      renderInline: () => (
        <div style={{ paddingLeft: 24 }}>
          {payload.files.map((f) => (
            <div key={f} style={{ color: "#7ee787" }}>- {f}</div>
          ))}
        </div>
      ),
    },
    {
      key: "gates",
      renderInline: () => (
        <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
          {payload.gates.map((g) => (
            <span
              key={g}
              style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: 6,
                backgroundColor: `${accent}22`,
                color: accent,
                border: `1px solid ${accent}66`,
                fontWeight: 600,
                fontSize: 17,
                letterSpacing: 0.3,
              }}
            >
              {g}
            </span>
          ))}
        </span>
      ),
    },
    { key: "test_strategy", block: payload.testStrategy },
    {
      key: "blocked_by",
      value:
        payload.blockedBy.length === 0
          ? "[]"
          : `[${payload.blockedBy.join(", ")}]`,
      valueColor: COLORS.textMuted,
    },
    {
      key: "estimate",
      renderInline: () => {
        const c = ESTIMATE_COLORS[payload.estimate];
        return (
          <span
            style={{
              display: "inline-block",
              padding: "2px 14px",
              borderRadius: 6,
              backgroundColor: `${c}22`,
              color: c,
              border: `1px solid ${c}66`,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: 0.4,
            }}
          >
            {payload.estimate}
          </span>
        );
      },
    },
  ];

  return (
    <div
      style={{
        backgroundColor: "#020617",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        boxShadow: `0 0 0 1px ${COLORS.active}22, 0 16px 40px rgba(0,0,0,0.6)`,
        overflow: "hidden",
        minWidth: 760,
        maxWidth: 1020,
      }}
    >
      <div
        style={{
          padding: "10px 18px",
          backgroundColor: COLORS.card,
          borderBottom: `1px solid ${COLORS.border}`,
          fontFamily: MONO,
          fontSize: 13,
          color: COLORS.textMuted,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <Dot color="#ff5f56" />
        <Dot color="#ffbd2e" />
        <Dot color="#27c93f" />
        <span style={{ marginLeft: 12 }}>yaml · task</span>
      </div>
      <div
        style={{
          padding: "20px 28px",
          fontFamily: MONO,
          fontSize: 22,
          lineHeight: 1.55,
        }}
      >
        {rows.map((row, i) => {
          const at = startFrame + i * stagger;
          const op = interpolate(frame, [at, at + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          return (
            <div key={row.key} style={{ opacity: op, minHeight: 32 }}>
              {"block" in row ? (
                <>
                  <div style={{ color: COLORS.textDim }}>
                    {row.key}: |
                  </div>
                  <div
                    style={{
                      color: COLORS.text,
                      paddingLeft: 32,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {row.block}
                  </div>
                </>
              ) : "renderInline" in row ? (
                row.key === "files" ? (
                  <>
                    <div style={{ color: COLORS.textDim }}>{row.key}:</div>
                    {row.renderInline()}
                  </>
                ) : (
                  <span>
                    <span style={{ color: COLORS.textDim }}>{row.key}: </span>
                    {row.renderInline()}
                  </span>
                )
              ) : (
                <span>
                  <span style={{ color: COLORS.textDim }}>{row.key}: </span>
                  <span style={{ color: row.valueColor ?? COLORS.text }}>
                    {row.value}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---- ApprovalGate -----------------------------------------------------------
// Three checks flow from the left toward a vertical "APPROVAL GATE" line.
// Auto checks slide through with a green PASS ✓; the human check pauses
// at the gate with a pulsing AWAITING [Y/n] prompt. Step 5 (Approval Gate).
// Captures the "agent halts until you say go" mechanic visually.

const ApprovalGate: React.FC<{ payload: ApprovalCheckpointPayload }> = ({
  payload,
}) => {
  const frame = useCurrentFrame();
  const checks = payload.checks;

  const ENTRY_GAP = 50;
  const ENTER_DUR = 30;
  const EVAL_AT = 30;
  const SETTLE_AT = 50;

  const cardW = 420;
  const cardH = 96;
  const gateX = 540;
  const passX = gateX + 280;

  const accent = COLORS.active;

  return (
    <div
      style={{
        position: "relative",
        width: cardW + passX + 80,
        height: checks.length * (cardH + 28) + 32,
        fontFamily: FONT,
      }}
    >
      {/* Gate column */}
      <div
        style={{
          position: "absolute",
          left: gateX + cardW / 2,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: accent,
          borderRadius: 2,
          boxShadow: `0 0 16px ${accent}88`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: gateX + cardW / 2 - 80,
          top: -36,
          width: 160,
          textAlign: "center",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 2,
          color: accent,
        }}
      >
        APPROVAL GATE
      </div>

      {checks.map((c, i) => {
        const startAt = i * ENTRY_GAP;
        const localFrame = frame - startAt;

        const enterT = interpolate(
          localFrame,
          [0, ENTER_DUR],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE },
        );
        const enterX = interpolate(enterT, [0, 1], [-cardW - 40, 0]);

        const evaluatingPulse = interpolate(
          localFrame,
          [EVAL_AT, EVAL_AT + 12, EVAL_AT + 24],
          [1, 1.06, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          },
        );

        const settleT = interpolate(
          localFrame,
          [SETTLE_AT, SETTLE_AT + 28],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE },
        );

        const isPass = c.decision === "pass";
        let xOffset = 0;
        const opacity = enterT;

        if (isPass) {
          xOffset = interpolate(settleT, [0, 1], [0, passX]);
        }

        // For the human "wait" card: pulse the AWAITING prompt
        const waitPulse =
          !isPass && localFrame > EVAL_AT
            ? 0.7 +
              0.3 *
                (Math.sin((frame - startAt - EVAL_AT) / 6) * 0.5 + 0.5)
            : 1;

        const ringColor = isPass
          ? "#7ee787"
          : c.type === "human"
            ? accent
            : COLORS.inactive;

        return (
          <div
            key={c.id}
            style={{
              position: "absolute",
              top: i * (cardH + 28) + 16,
              left: 0,
              width: cardW,
              height: cardH,
              transform: `translateX(${enterX + xOffset}px) scale(${evaluatingPulse})`,
              transformOrigin: "center",
              opacity,
              backgroundColor: COLORS.card,
              border: `1.5px solid ${
                localFrame > EVAL_AT ? ringColor : COLORS.inactive
              }`,
              borderRadius: 12,
              boxShadow:
                localFrame > EVAL_AT
                  ? `0 0 0 1px ${ringColor}55, 0 0 24px ${ringColor}33`
                  : "none",
              padding: "14px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 18,
                color: COLORS.text,
                letterSpacing: 0.2,
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
                fontSize: 15,
                fontFamily: MONO,
              }}
            >
              <span
                style={{
                  color: c.type === "auto" ? COLORS.textMuted : accent,
                  fontWeight: 600,
                }}
              >
                {c.type === "auto" ? "auto" : "human"}
              </span>
              {localFrame > EVAL_AT && (
                <>
                  <span style={{ color: COLORS.textMuted }}>·</span>
                  {isPass ? (
                    <span
                      style={{
                        color: "#7ee787",
                        fontWeight: 700,
                        letterSpacing: 0.4,
                      }}
                    >
                      PASS ✓
                    </span>
                  ) : (
                    <span
                      style={{
                        color: accent,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        opacity: waitPulse,
                      }}
                    >
                      AWAITING {c.waitPrompt ?? "[Y/n]"}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
