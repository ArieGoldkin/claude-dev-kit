import {
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from "remotion";

// Framing = where the camera is in normalized coordinates, plus zoom level.
// scale=1 fills the canvas; scale=1.25 zooms in 25% around (focalX, focalY).
// focal coords are 0..1 with (0, 0) = top-left, (1, 1) = bottom-right.
export type VideoClipFraming = {
  scale: number;
  focalX: number;
  focalY: number;
};

// Plays a video clip from the public/ folder with an interpolated zoom from
// startFraming to endFraming, easing in/out cubic. Holds at startFraming for
// `holdAtStartFrames` before the zoom begins.
//
// Use case: announcement videos that play a recording, hold for a beat, then
// zoom in to highlight a specific region (top-left, center, etc).
export const VideoClip: React.FC<{
  /** Path inside `public/`, e.g. "review-mr-workflow.mp4" */
  src: string;
  startFraming: VideoClipFraming;
  endFraming: VideoClipFraming;
  /** Frames to hold at startFraming before the zoom interpolation begins. */
  holdAtStartFrames?: number;
  /** Seconds offset into the source video to start playing. */
  startFromSeconds?: number;
  /** Defaults to false (muted); embedded audio interferes with narration. */
  audio?: boolean;
  /** Inner objectFit on the underlying <Video>. Defaults to "cover". */
  fit?: "cover" | "contain";
  /** Inner objectPosition on the underlying <Video>. Defaults to "top". */
  position?: string;
}> = ({
  src,
  startFraming,
  endFraming,
  holdAtStartFrames = 0,
  startFromSeconds = 0,
  audio = false,
  fit = "cover",
  position = "top",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const zoomEnd = Math.max(holdAtStartFrames + 1, durationInFrames - 1);
  const t = interpolate(frame, [holdAtStartFrames, zoomEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const scale = interpolate(t, [0, 1], [
    startFraming.scale,
    endFraming.scale,
  ]);
  const focalX = interpolate(t, [0, 1], [
    startFraming.focalX,
    endFraming.focalX,
  ]);
  const focalY = interpolate(t, [0, 1], [
    startFraming.focalY,
    endFraming.focalY,
  ]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: `${focalX * 100}% ${focalY * 100}%`,
          transform: `scale(${scale})`,
        }}
      >
        <Video
          src={staticFile(src)}
          startFrom={Math.floor(startFromSeconds * fps)}
          muted={!audio}
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit,
            objectPosition: position,
          }}
        />
      </div>
    </div>
  );
};
