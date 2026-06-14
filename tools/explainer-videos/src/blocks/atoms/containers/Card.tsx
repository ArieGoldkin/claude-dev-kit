import { COLORS, MONO } from "../../catalog";

// General-purpose rounded box. Used by flow-row, fan-out source, and recap.
// Optional bullets list shown below sub. Layout positioned absolutely by
// the parent preset (presets compute x/y/scale/opacity for entry animation).
export const Card: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  sub?: string;
  bullets?: string[];
  color: string;
  scale: number;
  opacity: number;
}> = ({ x, y, width, height, title, sub, bullets, color, scale, opacity }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width,
      height,
      transform: `scale(${scale})`,
      transformOrigin: "center center",
      opacity,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 18,
        background: COLORS.bgSurface,
        border: `3px solid ${color}`,
        boxShadow: `0 12px 48px ${color}25`,
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        justifyContent:
          bullets && bullets.length > 0 ? "flex-start" : "center",
      }}
    >
      <div
        style={{
          fontSize: 38,
          fontWeight: 800,
          color,
          letterSpacing: 0.5,
          textAlign: "center",
        }}
      >
        {title}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 22,
            color: COLORS.muted,
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          {sub}
        </div>
      )}
      {bullets && bullets.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "12px 0 0",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {bullets.map((b, i) => (
            <li
              key={i}
              style={{
                fontSize: 22,
                color: COLORS.neutral,
                fontFamily: MONO,
                display: "flex",
                gap: 10,
              }}
            >
              <span style={{ color }}>▸</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);
