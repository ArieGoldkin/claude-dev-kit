import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import {
  TransitionSeries,
  springTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  deltaCacheSpec,
  cumulativeFrames,
  type Scene,
  type SplitScreenPayload,
  type CodePayload,
  type TerminalPayload,
  type PanelPayload,
} from "./specs/delta-cache";

// =============================================================================
// Top-level composition
// =============================================================================

export const DeltaCacheFlow: React.FC = () => {
  const spec = deltaCacheSpec;
  const starts = cumulativeFrames(spec.scenes);
  const frame = useCurrentFrame();

  // Identify hero scene + its frame range so the title/footer can dim
  const heroIdx = spec.scenes.findIndex((s) => s.hero);
  const heroStart = heroIdx >= 0 ? starts[heroIdx] : -1;
  const heroEnd =
    heroIdx >= 0 ? heroStart + spec.scenes[heroIdx].durationFrames : -1;
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
      <SceneStrip
        scenes={spec.scenes}
        starts={starts}
        dim={isHeroActive}
      />

      {/* v1.2 Pattern 4 — TransitionSeries with springTiming({ damping: 200 }) between scenes.
          NOTE: TransitionSeries requires Sequence/Transition as DIRECT children only,
          so we flatten them inline. */}
      <TransitionSeries>
        {spec.scenes.flatMap((scene, i) => {
          const isLast = i === spec.scenes.length - 1;
          const seq = (
            <TransitionSeries.Sequence
              key={`${scene.id}-seq`}
              durationInFrames={scene.durationFrames}
            >
              {scene.hero ? (
                <HeroSplitScreenScene scene={scene} />
              ) : (
                <SceneBody scene={scene} />
              )}
            </TransitionSeries.Sequence>
          );
          if (isLast) return [seq];
          const trans = (
            <TransitionSeries.Transition
              key={`${scene.id}-trans`}
              presentation={fade()}
              timing={springTiming({ config: { damping: 200 } })}
            />
          );
          return [seq, trans];
        })}
      </TransitionSeries>

      <FooterBrand dim={isHeroActive} />
    </AbsoluteFill>
  );
};

// =============================================================================
// Title (dims during hero scene per cinematic-templates.md hero-zoom rule)
// =============================================================================

const Title: React.FC<{ title: string; subtitle: string; dim: boolean }> = ({
  title,
  subtitle,
  dim,
}) => {
  const frame = useCurrentFrame();
  const introOpacity = interpolate(frame, [0, 12, 60, 90], [0, 1, 1, 0.4], {
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
        zIndex: 10,
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
// Scene strip — top progress indicator. Dims during hero scene.
// Note: TransitionSeries plays scenes via local-frame remapping, so the strip
// reads the absolute frame and computes which scene is current itself.
// =============================================================================

const SceneStrip: React.FC<{
  scenes: Scene[];
  starts: number[];
  dim: boolean;
}> = ({ scenes, starts, dim }) => {
  const frame = useCurrentFrame();

  const currentIdx = (() => {
    for (let i = scenes.length - 1; i >= 0; i--) {
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
        zIndex: 10,
      }}
    >
      {scenes.map((scene, i) => {
        const isCurrent = i === currentIdx;
        const isPast = i < currentIdx;
        const sceneStart = starts[i];
        const localFrame = frame - sceneStart;
        const scaleSpring = isCurrent
          ? spring({
              frame: Math.max(0, localFrame),
              fps: 30,
              config: { damping: 12, stiffness: 120, mass: 0.6 },
              from: 0.97,
              to: 1.04,
            })
          : 1;

        const bg = isCurrent
          ? scene.accentColor
          : isPast
            ? "#21262d"
            : "#161b22";
        const fg = isCurrent ? "#0d1117" : isPast ? "#7d8590" : "#484f58";
        const border = isCurrent ? scene.accentColor : "#30363d";

        return (
          <div
            key={scene.id}
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
              transform: `scale(${scaleSpring})`,
              transformOrigin: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {scene.hero ? `★ ${scene.index}. ${scene.name}` : `${scene.index}. ${scene.name}`}
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// Standard scene body (terminal, code, panel) — TransitionSeries handles entry/exit
// fade, so we just render the visual without our own opacity envelope.
// =============================================================================

const SceneBody: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  // Subtle drop-in (no fade — TransitionSeries owns the cross-fade)
  const translateY = interpolate(frame, [0, 18], [12, 0], {
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
        bottom: 80,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <SceneHeader scene={scene} />
      <SceneDescription scene={scene} />
      <SceneVisual scene={scene} />
    </div>
  );
};

// =============================================================================
// Hero scene body — split-screen with hero-zoom and dimmed chrome
// =============================================================================

const HeroSplitScreenScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  // Hero-zoom: subtle scale-up across the scene
  const heroScale = spring({
    frame: Math.max(0, frame - 12),
    fps: 30,
    config: { damping: 18, stiffness: 110, mass: 0.7 },
    from: 1,
    to: 1.04,
  });

  if (scene.payload.kind !== "split-screen") return null;
  const split = scene.payload;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        transform: `scale(${heroScale})`,
        transformOrigin: "center",
      }}
    >
      {/* Hero title */}
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
            fontSize: 46,
            fontWeight: 800,
            color: "#f0f6fc",
            letterSpacing: -1,
          }}
        >
          {scene.name}
        </div>
        <div
          style={{
            fontSize: 17,
            color: "#c9d1d9",
            marginTop: 12,
            maxWidth: 720,
            margin: "12px auto 0",
            textAlign: "center",
          }}
        >
          {scene.description}
        </div>
      </div>

      {/* Split-screen panels */}
      <SplitScreen split={split} accent={scene.accentColor} />
    </div>
  );
};

// =============================================================================
// Scene chrome (header + description)
// =============================================================================

const SceneHeader: React.FC<{ scene: Scene }> = ({ scene }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 4,
          height: 24,
          backgroundColor: scene.accentColor,
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
        {`Scene ${scene.index} — ${scene.name}`}
      </div>
    </div>
  );
};

const SceneDescription: React.FC<{ scene: Scene }> = ({ scene }) => {
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
      {scene.description}
    </div>
  );
};

// =============================================================================
// Visual dispatcher
// =============================================================================

const SceneVisual: React.FC<{ scene: Scene }> = ({ scene }) => {
  switch (scene.payload.kind) {
    case "terminal":
      return (
        <TerminalScene
          payload={scene.payload}
          accent={scene.accentColor}
        />
      );
    case "code":
      return (
        <CodeScene payload={scene.payload} accent={scene.accentColor} />
      );
    case "panel":
      return (
        <PanelScene payload={scene.payload} accent={scene.accentColor} />
      );
    case "split-screen":
      // Hero scene path uses HeroSplitScreenScene directly
      return null;
  }
};

// =============================================================================
// Terminal scene — typewriter via STRING-SLICE (v1.2 Pattern 1)
// + token counter ticking up
// =============================================================================

const TerminalScene: React.FC<{
  payload: TerminalPayload;
  accent: string;
}> = ({ payload, accent }) => {
  const frame = useCurrentFrame();
  const startFrame = 24;
  const charsPerFrame = 1.4; // typing speed

  // Compute how many characters total have been "typed" by now
  const fullText = payload.lines.join("\n");
  const totalCharsTyped = Math.max(
    0,
    Math.floor((frame - startFrame) * charsPerFrame),
  );
  const visible = fullText.slice(0, Math.min(totalCharsTyped, fullText.length));
  const isStillTyping = totalCharsTyped < fullText.length;

  // Token counter: ramps from 0 → finalTokens over the typing window
  const totalChars = fullText.length;
  const typingDoneFrame = startFrame + totalChars / charsPerFrame;
  const tokenProgress = interpolate(
    frame,
    [startFrame, typingDoneFrame],
    [0, payload.finalTokens],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Reconstruct visible text as lines for rendering
  const visibleLines = visible.split("\n");
  // Pad to total line count so the box doesn't reflow
  while (visibleLines.length < payload.lines.length) visibleLines.push("");

  return (
    <div
      style={{
        marginTop: 8,
        display: "flex",
        gap: 16,
        flex: 1,
      }}
    >
      {/* Terminal box */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#010409",
          border: `1px solid ${accent}33`,
          borderRadius: 8,
          padding: "16px 20px",
          fontFamily: '"SF Mono", Menlo, Consolas, monospace',
          fontSize: 14,
          lineHeight: 1.55,
          boxShadow: `0 0 0 1px ${accent}22, 0 8px 24px rgba(0,0,0,0.4)`,
        }}
      >
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <Dot color="#ff5f56" />
          <Dot color="#ffbd2e" />
          <Dot color="#27c93f" />
        </div>
        {visibleLines.map((line, i) => {
          const isCommand = line.startsWith("$");
          const isHeader = line.startsWith("#");
          const isNumbered = /^\d+\./.test(line);
          const color = isCommand
            ? "#a5d6ff"
            : isHeader
              ? accent
              : isNumbered
                ? "#7ee787"
                : "#e6edf3";
          // Append cursor only on the last non-empty line that's currently typing
          const lastNonEmpty = (() => {
            for (let j = visibleLines.length - 1; j >= 0; j--) {
              if (visibleLines[j].length > 0) return j;
            }
            return -1;
          })();
          const showCursor =
            isStillTyping && i === lastNonEmpty && frame % 30 < 15;
          return (
            <div
              key={i}
              style={{
                color,
                whiteSpace: "pre",
                minHeight: 22,
                fontWeight: isHeader ? 700 : 400,
              }}
            >
              {line || " "}
              {showCursor && (
                <span style={{ color: accent, fontWeight: 700 }}>▌</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Token counter sidebar */}
      <TokenCounter
        label="tokens used"
        value={Math.floor(tokenProgress)}
        accent={accent}
        size="lg"
      />
    </div>
  );
};

// =============================================================================
// Code scene — typewriter (v1.2 Pattern 1) + keyword highlighter (Pattern 3)
// =============================================================================

const CodeScene: React.FC<{
  payload: CodePayload;
  accent: string;
}> = ({ payload, accent }) => {
  const frame = useCurrentFrame();
  const startFrame = 24;
  const charsPerFrame = 1.6;

  const fullText = payload.lines.join("\n");
  const totalCharsTyped = Math.max(
    0,
    Math.floor((frame - startFrame) * charsPerFrame),
  );
  const visible = fullText.slice(0, Math.min(totalCharsTyped, fullText.length));
  const isStillTyping = totalCharsTyped < fullText.length;
  const fullyTypedFrame = startFrame + fullText.length / charsPerFrame;

  const visibleLines = visible.split("\n");
  while (visibleLines.length < payload.lines.length) visibleLines.push("");

  // Find which line and char-position contains the highlight word — only
  // valid once that word is fully typed.
  const highlightIdxInFull = fullText.indexOf(payload.highlightWord);
  const highlightFullyTyped =
    highlightIdxInFull >= 0 &&
    totalCharsTyped >= highlightIdxInFull + payload.highlightWord.length;

  // Animate the highlight pen AFTER typing finishes — gives 2s+ hold time too
  const highlightStart = fullyTypedFrame + 12; // ~0.4s after typing done
  const highlightProgress = interpolate(
    frame,
    [highlightStart, highlightStart + 18],
    [0, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

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
        {`▶ ${payload.lang}  ·  hooks/preToolUse.ts`}
      </div>
      <div
        style={{
          padding: "16px 20px",
          fontFamily: '"SF Mono", Menlo, Consolas, monospace',
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {visibleLines.map((line, i) => {
          const lastNonEmpty = (() => {
            for (let j = visibleLines.length - 1; j >= 0; j--) {
              if (visibleLines[j].length > 0) return j;
            }
            return -1;
          })();
          const showCursor =
            isStillTyping && i === lastNonEmpty && frame % 30 < 15;
          return (
            <div
              key={i}
              style={{
                whiteSpace: "pre",
                minHeight: 22,
              }}
            >
              <span
                style={{
                  color: "#484f58",
                  marginRight: 16,
                  userSelect: "none",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <CodeLine
                line={line}
                highlightWord={payload.highlightWord}
                highlightActive={highlightFullyTyped}
                highlightWidth={highlightProgress}
                accent={accent}
              />
              {showCursor && (
                <span style={{ color: accent, fontWeight: 700 }}>▌</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// Code line with optional keyword highlighting (Pattern 3)
// =============================================================================

const CodeLine: React.FC<{
  line: string;
  highlightWord: string;
  highlightActive: boolean;
  highlightWidth: number; // 0..100
  accent: string;
}> = ({ line, highlightWord, highlightActive, highlightWidth, accent }) => {
  if (!line) return <span style={{ color: "#e6edf3" }}> </span>;

  // Comment line
  if (line.trim().startsWith("//")) {
    // Highlight keyword inside comments too
    const idx = line.indexOf(highlightWord);
    if (idx >= 0 && highlightActive) {
      const before = line.substring(0, idx);
      const after = line.substring(idx + highlightWord.length);
      return (
        <>
          <span style={{ color: "#7d8590" }}>{before}</span>
          <HighlightedWord
            word={highlightWord}
            color={accent}
            widthPct={highlightWidth}
            textColor="#7d8590"
          />
          <span style={{ color: "#7d8590" }}>{after}</span>
        </>
      );
    }
    return <span style={{ color: "#7d8590" }}>{line}</span>;
  }

  // Generic syntax: keywords, strings, numbers
  const keywords = [
    "export",
    "async",
    "function",
    "return",
    "if",
    "const",
    "await",
  ];
  const tokens = line.split(/(\s+|[(){}.,;:!=?]|"[^"]*"|'[^']*')/g).filter(Boolean);
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok === highlightWord && highlightActive) {
          return (
            <HighlightedWord
              key={i}
              word={tok}
              color={accent}
              widthPct={highlightWidth}
              textColor="#e6edf3"
            />
          );
        }
        if (keywords.includes(tok)) {
          return (
            <span key={i} style={{ color: "#ff7b72" }}>
              {tok}
            </span>
          );
        }
        if (/^["'].*["']$/.test(tok)) {
          return (
            <span key={i} style={{ color: "#a5d6ff" }}>
              {tok}
            </span>
          );
        }
        return (
          <span key={i} style={{ color: "#e6edf3" }}>
            {tok}
          </span>
        );
      })}
    </>
  );
};

// v1.2 Pattern 3 — animated highlighter pen (background-position)
const HighlightedWord: React.FC<{
  word: string;
  color: string;
  widthPct: number; // 0..100
  textColor: string;
}> = ({ word, color, widthPct, textColor }) => {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        padding: "0 4px",
        margin: "0 -4px",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 2,
          bottom: 2,
          backgroundColor: color,
          opacity: 0.4,
          width: `${widthPct}%`,
          transformOrigin: "left",
          borderRadius: 3,
        }}
      />
      <span style={{ position: "relative", color: textColor, fontWeight: 700 }}>
        {word}
      </span>
    </span>
  );
};

// =============================================================================
// Split-screen visual (hero scene only) — left: full content streams in,
// right: small unified diff. Token counters contrast.
// =============================================================================

const SplitScreen: React.FC<{
  split: SplitScreenPayload;
  accent: string;
}> = ({ split, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Both panels build from frame 18+ to give title room to land
  const panelEnter = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 18, stiffness: 110 },
    from: 0,
    to: 1,
  });

  // Left side: stream content lines via string-slice typewriter
  const leftStartFrame = 36;
  const leftCharsPerFrame = 1.6;
  const leftFullText = split.left.contentLines.join("\n");
  const leftCharsTyped = Math.max(
    0,
    Math.floor((frame - leftStartFrame) * leftCharsPerFrame),
  );
  const leftVisible = leftFullText.slice(
    0,
    Math.min(leftCharsTyped, leftFullText.length),
  );
  const leftLines = leftVisible.split("\n");
  while (leftLines.length < split.left.contentLines.length)
    leftLines.push("");

  const leftDoneFrame =
    leftStartFrame + leftFullText.length / leftCharsPerFrame;

  // Right side: diff lines reveal AFTER left finishes — sequential reveal
  // makes the contrast land. Each diff line drops in via spring.
  const rightStartFrame = leftDoneFrame + 18;

  // Token counters tick up
  const leftTokens = interpolate(
    frame,
    [leftStartFrame, leftDoneFrame],
    [0, split.left.tokenCount],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const rightDiffDoneFrame = rightStartFrame + split.right.diffLines.length * 8;
  const rightTokens = interpolate(
    frame,
    [rightStartFrame, rightDiffDoneFrame],
    [0, split.right.tokenCount],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Big number reveal — savings ratio. Lands at the very end as the punchline.
  const savingsFrame = rightDiffDoneFrame + 18;
  const savingsScale = spring({
    frame: Math.max(0, frame - savingsFrame),
    fps,
    config: { damping: 11, stiffness: 130 },
    from: 0.7,
    to: 1,
  });
  const savingsOpacity = interpolate(
    frame,
    [savingsFrame, savingsFrame + 14],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        alignItems: "stretch",
        width: "82%",
        maxWidth: 1500,
        opacity: panelEnter,
        transform: `translateY(${interpolate(panelEnter, [0, 1], [12, 0])}px)`,
      }}
    >
      {/* LEFT — without delta-cache */}
      <SplitPanel
        label={split.left.label}
        sublabel={split.left.sublabel}
        accent="#f85149" // red — the "bad" side
        tokens={Math.floor(leftTokens)}
        finalTokens={split.left.tokenCount}
      >
        <div
          style={{
            fontFamily: '"SF Mono", Menlo, Consolas, monospace',
            fontSize: 12,
            lineHeight: 1.5,
            color: "#c9d1d9",
            whiteSpace: "pre",
            opacity: 0.9,
          }}
        >
          {leftLines.map((line, i) => {
            const isHeader = line.startsWith("#");
            const isNumbered = /^\d+\./.test(line);
            return (
              <div
                key={i}
                style={{
                  color: isHeader
                    ? "#f85149"
                    : isNumbered
                      ? "#7ee787"
                      : "#c9d1d9",
                  minHeight: 18,
                  fontWeight: isHeader ? 700 : 400,
                }}
              >
                {line || " "}
              </div>
            );
          })}
        </div>
      </SplitPanel>

      {/* RIGHT — with delta-cache */}
      <SplitPanel
        label={split.right.label}
        sublabel={split.right.sublabel}
        accent={accent} // gold — the "good" side
        tokens={Math.floor(rightTokens)}
        finalTokens={split.right.tokenCount}
      >
        <div
          style={{
            fontFamily: '"SF Mono", Menlo, Consolas, monospace',
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: "pre",
          }}
        >
          {split.right.diffLines.map((line, i) => {
            const lineFrame = rightStartFrame + i * 8;
            const opacity = interpolate(
              frame,
              [lineFrame, lineFrame + 8],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const slideX = interpolate(
              frame,
              [lineFrame, lineFrame + 12],
              [-12, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const color = line.startsWith("+")
              ? "#3fb950"
              : line.startsWith("-")
                ? "#f85149"
                : line.startsWith("@")
                  ? "#79c0ff"
                  : "#c9d1d9";
            return (
              <div
                key={i}
                style={{
                  color,
                  opacity,
                  transform: `translateX(${slideX}px)`,
                  minHeight: 22,
                  fontWeight: line.startsWith("@") ? 700 : 400,
                }}
              >
                {line}
              </div>
            );
          })}

          {/* Savings callout */}
          <div
            style={{
              marginTop: 28,
              opacity: savingsOpacity,
              transform: `scale(${savingsScale})`,
              transformOrigin: "left center",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              display: "flex",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 56,
                fontWeight: 800,
                color: accent,
                letterSpacing: -2,
                lineHeight: 1,
              }}
            >
              98%
            </span>
            <span
              style={{
                fontSize: 14,
                color: "#7d8590",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              fewer tokens
            </span>
          </div>
        </div>
      </SplitPanel>
    </div>
  );
};

const SplitPanel: React.FC<{
  label: string;
  sublabel: string;
  accent: string;
  tokens: number;
  finalTokens: number;
  children: React.ReactNode;
}> = ({ label, sublabel, accent, tokens, children }) => {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: "#010409",
        border: `2px solid ${accent}`,
        borderRadius: 12,
        padding: "20px 22px",
        boxShadow: `0 0 0 1px ${accent}33, 0 12px 32px rgba(0,0,0,0.5)`,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 380,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 12,
            color: accent,
            fontFamily: '"SF Mono", Menlo, Consolas, monospace',
            letterSpacing: 1.5,
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#7d8590",
            fontWeight: 400,
          }}
        >
          {sublabel}
        </div>
      </div>

      {/* Token counter */}
      <div
        style={{
          padding: "10px 14px",
          backgroundColor: `${accent}11`,
          border: `1px solid ${accent}44`,
          borderRadius: 6,
          display: "flex",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: accent,
            fontFamily: '"SF Mono", Menlo, Consolas, monospace',
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          {tokens.toLocaleString()}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "#7d8590",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          tokens
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>{children}</div>
    </div>
  );
};

// =============================================================================
// Token counter sidebar (used by terminal scene)
// =============================================================================

const TokenCounter: React.FC<{
  label: string;
  value: number;
  accent: string;
  size: "sm" | "lg";
}> = ({ label, value, accent, size }) => {
  return (
    <div
      style={{
        width: size === "lg" ? 240 : 180,
        padding: "20px 22px",
        backgroundColor: "#010409",
        border: `1px solid ${accent}66`,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        boxShadow: `0 0 0 1px ${accent}22`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#7d8590",
          textTransform: "uppercase",
          letterSpacing: 1.5,
          fontFamily: '"SF Mono", Menlo, Consolas, monospace',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 56,
          fontWeight: 800,
          color: accent,
          fontFamily: '"SF Mono", Menlo, Consolas, monospace',
          letterSpacing: -2,
          lineHeight: 1,
        }}
      >
        {value.toLocaleString()}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#484f58",
          fontFamily: '"SF Mono", Menlo, Consolas, monospace',
        }}
      >
        ≈ {(value / 1000).toFixed(1)}k
      </div>
    </div>
  );
};

// =============================================================================
// Panel scene — per-word stagger headline (v1.2 Pattern 2)
// =============================================================================

const PanelScene: React.FC<{
  payload: PanelPayload;
  accent: string;
}> = ({ payload, accent }) => {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 24,
      }}
    >
      <PerWordStagger
        text={payload.headline}
        startFrame={12}
        fontSize={56}
        color="#f0f6fc"
        accent={accent}
      />
      <SubLine text={payload.subline} startFrame={48} accent={accent} />
    </div>
  );
};

const PerWordStagger: React.FC<{
  text: string;
  startFrame: number;
  fontSize: number;
  color: string;
  accent: string;
}> = ({ text, startFrame, fontSize, color, accent }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontSize,
        fontWeight: 800,
        color,
        letterSpacing: -1.5,
        textAlign: "center",
        lineHeight: 1.15,
        maxWidth: 1100,
      }}
    >
      {text.split(" ").map((word, i) => {
        const wordFrame = frame - startFrame - i * 4;
        const opacity = interpolate(wordFrame, [0, 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const y = spring({
          frame: Math.max(0, wordFrame),
          fps: 30,
          config: { damping: 14, stiffness: 110 },
          from: 16,
          to: 0,
        });
        // Highlight numeric/percent words in accent
        const isMetric = /\d/.test(word);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              transform: `translateY(${y}px)`,
              marginRight: "0.3em",
              color: isMetric ? accent : color,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

const SubLine: React.FC<{
  text: string;
  startFrame: number;
  accent: string;
}> = ({ text, startFrame, accent }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        fontSize: 22,
        color: "#c9d1d9",
        opacity,
        textAlign: "center",
        maxWidth: 920,
        fontWeight: 400,
        borderLeft: `3px solid ${accent}`,
        paddingLeft: 14,
      }}
    >
      {text}
    </div>
  );
};

// =============================================================================
// Footer brand
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
        zIndex: 10,
      }}
    >
      <div>ctk · delta-cache · PreToolUse hook</div>
      <div>same fidelity · less context</div>
    </div>
  );
};

// =============================================================================
// Small atoms
// =============================================================================

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
