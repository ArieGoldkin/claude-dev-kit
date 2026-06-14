# Cross-Origin Iframe Testing Patterns

Testing third-party embeds (VideoAsk, Typeform, etc.) with agent-browser.

## Table of Contents

- [The Limitation](#the-limitation)
  - [What Works](#what-works)
  - [What Doesn't Work](#what-doesnt-work)
- [VideoAsk Integration Example](#videoask-integration-example)
- [Testing Patterns](#testing-patterns)
  - [Pattern 1: URL Change Detection (Recommended)](#pattern-1-url-change-detection-recommended)
  - [Pattern 2: postMessage Monitoring](#pattern-2-postmessage-monitoring)
  - [Pattern 3: Coordinate Clicks (Fragile)](#pattern-3-coordinate-clicks-fragile)
  - [Pattern 4: Headed Mode + Manual](#pattern-4-headed-mode-manual)
- [Troubleshooting](#troubleshooting)
- [Verification](#verification)
- [Related](#related)

## The Limitation

Browser same-origin policy prevents JavaScript access to cross-origin iframe content.

### What Works

| Capability | Command | Notes |
|------------|---------|-------|
| Detect iframe exists | `snapshot -i` | Shows iframe as element |
| Get iframe attributes | `get attr @e# src` | src, title, dimensions |
| Take screenshots | `screenshot` | Shows iframe visually |
| Coordinate clicks | `mouse move X Y && mouse down left && mouse up left` | Fragile |
| URL change detection | `get url`, `wait --url` | Reliable |
| postMessage listener | `eval "window.addEventListener..."` | Advanced |

### What Doesn't Work

| Attempt | Why It Fails |
|---------|--------------|
| `snapshot -i` inside iframe | Cross-origin blocked |
| `frame @e#` then `snapshot` | Can switch but can't inspect |
| `click @ref` on iframe elements | No refs available |
| `fill @ref` inside iframe | No refs available |

## VideoAsk Integration Example

**Component:** Your app's VideoAsk wrapper component (e.g., `src/features/actions/components/video-ask-view.tsx`)

**Common URL Variables Passed:**
- `#user_id=` - User identifier
- `#activity_id=` - Format: `{actionSlug}|{activitySlug}`
- `#env=` - Environment (dev/qa/prod)

**postMessage Events:**
- `videoask_question_presented` - Question shown
- `videoask_question_submitted` - Answer submitted (includes optionId)
- `videoask_submitted` - VideoAsk completed

**Navigation:** App routes based on `optionId` or `questionId` via route mapping config

## Testing Patterns

### Pattern 1: URL Change Detection (Recommended)

Most reliable approach - monitor parent app URL changes after VideoAsk completion.

```bash
agent-browser open http://localhost:5173/action/{slug}/videoask
agent-browser wait --load networkidle
INITIAL=$(agent-browser get url)

# Complete VideoAsk manually in headed mode
# OR use coordinate clicks

agent-browser wait --url "**/celebrate" --timeout 60000
```

### Pattern 2: postMessage Monitoring

Capture VideoAsk events via postMessage before interaction.

```bash
agent-browser eval "
window.__vaEvents = [];
window.addEventListener('message', e => {
  if (e.data?.type?.startsWith('videoask_')) {
    window.__vaEvents.push({type: e.data.type, optionId: e.data.optionId});
  }
});
"
# After interaction:
agent-browser eval "JSON.stringify(window.__vaEvents)"
```

### Pattern 3: Coordinate Clicks (Fragile)

Direct coordinate-based clicks - fragile but works for static layouts.

```bash
agent-browser screenshot /tmp/va-before.png
agent-browser mouse move 350 200  # Answer option area
agent-browser mouse down left && agent-browser mouse up left
sleep 2
agent-browser screenshot /tmp/va-after.png
```

### Pattern 4: Headed Mode + Manual

For complex interactions, use headed mode with manual completion.

```bash
agent-browser open http://localhost:5173/action/{slug} --headed
# Complete VideoAsk manually while observing
agent-browser get url  # Verify navigation occurred
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| No iframe in snapshot | Page not loaded | `wait --load networkidle` |
| Click misses target | Wrong coordinates | Take screenshot, recalculate |
| URL never changes | VideoAsk not completing | Use `--headed`, check config |
| postMessage not captured | Listener added late | Inject before navigation |
| "Frame not found" | Cross-origin restriction | Use URL/coordinate patterns |

## Verification

Test patterns work with these commands:

```bash
agent-browser open http://localhost:5173/explore --headed
# Login manually
agent-browser snapshot -i | grep iframe  # Verify iframe detected
agent-browser screenshot /tmp/test.png   # Verify visual capture
agent-browser get url                     # Verify URL detection
```

## Related

- [spa-extraction.md](spa-extraction.md) - General SPA content extraction
- [auth-handling.md](auth-handling.md) - Authentication patterns
- [auth-handling.md](auth-handling.md) - Authentication and credential handling
