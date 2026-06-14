import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "../../catalog";

// Center column of a concrete-flow scene. Big icon + title + optional sub.
// Stronger glow than Card to draw the eye to the "actor" doing the work
// (SECURITY, CUSTOMS, delta-cache, etc.).
export const ActionBox: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  sub?: string;
  icon: string;
  color: string;
  startFrame: number;
}> = ({ x, y, width, height, title, sub, icon, color, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const scale = interpolate(sp, [0, 1], [0.85, 1]);
  const op = interpolate(frame, [startFrame, startFrame + 18], [0, 1], {
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
        transform: `scale(${scale})`,
        opacity: op,
        borderRadius: 18,
        background: COLORS.bgSurface,
        border: `3px solid ${color}`,
        boxShadow: `0 12px 60px ${color}40`,
        padding: "24px 28px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 80 }}>{icon}</div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 800,
          color,
          letterSpacing: 0.5,
        }}
      >
        {title}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 22,
            color: COLORS.muted,
            fontStyle: "italic",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
};
