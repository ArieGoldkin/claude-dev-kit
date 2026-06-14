# agent-browser Commands Reference

For the full command reference (150+ commands, v0.22.x), see the canonical reference in the agent-browser skill:

**Reference**: Read `skills/agent-browser/references/commands.md`

## Quick Reference for Content Capture

The most common commands for content extraction workflows:

```bash
# Navigate and capture
agent-browser navigate <url>
agent-browser snapshot -i              # Interactive elements with refs
agent-browser snapshot -s              # Page structure (headings, landmarks)
agent-browser snapshot -d              # Detailed snapshot

# Extract content
agent-browser get text @ref            # Text content of element
agent-browser get html @ref            # HTML of element
agent-browser get value @ref           # Input value
agent-browser get attribute @ref "src" # Specific attribute
agent-browser eval "document.title"    # Custom JavaScript

# Capture visual evidence
agent-browser screenshot [path]        # Current viewport
agent-browser screenshot --full [path] # Full page
agent-browser screenshot --annotate [path] # With numbered element labels
agent-browser pdf [path]               # Save as PDF

# Batch multiple extractions
echo '[
  {"command": "get", "args": ["text", "@e1"]},
  {"command": "get", "args": ["text", "@e2"]},
  {"command": "screenshot", "args": ["page.png"]}
]' | agent-browser batch

# Authentication for protected content
agent-browser auth login <saved-name>  # Load saved auth state
agent-browser navigate <protected-url>

# Network capture
agent-browser network har start capture.har
# ... navigate and interact ...
agent-browser network har stop
```
