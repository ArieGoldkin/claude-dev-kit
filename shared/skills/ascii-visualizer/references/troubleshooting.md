# ASCII Diagram Troubleshooting

## Alignment Breaks in Proportional Fonts

**Symptom**: Diagram looks fine in your editor but is misaligned in Slack, email, or a wiki.

**Cause**: Proportional fonts render characters at different widths (`W` is wider than `i`).

**Fix**: Always wrap diagrams in markdown code fences (triple backticks). Most renderers switch to a monospace font inside code blocks. If the target doesn't support code fences, prefix every line with 4 spaces.

## Width Overflow

**Symptom**: Diagram wraps or scrolls horizontally, breaking the visual layout.

**Fix**:
- Keep all lines under 80 characters
- Abbreviate labels: `Authentication Service` -> `Auth Svc`
- Stack components vertically instead of horizontally
- Split into multiple smaller diagrams connected by narrative text

## Character Encoding Issues

**Symptom**: Box-drawing characters (`─`, `│`, `┌`) display as `?` or garbled text.

**Cause**: Unicode box-drawing characters require UTF-8 encoding. Some terminals, email clients, and CI logs don't support them.

**Fix**: Use ASCII-only characters:
```
Unicode (fragile):    ASCII (safe):
┌────┐                +----+
│ Box│                | Box|
└────┘                +----+
```

## Copy-Paste Corruption

**Symptom**: Diagram looks correct in the source but columns shift after pasting.

**Causes**:
- Tab characters converted to spaces (or vice versa)
- Trailing whitespace stripped by the editor
- Smart quotes replacing straight quotes

**Fix**:
- Use spaces only (no tabs) inside diagrams
- Avoid trailing whitespace-dependent alignment
- Disable smart quote features when editing diagrams

## Markdown Renderer Differences

**Symptom**: Diagram renders differently in GitHub, GitLab, Confluence, or VS Code.

**Common issues**:
- Some renderers collapse multiple spaces inside code blocks
- Pipe characters (`|`) may be interpreted as table syntax outside code fences
- Backslash escaping varies between renderers

**Fix**:
- Always use fenced code blocks (not indented code blocks)
- Test in the target renderer before finalizing
- Avoid `|` outside code fences (use `\|` if required in markdown tables)

## ASCII Fallback Palette

When only basic ASCII is available (no extended characters at all):

```
Corners:     +
Horizontal:  -
Vertical:    |
Arrows:      > < ^ v
Dashed:      . . .
Crossing:    +
Trees:       +-- (branch)  |   (continue)  \-- (last)
```

This minimal set works in every terminal, editor, email client, and CI log.
