# Pattern: sequence-diagram

Animate a sequence diagram — actors as columns, messages as arrows revealing in time order, lifelines as vertical lines, return arrows distinguishable from request arrows.

**When to use**: the user wants to show multiple parties exchanging messages with explicit time ordering (request/response flows, distributed system message exchange, swimlane diagrams).

**When NOT to use**: if there's only one "actor" (use `flow-pipeline`) or the focus is structural (use `architecture`).

## YAML schema

```yaml
title: "MR Creation Flow"                     # required
subtitle: "Developer → glab → GitLab → CI → Reviewer"  # optional
duration_seconds: 45                          # optional, default 45
fps: 30                                       # optional, default 30

actors:                                       # required (≥2 entries)
  - id: developer
    label: "Developer"
    column: 0                                 # 0-indexed left-to-right
  - id: glab
    label: "glab CLI"
    column: 1
  - id: gitlab
    label: "GitLab API"
    column: 2
  - id: ci
    label: "CI Pipeline"
    column: 3
  - id: reviewer
    label: "Reviewer"
    column: 4

messages:                                     # required (≥1 entry)
  - id: m1
    from: developer
    to: glab
    label: "glab mr create --title ..."
    type: sync                                # one of: sync | async | response
    time_frame: 0                             # frame at which message appears
  - id: m2
    from: glab
    to: gitlab
    label: "POST /merge_requests"
    type: sync
    time_frame: 60
  - id: m3
    from: gitlab
    to: ci
    label: "trigger pipeline (event)"
    type: async
    time_frame: 150
  - id: m4
    from: ci
    to: gitlab
    label: "report status"
    type: response
    time_frame: 600
  # ... more messages

narration:                                    # optional
  - segment: "The developer runs glab mr create."
    start_frame: 0
  - segment: "glab POSTs to GitLab's merge_requests endpoint."
    start_frame: 60
```

## Required fields validation

Reject specs missing: `title`, `actors` (≥2), `messages` (≥1), or messages whose `from` / `to` reference an actor not in the actors list. Reject if `time_frame` values aren't monotonically non-decreasing (sequence ordering must be explicit).

## Component template

```tsx
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

export const SequenceDiagramComposition: React.FC<{spec: SequenceSpec}> = ({spec}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{backgroundColor: '#0e1116', color: '#e6edf3', fontFamily: 'system-ui'}}>
      <Title text={spec.title} subtitle={spec.subtitle} />

      {/* Actor columns at top */}
      {spec.actors.map(actor => (
        <ActorHeader key={actor.id} actor={actor} />
      ))}

      {/* Lifeline vertical lines */}
      {spec.actors.map(actor => (
        <Lifeline key={actor.id} column={actor.column} />
      ))}

      {/* Messages animate in by time_frame */}
      {spec.messages.map(msg => {
        const opacity = interpolate(frame, [msg.time_frame, msg.time_frame + 15], [0, 1], {extrapolateRight: 'clamp'});
        const drawProgress = interpolate(frame, [msg.time_frame, msg.time_frame + 30], [0, 1], {extrapolateRight: 'clamp'});
        return (
          <MessageArrow
            key={msg.id}
            from={columnX(msg.from, spec.actors)}
            to={columnX(msg.to, spec.actors)}
            yOffset={msg.time_frame * 1.5}
            type={msg.type}
            label={msg.label}
            opacity={opacity}
            drawProgress={drawProgress}
          />
        );
      })}

      {spec.narration && <NarrationOverlay segments={spec.narration} fps={spec.fps} />}
    </AbsoluteFill>
  );
};
```

`ActorHeader` renders the label at the top of each column. `Lifeline` is a thin dashed vertical line down the canvas. `MessageArrow` is an SVG path with arrowhead, drawn left-to-right or right-to-left between two columns at the message's `yOffset`.

## Visual conventions

- **Actor columns** evenly spaced across the canvas width; column index multiplied by `canvasWidth / numActors` gives the X.
- **Lifelines** thin (1-2px) dashed vertical lines from below the header to bottom of canvas.
- **Message arrows**: solid for `sync`, dashed for `async`, lighter color + arrow-toward-sender for `response`.
- **Y-position**: `time_frame` directly maps to a Y offset so message ordering is visually obvious.
- **Active periods** (when an actor is "doing work") shown as a thicker rectangle on the lifeline. Optional but recommended for clarity.

## Worked example

`assets/example-sequence-mr-creation.yaml` shows the MR creation actor flow (Developer → glab → GitLab → CI → Reviewer). Use as starting point for any actor-based message flow.
