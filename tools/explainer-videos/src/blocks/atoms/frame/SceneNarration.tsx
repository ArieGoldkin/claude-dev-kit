import { SANS } from "../../catalog";

// Bottom-aligned single-line narration. Caps to 96px horizontal padding so
// long sentences wrap naturally. Used by every preset.
export const SceneNarration: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      bottom: 64,
      left: 0,
      right: 0,
      textAlign: "center",
      fontFamily: SANS,
      fontSize: 36,
      fontWeight: 500,
      color: "#e6edf3",
      letterSpacing: 0.3,
      padding: "0 96px",
    }}
  >
    {text}
  </div>
);
