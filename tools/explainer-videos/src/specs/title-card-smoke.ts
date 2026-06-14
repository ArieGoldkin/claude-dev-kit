import type { BlocksSpec } from "../blocks/catalog";

// Smoke spec for the title-card scene preset (added in MR1).
// Two back-to-back title cards. Validates Typewriter atom, line1/line2
// sequencing, hold-after-typing, and the cursor blink. Used as the visual
// regression case for the new preset; not part of any shipped video.
export const titleCardSmokeSpec: BlocksSpec = {
  videoTitle: "title-card smoke",
  videoSubtitle: "internal",
  durationSeconds: 14,
  fps: 30,
  bgPattern: "grid",
  scenes: [
    {
      kind: "title-card",
      id: "card1",
      // line1 = 33 chars / 1 cpf = 33f; gap 12f; line2 = 22 chars = 22f;
      // hold 90f. Total min = 157f. Allocate 210f (7s) for breathing room.
      durationFrames: 210,
      line1: "title-card preset is now ready",
      line2: "with typewriter reveal.",
      line1Accent: "#79c0ff",
      line2Accent: "#c9d1d9",
    },
    {
      kind: "title-card",
      id: "card2",
      // line1 = 25 chars; gap 12f; line2 = 31 chars; hold 90f. Min = 158f.
      // Allocate 210f for symmetry with card1.
      durationFrames: 210,
      line1: "Two lines, sequential.",
      line2: "Hold three seconds, then fade.",
      line1Accent: "#a371f7",
      line2Accent: "#8b949e",
    },
  ],
};
