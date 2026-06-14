# Video Recording

Record browser sessions as WebM videos for debugging, documentation, and auditing.

## Table of Contents

- [Basic Recording](#basic-recording)
- [Recording Commands](#recording-commands)
- [Output Format](#output-format)
- [Screenshots](#screenshots)
- [Common Patterns](#common-patterns)
  - [Record Entire Workflow](#record-entire-workflow)
  - [Record Only Specific Sections](#record-only-specific-sections)
  - [Segment Recording](#segment-recording)
- [Use Cases](#use-cases)
  - [Bug Documentation](#bug-documentation)
  - [Test Evidence](#test-evidence)
  - [User Flow Documentation](#user-flow-documentation)
- [Best Practices](#best-practices)
- [Limitations](#limitations)

## Basic Recording

```bash
# Start recording
agent-browser record start /path/to/recording.webm

# Perform actions
agent-browser open https://example.com
agent-browser snapshot -i
agent-browser click @e1
agent-browser fill @e2 "test value"

# Stop recording
agent-browser record stop
```

## Recording Commands

```bash
# Start new recording
agent-browser record start <output-path>

# Stop current recording
agent-browser record stop

# Restart recording (stop + start new file)
agent-browser record restart <new-output-path>
```

## Output Format

| Property | Value |
|----------|-------|
| Format | WebM |
| Codec | VP9 (since v0.20.1) |
| Audio | None (browser automation only) |
| Resolution | Matches viewport size |

## Screenshots

Capture individual frames with optional annotations:

```bash
# Basic screenshot
agent-browser screenshot /tmp/page.png

# Annotated screenshot with numbered element overlays
agent-browser screenshot --annotate /tmp/annotated.png

# Control format and quality
agent-browser screenshot --screenshot-format jpeg --screenshot-quality 80 /tmp/page.jpg
```

The `--annotate` flag overlays numbered labels on interactive elements, useful for E2E test evidence and bug reports.

## Common Patterns

### Record Entire Workflow

```bash
#!/bin/bash
OUTPUT="/tmp/user-journey-$(date +%Y%m%d-%H%M%S).webm"

agent-browser record start "$OUTPUT"

agent-browser open https://app.example.com
agent-browser snapshot -i
agent-browser click @e1
agent-browser wait navigation
agent-browser snapshot -i
agent-browser fill @e2 "search query"
agent-browser click @e3
agent-browser wait 2000
agent-browser screenshot /tmp/result.png

agent-browser record stop
echo "Recording saved to: $OUTPUT"
```

### Record Only Specific Sections

```bash
#!/bin/bash
# Setup (not recorded)
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "$USERNAME"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3
agent-browser wait navigation

# Start recording for the important part
agent-browser record start /tmp/checkout-flow.webm

agent-browser open https://app.example.com/checkout
agent-browser snapshot -i
agent-browser fill @e1 "4242424242424242"
agent-browser fill @e2 "12/28"
agent-browser fill @e3 "123"
agent-browser click @e4
agent-browser wait navigation

agent-browser record stop
```

### Segment Recording

```bash
#!/bin/bash
agent-browser open https://app.example.com

# Record section 1
agent-browser record start /tmp/section1.webm
agent-browser snapshot -i
agent-browser click @e1
agent-browser wait navigation
agent-browser record stop

# Record section 2
agent-browser record start /tmp/section2.webm
agent-browser snapshot -i
agent-browser click @e2
agent-browser wait navigation
agent-browser record stop
```

## Use Cases

### Bug Documentation

```bash
#!/bin/bash
BUG_ID="ISSUE-123"
OUTPUT="/tmp/bug-$BUG_ID-$(date +%Y%m%d).webm"

agent-browser record start "$OUTPUT"

agent-browser open https://app.example.com/buggy-page
agent-browser snapshot -i
agent-browser click @e1
agent-browser screenshot --annotate "/tmp/bug-$BUG_ID.png"

agent-browser record stop
echo "Bug recording: $OUTPUT"
echo "Bug screenshot: /tmp/bug-$BUG_ID.png"
```

### Test Evidence

```bash
#!/bin/bash
TEST_NAME="checkout-flow"
EVIDENCE_DIR="/tmp/test-evidence/$(date +%Y%m%d)"
mkdir -p "$EVIDENCE_DIR"

agent-browser record start "$EVIDENCE_DIR/$TEST_NAME.webm"

agent-browser open https://app.example.com/checkout
# ... test execution ...

# Annotated screenshot as evidence
agent-browser screenshot --annotate "$EVIDENCE_DIR/$TEST_NAME-result.png"

agent-browser record stop
```

### User Flow Documentation

```bash
#!/bin/bash
FLOWS=("signup" "login" "checkout" "profile-update")

for flow in "${FLOWS[@]}"; do
    agent-browser record start "/docs/videos/$flow.webm"

    case $flow in
        signup) ;; # Signup flow steps
        login)  ;; # Login flow steps
    esac

    agent-browser record stop
done
```

## Best Practices

### 1. Name Recordings Descriptively

```bash
# Good
agent-browser record start "/tmp/checkout-$(date +%Y%m%d-%H%M%S).webm"

# Avoid
agent-browser record start "/tmp/recording.webm"
```

### 2. Set Viewport Before Recording

```bash
agent-browser viewport 1920 1080
agent-browser record start /tmp/hd-recording.webm
```

### 3. Use Trap for Cleanup

```bash
trap 'agent-browser record stop 2>/dev/null' EXIT
agent-browser record start /tmp/safe-recording.webm
```

### 4. Clean Up Old Recordings

```bash
find /tmp -name "*.webm" -mtime +7 -delete
```

## Limitations

- **Format**: WebM only (no MP4, GIF, etc.)
- **Codec**: VP9 only (since v0.20.1)
- **Audio**: No audio capture
- **Size**: Large files for long recordings (control with viewport size)
- **Real-time**: Cannot stream; file written on stop
- **Downloads**: Download behavior during recording fixed in v0.22.3
