import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { H, W, type SceneFanOut } from "../catalog";
import {
  Card,
  PluginBadge,
  SceneNarration,
  SceneTitle,
  useSceneFade,
} from "../atoms";

// One source Card up top, N target PluginBadges below, dashed arrows fan
// out from the source's bottom edge. Arrows stagger 6 frames apart so the
// fan reads as a sequential broadcast rather than a single explosion.
//
// Fan arrows render inline as SVG (not yet an atom — would extract to an
// ArrowFan atom in a follow-up if a second preset needs the same shape).
export const FanOutScene: React.FC<{ scene: SceneFanOut }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useSceneFade(scene.durationFrames);

  const sourceX = W / 2 - 360;
  const sourceY = 220;
  const sourceW = 720;
  const sourceH = 240;

  const targetsTop = sourceY + sourceH + 160;
  const n = scene.targets.length;
  const targetW = n <= 7 ? 220 : 180;
  const targetGap = 20;
  const targetsWidth = n * targetW + (n - 1) * targetGap;
  const targetsStartX = (W - targetsWidth) / 2;

  const sourceSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const sourceScale = interpolate(sourceSpring, [0, 1], [0.85, 1]);
  const sourceOp = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <SceneTitle text={scene.title} accent={scene.accent} />

      <Card
        x={sourceX}
        y={sourceY}
        width={sourceW}
        height={sourceH}
        title={scene.source.title}
        sub={scene.source.sub}
        bullets={scene.source.bullets}
        color={scene.accent}
        scale={sourceScale}
        opacity={sourceOp}
      />

      <svg
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        width={W}
        height={H}
      >
        {scene.targets.map((t, i) => {
          const tx = targetsStartX + i * (targetW + targetGap) + targetW / 2;
          const ty = targetsTop;
          const arrowStart = 36 + i * 6;
          const draw = interpolate(
            frame,
            [arrowStart, arrowStart + 18],
            [0, 1],
            { extrapolateRight: "clamp" },
          );
          const fromX = sourceX + sourceW / 2;
          const fromY = sourceY + sourceH;
          const dx = tx - fromX;
          const dy = ty - fromY;
          return (
            <g key={i}>
              <defs>
                <marker
                  id={`fan-arrow-${i}`}
                  markerWidth={10}
                  markerHeight={10}
                  refX={8}
                  refY={5}
                  orient="auto"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={t.color} />
                </marker>
              </defs>
              <line
                x1={fromX}
                y1={fromY}
                x2={fromX + dx * draw}
                y2={fromY + dy * draw}
                stroke={t.color}
                strokeWidth={2.5}
                strokeDasharray="6 6"
                opacity={0.8}
                markerEnd={draw > 0.95 ? `url(#fan-arrow-${i})` : undefined}
              />
            </g>
          );
        })}
      </svg>

      {scene.targets.map((t, i) => {
        const x = targetsStartX + i * (targetW + targetGap);
        const start = 36 + i * 6 + 6;
        const op = interpolate(frame, [start, start + 18], [0, 1], {
          extrapolateRight: "clamp",
        });
        const sp = spring({
          frame: Math.max(0, frame - start),
          fps,
          config: { damping: 16, stiffness: 110 },
        });
        const scale = interpolate(sp, [0, 1], [0.8, 1]);
        return (
          <PluginBadge
            key={i}
            x={x}
            y={targetsTop}
            width={targetW}
            label={t.label}
            color={t.color}
            scale={scale}
            opacity={op}
          />
        );
      })}

      <SceneNarration text={scene.narration} />
    </AbsoluteFill>
  );
};
