import { COLORS, MONO } from "../../catalog";

// Small rectangular badge used as a fan-out target.
// Renders a single label centered (e.g., "ctk", "*.spec.ts").
export const PluginBadge: React.FC<{
  x: number;
  y: number;
  width: number;
  label: string;
  color: string;
  scale: number;
  opacity: number;
}> = ({ x, y, width, label, color, scale, opacity }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width,
      height: 100,
      borderRadius: 14,
      background: COLORS.bgSurface,
      border: `3px solid ${color}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: MONO,
      fontSize: width < 200 ? 24 : 30,
      fontWeight: 700,
      color,
      letterSpacing: 0.5,
      boxShadow: `0 8px 32px ${color}30`,
      transform: `scale(${scale})`,
      opacity,
    }}
  >
    {label}
  </div>
);
