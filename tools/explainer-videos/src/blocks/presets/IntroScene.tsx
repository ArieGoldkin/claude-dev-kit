import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, SANS, type SceneIntro } from "../catalog";
import { AnalogyCard, SceneNarration, useSceneFade } from "../atoms";

// Title + subtitle on top, two analogy cards sliding in from each side.
// Used as the opening scene of every block-style explainer video.
export const IntroScene: React.FC<{ scene: SceneIntro }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useSceneFade(scene.durationFrames);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 56,
          fontWeight: 800,
          color: "#e6edf3",
          letterSpacing: -0.5,
        }}
      >
        {scene.title}
      </div>
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 28,
          color: COLORS.muted,
          letterSpacing: 0.3,
        }}
      >
        {scene.subtitle}
      </div>
      <div
        style={{
          position: "absolute",
          top: 360,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 80,
        }}
      >
        {scene.cards.map((card, i) => {
          const dx = interpolate(
            spring({
              frame: Math.max(0, frame - 12 * (i + 1)),
              fps,
              config: { damping: 18, stiffness: 80 },
            }),
            [0, 1],
            [i === 0 ? -120 : 120, 0],
          );
          const cardOpacity = interpolate(
            frame,
            [12 * (i + 1), 12 * (i + 1) + 18],
            [0, 1],
            { extrapolateRight: "clamp" },
          );
          return (
            <AnalogyCard
              key={card.label}
              label={card.label}
              role={card.role}
              icon={card.icon}
              color={card.color}
              dx={dx}
              opacity={cardOpacity}
            />
          );
        })}
      </div>
      <SceneNarration text={scene.narration} />
    </AbsoluteFill>
  );
};
