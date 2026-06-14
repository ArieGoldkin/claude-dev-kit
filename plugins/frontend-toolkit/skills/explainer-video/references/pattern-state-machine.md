# Pattern: state-machine

Animate a finite state machine — states as nodes, transitions as edges, walk through scenarios that visit states in sequence, highlight invalid transitions.

**When to use**: the user wants to explain a state-and-transition graph (lifecycle, FSM, workflow with branching) and walk through specific scenarios across it.

**When NOT to use**: if the focus is structural without scenarios (use `architecture`) or per-actor messaging (use `sequence-diagram`).

## YAML schema

```yaml
title: "Member Lifecycle"                     # required
subtitle: "onboarding → engagement → cancelled"  # optional
duration_seconds: 60                          # optional, default 60
fps: 30                                       # optional, default 30

states:                                       # required (≥2 entries)
  - id: onboarding
    label: "onboarding"
    description: "First 30 days; Sparks not yet active"
    position: { x: 200, y: 400 }
  - id: early_engagement
    label: "early_engagement"
    description: "Sparks active; coach assigned"
    position: { x: 600, y: 400 }
  - id: engagement
    label: "engagement"
    description: "Steady-state member"
    position: { x: 1000, y: 400 }
  - id: cancelled
    label: "cancelled"
    description: "Terminal — Cognito user disabled"
    position: { x: 1400, y: 400 }

transitions:                                  # required (≥1 entry)
  - id: t1
    from: onboarding
    to: early_engagement
    trigger: "30 days elapsed"
    valid: true
  - id: t2
    from: early_engagement
    to: engagement
    trigger: "first cycle complete"
    valid: true
  - id: t3
    from: engagement
    to: cancelled
    trigger: "carrier event: cancelled"
    valid: true
  - id: t_invalid_1
    from: cancelled
    to: engagement
    trigger: "(any)"
    valid: false                              # rendered with shake + red color
  # ... more transitions

scenarios:                                    # optional, at least one recommended
  - id: happy_path
    name: "Happy path"
    sequence: [onboarding, early_engagement, engagement]
  - id: cancellation
    name: "Cancellation flow"
    sequence: [engagement, cancelled]
  - id: invalid_revival
    name: "Attempted revival of cancelled member"
    sequence: [cancelled, engagement]         # final transition is invalid → triggers shake
```

## Required fields validation

Reject specs missing: `title`, `states` (≥2), `transitions` (≥1), or transitions referencing states not in the states list. Reject scenarios that step through a sequence of states without a corresponding transition (every consecutive pair in `sequence` must have a defined transition, valid or invalid).

## Component template

```tsx
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring } from 'remotion';

export const StateMachineComposition: React.FC<{spec: StateMachineSpec}> = ({spec}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{backgroundColor: '#0e1116', color: '#e6edf3', fontFamily: 'system-ui'}}>
      <Title text={spec.title} subtitle={spec.subtitle} />

      {/* Static layer: all states + valid transitions, dim */}
      {spec.states.map(state => <StateNode key={state.id} state={state} dim />)}
      {spec.transitions.filter(t => t.valid).map(t => <TransitionEdge key={t.id} transition={t} dim />)}

      {/* Active layer: scenario walkthroughs */}
      {spec.scenarios?.map((scenario, idx) => {
        const scenarioStartFrame = idx * (spec.duration_seconds * spec.fps / spec.scenarios.length);
        const scenarioDuration = (spec.duration_seconds * spec.fps) / spec.scenarios.length;
        return (
          <Sequence key={scenario.id} from={scenarioStartFrame} durationInFrames={scenarioDuration}>
            <ScenarioWalkthrough scenario={scenario} states={spec.states} transitions={spec.transitions} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
```

`ScenarioWalkthrough` highlights states in `scenario.sequence` order, animating a "current state" indicator from one to the next. For each consecutive pair, look up the transition: if `valid`, animate the edge highlight (interpolate stroke-width + color); if `invalid`, trigger a shake on the destination state via `spring()`-driven X offset and color the attempted edge red.

## Visual conventions

- **States as rounded rectangles** with label + (optional) description below.
- **Current state** highlighted via accent color border + subtle scale-up via `spring()`.
- **Valid transitions** as solid arrows with label on the edge.
- **Invalid transition attempts** rendered as red dashed arrow with the destination state shaking briefly (X position interpolated with `spring()` damping=2).
- **Terminal states** (states with no outgoing valid transitions) marked with a doubled border.

## Worked example

`assets/example-state-machine-member-lifecycle.yaml` shows the member lifecycle FSM with four scenarios including an invalid cancelled→engagement attempt. The invalid scenario is the visual highlight — it makes the immutability rule concrete.
