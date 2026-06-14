import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, SANS, type BlocksSpec, type Scene } from "./blocks/catalog";
import { validateSpec } from "./blocks/validateSpec";
import { BgPattern, FooterStrip } from "./blocks/atoms";
import {
  ConcreteFlowScene,
  FanOutScene,
  FlowRowScene,
  IntroScene,
  RecapScene,
  TitleCardScene,
  VideoClipScene,
} from "./blocks/presets";

// =============================================================================
// Generic block-style explainer renderer.
// Takes a BlocksSpec, dispatches each scene to its preset component.
// New explainer videos add a spec file and a thin <BlockExplainer/> wrapper.
// =============================================================================

export const BlockExplainer: React.FC<{ spec: BlocksSpec }> = ({ spec }) => {
  validateSpec(spec);
  return (
  <AbsoluteFill
    style={{
      backgroundColor: COLORS.bgDeep,
      color: COLORS.neutral,
      fontFamily: SANS,
    }}
  >
    <BgPattern kind={spec.bgPattern} />

    {(() => {
      // Compute cumulative startFrame offsets so specs only declare durations.
      let acc = 0;
      return spec.scenes.map((scene) => {
        const from = acc;
        acc += scene.durationFrames;
        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={scene.durationFrames}
          >
            <SceneRouter scene={scene} />
          </Sequence>
        );
      });
    })()}

    <FooterStrip text={spec.footer ?? "claude-dev-kit"} />
  </AbsoluteFill>
  );
};

const SceneRouter: React.FC<{ scene: Scene }> = ({ scene }) => {
  switch (scene.kind) {
    case "intro":
      return <IntroScene scene={scene} />;
    case "flow-row":
      return <FlowRowScene scene={scene} />;
    case "fan-out":
      return <FanOutScene scene={scene} />;
    case "recap":
      return <RecapScene scene={scene} />;
    case "concrete-flow":
      return <ConcreteFlowScene scene={scene} />;
    case "title-card":
      return <TitleCardScene scene={scene} />;
    case "video-clip":
      return <VideoClipScene scene={scene} />;
  }
};
