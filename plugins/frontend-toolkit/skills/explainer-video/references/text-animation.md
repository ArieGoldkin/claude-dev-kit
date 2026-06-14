# Text animation patterns

There is **no canonical Remotion text-animation API**. The `remotion.dev/docs/animating-text` URL returns 404. Patterns are composed from primitives, with conventions captured in the `remotion-dev/skills` repo.

> **Cite this URL** in compositions, not the docs site:
> `https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion/rules/text-animations.md`

This reference covers four patterns we use beyond `interpolate(opacity, ...)`. Apply when descriptions, headlines, code reveals, or keyword emphasis carry the explanation.

## Pattern 1 — Typewriter (string-slice, NOT per-char opacity)

Reveal text character-by-character. The naive implementation maps each character to its own opacity-interpolated `<span>` — wrong. The Remotion-correct path is **string slicing**.

```tsx
const typedText = (text: string, frame: number, charsPerFrame = 0.5) =>
  text.slice(0, Math.floor(frame * charsPerFrame));

// Usage
const visible = typedText(line, frame - startFrame, 0.7);
return <span>{visible}<Cursor visible={frame % 30 < 15} /></span>;
```

**Why**: per-char opacity creates N spans (heavy DOM, poor render perf), and renders all N glyphs eating their layout space immediately — text reflows look broken. String slicing renders only what's visible; layout flows naturally as characters appear.

**Use when**: terminal phases revealing command output line-by-line, code phases revealing a function definition, or any moment where the *act of typing* IS the visual.

**Don't use when**: the line is decorative (use opacity reveal); the user has already read the line and you're showing it again (cut to fully-typed).

## Pattern 2 — Per-word stagger

Headlines and one-line descriptions feel inert when they fade in as a block. Stagger word-by-word with a spring per word for kinetic typography.

```tsx
const Headline: React.FC<{ text: string; startFrame: number }> = ({ text, startFrame }) => {
  const frame = useCurrentFrame();
  return (
    <span>
      {text.split(' ').map((word, i) => {
        const wordFrame = frame - startFrame - i * 3;
        const opacity = interpolate(wordFrame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const y = spring({ frame: Math.max(0, wordFrame), fps: 30, config: { damping: 14, stiffness: 110 }, from: 8, to: 0 });
        return <span key={i} style={{ display: 'inline-block', opacity, transform: `translateY(${y}px)`, marginRight: '0.3em' }}>{word}</span>;
      })}
    </span>
  );
};
```

**Use when**: hero phase title, phase-name reveal, the "punchline" sentence at the end of an explanation.

**Don't use when**: the text is paragraph-length (per-word stagger on a paragraph reads as gimmicky); the text is purely informational (use plain opacity reveal — save the kinetic punch for moments that matter).

## Pattern 3 — Keyword highlighting (animated highlighter pen)

Behind a single emphasized word in a sentence, animate a translucent background sliding from left to right — like a highlighter pen striking through.

```tsx
const Highlighted: React.FC<{ word: string; color: string; startFrame: number }> = ({ word, color, startFrame }) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame - startFrame, [0, 18], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <span style={{ position: 'relative', display: 'inline-block', padding: '0 4px' }}>
      <span style={{
        position: 'absolute', inset: 0, backgroundColor: color, opacity: 0.4,
        width: `${width}%`, transformOrigin: 'left',
      }} />
      <span style={{ position: 'relative' }}>{word}</span>
    </span>
  );
};
```

**Use when**: the description prose has ONE load-bearing word and you want the eye drawn to it without changing the layout.

**Don't use when**: highlighting more than one word in a sentence (visual noise); the word is a code identifier (use code-block emphasis instead).

## Pattern 4 — `<TransitionSeries>` between phases

Replace hard cross-fades between phases with overlapping cinematic transitions.

```tsx
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { fade, slide, wipe } from '@remotion/transitions/fade'; // or /slide, /wipe, /flip, /clock-wipe

<TransitionSeries>
  {phases.map((phase, i) => (
    <React.Fragment key={phase.id}>
      <TransitionSeries.Sequence durationInFrames={phase.durationFrames}>
        <PhaseBody phase={phase} />
      </TransitionSeries.Sequence>
      {i < phases.length - 1 && (
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 } })}
        />
      )}
    </React.Fragment>
  ))}
</TransitionSeries>
```

**Use when**: phase boundaries currently feel slideshow-y. The slow `springTiming({damping: 200})` configuration is what makes it feel cinematic vs choppy.

**Don't use when**: a phase is the hero — hero phases want the abrupt entry to claim attention.

## Quick reference table

| Pattern | Best moment | Cost (LOC) |
|---|---|---|
| Typewriter string-slice | Code/terminal reveal | ~10 |
| Per-word stagger | Headlines, hero punchline | ~15 |
| Keyword highlighting | Sentence with one load-bearing word | ~12 |
| `<TransitionSeries>` between phases | Phase-to-phase boundaries | ~20 |

## Anti-patterns

- **Per-character opacity for typewriter** — see Pattern 1. Wrong.
- **Stagger every line everywhere** — kinetic typography on every text element flattens the visual hierarchy. Pick the moments that matter.
- **CSS @keyframes / `animation-delay` for staggered reveals** — render-broken (see `gotchas.md` rule #1). All staggers must use `interpolate()` / `spring()` keyed off `useCurrentFrame()`.
- **Custom kinetic-typography engines (GSAP SplitText, anime.js)** — pull non-Remotion animation runtimes that fight the deterministic frame model.
