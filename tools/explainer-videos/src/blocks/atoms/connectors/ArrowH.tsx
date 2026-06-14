import { interpolate, useCurrentFrame } from "remotion";
import { W, H } from "../../catalog";

// Horizontal arrow that draws left-to-right between two x-coordinates.
// `arrowId` must be unique within the SVG to avoid marker-id collisions
// when multiple ArrowH render in the same scene.
export const ArrowH: React.FC<{
  fromX: number;
  toX: number;
  y: number;
  color: string;
  arrowId: string;
  startFrame: number;
  durationFrames?: number;
  strokeWidth?: number;
}> = ({
  fromX,
  toX,
  y,
  color,
  arrowId,
  startFrame,
  durationFrames = 18,
  strokeWidth = 4,
}) => {
  const frame = useCurrentFrame();
  const draw = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  return (
    <svg
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      width={W}
      height={H}
    >
      <defs>
        <marker
          id={arrowId}
          markerWidth={12}
          markerHeight={12}
          refX={10}
          refY={6}
          orient="auto"
        >
          <path d="M 0 0 L 12 6 L 0 12 z" fill={color} />
        </marker>
      </defs>
      <line
        x1={fromX}
        y1={y}
        x2={fromX + (toX - fromX) * draw}
        y2={y}
        stroke={color}
        strokeWidth={strokeWidth}
        markerEnd={draw > 0.95 ? `url(#${arrowId})` : undefined}
      />
    </svg>
  );
};
