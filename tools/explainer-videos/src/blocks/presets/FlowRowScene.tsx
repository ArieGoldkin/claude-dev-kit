import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { W, type SceneFlowRow } from "../catalog";
import {
  ArrowH,
  Card,
  SceneNarration,
  SceneTitle,
  useSceneFade,
} from "../atoms";

// N boxes in a row, arrows draw between consecutive boxes after both
// endpoint boxes have appeared. Box width / gap / row Y are constants —
// future variant could parametrize them but the current uniformity helps
// videos read consistently across topics.
export const FlowRowScene: React.FC<{ scene: SceneFlowRow }> = ({
  scene,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useSceneFade(scene.durationFrames);

  const n = scene.boxes.length;
  const boxWidth = 440;
  const gap = 90;
  const totalWidth = n * boxWidth + (n - 1) * gap;
  const startX = (W - totalWidth) / 2;
  const boxY = 320;
  const boxHeight = 360;

  return (
    <AbsoluteFill style={{ opacity }}>
      <SceneTitle text={scene.title} accent={scene.accent} />

      {scene.boxes.slice(0, -1).map((_, i) => {
        const fromX = startX + (i + 1) * boxWidth + i * gap;
        const toX = fromX + gap;
        const arrowY = boxY + boxHeight / 2;
        return (
          <ArrowH
            key={`arrow-${i}`}
            fromX={fromX}
            toX={toX}
            y={arrowY}
            color={scene.accent}
            arrowId={`arrow-${scene.id}-${i}`}
            startFrame={12 * (i + 2) + 12}
          />
        );
      })}

      {scene.boxes.map((box, i) => {
        const x = startX + i * (boxWidth + gap);
        const start = 12 * (i + 1);
        const sp = spring({
          frame: Math.max(0, frame - start),
          fps,
          config: { damping: 18, stiffness: 90 },
        });
        const scale = interpolate(sp, [0, 1], [0.85, 1]);
        const boxOpacity = interpolate(
          frame,
          [start, start + 18],
          [0, 1],
          { extrapolateRight: "clamp" },
        );
        return (
          <Card
            key={i}
            x={x}
            y={boxY}
            width={boxWidth}
            height={boxHeight}
            title={box.title}
            sub={box.sub}
            bullets={box.bullets}
            color={box.color}
            scale={scale}
            opacity={boxOpacity}
          />
        );
      })}

      <SceneNarration text={scene.narration} />
    </AbsoluteFill>
  );
};
