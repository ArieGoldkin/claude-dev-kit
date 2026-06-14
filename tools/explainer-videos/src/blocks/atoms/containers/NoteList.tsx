import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, MONO } from "../../catalog";

// Vertical stack of icon+text cards. Notes slide in left-to-right one at a
// time (12-frame stagger). Used as the `notes` output variant for showing
// post-hook feedback bullets.
export const NoteList: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  notes: Array<{ icon: string; text: string; color: string }>;
  startFrame: number;
}> = ({ x, y, width, height, notes, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardHeight = (height - 16 * (notes.length - 1)) / notes.length;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {notes.map((n, i) => {
        const t = startFrame + i * 12;
        const sp = spring({
          frame: Math.max(0, frame - t),
          fps,
          config: { damping: 16, stiffness: 110 },
        });
        const dx = interpolate(sp, [0, 1], [60, 0]);
        const op = interpolate(frame, [t, t + 18], [0, 1], {
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              height: cardHeight,
              borderRadius: 14,
              background: COLORS.bgSurface,
              border: `3px solid ${n.color}`,
              boxShadow: `0 8px 32px ${n.color}25`,
              padding: "12px 24px",
              display: "flex",
              alignItems: "center",
              gap: 20,
              transform: `translateX(${dx}px)`,
              opacity: op,
            }}
          >
            <div style={{ fontSize: 44 }}>{n.icon}</div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 28,
                color: n.color,
                fontWeight: 700,
              }}
            >
              {n.text}
            </div>
          </div>
        );
      })}
    </div>
  );
};
