import { interpolate, useCurrentFrame } from "remotion";

// Fades a scene in over the first 18 frames and partially out over the last 18.
// Each preset calls this and applies the returned opacity to its outer wrapper.
export const useSceneFade = (durationFrames: number): number => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationFrames - 18, durationFrames],
    [1, 0.2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return Math.min(fadeIn, fadeOut);
};
