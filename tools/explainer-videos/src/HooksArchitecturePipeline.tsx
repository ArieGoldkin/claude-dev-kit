import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import {
  hooksArchitectureSpec,
  cumulativeFrames,
  type Phase,
} from "./specs/hooks-architecture";

// =============================================================================
// Top-level composition
// =============================================================================

export const HooksArchitecturePipeline: React.FC = () => {
  const spec = hooksArchitectureSpec;
  const starts = cumulativeFrames(spec.phases);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d1117",
        color: "#e6edf3",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}
    >
      <Title title={spec.title} subtitle={spec.subtitle} />
      <PhaseStrip phases={spec.phases} starts={starts} />

      {spec.phases.map((phase, i) => (
        <Sequence
          key={phase.id}
          from={starts[i]}
          durationInFrames={phase.durationFrames}
        >
          <PhaseBody phase={phase} />
        </Sequence>
      ))}

      {/* Per-phase narration tracks (macOS `say` Samantha @ -r 200) */}
      {spec.phases.map((phase, i) => (
        <Sequence
          key={`audio-${phase.id}`}
          from={starts[i]}
          durationInFrames={phase.durationFrames}
        >
          <Audio src={staticFile(`narration-${phase.id}.wav`)} volume={0.85} />
        </Sequence>
      ))}

      <FooterBrand />
    </AbsoluteFill>
  );
};

// =============================================================================
// Title
// =============================================================================

const Title: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 32,
        left: 56,
        right: 56,
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
// Phase strip — current-phase indicator at top
// =============================================================================

const PhaseStrip: React.FC<{ phases: Phase[]; starts: number[] }> = ({ phases, starts }) => {
  const frame = useCurrentFrame();

  // Determine which phase is currently active.
  const currentIdx = (() => {
    for (let i = phases.length - 1; i >= 0; i--) {
      if (frame >= starts[i]) return i;
    }
    return 0;
  })();

  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        left: 56,
        right: 56,
        display: "flex",
        gap: 8,
      }}
    >
      {phases.map((phase, i) => {
        const isCurrent = i === currentIdx;
        const isPast = i < currentIdx;
        // Spring-driven scale on the active pill
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
            {`P${i}`}
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// Phase body — switches by visualStyle, with cross-fade entry
// =============================================================================

const PhaseBody: React.FC<{ phase: Phase }> = ({ phase }) => {
  const frame = useCurrentFrame();

  // Cross-fade in over the first 15 frames; fade out over the last 15
  const opacity = interpolate(
    frame,
    [0, 15, phase.durationFrames - 15, phase.durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Slide up subtle
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

const PhaseHeader: React.FC<{ phase: Phase }> = ({ phase }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
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
// Visuals — terminal | code | diagram | panel
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
      return <DiagramVisual which={phase.payload.svg} accent={phase.accentColor} />;
    case "panel":
      return <PanelVisual bullets={phase.payload.bullets} accent={phase.accentColor} />;
  }
};

// ---- Terminal ---------------------------------------------------------------

const TerminalVisual: React.FC<{ lines: string[]; accent: string }> = ({
  lines,
  accent,
}) => {
  const frame = useCurrentFrame();
  // Reveal lines progressively. Start at frame 24, one line every 12 frames.
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
      {/* Faux window dots */}
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
        const color = isComment
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
            }}
          >
            {line || " "}
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
                color: colorizeCode(line, lang),
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

const colorizeCode = (_line: string, _lang: string): string => "#e6edf3";

// Very lightweight token highlighter — no parser, just regex tints.
const CodeLine: React.FC<{ line: string; lang: string }> = ({ line, lang }) => {
  const tokens: { text: string; color: string }[] = [];

  // Comments
  const commentMatch = line.match(/^(\s*)(\/\/.*|#.*)$/);
  if (commentMatch) {
    tokens.push({ text: commentMatch[1], color: "#e6edf3" });
    tokens.push({ text: commentMatch[2], color: "#7d8590" });
    return (
      <>
        {tokens.map((t, i) => (
          <span key={i} style={{ color: t.color }}>
            {t.text}
          </span>
        ))}
      </>
    );
  }

  // String highlighting (single + double quotes)
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
        // Keywords
        const keywords =
          lang === "ts"
            ? /\b(const|let|import|from|return|if|else|await|async|process|console|new)\b/g
            : lang === "json"
              ? /(\btrue\b|\bfalse\b|\bnull\b)/g
              : /\b\b/g;
        const sub = part.split(keywords);
        return (
          <span key={i} style={{ color: "#e6edf3" }}>
            {sub.map((s, j) => {
              const isKw = j % 2 === 1;
              return (
                <span key={j} style={{ color: isKw ? "#ff7b72" : "#e6edf3" }}>
                  {s}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
};

// ---- Diagram ----------------------------------------------------------------

const DiagramVisual: React.FC<{ which: string; accent: string }> = ({ which, accent }) => {
  if (which === "symlink-resolve") {
    return <SymlinkDiagram accent={accent} />;
  }
  return null;
};

const SymlinkDiagram: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Reveal items in sequence
  const reveal = (delay: number) =>
    interpolate(frame, [delay, delay + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // Arrow path animation: trace from plugin file -> shared file
  const arrowProgress = spring({
    frame: Math.max(0, frame - 80),
    fps,
    config: { damping: 22, stiffness: 90 },
  });

  return (
    <div
      style={{
        marginTop: 8,
        flex: 1,
        backgroundColor: "#010409",
        border: `1px solid ${accent}44`,
        borderRadius: 8,
        padding: 32,
        position: "relative",
        boxShadow: `0 0 0 1px ${accent}22, 0 8px 24px rgba(0,0,0,0.4)`,
        fontFamily: '"SF Mono", Menlo, Consolas, monospace',
        fontSize: 13,
      }}
    >
      {/* Plugin-side tree */}
      <div
        style={{
          position: "absolute",
          top: 32,
          left: 32,
          opacity: reveal(24),
        }}
      >
        <div style={{ color: "#7d8590", marginBottom: 6 }}>Plugin (entry point)</div>
        <Tree
          lines={[
            "plugins/continuity-toolkit/",
            "  hooks/src/",
            "    pretool/",
            "      security-blocker.ts ──┐",
            "    lib/ ──────────────────┐│",
            "    types.ts ─────────────┐││",
          ]}
          accent={accent}
          highlightLine={3}
        />
      </div>

      {/* Shared-side tree */}
      <div
        style={{
          position: "absolute",
          top: 32,
          right: 32,
          opacity: reveal(48),
        }}
      >
        <div style={{ color: "#7d8590", marginBottom: 6 }}>Shared (real files)</div>
        <Tree
          lines={[
            "shared/hooks-infra/src/",
            "  hooks/pretool/",
            "    security-blocker.ts ◀─┘",
            "  lib/ ◀────────────────┘",
            "  types.ts ◀───────────┘",
            "",
          ]}
          accent={accent}
          highlightLine={2}
        />
      </div>

      {/* Caption explaining preserveSymlinks */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 32,
          right: 32,
          padding: 14,
          backgroundColor: "#161b22",
          border: `1px solid ${accent}44`,
          borderRadius: 6,
          opacity: reveal(80),
          fontSize: 13,
          color: "#c9d1d9",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}
      >
        <span style={{ color: accent, fontWeight: 700 }}>preserveSymlinks: true</span>
        <span> — TypeScript and esbuild resolve imports relative to the </span>
        <span style={{ color: "#a5d6ff" }}>symlink location</span>
        <span> (plugin), not the </span>
        <span style={{ color: "#ff7b72" }}>real file</span>
        <span> (shared). Without this, </span>
        <span style={{ color: "#7ee787" }}>../lib/</span>
        <span> wouldn't resolve from the deeper shared tree.</span>
      </div>

      {/* Arrow that draws across */}
      <ArrowOverlay progress={arrowProgress} accent={accent} />
    </div>
  );
};

const Tree: React.FC<{ lines: string[]; accent: string; highlightLine: number }> = ({
  lines,
  highlightLine,
  accent,
}) => (
  <div>
    {lines.map((line, i) => (
      <div
        key={i}
        style={{
          color: i === highlightLine ? accent : "#c9d1d9",
          whiteSpace: "pre",
          minHeight: 20,
          fontWeight: i === highlightLine ? 700 : 400,
        }}
      >
        {line}
      </div>
    ))}
  </div>
);

const ArrowOverlay: React.FC<{ progress: number; accent: string }> = ({
  progress,
  accent,
}) => {
  // SVG arrow drawn from left tree to right tree
  const x1 = 290;
  const y1 = 110;
  const x2 = 720;
  const y2 = 110;
  const xMid = (x1 + x2) / 2;
  const yMid = 70; // arc up
  const total = 600; // approx path length
  const dashOffset = total * (1 - progress);

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <polygon points="0 0, 8 4, 0 8" fill={accent} />
        </marker>
      </defs>
      <path
        d={`M ${x1} ${y1} Q ${xMid} ${yMid}, ${x2} ${y2}`}
        stroke={accent}
        strokeWidth="2.5"
        fill="none"
        strokeDasharray={total}
        strokeDashoffset={dashOffset}
        markerEnd="url(#arrowhead)"
        opacity={progress > 0.05 ? 1 : 0}
      />
    </svg>
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

// =============================================================================
// Footer brand
// =============================================================================

const FooterBrand: React.FC = () => {
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
      }}
    >
      <div>claude-dev-kit / shared/hooks-infra</div>
      <div>preserveSymlinks: true</div>
    </div>
  );
};
