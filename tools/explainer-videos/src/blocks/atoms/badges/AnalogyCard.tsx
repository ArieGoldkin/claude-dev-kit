import { COLORS } from "../../catalog";

// Used in intro scenes — emoji + small caps label + big role text.
// Slides in from one side via dx prop owned by the parent preset.
export const AnalogyCard: React.FC<{
  label: string;
  role: string;
  icon: string;
  color: string;
  dx: number;
  opacity: number;
}> = ({ label, role, icon, color, dx, opacity }) => (
  <div
    style={{
      width: 480,
      padding: "48px 40px",
      borderRadius: 18,
      background: COLORS.bgSurface,
      border: `3px solid ${color}`,
      boxShadow: `0 12px 60px ${color}30`,
      textAlign: "center",
      transform: `translateX(${dx}px)`,
      opacity,
    }}
  >
    <div style={{ fontSize: 80, marginBottom: 16 }}>{icon}</div>
    <div
      style={{
        fontSize: 22,
        color: COLORS.muted,
        fontWeight: 600,
        letterSpacing: 2,
        marginBottom: 8,
      }}
    >
      {label}
    </div>
    <div
      style={{ fontSize: 44, fontWeight: 800, color, letterSpacing: 0.5 }}
    >
      {role}
    </div>
  </div>
);
