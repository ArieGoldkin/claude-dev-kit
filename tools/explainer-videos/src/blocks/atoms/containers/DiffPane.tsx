import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, MONO, type DiffLine } from "../../catalog";

// Git-style red/green diff lines stagger in left-to-right (one every 10 frames).
// `removed` lines render red, `added` green, `context` muted gray.
// Used as the `diff` output variant in concrete-flow scenes (delta-cache).
export const DiffPane: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  lines: DiffLine[];
  startFrame: number;
}> = ({ x, y, width, height, label, lines, startFrame }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        borderRadius: 18,
        background: COLORS.bgSurface,
        border: `3px solid ${COLORS.pre}`,
        boxShadow: `0 12px 48px ${COLORS.pre}25`,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: 18,
          color: COLORS.muted,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          background: COLORS.bgRaised,
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontFamily: MONO,
          fontSize: 18,
          overflow: "hidden",
        }}
      >
        {lines.map((l, i) => {
          const start = startFrame + i * 10;
          const op = interpolate(frame, [start, start + 16], [0, 1], {
            extrapolateRight: "clamp",
          });
          const dx = interpolate(
            frame,
            [start, start + 16],
            [-12, 0],
            { extrapolateRight: "clamp" },
          );
          let color: string;
          let bg: string;
          if (l.kind === "added") {
            color = COLORS.pre;
            bg = `${COLORS.pre}18`;
          } else if (l.kind === "removed") {
            color = COLORS.danger;
            bg = `${COLORS.danger}18`;
          } else {
            color = COLORS.muted;
            bg = "transparent";
          }
          return (
            <div
              key={i}
              style={{
                color,
                background: bg,
                padding: "4px 10px",
                borderRadius: 4,
                fontWeight: l.kind === "context" ? 400 : 600,
                opacity: op,
                transform: `translateX(${dx}px)`,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {l.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};
