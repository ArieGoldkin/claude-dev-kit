# Slop avoidance

Rules to keep generated videos from looking like generic AI-produced content. The first render of any composition is the moment slop sneaks in — defaults are the enemy.

## The cardinal rule: text is the enemy

Most boring tech explainers are too dense. The reader's eyes can't track motion AND read paragraph-length descriptions. Pick one:

- **On-screen text**: ≤ 7 words at any given moment. Headlines + one-line callouts. Period.
- **Long-form description**: belongs in narration audio or per-line reveal (one short sentence per beat), never as a paragraph the viewer has to read while motion plays.

If a phase's `description` field is > 15 words, it is too long for direct display. Either:
- Move it to narration (and display a 5-word title only), or
- Break it into N short sentences with `<Sequence>`-staggered reveals (line N appears at frame N×30, etc.), or
- Cut it.

Concretely, our existing `pattern-flow-pipeline.md` `PhaseDescription` component renders the entire `description` string at once. That's a slop trap. **Override**: when a phase's description exceeds 15 words, render only the first 5-7 words as a headline; treat the rest as narration script.

## Timing rules

Short cuts feel cheap. Long cuts breathe.

- **No cut shorter than 60 frames** (2 seconds @ 30fps). Sub-second flashes are visual whiplash; the brain registers "something happened" but not what.
- **Average phase duration ≥ 8 seconds** for explainer content. Faster than that, the viewer can't absorb both visual and text.
- **One full-stop pause per minute** — a frame where motion stops, content holds, the viewer can rest. Without pauses, the video feels relentless.
- **Hero phase budget**: longer than the median (10-15s minimum). The hero earns the time.

## Hook rules — open right, end right

The first 3 seconds decide whether the viewer keeps watching. Two patterns work; one fails reliably.

**Works**:
- Open with what the viewer will *learn* — "In 90 seconds: how a single hook fires across the symlinked monorepo."
- Open with the *punchline visual* — show the most striking diagram element, then back up to "let me show you how this works."

**Fails reliably**:
- "Hi I'm Claude and today we'll explore..."
- A title slide that holds for >2s before the first phase begins
- Generic "Welcome!" / "Let's dive in!" / "Hello everyone!"

**Closing**: the last 3 seconds should restate the takeaway, not credit-roll. "That's how a hook fires — start to deny in low double-digit milliseconds." Then a one-frame end card with the project name. Don't fade to black for 2 seconds with no information.

## Anti-patterns (do not generate these)

| Anti-pattern | Why it's slop | Replacement |
|---|---|---|
| Gratuitous spinning intros | "Looks AI-generated" instantly | Hard cut into Phase 1; no intro animation |
| Stock-music swelling at every cut | Manipulative, ignored after first 10s | Music optional and consistent throughout, not reactive |
| Fake-handwriting text reveals | Cliché; reads as filler | Plain interpolated opacity reveal |
| Generic confetti / particle backdrops | Reads as "celebration template" not "explanation" | Solid dark background; let content carry |
| Centered content on every phase | No visual rhythm; reads as flat | Mix left-aligned, right-aligned, centered across phases |
| Title slide longer than 2 seconds | First-three-seconds bleed | Title overlaps with Phase 1's first frames; fades out by frame 60 |
| Same accent color every phase | Visual monotony | One distinct accent per phase (or per phase-group) |
| Subtle motion on everything | Background haze that reads as "hidden video player" | Stillness for siblings; motion only for the focused element |

## Aesthetic baselines

When in doubt, anchor to known-good in-house references:

- **`docs/artifacts/notebooklm-review-mr-2.3.1/infographic-time-traveler.png`** — *The Chronometry of Code* infographic. Editorial / parchment palette. Strong because it has a metaphor (chronometer dials, timetravel logbook), not just a process diagram.
- **`docs/artifacts/notebooklm-review-mr-2.3.1/video-whiteboard.mp4`** — NotebookLM-rendered whiteboard explainer. Strong because it has a spoken narrative + cinematic camera pans across hand-drawn elements.
- **`docs/artifacts/review-mr-business-context-playground.html`** — interactive playground for the same content. Strong because each viewer chooses their path, not a forced linear order.

What these share: each picks a metaphor or an interaction model, then commits to it. Generic AI defaults pick none and hope motion alone carries the work.

## Density check before rendering

Before triggering `npx remotion render`, audit the spec:

- [ ] Every phase's `description` field is ≤ 15 words OR explicitly flagged for narration-only
- [ ] No two consecutive phases share `visual_style`
- [ ] Exactly one phase has `hero: true`
- [ ] Each phase's `duration_frames` ≥ 240 (8 seconds)
- [ ] First phase opens with what the viewer will learn (not a generic title)
- [ ] Last phase restates the takeaway in ≤ 10 words
- [ ] Each phase has a distinct `accent_color`

If any check fails, fix the spec before rendering. Re-rendering takes 30-90s; spec audit takes 30 seconds.

## When the user asks "make it less boring"

Three diagnostic questions, in order:

1. **Is there a hero phase?** If no, pick one and apply a cinematic template (see `cinematic-templates.md`).
2. **Is the text density too high?** If any phase has paragraph-length on-screen text, that's the dominant problem.
3. **Are all phases visually identical in structure?** If yes, mix `visual_style` across phases.

Most "boring" complaints resolve at step 1 alone. The hero phase is the single highest-leverage lever the skill has.
