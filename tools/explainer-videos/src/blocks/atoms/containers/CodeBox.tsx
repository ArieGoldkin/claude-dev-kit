import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, MONO } from "../../catalog";

// Code-styled value box with a label header. Used as concrete-flow input
// (where the value is the requested action) and as the `code` output variant
// (where the value is the result, e.g. redacted token).
//
// Owns its own entry spring (scale 0.85→1, fade in over 18 frames). The
// `springConfig` prop overrides the default damping/stiffness for callers
// that need a different feel (e.g., output appears with a gentler bounce).
export const CodeBox: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: string;
  color: string;
  startFrame: number;
  springConfig?: { damping: number; stiffness: number };
}> = ({
  x,
  y,
  width,
  height,
  label,
  value,
  color,
  startFrame,
  springConfig = { damping: 18, stiffness: 90 },
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: springConfig,
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
        boxShadow: `0 12px 48px ${color}25`,
        padding: "28px 32px",
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
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <code
          style={{
            fontFamily: MONO,
            fontSize: 32,
            color,
            fontWeight: 700,
            background: COLORS.bgRaised,
            padding: "16px 24px",
            borderRadius: 10,
            border: `1px solid ${COLORS.border}`,
            wordBreak: "break-all",
            textAlign: "center",
          }}
        >
          {value}
        </code>
      </div>
    </div>
  );
};
