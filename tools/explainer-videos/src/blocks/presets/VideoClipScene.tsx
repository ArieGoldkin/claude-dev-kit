import { AbsoluteFill } from "remotion";
import type { SceneVideoClip } from "../catalog";
import { SceneNarration, useSceneFade, VideoClip } from "../atoms";

// Embeds a video from public/ with a hold-then-zoom framing. Optional
// narration overlay along the bottom edge. Used for the "play recording,
// hold, zoom" middle section of announcement videos.
export const VideoClipScene: React.FC<{ scene: SceneVideoClip }> = ({
  scene,
}) => {
  const opacity = useSceneFade(scene.durationFrames);

  return (
    <AbsoluteFill style={{ opacity }}>
      <VideoClip
        src={scene.src}
        startFraming={scene.startFraming}
        endFraming={scene.endFraming}
        holdAtStartFrames={scene.holdAtStartFrames ?? 0}
        startFromSeconds={scene.startFromSeconds ?? 0}
        audio={scene.audio ?? false}
        fit={scene.fit ?? "cover"}
        position={scene.position ?? "top"}
      />
      {scene.narration && <SceneNarration text={scene.narration} />}
    </AbsoluteFill>
  );
};
