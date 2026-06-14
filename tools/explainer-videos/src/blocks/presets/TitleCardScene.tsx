import { AbsoluteFill } from "remotion";
import { COLORS, SANS, type SceneTitleCard } from "../catalog";
import {
  SceneNarration,
  Typewriter,
  typewriterFrames,
  useSceneFade,
} from "../atoms";

// Two-line title card with sequential typewriter reveal. Line 1 types from
// frame 0; line 2 starts after line 1 finishes + gapFrames. Both lines hold
// for holdFrames after the second finishes.
//
// Used for announcement-style intros and outros (e.g. "X is now available"
// then "with feature Y"). For richer openings with analogy cards, use
// IntroScene instead.
export const TitleCardScene: React.FC<{ scene: SceneTitleCard }> = ({
  scene,
}) => {
  const opacity = useSceneFade(scene.durationFrames);
  const cpf = scene.charsPerFrame ?? 1;
  const gap = scene.gapFrames ?? 12;
  const line1Frames = typewriterFrames(scene.line1, cpf);
  const line2Start = line1Frames + gap;

  const line1Color = scene.line1Accent ?? "#e6edf3";
  const line2Color = scene.line2Accent ?? COLORS.muted;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 32,
          fontFamily: SANS,
          padding: "0 120px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            letterSpacing: -1,
            color: line1Color,
            lineHeight: 1.1,
          }}
        >
          <Typewriter
            text={scene.line1}
            startFrame={0}
            charsPerFrame={cpf}
            showCursor
            cursorColor={line1Color}
          />
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 500,
            letterSpacing: -0.3,
            color: line2Color,
            lineHeight: 1.2,
          }}
        >
          <Typewriter
            text={scene.line2}
            startFrame={line2Start}
            charsPerFrame={cpf}
            showCursor
            cursorBlinkAfterDone
            cursorColor={line2Color}
          />
        </div>
      </div>
      {scene.narration && <SceneNarration text={scene.narration} />}
    </AbsoluteFill>
  );
};
