import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "../../catalog";

// Slammed-in rotated stamp (DENIED, ALLOWED, FULL FILE, etc.). Used as the
// `stamp` output variant in concrete-flow scenes. Designed to feel decisive:
// scale 1.6→1 + rotate -20°→-8° in ~12 frames.
export const Stamp: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  sub?: string;
  color: string;
  icon: string;
  startFrame: number;
}> = ({ x, y, width, height, text, sub, color, icon, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 12, stiffness: 140 },
  });
  const scale = interpolate(sp, [0, 1], [1.6, 1]);
  const rotate = interpolate(sp, [0, 1], [-20, -8]);
  const op = interpolate(frame, [startFrame, startFrame + 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: op,
      }}
    >
      <div
        style={{
          padding: "24px 48px",
          borderRadius: 14,
          border: `6px double ${color}`,
          background: `${color}18`,
          boxShadow: `0 0 60px ${color}60`,
          transform: `scale(${scale}) rotate(${rotate}deg)`,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 54, lineHeight: 1 }}>{icon}</div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            color,
            letterSpacing: 4,
            marginTop: 8,
            textTransform: "uppercase",
          }}
        >
          {text}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 20,
              color: COLORS.muted,
              fontStyle: "italic",
              marginTop: 6,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
};
