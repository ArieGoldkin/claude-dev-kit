import "./index.css";
import { Composition } from "remotion";
import { HooksArchitecturePipeline } from "./HooksArchitecturePipeline";
import { hooksArchitectureSpec } from "./specs/hooks-architecture";
import { DevelopPipeline } from "./DevelopPipeline";
import { developPipelineSpec } from "./specs/develop-pipeline";
import { ReviewMrWorkflow } from "./ReviewMrWorkflow";
import {
  reviewMrSpec,
  totalFrames as reviewMrTotalFrames,
} from "./specs/review-mr-workflow";
import { DeltaCacheFlow } from "./DeltaCacheFlow";
import { DeltaCacheExplainer } from "./DeltaCacheExplainer";
import {
  deltaCacheSpec,
  totalFrames as deltaCacheTotalFrames,
} from "./specs/delta-cache";
import { HooksBlockExplainer } from "./HooksBlockExplainer";
import {
  hooksBlocksSpec,
  totalFrames as hooksBlocksTotalFrames,
} from "./specs/hooks-blocks";
import { DeltaCacheBlockExplainer } from "./DeltaCacheBlockExplainer";
import {
  deltaCacheBlocksSpec,
  totalFrames as deltaCacheBlocksTotalFrames,
} from "./specs/delta-cache-blocks";
import { TitleCardSmoke } from "./TitleCardSmoke";
import { titleCardSmokeSpec } from "./specs/title-card-smoke";
import { totalFrames as blocksTotalFrames } from "./blocks/catalog";
import { VideoClipSmoke } from "./VideoClipSmoke";
import { videoClipSmokeSpec } from "./specs/video-clip-smoke";
import { DevelopWorkflow } from "./DevelopWorkflow";
import {
  developWorkflowSpec,
  totalFrames as developWorkflowTotalFrames,
} from "./specs/develop-workflow";

const HOOKS_TOTAL_FRAMES = hooksArchitectureSpec.phases.reduce(
  (sum, p) => sum + p.durationFrames,
  0,
);
const DEVELOP_TOTAL_FRAMES = developPipelineSpec.phases.reduce(
  (sum, p) => sum + p.durationFrames,
  0,
);
const REVIEW_MR_TOTAL_FRAMES = reviewMrTotalFrames(reviewMrSpec);
const DELTA_CACHE_TOTAL_FRAMES = deltaCacheTotalFrames(deltaCacheSpec.scenes);
const HOOKS_BLOCKS_TOTAL_FRAMES = hooksBlocksTotalFrames(hooksBlocksSpec);
const DELTA_CACHE_BLOCKS_TOTAL_FRAMES = deltaCacheBlocksTotalFrames(deltaCacheBlocksSpec);
const TITLE_CARD_SMOKE_TOTAL_FRAMES = blocksTotalFrames(titleCardSmokeSpec);
const VIDEO_CLIP_SMOKE_TOTAL_FRAMES = blocksTotalFrames(videoClipSmokeSpec);
const DEVELOP_WORKFLOW_TOTAL_FRAMES = developWorkflowTotalFrames(developWorkflowSpec);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HooksArchitecturePipeline"
        component={HooksArchitecturePipeline}
        durationInFrames={HOOKS_TOTAL_FRAMES}
        fps={hooksArchitectureSpec.fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="DevelopPipeline"
        component={DevelopPipeline}
        durationInFrames={DEVELOP_TOTAL_FRAMES}
        fps={developPipelineSpec.fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="ReviewMrWorkflow"
        component={ReviewMrWorkflow}
        durationInFrames={REVIEW_MR_TOTAL_FRAMES}
        fps={reviewMrSpec.fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="DeltaCacheFlow"
        component={DeltaCacheFlow}
        durationInFrames={DELTA_CACHE_TOTAL_FRAMES}
        fps={deltaCacheSpec.fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="DeltaCacheExplainer"
        component={DeltaCacheExplainer}
        durationInFrames={DELTA_CACHE_TOTAL_FRAMES}
        fps={deltaCacheSpec.fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="HooksBlockExplainer"
        component={HooksBlockExplainer}
        durationInFrames={HOOKS_BLOCKS_TOTAL_FRAMES}
        fps={hooksBlocksSpec.fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="DeltaCacheBlockExplainer"
        component={DeltaCacheBlockExplainer}
        durationInFrames={DELTA_CACHE_BLOCKS_TOTAL_FRAMES}
        fps={deltaCacheBlocksSpec.fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="TitleCardSmoke"
        component={TitleCardSmoke}
        durationInFrames={TITLE_CARD_SMOKE_TOTAL_FRAMES}
        fps={titleCardSmokeSpec.fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="VideoClipSmoke"
        component={VideoClipSmoke}
        durationInFrames={VIDEO_CLIP_SMOKE_TOTAL_FRAMES}
        fps={videoClipSmokeSpec.fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="DevelopWorkflow"
        component={DevelopWorkflow}
        durationInFrames={DEVELOP_WORKFLOW_TOTAL_FRAMES}
        fps={developWorkflowSpec.fps}
        width={1920}
        height={1080}
      />
    </>
  );
};
