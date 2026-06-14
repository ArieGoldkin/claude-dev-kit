# Explanation pacing

The `slop-avoidance.md` rules cover what NOT to do (TikTok pacing, gratuitous intros, dense text). This reference covers what TO do — five rules from the **education-video tradition** (3Blue1Brown, manim, Khan Academy) that Remotion's docs are silent on.

These rules are load-bearing for *explanation* videos as opposed to *marketing* videos. The audiences want different things: marketing wants attention captured; explanation wants understanding built.

## Rule 1 — One idea per beat. Hold ≥ 2s after motion settles

Marketing pacing: continuous motion, every frame doing something. Education pacing: motion, then **stillness**.

After any meaningful change on screen (a phase reveal, an arrow drawing, a card appearing), hold for at least 2 seconds (60 frames @ 30fps) where nothing moves. The viewer needs read-time AFTER motion ends, not during it.

```tsx
// In a phase with a 12s budget (360 frames):
// frames 0-90: build animation completes
// frames 90-330: HOLD — nothing animates, content is read
// frames 330-360: gentle exit (cross-fade or transition)
```

Concretely: every phase's last 30-50% of its frame budget should be visually static. If a phase's animations are still resolving past frame 60-70%, the budget is too short OR the content is too much. Cut content; don't compress motion.

## Rule 2 — Narration leads, visuals echo ~150ms behind

In explanation, the *idea* is the spoken (or read) sentence; the visual *confirms* the idea. Marketing reverses this: visual hook, then narration says "and that's why...".

Practical implication when you have narration:

```tsx
// Audio segment plays from frame 0 of the phase
<Audio src={narration} />

// Visual reveal lags ~5 frames (150ms @ 30fps)
const visualOpacity = interpolate(frame, [5, 17], [0, 1], { extrapolateRight: 'clamp' });
```

When you DON'T have narration (silent video with subtitles), put the *subtitle* text on screen first and let the diagrammatic visual echo behind it. This is the inverse of typical "show the diagram, then label it."

## Rule 3 — Persistent context. Dim, don't cut

Explainers BUILD; marketing REPLACES. A previous phase's diagram or content shouldn't disappear when the next phase begins — it should fade to ~20-30% opacity and persist as backdrop. The viewer keeps the prior idea in peripheral vision while the new one builds.

```tsx
// Default cross-fade (current pattern, marketing style):
const opacity = interpolate(frame, [0, 15, dur-15, dur], [0, 1, 1, 0]);

// Explainer-style persistent context:
const opacity = interpolate(frame, [0, 15, dur-15, dur], [0, 1, 1, 0.25]);
//                                                              ^^^^
//                          previous phase fades to dim, not gone
```

When does this NOT apply? When the next phase's content is structurally different (Phase 2 was a code block, Phase 3 is an architecture diagram — they don't share visual coordinates and dimming the code block clutters the new layout). In that case, full cross-fade is correct. The dim-don't-cut rule applies WITHIN a coherent visual story arc (e.g., a 3-step argument where each step adds to the prior).

For our 6-phase pipelines, the rule is more loosely interpreted: the **phase strip** at the top remains visible and shows progression — that's the persistent context. Within each phase's body, we can cross-fade.

## Rule 4 — Lower text density, longer on-screen time

Slop-avoidance gives the upper bound on text density (≤ 7 words at any moment). Explanation pacing gives the lower bound on **time-on-screen**:

| Text length | Minimum on-screen time |
|---|---|
| 1-3 words (headline) | 3 seconds (90 frames) |
| 4-7 words (one-line) | 5 seconds (150 frames) |
| Multiple lines (rare) | 8+ seconds (240+ frames) |

A reader needs ~250-350ms per word for comprehension; multiply by word count, then DOUBLE for any text the viewer needs to absorb actively. Marketing can violate this because the reader doesn't need to retain the words; explanation cannot.

Practical implication: phases shorter than 8s either have too few words (reduce decoration time) or too many (cut text or split into two phases).

## Rule 5 — No surprise cuts. Slow `springTiming` over fast `linearTiming`

Marketing video transitions: fast cuts (8-15 frames), wipes that *snap*, rapid montage. Explanation video transitions: slow, telegraphed, the viewer always knows what's coming.

```tsx
// Marketing-style transition timing
import { linearTiming } from '@remotion/transitions';
linearTiming({ durationInFrames: 8 });

// Explanation-style transition timing
import { springTiming } from '@remotion/transitions';
springTiming({ config: { damping: 200, stiffness: 80 } });
// 200 damping = critically over-damped = no overshoot, smooth settle
// 80 stiffness = slow ramp; the transition takes 25-40 frames
```

The over-damped spring with low stiffness is *intentionally* gentle. The viewer's attention drifts to the new content because it arrived gradually; an abrupt cut yanks attention against their will, which feels disrespectful in education contexts.

## Summary — "marketing pacing vs explanation pacing"

| Dimension | Marketing | Explanation |
|---|---|---|
| Motion vs stillness | Continuous motion | Motion + ≥2s hold |
| Lead element | Visual first, narration follows | Narration first, visual echoes |
| Prior context | Replaced (cut) | Persisted (dim, ~25%) |
| Time-on-screen per word | Minimal (~150ms/word) | Generous (~500ms+/word) |
| Transition timing | Fast cuts (8-15f) | Slow springs (25-40f, damping 200) |

When generating a video for `ftk:explainer-video`, default to explanation pacing. The skill's audience is engineers absorbing process flows, not viewers being sold to.

## When to break these rules

- **The video is a 30-second teaser** — marketing pacing is correct; this skill is the wrong tool (point to a Stitch / Figma route).
- **The audience already knows the content** (a refresher / certification quiz) — faster pacing is acceptable; viewers don't need build time.
- **The video is for asynchronous reference** (paused, scrubbed, replayed) — Rule 1 (hold time) becomes optional; viewers control their own pacing.

For default `ftk:explainer-video` invocations — engineers learning a process for the first time — all 5 rules apply.
