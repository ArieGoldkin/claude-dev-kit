// DeltaCacheExplainer — strict v1.2-pattern composition for ctk delta-cache.
//
// Architecture (non-negotiable per the prompt):
//   <TransitionSeries>                              ← drives scene transitions
//     <TransitionSeries.Sequence>
//       <SceneRouter scene={...} />                 ← dispatches by payload.kind
//     </TransitionSeries.Sequence>
//     <TransitionSeries.Transition timing={springTiming({damping:200})} presentation={fade()} />
//     ...
//   </TransitionSeries>
//
// Sequence + Transition MUST be direct children of TransitionSeries (no wrapper
// components — wrapping breaks render). flatMap inlines them to satisfy this.

import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import { Highlight, themes } from "prism-react-renderer";
import {
  deltaCacheSpec,
  type Scene,
  type TerminalPayload,
  type CodePayload,
  type SplitScreenPayload,
  type PanelPayload,
} from "./specs/delta-cache";

// Load fonts at module top — Remotion handles delayRender/continueRender internally
const { fontFamily: INTER } = loadInter();
const { fontFamily: JETBRAINS } = loadJetBrainsMono();

// ----------------------------------------------------------------------------
// Visual system constants (from the prompt)
// ----------------------------------------------------------------------------

const BG = "#0d1117";
const CARD_BG = "#161b22";
const CARD_BORDER = "#30363d";
const TEXT = "#f0f6fc";
const TEXT_MUTED = "#7d8590";
const TEXT_DIM = "#484f58";

// Card shape
const CARD_RADIUS = 8;
const CARD_BORDER_WIDTH = 1;

// ----------------------------------------------------------------------------
// Top-level composition
// ----------------------------------------------------------------------------

export const DeltaCacheExplainer: React.FC = () => {
  const scenes = deltaCacheSpec.scenes;

  return (
    <AbsoluteFill style={{ backgroundColor: BG, color: TEXT, fontFamily: INTER }}>
      <TransitionSeries>
        {scenes.flatMap((scene, i) => {
          const sequenceNode = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}`}
              durationInFrames={scene.durationFrames}
            >
              <SceneRouter scene={scene} />
            </TransitionSeries.Sequence>
          );

          // Insert a transition between scenes (not before the first, not after the last)
          if (i < scenes.length - 1) {
            return [
              sequenceNode,
              <TransitionSeries.Transition
                key={`trans-${scene.id}`}
                timing={springTiming({ config: { damping: 200 } })}
                presentation={fade()}
              />,
            ];
          }
          return [sequenceNode];
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};

// ----------------------------------------------------------------------------
// SceneRouter — dispatches by payload kind
// ----------------------------------------------------------------------------

const SceneRouter: React.FC<{ scene: Scene }> = ({ scene }) => {
  switch (scene.payload.kind) {
    case "terminal":
      return <TerminalScene scene={scene} payload={scene.payload} />;
    case "code":
      return <CodeScene scene={scene} payload={scene.payload} />;
    case "split-screen":
      return <SplitScreenScene scene={scene} payload={scene.payload} />;
    case "panel":
      return <PanelScene scene={scene} payload={scene.payload} />;
  }
};

// ----------------------------------------------------------------------------
// Shared chrome — title bar, scene label, footer
// ----------------------------------------------------------------------------

const SceneFrame: React.FC<{
  scene: Scene;
  children: React.ReactNode;
}> = ({ scene, children }) => {
  return (
    <AbsoluteFill style={{ padding: 56, display: "flex", flexDirection: "column" }}>
      <SceneHeader scene={scene} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", marginTop: 24 }}>
        {children}
      </div>
      <SceneFooter scene={scene} />
    </AbsoluteFill>
  );
};

const SceneHeader: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stripIn = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const opacity = interpolate(stripIn, [0, 1], [0, 1]);
  const x = interpolate(stripIn, [0, 1], [-12, 0]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity,
        transform: `translateX(${x}px)`,
      }}
    >
      <div
        style={{
          fontFamily: JETBRAINS,
          fontSize: 13,
          color: TEXT_MUTED,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        Scene {scene.index} of {deltaCacheSpec.scenes.length}
      </div>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: scene.accentColor,
          boxShadow: scene.hero ? `0 0 18px ${scene.accentColor}aa` : "none",
        }}
      />
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: TEXT,
          letterSpacing: -0.3,
        }}
      >
        {scene.name}
      </div>
    </div>
  );
};

const SceneFooter: React.FC<{ scene: Scene }> = ({ scene }) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 24,
        fontFamily: JETBRAINS,
        fontSize: 12,
        color: TEXT_DIM,
        letterSpacing: 0.5,
      }}
    >
      <div>{deltaCacheSpec.title}</div>
      <div style={{ color: scene.hero ? scene.accentColor : TEXT_DIM }}>
        {scene.description}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Token counter (used by Scene 1 + Scene 3)
// ----------------------------------------------------------------------------

const TokenCounter: React.FC<{
  startFrame: number;
  endFrame: number;
  finalValue: number;
  accent: string;
  label?: string;
  large?: boolean;
}> = ({ startFrame, endFrame, finalValue, accent, label, large }) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame, [startFrame, endFrame], [0, finalValue], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const display = Math.round(value).toLocaleString();

  return (
    <div
      style={{
        backgroundColor: CARD_BG,
        border: `${CARD_BORDER_WIDTH}px solid ${CARD_BORDER}`,
        borderRadius: CARD_RADIUS,
        padding: large ? "14px 22px" : "8px 14px",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 4,
        fontFamily: JETBRAINS,
      }}
    >
      {label && (
        <div
          style={{
            fontSize: 11,
            color: TEXT_MUTED,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fontFamily: INTER,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          fontSize: large ? 56 : 24,
          fontWeight: 700,
          color: accent,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {display}
      </div>
      <div
        style={{
          fontSize: large ? 14 : 11,
          color: TEXT_MUTED,
          fontFamily: INTER,
        }}
      >
        tokens
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Typewriter (string-slice — NOT per-char opacity)
// ----------------------------------------------------------------------------

const computeVisibleChars = (
  frame: number,
  startFrame: number,
  endFrame: number,
  totalChars: number
): number => {
  const visible = interpolate(
    frame,
    [startFrame, endFrame],
    [0, totalChars],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.linear,
    }
  );
  return Math.floor(visible);
};

const Cursor: React.FC<{ visible: boolean; color: string }> = ({ visible, color }) => {
  const frame = useCurrentFrame();
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: "1em",
        backgroundColor: color,
        marginLeft: 2,
        verticalAlign: "text-bottom",
        opacity: visible && blink ? 1 : 0,
      }}
    />
  );
};

// ----------------------------------------------------------------------------
// Scene 1 — Terminal (typewriter, token counter ticks 0→3000)
// ----------------------------------------------------------------------------

const TerminalScene: React.FC<{ scene: Scene; payload: TerminalPayload }> = ({
  scene,
  payload,
}) => {
  const frame = useCurrentFrame();

  // Type budget: leave ≥60 frames hold at the end
  const typeEndFrame = scene.durationFrames - 60;
  const totalChars = payload.lines.reduce((sum, l) => sum + l.length + 1, 0); // +1 for newline
  const visibleChars = computeVisibleChars(
    frame,
    18, // start typing after 18 frames (header settles)
    typeEndFrame,
    totalChars
  );

  // Slice the lines according to visibleChars
  const renderedLines: { text: string; isActive: boolean; done: boolean }[] = [];
  let consumed = 0;
  let activeFound = false;
  for (const line of payload.lines) {
    const lineLen = line.length + 1;
    if (consumed + lineLen <= visibleChars) {
      renderedLines.push({ text: line, isActive: false, done: true });
      consumed += lineLen;
    } else if (!activeFound) {
      const remaining = visibleChars - consumed;
      renderedLines.push({
        text: line.slice(0, Math.max(0, remaining)),
        isActive: true,
        done: false,
      });
      activeFound = true;
      consumed = visibleChars;
    } else {
      break;
    }
  }

  // Token counter spans full scene (excluding the last 60-frame hold)
  const counterStart = 18;
  const counterEnd = scene.durationFrames - 60;

  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        <Card accent={scene.accentColor}>
          <TerminalChrome />
          <div
            style={{
              fontFamily: JETBRAINS,
              fontSize: 22,
              lineHeight: 1.55,
              padding: 24,
              minHeight: 480,
              color: TEXT,
            }}
          >
            {renderedLines.map((line, i) => {
              const isCommand = line.text.startsWith("$");
              const isComment = line.text.startsWith("#");
              const isList = /^\d+\./.test(line.text);
              const color = isCommand
                ? "#a5d6ff"
                : isComment
                  ? "#7ee787"
                  : isList
                    ? scene.accentColor
                    : TEXT;
              const opacity = line.done && i < renderedLines.length - 1 ? 0.55 : 1;
              return (
                <div
                  key={i}
                  style={{
                    color,
                    opacity,
                    minHeight: "1.55em",
                    whiteSpace: "pre",
                  }}
                >
                  {line.text || " "}
                  {line.isActive && <Cursor visible color={color} />}
                </div>
              );
            })}
          </div>
        </Card>

        <div style={{ position: "absolute", top: 110, right: 56 }}>
          <TokenCounter
            startFrame={counterStart}
            endFrame={counterEnd}
            finalValue={payload.finalTokens}
            accent={scene.accentColor}
            label="tokens consumed"
          />
        </div>
      </div>
    </SceneFrame>
  );
};

const TerminalChrome: React.FC = () => (
  <div
    style={{
      display: "flex",
      gap: 6,
      padding: "12px 14px",
      borderBottom: `1px solid ${CARD_BORDER}`,
      backgroundColor: "#0a0e13",
    }}
  >
    {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
      <div
        key={c}
        style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c }}
      />
    ))}
  </div>
);

// ----------------------------------------------------------------------------
// Scene 2 — Code (syntax-highlighted typewriter + keyword highlight slide-in)
// ----------------------------------------------------------------------------

const CodeScene: React.FC<{ scene: Scene; payload: CodePayload }> = ({
  scene,
  payload,
}) => {
  const frame = useCurrentFrame();

  // Type lines top-to-bottom. Compute visible chars across all lines.
  const typeStart = 18;
  const typeEnd = scene.durationFrames - 100; // leave room for highlight + hold
  const totalChars = payload.lines.reduce((sum, l) => sum + l.length + 1, 0);
  const visibleChars = computeVisibleChars(frame, typeStart, typeEnd, totalChars);

  // Determine which lines are visible (and how much)
  const visibleLines: { text: string; complete: boolean }[] = [];
  let consumed = 0;
  for (const line of payload.lines) {
    const lineLen = line.length + 1;
    if (consumed + lineLen <= visibleChars) {
      visibleLines.push({ text: line, complete: true });
      consumed += lineLen;
    } else {
      const remaining = visibleChars - consumed;
      if (remaining > 0) {
        visibleLines.push({ text: line.slice(0, remaining), complete: false });
      }
      break;
    }
  }

  // Highlight fires after line 10 (index 9) is fully typed
  const highlightTriggerLine = 9;
  const highlightLineStartChar = payload.lines
    .slice(0, highlightTriggerLine)
    .reduce((sum, l) => sum + l.length + 1, 0);
  const highlightLineEndChar =
    highlightLineStartChar + payload.lines[highlightTriggerLine].length;
  const lineFinishedFrame = interpolate(
    highlightLineEndChar,
    [0, totalChars],
    [typeStart, typeEnd]
  );

  return (
    <SceneFrame scene={scene}>
      <Card accent={scene.accentColor}>
        <div
          style={{
            padding: "12px 18px",
            borderBottom: `1px solid ${CARD_BORDER}`,
            backgroundColor: "#0a0e13",
            fontFamily: JETBRAINS,
            fontSize: 13,
            color: TEXT_MUTED,
          }}
        >
          ▶ ctk · pretool/cache-check.ts
        </div>
        <Highlight
          code={payload.lines.join("\n")}
          language={payload.lang}
          theme={themes.vsDark}
        >
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre
              style={{
                margin: 0,
                padding: 24,
                fontFamily: JETBRAINS,
                fontSize: 22,
                lineHeight: 1.55,
                background: "transparent",
              }}
            >
              {tokens.map((line, lineIdx) => {
                const visibleLine = visibleLines[lineIdx];
                if (!visibleLine) {
                  return (
                    <div key={lineIdx} style={{ minHeight: "1.55em", opacity: 0 }}>
                      {" "}
                    </div>
                  );
                }

                const isActive = !visibleLine.complete;
                const charsToShow = visibleLine.text.length;

                // Render tokens up to charsToShow
                let charsConsumed = 0;
                const renderedTokens: React.ReactNode[] = [];

                for (let tokenIdx = 0; tokenIdx < line.length; tokenIdx++) {
                  const token = line[tokenIdx];
                  const tokenLen = token.content.length;
                  if (charsConsumed >= charsToShow) break;
                  const remaining = charsToShow - charsConsumed;
                  const slicedContent = token.content.slice(0, remaining);
                  const props = getTokenProps({ token });
                  renderedTokens.push(
                    <span
                      key={tokenIdx}
                      {...props}
                      style={{ ...props.style }}
                    >
                      {slicedContent}
                    </span>
                  );
                  charsConsumed += tokenLen;
                }

                // For line 10 (highlightTriggerLine): wrap "intercept" with KeywordHighlight
                const isHighlightLine = lineIdx === highlightTriggerLine;

                const lineProps = getLineProps({ line });
                return (
                  <div
                    key={lineIdx}
                    {...lineProps}
                    style={{
                      ...lineProps.style,
                      minHeight: "1.55em",
                      position: "relative",
                    }}
                  >
                    {isHighlightLine && visibleLine.complete ? (
                      <HighlightedLine
                        line={line}
                        getTokenProps={getTokenProps}
                        keyword={payload.highlightWord}
                        accent={scene.accentColor}
                        triggerFrame={lineFinishedFrame}
                      />
                    ) : (
                      <>
                        {renderedTokens}
                        {isActive && <Cursor visible color={TEXT} />}
                      </>
                    )}
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>
      </Card>
    </SceneFrame>
  );
};

// Renders the "intercept" line with a highlighter-pen background-position animation
// over the keyword. Slides in (background-position 100% → 0%), does NOT fade in.
const HighlightedLine: React.FC<{
  line: { content: string; types: string[] }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTokenProps: (input: { token: { content: string; types: string[] } }) => any;
  keyword: string;
  accent: string;
  triggerFrame: number;
}> = ({ line, getTokenProps, keyword, accent, triggerFrame }) => {
  const frame = useCurrentFrame();
  // Slide highlight IN over 20 frames after triggerFrame.
  // Width-based "highlighter pen" — unambiguous slide-in (vs background-position
  // which depends on gradient angle and is hard to reason about). Same visual.
  const widthPercent = interpolate(
    frame,
    [triggerFrame, triggerFrame + 20],
    [0, 100],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }
  );

  return (
    <>
      {line.map((token, i) => {
        const props = getTokenProps({ token });
        const containsKeyword = token.content.includes(keyword);
        if (!containsKeyword) {
          return (
            <span key={i} {...props} style={props.style}>
              {token.content}
            </span>
          );
        }
        // Wrap the keyword with the animated highlighter pen — a bar of
        // colored ink that grows from 0% to 100% width behind the text.
        const parts = token.content.split(keyword);
        return (
          <React.Fragment key={i}>
            <span {...props} style={props.style}>
              {parts[0]}
            </span>
            <span
              style={{
                position: "relative",
                display: "inline-block",
                padding: "0 4px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: `${accent}55`,
                  width: `${widthPercent}%`,
                  borderRadius: 3,
                  transformOrigin: "left",
                }}
              />
              <span
                {...props}
                style={{
                  ...props.style,
                  position: "relative",
                  color: TEXT,
                  fontWeight: 700,
                }}
              >
                {keyword}
              </span>
            </span>
            {parts[1] && (
              <span {...props} style={props.style}>
                {parts[1]}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

// ----------------------------------------------------------------------------
// Scene 3 — Split-screen HERO (both sides stream simultaneously)
// ----------------------------------------------------------------------------

const SplitScreenScene: React.FC<{ scene: Scene; payload: SplitScreenPayload }> = ({
  scene,
  payload,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Both sides stream over the same frame range, ending ≥90 frames before scene ends
  const streamStart = 24;
  const streamEnd = scene.durationFrames - 110; // 110 frames hold for hero (≥90 required)

  // LEFT side: full content streaming
  const leftTotalChars = payload.left.contentLines.reduce(
    (sum, l) => sum + l.length + 1,
    0
  );
  const leftVisible = computeVisibleChars(
    frame,
    streamStart,
    streamEnd,
    leftTotalChars
  );
  const leftLines: { text: string; complete: boolean }[] = [];
  let lConsumed = 0;
  for (const line of payload.left.contentLines) {
    const lineLen = line.length + 1;
    if (lConsumed + lineLen <= leftVisible) {
      leftLines.push({ text: line, complete: true });
      lConsumed += lineLen;
    } else {
      const remaining = leftVisible - lConsumed;
      if (remaining > 0)
        leftLines.push({ text: line.slice(0, remaining), complete: false });
      break;
    }
  }

  // RIGHT side: diff streaming
  const rightTotalChars = payload.right.diffLines.reduce(
    (sum, l) => sum + l.length + 1,
    0
  );
  const rightVisible = computeVisibleChars(
    frame,
    streamStart,
    streamEnd,
    rightTotalChars
  );
  const rightLines: { text: string; complete: boolean }[] = [];
  let rConsumed = 0;
  for (const line of payload.right.diffLines) {
    const lineLen = line.length + 1;
    if (rConsumed + lineLen <= rightVisible) {
      rightLines.push({ text: line, complete: true });
      rConsumed += lineLen;
    } else {
      const remaining = rightVisible - rConsumed;
      if (remaining > 0)
        rightLines.push({ text: line.slice(0, remaining), complete: false });
      break;
    }
  }

  // Big "98% fewer tokens" callout springs in after both streams settle
  const calloutFrame = streamEnd + 30;
  const calloutSpring = spring({
    frame: Math.max(0, frame - calloutFrame),
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const calloutOpacity = interpolate(calloutSpring, [0, 1], [0, 1]);
  const calloutScale = interpolate(calloutSpring, [0, 1], [0.85, 1]);

  return (
    <SceneFrame scene={scene}>
      <div
        style={{
          display: "flex",
          gap: 24,
          flex: 1,
          minHeight: 0,
          position: "relative",
        }}
      >
        {/* LEFT — without delta-cache */}
        <SplitSide
          label={payload.left.label}
          sublabel={payload.left.sublabel}
          accent="#f85149"
          lines={leftLines}
          tokenStart={streamStart}
          tokenEnd={streamEnd}
          tokenFinal={payload.left.tokenCount}
        />

        {/* DIVIDING LINE in hero gold */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 2,
            background: `linear-gradient(180deg, transparent, ${scene.accentColor}, transparent)`,
            transform: "translateX(-1px)",
            opacity: 0.7,
          }}
        />

        {/* RIGHT — with delta-cache (diff) */}
        <SplitSide
          label={payload.right.label}
          sublabel={payload.right.sublabel}
          accent={scene.accentColor}
          lines={rightLines}
          tokenStart={streamStart}
          tokenEnd={streamEnd}
          tokenFinal={payload.right.tokenCount}
          isDiff
        />

        {/* CALLOUT */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${calloutScale})`,
            opacity: calloutOpacity,
            backgroundColor: BG,
            border: `2px solid ${scene.accentColor}`,
            borderRadius: 14,
            padding: "20px 32px",
            boxShadow: `0 0 48px ${scene.accentColor}55, 0 16px 48px rgba(0,0,0,0.6)`,
            textAlign: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: scene.accentColor,
              fontFamily: JETBRAINS,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: -1,
              lineHeight: 1,
            }}
          >
            98% fewer
          </div>
          <div
            style={{
              fontSize: 14,
              color: TEXT_MUTED,
              marginTop: 6,
              fontFamily: INTER,
              letterSpacing: 1.4,
              textTransform: "uppercase",
            }}
          >
            tokens per redundant Read
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};

const SplitSide: React.FC<{
  label: string;
  sublabel: string;
  accent: string;
  lines: { text: string; complete: boolean }[];
  tokenStart: number;
  tokenEnd: number;
  tokenFinal: number;
  isDiff?: boolean;
}> = ({ label, sublabel, accent, lines, tokenStart, tokenEnd, tokenFinal, isDiff }) => {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: accent,
              fontFamily: INTER,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              borderBottom: `2px solid ${accent}`,
              paddingBottom: 6,
              marginBottom: 6,
              display: "inline-block",
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 13, color: TEXT_MUTED, fontFamily: INTER }}>
            {sublabel}
          </div>
        </div>
        <TokenCounter
          startFrame={tokenStart}
          endFrame={tokenEnd}
          finalValue={tokenFinal}
          accent={accent}
        />
      </div>

      <Card accent={accent} flex>
        <div
          style={{
            padding: 20,
            fontFamily: JETBRAINS,
            fontSize: 18,
            lineHeight: 1.55,
            flex: 1,
            overflow: "hidden",
          }}
        >
          {lines.map((line, i) => {
            const isAddition = isDiff && line.text.startsWith("+");
            const isRemoval = isDiff && line.text.startsWith("-");
            const isHunkHeader = isDiff && line.text.startsWith("@@");
            const color = isAddition
              ? "#3fb950"
              : isRemoval
                ? "#f85149"
                : isHunkHeader
                  ? "#a371f7"
                  : TEXT;
            const bg = isAddition
              ? "rgba(63,185,80,0.12)"
              : isRemoval
                ? "rgba(248,81,73,0.12)"
                : "transparent";
            return (
              <div
                key={i}
                style={{
                  color,
                  backgroundColor: bg,
                  minHeight: "1.55em",
                  whiteSpace: "pre",
                  paddingLeft: bg !== "transparent" ? 6 : 0,
                  paddingRight: bg !== "transparent" ? 6 : 0,
                  marginLeft: bg !== "transparent" ? -6 : 0,
                  marginRight: bg !== "transparent" ? -6 : 0,
                  fontWeight: isHunkHeader ? 600 : 400,
                }}
              >
                {line.text || " "}
                {!line.complete && i === lines.length - 1 && (
                  <Cursor visible color={color} />
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Scene 4 — Panel (per-word stagger headline + subline fade-in)
// ----------------------------------------------------------------------------

const PanelScene: React.FC<{ scene: Scene; payload: PanelPayload }> = ({
  scene,
  payload,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = payload.headline.split(" ");
  const wordStagger = 4; // frames between words
  const headlineStartFrame = 18;
  const lastWordLandsFrame = headlineStartFrame + (words.length - 1) * wordStagger + 18;

  // Subline fades in 15 frames AFTER the last word lands
  const sublineStart = lastWordLandsFrame + 15;
  const sublineOpacity = interpolate(
    frame,
    [sublineStart, sublineStart + 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <SceneFrame scene={scene}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            letterSpacing: -2,
            color: TEXT,
            lineHeight: 1.1,
            fontFamily: INTER,
            maxWidth: 1400,
          }}
        >
          {words.map((word, i) => {
            const wordFrame = headlineStartFrame + i * wordStagger;
            const ws = spring({
              frame: Math.max(0, frame - wordFrame),
              fps,
              config: { damping: 12, stiffness: 100 },
            });
            const opacity = interpolate(ws, [0, 1], [0, 1]);
            const y = interpolate(ws, [0, 1], [16, 0]);
            const isPercent = word.includes("95%");
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity,
                  transform: `translateY(${y}px)`,
                  marginRight: "0.34em",
                  color: isPercent ? scene.accentColor : TEXT,
                  fontSize: isPercent ? 100 : undefined,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 22,
            color: TEXT_MUTED,
            opacity: sublineOpacity,
            fontFamily: INTER,
            letterSpacing: 0.2,
          }}
        >
          {payload.subline}
        </div>
      </div>
    </SceneFrame>
  );
};

// ----------------------------------------------------------------------------
// Card primitive
// ----------------------------------------------------------------------------

const Card: React.FC<{
  accent: string;
  children: React.ReactNode;
  flex?: boolean;
}> = ({ accent, children, flex }) => {
  return (
    <div
      style={{
        backgroundColor: CARD_BG,
        border: `${CARD_BORDER_WIDTH}px solid ${CARD_BORDER}`,
        borderRadius: CARD_RADIUS,
        overflow: "hidden",
        boxShadow: `0 0 0 1px ${accent}22, 0 12px 32px rgba(0,0,0,0.4)`,
        flex: flex ? 1 : undefined,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
};
