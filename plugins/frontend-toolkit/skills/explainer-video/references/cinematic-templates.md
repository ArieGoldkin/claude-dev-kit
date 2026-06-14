# Cinematic templates

Opinionated visual moves the skill picks per phase. Without these, every phase looks like every other phase, the brain stops noticing motion, and the video reads as boring even when the content is correct.

**Hard rule**: each video has exactly ONE *hero phase* — the one moment that earns elevated cinematic treatment. Mark it in the YAML spec with `hero: true`. Every other phase uses standard treatment.

## Why this exists

Without intentional visual variety, our default composition (phase strip + body panel) repeats unchanged across all N phases. That structural monotony is the load-bearing reason early renders felt boring. The fix is two layers:

1. **Vary the body** across phases — mix `terminal`, `code`, `diagram`, `panel` (covered in the pattern reference's "visual variety rule").
2. **Elevate ONE phase** — the hero. The viewer's attention budget is finite; spend it on the punchline.

## When to use which template

Pick exactly one template per video for the hero phase. The other phases stay on the default visual_style treatment.

| Template | Best fit | Avoid when |
|---|---|---|
| **Hero zoom** | Punchline reveal — content scales up while siblings fade to backdrop. The "this is the magic" moment. | The phase is just enumeration |
| **Split-screen comparison** | Contrasting two states (plugin tree vs shared tree, before vs after, valid vs invalid) | The two halves aren't visually balanced |
| **Progressive pan** | Long sequences (terminal output, multi-file diff, agent fan-out) — camera moves across content | The content fits on one screen |
| **Spotlight** | One element matters; siblings dim to ~20% opacity. Good for "Agent #10 specifically" moments | Nothing actually deserves singular focus |
| **Stack reveal** | N enumerated items appearing in sequence with elastic spring drop-in | Items don't naturally enumerate |

## Template snippets

These are guidance shapes — adapt to the specific YAML spec at use time.

### Hero zoom

```tsx
const HeroPhase: React.FC<{phase: Phase}> = ({phase}) => {
  const frame = useCurrentFrame();
  const scale = spring({
    frame: Math.max(0, frame - 12),
    fps: 30,
    config: { damping: 18, stiffness: 110, mass: 0.7 },
    from: 1,
    to: 1.18,  // 18% scale-up
  });
  const siblingOpacity = interpolate(frame, [12, 30], [1, 0.2], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center', /* hero content */ }}>
        {/* the payload — typically a diagram or single visual element */}
      </div>
      <div style={{ opacity: siblingOpacity, /* phase strip + footer dim */ }}>
        {/* siblings */}
      </div>
    </AbsoluteFill>
  );
};
```

### Split-screen comparison

```tsx
const SplitScreen: React.FC<{left: JSX.Element, right: JSX.Element}> = ({left, right}) => {
  const frame = useCurrentFrame();
  const split = interpolate(frame, [0, 24], [0, 50], { extrapolateRight: 'clamp' }); // left half grows from 0% to 50%
  return (
    <AbsoluteFill style={{ display: 'flex' }}>
      <div style={{ width: `${split}%`, overflow: 'hidden' }}>{left}</div>
      <div style={{ width: `${100 - split}%`, overflow: 'hidden' }}>{right}</div>
    </AbsoluteFill>
  );
};
```

### Progressive pan

```tsx
const ProgressivePan: React.FC<{contentWidth: number}> = ({contentWidth}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const panX = interpolate(frame, [0, 240], [0, -(contentWidth - width)], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <div style={{ transform: `translateX(${panX}px)`, width: contentWidth }}>
        {/* wide content — terminal output, full diff, etc. */}
      </div>
    </AbsoluteFill>
  );
};
```

### Spotlight

```tsx
const Spotlight: React.FC<{focusedIdx: number, items: Item[]}> = ({focusedIdx, items}) => {
  const frame = useCurrentFrame();
  const focusOpacity = interpolate(frame, [0, 24], [1, 1]); // stays 1
  const dimOpacity = interpolate(frame, [12, 36], [1, 0.2], { extrapolateRight: 'clamp' });
  const focusScale = spring({ frame, fps: 30, from: 1, to: 1.08 });
  return (
    <>{items.map((item, i) => (
      <div key={i} style={{
        opacity: i === focusedIdx ? focusOpacity : dimOpacity,
        transform: i === focusedIdx ? `scale(${focusScale})` : 'scale(1)',
      }}>{item.render()}</div>
    ))}</>
  );
};
```

### Stack reveal

```tsx
const StackReveal: React.FC<{items: string[]}> = ({items}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.map((item, i) => {
        const delay = 18 + i * 14;
        const opacity = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: 'clamp' });
        const y = spring({
          frame: Math.max(0, frame - delay),
          fps: 30,
          config: { damping: 14, stiffness: 100 },
          from: -20,
          to: 0,
        });
        return <div key={i} style={{ opacity, transform: `translateY(${y}px)` }}>{item}</div>;
      })}
    </div>
  );
};
```

## What NOT to combine

- Two cinematic templates in the same video — pick ONE hero. Multiple "punchlines" mean the viewer doesn't know what to remember.
- Hero zoom + progressive pan — they fight each other (scale-up meets translate). Camera does one thing per phase.
- Spotlight + stack reveal — the spotlight's dimming kills the stack's enumerate-and-celebrate read.
- Any cinematic template + dense text. The hero phase should be ≤ 7 words on screen. If you can't reduce the text, the phase isn't a hero candidate.

## Picking the hero phase

The hero is the phase that:

- Carries the *insight* the viewer should remember after closing the video
- Has natural visual content (a diagram beats a code block beats a terminal block)
- Is in the middle third of the video (frames 30-70% — the payoff moment, not the intro or outro)

For an `/etk:review-mr` 8-phase explainer, the hero is Phase 5 (the 10-agent fan-out — the "many parallel reviewers" moment). For a Lambda topology architecture, the hero is the data-flow animation phase, not the static-services phase. Pick the moment, not the longest phase.

## Defaults if no hero is marked

If the YAML spec has no `hero: true`, pick the median-duration phase in the middle third and apply hero zoom by default. Do NOT cinematically elevate every phase — that defeats the purpose.
