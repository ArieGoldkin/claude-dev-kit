# Pattern: flow-pipeline

Animate a multi-phase process unfolding in time — each phase becomes a sequenced segment, transitions between phases use camera/highlight motion, current-phase indicator pins the viewer's attention.

**When to use**: the user wants to walk through a process where time is the dominant axis (a CI/CD pipeline, a multi-step workflow, a phased review process).

**When NOT to use**: if the dominant axis is structure (use `architecture`) or per-actor messaging (use `sequence-diagram`).

## YAML schema

```yaml
title: "/etk:review-mr — 8-Phase Pipeline"   # required
subtitle: "Generic review plugin that knows your project's rules"  # optional
duration_seconds: 90                          # optional, default 90
fps: 30                                       # optional, default 30

phases:                                       # required (≥2 entries)
  - id: phase_0
    name: "Phase 0: Mode Policy"
    description: "Detect MR mode"             # ≤15 words; longer text moves to narration
    duration_frames: 240                      # 8s @ 30fps MINIMUM per slop-avoidance.md
    visual_style: "panel"                     # panel | code | terminal | diagram
    accent_color: "#79c0ff"
    hero: false                               # exactly ONE phase per video sets this true
  - id: phase_1
    name: "Phase 1: MR + Ticket Fetch"
    description: "Pull diff + linked ticket"
    duration_frames: 270
    visual_style: "terminal"                  # MUST differ from prior phase's style
    accent_color: "#a371f7"
  # ... more phases — exactly one gets hero: true
  - id: phase_5
    name: "Phase 5: Agent Fan-out"
    description: "10 reviewers in parallel"
    duration_frames: 540                      # hero earns extra time (≥10s)
    visual_style: "diagram"
    accent_color: "#f0b049"
    hero: true                                # ★ the punchline phase

narration_script:                             # optional
  - phase_id: phase_0
    text: "The pipeline starts by reading the merge request's metadata..."
  - phase_id: phase_1
    text: "Phase 1 fetches the MR diff and the linked ticket..."
  # ... one entry per phase, or per-segment within a phase
```

## Required fields validation

Reject specs missing: `title`, `phases` (≥2), or any `phase.duration_frames`. Sum of `duration_frames` should equal `duration_seconds * fps` ± 30 frames. Warn if narration_script references a `phase_id` not in the phases list.

## Visual-variety rule (load-bearing — see `slop-avoidance.md`)

**No two consecutive phases may share the same `visual_style`.** Mix `panel` / `code` / `terminal` / `diagram` across the video. Phase 0 panel + Phase 1 panel + Phase 2 panel renders as flat slideshow; Phase 0 panel + Phase 1 terminal + Phase 2 diagram has visual rhythm.

If the user-provided spec violates this rule, propose a fix before rendering — don't auto-correct silently. Examples:

- "All phases use `panel` — try alternating with `code` for phases that show actual code, `terminal` for phases that show shell output, `diagram` for the architecture phase."
- "Phases 3 and 4 both use `code`; consider making Phase 4 a `diagram` since it's about file structure."

## Hero phase rule (load-bearing — see `cinematic-templates.md`)

**Exactly ONE phase per video has `hero: true`.** That phase gets cinematic-template treatment (zoom / split-screen / progressive-pan / spotlight / stack-reveal — pick one per video). Every other phase uses standard treatment.

If no phase is marked hero, default to the median-duration phase in the middle third (frames 30%-70% of total) and apply hero zoom. Do NOT cinematically elevate every phase.

Hero phase budget: ≥ 300 frames (10 seconds at 30fps). Cinematic moves need time to land.

The hero is the phase that carries the *insight the viewer should remember*. For a `/etk:review-mr` 8-phase explainer, the hero is Phase 5 (the 10-agent fan-out — the "many parallel reviewers" moment), not Phase 0 (mode policy). Pick the moment, not the longest phase.

## Component template

```tsx
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring } from 'remotion';

export const FlowPipelineComposition: React.FC<{spec: FlowSpec}> = ({spec}) => {
  let cumulativeFrame = 0;

  return (
    <AbsoluteFill style={{backgroundColor: '#0e1116', color: '#e6edf3', fontFamily: 'system-ui'}}>
      <Title text={spec.title} subtitle={spec.subtitle} />
      <PhaseStrip phases={spec.phases} currentFrame={useCurrentFrame()} cumulativeFrames={cumulativeFramesArray(spec.phases)} />

      {spec.phases.map((phase, i) => {
        const startFrame = cumulativeFrame;
        cumulativeFrame += phase.duration_frames;
        return (
          <Sequence key={phase.id} from={startFrame} durationInFrames={phase.duration_frames}>
            <PhasePanel phase={phase} />
          </Sequence>
        );
      })}

      {spec.narration_script && <NarrationOverlay script={spec.narration_script} fps={spec.fps} />}
    </AbsoluteFill>
  );
};
```

`PhaseStrip` is a horizontal indicator bar at the top showing all N phases with the current one highlighted (use `interpolate` to slide the highlight, or `spring()` for elastic motion). `PhasePanel` switches based on `visual_style`:

- `panel`: a card with name, description, animated bullet reveals
- `code`: an animated code reveal (use `<CodeReveal>` from your project's components or build with `interpolate` over character ranges)
- `terminal`: a faux-terminal showing typed output, line-by-line
- `diagram`: a small SVG/ASCII diagram with sequenced reveals

## Visual conventions

- **Phase strip at top** with N pills, current pill highlighted via `accent_color` and a subtle `spring()`-driven scale-up.
- **Body panel transitions** via `interpolate` cross-fade (NOT CSS transition) over 15 frames.
- **Narration captions** in a lower-third, also `interpolate`-driven opacity.
- **Phase number + name** stays visible throughout each phase to anchor the viewer.

## Worked example

`assets/example-flow-review-mr.yaml` renders the `/etk:review-mr` 8-phase pipeline (Phase 0 dial-setting → Phase 7 logbook), the canonical example for this pattern. Use it as a starting point and adapt phase content + narration for any other multi-phase process (e.g., `/etk:develop` 6 phases, OHAOI debugging loop).
