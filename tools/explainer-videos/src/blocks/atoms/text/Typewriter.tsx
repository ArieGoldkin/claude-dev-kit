import { useCurrentFrame } from "remotion";

// Char-by-char text reveal. Slices the text by computed character index
// based on current frame, returns a span. The parent positions and styles it.
//
// charsPerFrame defaults to 1 (one character per frame at 30fps = ~30 cps).
// startFrame is relative to the parent Sequence (0 = first frame of scene).
//
// Optional blinking cursor (`▌`) shown while typing and continues blinking
// after the last char if `cursorBlinkAfterDone` is true (default false).
export const Typewriter: React.FC<{
  text: string;
  startFrame?: number;
  charsPerFrame?: number;
  showCursor?: boolean;
  cursorBlinkAfterDone?: boolean;
  cursorColor?: string;
  style?: React.CSSProperties;
}> = ({
  text,
  startFrame = 0,
  charsPerFrame = 1,
  showCursor = false,
  cursorBlinkAfterDone = false,
  cursorColor,
  style,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - startFrame);
  const charsShown = Math.min(
    text.length,
    Math.floor(localFrame * charsPerFrame),
  );
  const visible = text.slice(0, charsShown);
  const isTyping = charsShown < text.length;
  const blinkOn = Math.floor(frame / 15) % 2 === 0;
  const renderCursor =
    showCursor && (isTyping || (cursorBlinkAfterDone && blinkOn));

  return (
    <span style={style}>
      {visible}
      {renderCursor && (
        <span
          style={{
            color: cursorColor ?? "currentColor",
            opacity: isTyping ? 1 : blinkOn ? 1 : 0,
            marginLeft: 2,
          }}
        >
          ▌
        </span>
      )}
    </span>
  );
};

// Convenience helper: how many frames does it take to fully type `text`
// at `charsPerFrame`? Used by presets to compute when line2 should start
// and how much hold remains.
export const typewriterFrames = (
  text: string,
  charsPerFrame = 1,
): number => Math.ceil(text.length / charsPerFrame);
