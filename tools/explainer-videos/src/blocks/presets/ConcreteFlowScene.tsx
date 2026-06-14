import { AbsoluteFill } from "remotion";
import { W, type ConcreteOutput, type SceneConcreteFlow } from "../catalog";
import {
  ActionBox,
  ArrowH,
  CodeBox,
  DiffPane,
  NoteList,
  SceneNarration,
  SceneTitle,
  Stamp,
  useSceneFade,
} from "../atoms";

// Three-column layout: input (left) → action (middle) → output (right).
// Output kind dispatches to one of four atoms (stamp, code, diff, notes).
// Animation timeline is fixed: input @ 0, arrow1 @ 12, action @ 24,
// arrow2 @ 42, output @ 54 frames.
export const ConcreteFlowScene: React.FC<{ scene: SceneConcreteFlow }> = ({
  scene,
}) => {
  const opacity = useSceneFade(scene.durationFrames);

  const colWidth = 480;
  const gap = 80;
  const totalWidth = 3 * colWidth + 2 * gap;
  const startX = (W - totalWidth) / 2;
  const boxY = 320;
  const boxHeight = 320;

  const inputX = startX;
  const actionX = startX + colWidth + gap;
  const outputX = startX + 2 * (colWidth + gap);

  const T_INPUT = 0;
  const T_ARROW1 = 12;
  const T_ACTION = 24;
  const T_ARROW2 = 42;
  const T_OUTPUT = 54;

  return (
    <AbsoluteFill style={{ opacity }}>
      <SceneTitle text={scene.title} accent={scene.accent} />

      <ArrowH
        fromX={inputX + colWidth}
        toX={actionX}
        y={boxY + boxHeight / 2}
        color={scene.action.color}
        arrowId={`cf-arrow1-${scene.id}`}
        startFrame={T_ARROW1}
      />
      <ArrowH
        fromX={actionX + colWidth}
        toX={outputX}
        y={boxY + boxHeight / 2}
        color={scene.accent}
        arrowId={`cf-arrow2-${scene.id}`}
        startFrame={T_ARROW2}
      />

      <CodeBox
        x={inputX}
        y={boxY}
        width={colWidth}
        height={boxHeight}
        label={scene.input.label}
        value={scene.input.value}
        color={scene.input.color}
        startFrame={T_INPUT}
      />

      <ActionBox
        x={actionX}
        y={boxY}
        width={colWidth}
        height={boxHeight}
        title={scene.action.title}
        sub={scene.action.sub}
        icon={scene.action.icon}
        color={scene.action.color}
        startFrame={T_ACTION}
      />

      <OutputArea
        x={outputX}
        y={boxY}
        width={colWidth}
        height={boxHeight}
        output={scene.output}
        startFrame={T_OUTPUT}
      />

      <SceneNarration text={scene.narration} />
    </AbsoluteFill>
  );
};

// Routes a ConcreteOutput to the right atom. Internal to this preset.
const OutputArea: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  output: ConcreteOutput;
  startFrame: number;
}> = ({ x, y, width, height, output, startFrame }) => {
  if (output.kind === "stamp") {
    return (
      <Stamp
        x={x}
        y={y}
        width={width}
        height={height}
        text={output.text}
        sub={output.sub}
        color={output.color}
        icon={output.icon}
        startFrame={startFrame}
      />
    );
  }
  if (output.kind === "code") {
    return (
      <CodeBox
        x={x}
        y={y}
        width={width}
        height={height}
        label={output.label || "RESULT"}
        value={output.value}
        color={output.color}
        startFrame={startFrame}
        springConfig={{ damping: 14, stiffness: 110 }}
      />
    );
  }
  if (output.kind === "diff") {
    return (
      <DiffPane
        x={x}
        y={y}
        width={width}
        height={height}
        label={output.label || "DIFF"}
        lines={output.lines}
        startFrame={startFrame}
      />
    );
  }
  return (
    <NoteList
      x={x}
      y={y}
      width={width}
      height={height}
      notes={output.notes}
      startFrame={startFrame}
    />
  );
};
