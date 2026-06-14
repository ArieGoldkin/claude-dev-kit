# Pattern: architecture

Animate a system architecture diagram — services as nodes, connections as edges, sequenced reveals to walk the viewer through the structure.

**When to use**: the user wants to explain a system's shape (services, components, infrastructure topology) and how they connect. Time-of-day or per-event flow is secondary.

**When NOT to use**: if the dominant axis is time (use `flow-pipeline`) or per-actor messaging (use `sequence-diagram`).

## YAML schema

```yaml
title: "Event-Driven Lambda Topology"           # required
subtitle: "43 services, event-driven"        # optional
duration_seconds: 60                          # optional, default 60
fps: 30                                       # optional, default 30

services:                                     # required (≥2 entries)
  - id: api_gateway
    label: "API Gateway"
    role: "ingress"                          # optional, used for color/icon mapping
    position: { x: 100, y: 200 }            # required, in 1920×1080 canvas coords
  - id: lifecycle_lambda
    label: "lifecycle-stage-handler"
    role: "lambda"
    position: { x: 600, y: 200 }
  # ... more services

connections:                                  # required (≥1 entry)
  - from: api_gateway
    to: lifecycle_lambda
    type: sync                                # one of: sync | async | event
    label: "POST /lifecycle"                 # optional
  # ... more connections

reveal_order:                                 # optional. If absent, reveal in YAML order.
  - [api_gateway]                            # group 0: appears at frame 0
  - [lifecycle_lambda, sf_sync_lambda]       # group 1: appears together
  - [api_gateway → lifecycle_lambda]         # group 2: connection animates
  # ... up to N groups, total spread across duration

narration:                                    # optional
  - segment: "Requests enter via API Gateway."
    start_seconds: 0
  - segment: "API Gateway routes to the lifecycle handler."
    start_seconds: 6
  # ... aligned to reveal groups
```

## Required fields validation

Reject specs missing: `title`, `services` (≥2), `connections` (≥1), or any service referenced in `connections` that isn't defined in `services`. Surface ALL validation errors in one pass — don't drip-feed.

## Component template

This is the architecture composition shape. Adapt names + props to match the project. **Do not copy verbatim** — the official Remotion skill at `remotion-dev/skills` has the canonical primitives; use those.

```tsx
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from 'remotion';

export const ArchitectureComposition: React.FC<{spec: ArchitectureSpec}> = ({spec}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{backgroundColor: '#0e1116', color: '#e6edf3', fontFamily: 'system-ui'}}>
      <Title text={spec.title} subtitle={spec.subtitle} />

      {spec.services.map((svc, i) => {
        const revealFrame = revealFrameFor(svc.id, spec.reveal_order, spec.duration_seconds * spec.fps);
        const opacity = interpolate(frame, [revealFrame, revealFrame + 15], [0, 1], {extrapolateRight: 'clamp'});
        return (
          <ServiceNode key={svc.id} service={svc} opacity={opacity} />
        );
      })}

      {spec.connections.map((conn, i) => {
        const revealFrame = revealFrameFor(`${conn.from}→${conn.to}`, spec.reveal_order, ...);
        const drawProgress = interpolate(frame, [revealFrame, revealFrame + 30], [0, 1], {extrapolateRight: 'clamp'});
        return (
          <ConnectionEdge key={i} from={posOf(conn.from)} to={posOf(conn.to)} type={conn.type} progress={drawProgress} />
        );
      })}

      {spec.narration && <NarrationOverlay segments={spec.narration} fps={spec.fps} />}
    </AbsoluteFill>
  );
};
```

`ServiceNode` is an absolutely-positioned card with an icon hint by `role` and a fade-in via `opacity`. `ConnectionEdge` is an SVG path drawn with `stroke-dasharray` and `stroke-dashoffset` interpolated by `progress`. `NarrationOverlay` shows current segment text in a lower-third.

## Visual conventions

- **Background**: dark (`#0e1116`) by default; user can override per-spec.
- **Service cards**: rounded rectangles, role-coloured border (ingress=blue, lambda=purple, db=green, queue=orange, external=gray).
- **Connection edges**: solid for `sync`, dashed for `async`, dotted-with-arrowhead for `event`. Animate stroke-dashoffset for the "draw" effect.
- **Reveal animation**: services fade in over 15 frames (~0.5s @ 30fps), edges draw in over 30 frames (~1s).

## Worked example

`assets/example-architecture-event-lambdas.yaml` shows the 43-Lambda topology grouped into reveal stages: ingress → core handlers → integrations → data plane. Use it as both starting point and validation oracle.
