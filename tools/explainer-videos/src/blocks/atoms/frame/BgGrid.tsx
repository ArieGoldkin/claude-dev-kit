import { COLORS, W, H } from "../../catalog";

// Subtle grid backdrop drawn behind every scene. Renders at 4% opacity
// so it reads as terminal-aesthetic texture, not a foreground element.
export const BgGrid: React.FC = () => (
  <svg
    style={{ position: "absolute", inset: 0, opacity: 0.04 }}
    width={W}
    height={H}
  >
    <defs>
      <pattern id="grid" width={48} height={48} patternUnits="userSpaceOnUse">
        <path
          d="M 48 0 L 0 0 0 48"
          fill="none"
          stroke={COLORS.neutral}
          strokeWidth={0.5}
        />
      </pattern>
    </defs>
    <rect width={W} height={H} fill="url(#grid)" />
  </svg>
);
