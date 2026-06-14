import { COLORS, W, H } from "../../catalog";

export type BgKind = "grid" | "dots" | "diagonal" | "none";

// Subtle backdrop variants drawn behind every scene at 4% opacity. Picking
// a different kind per-spec is a low-cost variety lever — videos feel less
// cookie-cutter without changing scene structure or palette.
export const BgPattern: React.FC<{ kind?: BgKind }> = ({ kind = "grid" }) => {
  if (kind === "none") return null;

  return (
    <svg
      style={{ position: "absolute", inset: 0, opacity: 0.04 }}
      width={W}
      height={H}
    >
      <defs>
        {kind === "grid" && (
          <pattern
            id="bg-pattern"
            width={48}
            height={48}
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke={COLORS.neutral}
              strokeWidth={0.5}
            />
          </pattern>
        )}
        {kind === "dots" && (
          <pattern
            id="bg-pattern"
            width={36}
            height={36}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={2} cy={2} r={1.5} fill={COLORS.neutral} />
          </pattern>
        )}
        {kind === "diagonal" && (
          <pattern
            id="bg-pattern"
            width={28}
            height={28}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={28}
              stroke={COLORS.neutral}
              strokeWidth={1}
            />
          </pattern>
        )}
      </defs>
      <rect width={W} height={H} fill="url(#bg-pattern)" />
    </svg>
  );
};
