import { BlockExplainer } from "./BlockExplainer";
import { deltaCacheBlocksSpec } from "./specs/delta-cache-blocks";

export const DeltaCacheBlockExplainer: React.FC = () => (
  <BlockExplainer spec={deltaCacheBlocksSpec} />
);
