import { BlockExplainer } from "./BlockExplainer";
import { videoClipSmokeSpec } from "./specs/video-clip-smoke";

export const VideoClipSmoke: React.FC = () => (
  <BlockExplainer spec={videoClipSmokeSpec} />
);
