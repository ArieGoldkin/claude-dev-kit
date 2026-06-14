import type { BlocksSpec } from "../blocks/catalog";

// Smoke spec for the video-clip scene preset (added in MR2). Plays the
// review-mr-workflow.mp4 from public/, holds the top-aligned full frame
// for 60f (2s @ 30fps), then continuously zooms to 125% focused on the
// top-left over the remainder. Used as the visual regression case for the
// new preset; not part of any shipped video.
export const videoClipSmokeSpec: BlocksSpec = {
  videoTitle: "video-clip smoke",
  videoSubtitle: "internal",
  durationSeconds: 8,
  fps: 30,
  bgPattern: "none",
  scenes: [
    {
      kind: "video-clip",
      id: "embed",
      durationFrames: 240, // 8s @ 30fps
      src: "review-mr-workflow.mp4",
      startFraming: { scale: 1.0, focalX: 0.5, focalY: 0 },
      endFraming: { scale: 1.25, focalX: 0, focalY: 0 },
      holdAtStartFrames: 60, // hold 2s before zoom begins
      startFromSeconds: 0,
      audio: false,
      fit: "cover",
      position: "top",
    },
  ],
};
