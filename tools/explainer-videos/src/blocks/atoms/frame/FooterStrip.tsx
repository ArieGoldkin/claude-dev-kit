import { COLORS, MONO } from "../../catalog";

// Small attribution strip in the bottom-right corner. The text comes from
// the spec's `footer` field (defaults to "claude-dev-kit" in BlockExplainer).
export const FooterStrip: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      bottom: 16,
      right: 32,
      fontFamily: MONO,
      fontSize: 14,
      color: COLORS.muted,
      letterSpacing: 1.2,
    }}
  >
    {text}
  </div>
);
