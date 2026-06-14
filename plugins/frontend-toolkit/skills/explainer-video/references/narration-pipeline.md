# Narration pipeline

Pre-render narration to a single audio file before video render. Live TTS at render time desyncs — never do it.

## Script format

Narration scripts live inside the spec YAML (per the pattern reference's schema). Two shapes are supported:

**Per-segment**:
```yaml
narration:
  - segment: "Sentence to speak."
    start_seconds: 0      # OR start_frame, not both
  - segment: "Second sentence."
    start_seconds: 6
```

**Per-phase / per-id** (for `flow-pipeline`, `state-machine`):
```yaml
narration_script:
  - phase_id: phase_0
    text: "The pipeline starts by reading the merge request's metadata."
  - phase_id: phase_1
    text: "Phase 1 fetches the MR diff and the linked ticket."
```

The skill normalizes both shapes into an internal `[{text, start_frame, duration_frame}]` list before TTS.

## ElevenLabs TTS

Set `ELEVENLABS_API_KEY` as an environment variable before invoking the skill. The skill reads it; never inline keys into the spec.

```bash
export ELEVENLABS_API_KEY=...
# Optional voice tuning:
export ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # default voice if unset
export ELEVENLABS_MODEL_ID=eleven_turbo_v2         # default model if unset
```

The skill makes ONE call per segment (or one batched call if the segments are short and contiguous), saves each result to `public/narration-<segment-id>.mp3`, and computes durations.

For a single combined audio track (often easier than per-segment files):

1. Generate each segment's audio.
2. Concatenate via `ffmpeg -f concat -i segments.txt -c copy public/narration.mp3`.
3. Mount with `<Audio src={staticFile('narration.mp3')} />` in the Composition.

## Audio sync

In the Composition, mount narration with explicit timing:

```tsx
import { Audio, staticFile, Sequence } from 'remotion';

// Single combined track:
<Audio src={staticFile('narration.mp3')} />

// Per-segment tracks aligned to their start frames:
{narrationSegments.map(seg => (
  <Sequence key={seg.id} from={seg.start_frame} durationInFrames={seg.duration_frame}>
    <Audio src={staticFile(`narration-${seg.id}.mp3`)} />
  </Sequence>
))}
```

Both work. The combined-track approach is simpler but assumes you know the total visual duration matches the audio duration. The per-segment approach lets the visuals re-time without re-rendering audio, at the cost of more book-keeping.

## Captions

Always render captions for accessibility, even when audio plays. Display the current segment's text in a lower-third overlay, opacity-driven by `interpolate` keyed to `start_frame`:

```tsx
const opacity = interpolate(frame, [seg.start_frame, seg.start_frame + 5, seg.end_frame - 5, seg.end_frame], [0, 1, 1, 0]);
```

This serves two purposes: accessibility, AND a fallback when narration is silent (no API key or graceful degradation).

## Graceful degradation

If `ELEVENLABS_API_KEY` is not set:

1. Skip TTS generation entirely.
2. Render the video silent.
3. Keep captions visible (they were already needed for accessibility).
4. Return `STATUS: DONE_WITH_CONCERNS` with the note "Rendered silent (ELEVENLABS_API_KEY not set); captions visible."

Do NOT block on TTS unavailability. Silent + captions is acceptable output.

## Hard rules

1. **Never live-TTS at render time.** Pre-render to file. Live TTS desyncs against the deterministic frame clock.
2. **Pre-existing audio files only in `public/`.** Remotion's `staticFile()` resolves from there. Files placed elsewhere won't be bundled into the render.
3. **Match audio duration to visual duration.** If the narration is longer than the visual, the trailing audio gets cut (and that's confusing). Either trim narration or extend the final visual segment to absorb the tail.
4. **Don't auto-generate per-frame TTS.** That's expensive (one API call per frame) AND violates rule #1. The natural unit of TTS is "a sentence per visual segment," not "frame-by-frame."

## Cost

ElevenLabs charges per character. A 60-second video typically has 100-150 words of narration ≈ 600-900 characters ≈ ~$0.02-0.05 per render at default tiers. Surface this to the user once when they first set up narration.
