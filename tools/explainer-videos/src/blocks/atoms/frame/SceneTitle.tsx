import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SANS } from "../../catalog";

// Top-aligned scene heading. Slides up 16px over the first ~30 frames.
// Color comes from the scene's accent so consecutive scenes feel distinct.
export const SceneTitle: React.FC<{ text: string; accent: string }> = ({
  text,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dy = interpolate(
    spring({ frame, fps, config: { damping: 18, stiffness: 100 } }),
    [0, 1],
    [16, 0],
  );
  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: SANS,
        fontSize: 44,
        fontWeight: 700,
        color: accent,
        letterSpacing: 1,
        textTransform: "uppercase",
        transform: `translateY(${dy}px)`,
      }}
    >
      {text}
    </div>
  );
};
