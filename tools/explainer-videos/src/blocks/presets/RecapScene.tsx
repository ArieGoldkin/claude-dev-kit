import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, SANS, type SceneRecap } from "../catalog";
import { SceneNarration, SceneTitle, useSceneFade } from "../atoms";

// Closing scene: two summary cards slide in from each side, then the
// footnote callout fades+scales in over the top at frame 60.
//
// Recap cards render inline (not the same shape as Card atom — they have
// a different bullet style + larger text). Future: extract as
// `RecapCard` atom if a second preset needs the same shape.
export const RecapScene: React.FC<{ scene: SceneRecap }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useSceneFade(scene.durationFrames);

  return (
    <AbsoluteFill style={{ opacity }}>
      <SceneTitle text={scene.title} accent={COLORS.warn} />

      <div
        style={{
          position: "absolute",
          top: 220,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 60,
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
          const op = interpolate(
            frame,
            [12 * (i + 1), 12 * (i + 1) + 18],
            [0, 1],
            { extrapolateRight: "clamp" },
          );
          return (
            <div
              key={i}
              style={{
                width: 720,
                padding: "40px 48px",
                borderRadius: 18,
                background: COLORS.bgSurface,
                border: `3px solid ${card.color}`,
                boxShadow: `0 12px 48px ${card.color}25`,
                transform: `translateX(${dx}px)`,
                opacity: op,
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: card.color,
                  marginBottom: 24,
                  letterSpacing: 0.5,
                }}
              >
                {card.title}
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {card.bullets.map((b, j) => (
                  <li
                    key={j}
                    style={{
                      fontSize: 26,
                      color: "#e6edf3",
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={{ color: card.color, fontWeight: 700 }}>
                      ✓
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <Footnote text={scene.footnote} />

      <SceneNarration text={scene.narration} />
    </AbsoluteFill>
  );
};

// Big gold-colored recap line that scales and fades in at frame 60.
const Footnote: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const startFn = 60;
  const op = interpolate(frame, [startFn, startFn + 24], [0, 1], {
    extrapolateRight: "clamp",
  });
  const sp = spring({
    frame: Math.max(0, frame - startFn),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const scale = interpolate(sp, [0, 1], [0.9, 1]);
  return (
    <div
      style={{
        position: "absolute",
        top: 720,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: SANS,
        fontSize: 56,
        fontWeight: 800,
        color: COLORS.warn,
        letterSpacing: 0.5,
        transform: `scale(${scale})`,
        opacity: op,
      }}
    >
      {text}
    </div>
  );
};
