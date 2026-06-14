import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import {
  developPipelineSpec,
  cumulativeFrames,
  type Phase,
} from "./specs/develop-pipeline";

// =============================================================================
// Top-level composition
// =============================================================================

export const DevelopPipeline: React.FC = () => {
  const spec = developPipelineSpec;
  const starts = cumulativeFrames(spec.phases);
  const frame = useCurrentFrame();

  // Identify hero phase + its frame range so the phase strip can dim
  const heroIdx = spec.phases.findIndex((p) => p.hero);
  const heroStart = heroIdx >= 0 ? starts[heroIdx] : -1;
  const heroEnd = heroIdx >= 0 ? heroStart + spec.phases[heroIdx].durationFrames : -1;
  const isHeroActive = frame >= heroStart && frame < heroEnd;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d1117",
        color: "#e6edf3",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}
    >
      <Title
        title={spec.title}
        subtitle={spec.subtitle}
        dim={isHeroActive}
      />
      <PhaseStrip
        phases={spec.phases}
        starts={starts}
        dim={isHeroActive}
      />

      {spec.phases.map((phase, i) => (
        <Sequence
          key={phase.id}
          from={starts[i]}
          durationInFrames={phase.durationFrames}
        >
          {phase.hero ? <HeroPhaseBody phase={phase} /> : <PhaseBody phase={phase} />}
        </Sequence>
      ))}

      <FooterBrand dim={isHeroActive} />
    </AbsoluteFill>
  );
};

// =============================================================================
// Title (dims during hero phase per cinematic-templates.md hero-zoom rule)
// =============================================================================

const Title: React.FC<{ title: string; subtitle: string; dim: boolean }> = ({
  title,
  subtitle,
  dim,
}) => {
  const frame = useCurrentFrame();
  const introOpacity = interpolate(frame, [0, 12, 60, 90], [0, 1, 1, 0.3], {
    extrapolateRight: "clamp",
  });
  const dimOpacity = dim ? 0.15 : 1;

  return (
    <div
      style={{
        position: "absolute",
        top: 32,
        left: 56,
        right: 56,
        opacity: Math.min(introOpacity, dimOpacity),
        transition: undefined, // no CSS transitions per gotcha #1
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: -0.5,
          color: "#f0f6fc",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 400,
          color: "#7d8590",
          marginTop: 6,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};

// =============================================================================
// Phase strip — dims during hero phase
// =============================================================================

const PhaseStrip: React.FC<{ phases: Phase[]; starts: number[]; dim: boolean }> = ({
  phases,
  starts,
  dim,
}) => {
  const frame = useCurrentFrame();

  const currentIdx = (() => {
    for (let i = phases.length - 1; i >= 0; i--) {
      if (frame >= starts[i]) return i;
    }
    return 0;
  })();

  const stripOpacity = dim ? 0.2 : 1;

  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        left: 56,
        right: 56,
        display: "flex",
        gap: 8,
        opacity: stripOpacity,
      }}
    >
      {phases.map((phase, i) => {
        const isCurrent = i === currentIdx;
        const isPast = i < currentIdx;
        const phaseStart = starts[i];
        const localFrame = frame - phaseStart;
        const scale = isCurrent
          ? spring({
              frame: Math.max(0, localFrame),
              fps: 30,
              config: { damping: 12, stiffness: 120, mass: 0.6 },
              from: 0.97,
              to: 1.04,
            })
          : 1;

        const bg = isCurrent ? phase.accentColor : isPast ? "#21262d" : "#161b22";
        const fg = isCurrent ? "#0d1117" : isPast ? "#7d8590" : "#484f58";
        const border = isCurrent ? phase.accentColor : "#30363d";

        return (
          <div
            key={phase.id}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 6,
              backgroundColor: bg,
              border: `1px solid ${border}`,
              fontSize: 11,
              fontWeight: isCurrent ? 700 : 500,
              color: fg,
              textAlign: "center",
              transform: `scale(${scale})`,
              transformOrigin: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {phase.hero ? `★ P${i}` : `P${i}`}
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// Standard phase body
// =============================================================================

const PhaseBody: React.FC<{ phase: Phase }> = ({ phase }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 15, phase.durationFrames - 15, phase.durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const translateY = interpolate(frame, [0, 18], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 180,
        left: 56,
        right: 56,
        bottom: 110,
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <PhaseHeader phase={phase} />
      <PhaseDescription phase={phase} />
      {phase.payload && <PhaseVisual phase={phase} />}
    </div>
  );
};

// =============================================================================
// Hero phase body (cinematic-templates.md → hero-zoom + stack-reveal payload)
// =============================================================================

const HeroPhaseBody: React.FC<{ phase: Phase }> = ({ phase }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 18, phase.durationFrames - 18, phase.durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Hero-zoom: subtle scale-up across the phase
  const heroScale = spring({
    frame: Math.max(0, frame - 12),
    fps: 30,
    config: { damping: 18, stiffness: 110, mass: 0.7 },
    from: 1,
    to: 1.05,
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        transform: `scale(${heroScale})`,
        transformOrigin: "center",
      }}
    >
      {/* Hero title block — bigger than standard phase header */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 14,
            color: "#7d8590",
            fontFamily: '"SF Mono", Menlo, Consolas, monospace',
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          ★ THE PUNCHLINE
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: "#f0f6fc",
            letterSpacing: -1,
          }}
        >
          {phase.name.replace(/^Phase \d+ — /, "")}
        </div>
        <div
          style={{
            fontSize: 18,
            color: "#c9d1d9",
            marginTop: 14,
            maxWidth: 720,
            textAlign: "center",
            margin: "14px auto 0",
          }}
        >
          {phase.description}
        </div>
      </div>

      {/* Stack-reveal payload — three RED/GREEN/REFACTOR cards drop in */}
      {phase.payload?.kind === "stack-reveal" && (
        <StackReveal cards={phase.payload.cards} />
      )}
    </div>
  );
};

// =============================================================================
// Standard phase pieces
// =============================================================================

const PhaseHeader: React.FC<{ phase: Phase }> = ({ phase }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 4,
          height: 24,
          backgroundColor: phase.accentColor,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#f0f6fc",
          letterSpacing: -0.3,
        }}
      >
        {phase.name}
      </div>
    </div>
  );
};

const PhaseDescription: React.FC<{ phase: Phase }> = ({ phase }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [12, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontSize: 16,
        lineHeight: 1.55,
        color: "#c9d1d9",
        maxWidth: 920,
        opacity,
      }}
    >
      {phase.description}
    </div>
  );
};

// =============================================================================
// Visuals — terminal | code | diagram (plan-fanout) | panel
// =============================================================================

const PhaseVisual: React.FC<{ phase: Phase }> = ({ phase }) => {
  if (!phase.payload) return null;
  switch (phase.payload.kind) {
    case "terminal":
      return <TerminalVisual lines={phase.payload.lines} accent={phase.accentColor} />;
    case "code":
      return (
        <CodeVisual
          lines={phase.payload.lines}
          lang={phase.payload.lang}
          accent={phase.accentColor}
        />
      );
    case "diagram":
      if (phase.payload.svg === "plan-fanout") {
        return <PlanFanoutDiagram accent={phase.accentColor} />;
      }
      return null;
    case "panel":
      return <PanelVisual bullets={phase.payload.bullets} accent={phase.accentColor} />;
    case "stack-reveal":
      // Hero-only path — handled inside HeroPhaseBody
      return null;
  }
};

// ---- Terminal ---------------------------------------------------------------

const TerminalVisual: React.FC<{ lines: string[]; accent: string }> = ({
  lines,
  accent,
}) => {
  const frame = useCurrentFrame();
  const startFrame = 24;
  const perLine = 12;

  return (
    <div
      style={{
        marginTop: 8,
        backgroundColor: "#010409",
        border: `1px solid ${accent}33`,
        borderRadius: 8,
        padding: "16px 20px",
        fontFamily: '"SF Mono", Menlo, Consolas, monospace',
        fontSize: 14,
        lineHeight: 1.55,
        flex: 1,
        boxShadow: `0 0 0 1px ${accent}22, 0 8px 24px rgba(0,0,0,0.4)`,
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <Dot color="#ff5f56" />
        <Dot color="#ffbd2e" />
        <Dot color="#27c93f" />
      </div>
      {lines.map((line, i) => {
        const lineFrame = startFrame + i * perLine;
        const opacity = interpolate(frame, [lineFrame, lineFrame + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const isComment = line.startsWith("#");
        const isCommand = line.startsWith("$");
        const isPlus = line.startsWith("+") || line.startsWith("  ");
        const isArrow = line.startsWith("→");
        const isStatus = line.startsWith("STATUS:");
        const color = isStatus
          ? "#3fb950"
          : isArrow
            ? accent
            : isComment
              ? "#7d8590"
              : isCommand
                ? "#a5d6ff"
                : isPlus
                  ? "#7ee787"
                  : "#e6edf3";
        return (
          <div
            key={i}
            style={{
              opacity,
              color,
              whiteSpace: "pre",
              minHeight: 20,
              fontWeight: isStatus ? 700 : 400,
            }}
          >
            {line || " "}
          </div>
        );
      })}
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: color,
    }}
  />
);

// ---- Code -------------------------------------------------------------------

const CodeVisual: React.FC<{ lines: string[]; lang: string; accent: string }> = ({
  lines,
  lang,
  accent,
}) => {
  const frame = useCurrentFrame();
  const startFrame = 24;
  const perLine = 8;

  return (
    <div
      style={{
        marginTop: 8,
        backgroundColor: "#010409",
        border: `1px solid ${accent}44`,
        borderRadius: 8,
        flex: 1,
        boxShadow: `0 0 0 1px ${accent}22, 0 8px 24px rgba(0,0,0,0.4)`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #21262d",
          fontSize: 11,
          color: "#7d8590",
          backgroundColor: "#0d1117",
          fontFamily: '"SF Mono", Menlo, Consolas, monospace',
        }}
      >
        {`▶ ${lang}`}
      </div>
      <div
        style={{
          padding: "16px 20px",
          fontFamily: '"SF Mono", Menlo, Consolas, monospace',
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {lines.map((line, i) => {
          const lineFrame = startFrame + i * perLine;
          const opacity = interpolate(frame, [lineFrame, lineFrame + 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                opacity,
                whiteSpace: "pre",
                minHeight: 22,
              }}
            >
              <span style={{ color: "#484f58", marginRight: 16, userSelect: "none" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <CodeLine line={line} lang={lang} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CodeLine: React.FC<{ line: string; lang: string }> = ({ line, lang }) => {
  // Markdown-aware highlighting for hypothesis docs
  if (lang === "md") {
    if (line.startsWith("##")) {
      return <span style={{ color: "#79c0ff", fontWeight: 700 }}>{line}</span>;
    }
    if (line.startsWith("- ")) {
      return (
        <>
          <span style={{ color: "#f0b049" }}>- </span>
          <span style={{ color: "#c9d1d9" }}>{line.substring(2)}</span>
        </>
      );
    }
    return <span style={{ color: "#e6edf3" }}>{line || " "}</span>;
  }

  // Generic comment + string highlighting
  const commentMatch = line.match(/^(\s*)(\/\/.*|#.*)$/);
  if (commentMatch) {
    return (
      <>
        <span style={{ color: "#e6edf3" }}>{commentMatch[1]}</span>
        <span style={{ color: "#7d8590" }}>{commentMatch[2]}</span>
      </>
    );
  }

  const parts = line.split(/(["'`][^"'`]*["'`])/g);
  return (
    <>
      {parts.map((part, i) => {
        const isString = /^["'`]/.test(part);
        if (isString) {
          return (
            <span key={i} style={{ color: "#a5d6ff" }}>
              {part}
            </span>
          );
        }
        return (
          <span key={i} style={{ color: "#e6edf3" }}>
            {part}
          </span>
        );
      })}
    </>
  );
};

// ---- Diagram: plan-fanout ---------------------------------------------------

const PlanFanoutDiagram: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Plan node fades in first; tasks fan out from it via spring
  const planOpacity = interpolate(frame, [12, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fanoutProgress = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 18, stiffness: 90 },
  });

  const tasks = [
    { label: "T1: schema migration", color: "#79c0ff" },
    { label: "T2: API endpoint", color: "#a371f7" },
    { label: "T3: frontend form", color: "#3fb950" },
    { label: "T4: integration test", color: "#f0b049" },
  ];

  return (
    <div
      style={{
        marginTop: 8,
        flex: 1,
        backgroundColor: "#010409",
        border: `1px solid ${accent}44`,
        borderRadius: 8,
        position: "relative",
        boxShadow: `0 0 0 1px ${accent}22, 0 8px 24px rgba(0,0,0,0.4)`,
        fontFamily: '"SF Mono", Menlo, Consolas, monospace',
        fontSize: 13,
        overflow: "hidden",
      }}
    >
      {/* Plan source node */}
      <div
        style={{
          position: "absolute",
          left: 56,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: planOpacity,
          padding: "16px 22px",
          backgroundColor: `${accent}1f`,
          border: `2px solid ${accent}`,
          borderRadius: 10,
          fontWeight: 700,
          color: "#f0f6fc",
          fontSize: 16,
        }}
      >
        Plan
        <div
          style={{
            fontSize: 11,
            color: "#7d8590",
            fontWeight: 400,
            marginTop: 4,
          }}
        >
          quality gates per task
        </div>
      </div>

      {/* Task targets fan-out vertically on the right */}
      {tasks.map((task, i) => {
        const yOffset = (i - (tasks.length - 1) / 2) * 88;
        const x = interpolate(fanoutProgress, [0, 1], [400, 760]);
        const opacity = interpolate(fanoutProgress, [0, 0.35], [0, 1], {
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={task.label}
            style={{
              position: "absolute",
              left: x,
              top: `calc(50% + ${yOffset}px)`,
              transform: "translateY(-50%)",
              opacity,
              padding: "10px 16px",
              backgroundColor: `${task.color}1a`,
              border: `1px solid ${task.color}`,
              borderRadius: 8,
              color: task.color,
              fontWeight: 600,
              minWidth: 220,
            }}
          >
            {task.label}
          </div>
        );
      })}

      {/* Fan-out arrows */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {tasks.map((task, i) => {
          const yOffset = (i - (tasks.length - 1) / 2) * 88;
          const x1 = 220;
          const y1 = "50%";
          const x2 = 760;
          const y2Offset = yOffset;
          const dashLen = 600;
          const dashOffset = dashLen * (1 - fanoutProgress);
          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={`calc(50% + ${y2Offset}px)`}
                stroke={task.color}
                strokeWidth="2"
                strokeDasharray={dashLen}
                strokeDashoffset={dashOffset}
                opacity={fanoutProgress > 0.05 ? 1 : 0}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ---- Panel ------------------------------------------------------------------

const PanelVisual: React.FC<{ bullets: string[]; accent: string }> = ({
  bullets,
  accent,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        marginTop: 8,
        flex: 1,
        backgroundColor: "#010409",
        border: `1px solid ${accent}44`,
        borderRadius: 8,
        padding: "24px 28px",
        boxShadow: `0 0 0 1px ${accent}22, 0 8px 24px rgba(0,0,0,0.4)`,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {bullets.map((b, i) => {
        const reveal = interpolate(frame, [24 + i * 14, 36 + i * 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const slideX = interpolate(frame, [24 + i * 14, 36 + i * 14], [-12, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              opacity: reveal,
              transform: `translateX(${slideX}px)`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: accent,
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 17, color: "#e6edf3", lineHeight: 1.4 }}>{b}</div>
          </div>
        );
      })}
    </div>
  );
};

// ---- Stack reveal (hero phase only) -----------------------------------------

const StackReveal: React.FC<{
  cards: { label: string; subtitle: string; accent: string }[];
}> = ({ cards }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        alignItems: "stretch",
        marginTop: 30,
      }}
    >
      {cards.map((card, i) => {
        const delay = 36 + i * 24;
        const opacity = interpolate(frame, [delay, delay + 18], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const ySpring = spring({
          frame: Math.max(0, frame - delay),
          fps: 30,
          config: { damping: 14, stiffness: 110, mass: 0.7 },
          from: -32,
          to: 0,
        });
        const scaleSpring = spring({
          frame: Math.max(0, frame - delay),
          fps: 30,
          config: { damping: 11, stiffness: 130 },
          from: 0.92,
          to: 1,
        });

        return (
          <div
            key={card.label}
            style={{
              opacity,
              transform: `translateY(${ySpring}px) scale(${scaleSpring})`,
              backgroundColor: "#010409",
              border: `2px solid ${card.accent}`,
              borderRadius: 12,
              padding: "28px 32px",
              minWidth: 280,
              boxShadow: `0 0 0 1px ${card.accent}33, 0 12px 32px rgba(0,0,0,0.5)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: card.accent,
                letterSpacing: 2,
                fontFamily: '"SF Mono", Menlo, Consolas, monospace',
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#c9d1d9",
                textAlign: "center",
                lineHeight: 1.5,
                maxWidth: 240,
              }}
            >
              {card.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// Footer brand (dims during hero)
// =============================================================================

const FooterBrand: React.FC<{ dim: boolean }> = ({ dim }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: 56,
        right: 56,
        display: "flex",
        justifyContent: "space-between",
        fontSize: 11,
        color: "#484f58",
        fontFamily: '"SF Mono", Menlo, Consolas, monospace',
        opacity: dim ? 0.2 : 1,
      }}
    >
      <div>etk:develop · 6-phase pipeline</div>
      <div>STATUS: DONE on evidence, not vibes</div>
    </div>
  );
};
