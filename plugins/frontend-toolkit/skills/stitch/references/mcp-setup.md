# Stitch MCP Server Setup

## Table of Contents

- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Verify Setup](#verify-setup)
- [1Password Integration](#1password-integration)
- [Troubleshooting](#troubleshooting)

---

## How It Works

The `/stitch` skill uses a local MCP server (`stitch-server.ts`) that wraps the `@google/stitch-sdk`. The server runs as a stdio subprocess of Claude Code, exposing 7 tools for generating, reading, editing, and exporting Stitch designs.

```
Claude Code  --stdio-->  stitch-server.ts  --SDK-->  Stitch API (Google)
                         (local MCP server)          (Gemini-powered)
```

No Google Cloud project required. Auth is via a Stitch API key.

## Prerequisites

1. **Stitch API Key** -- generate at https://stitch.withgoogle.com/ → Settings → API Keys
2. **Node.js >= 18** and **npm**
3. **Dependencies installed**: `cd plugins/frontend-toolkit/mcp && npm install  # monorepo dev only; installed plugins bundle deps into mcp/dist/`

## Configuration

The project `.mcp.json` (gitignored) registers the server:

```json
{
  "mcpServers": {
    "stitch": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/mcp/dist/stitch-server.js"],
      "env": {
        "STITCH_API_KEY": "${STITCH_API_KEY}"
      }
    }
  }
}
```

`STITCH_API_KEY` must be set in the shell environment before launching Claude Code.

## Verify Setup

After configuring, restart Claude Code and verify tools are available:

```
Ask Claude: "List available Stitch MCP tools"
Expected: 7 tools (stitch_list_projects, stitch_list_screens, stitch_generate,
          stitch_edit, stitch_get_html, stitch_get_image, stitch_extract_design)
```

If tools don't appear:
1. Check `STITCH_API_KEY` is set: `echo $STITCH_API_KEY`
2. Test server manually: `STITCH_API_KEY=your-key node ${CLAUDE_PLUGIN_ROOT}/mcp/dist/stitch-server.js`
3. Check stderr output for error messages
4. Ensure dependencies are installed: `cd plugins/frontend-toolkit/mcp && npm install  # monorepo dev only; installed plugins bundle deps into mcp/dist/`

## 1Password Integration

Store the API key securely and load via login shell:

```bash
# In ~/.zshrc (inside login-shell guard block)
[[ -o login ]] && [[ -z "$STITCH_API_KEY" ]] && \
  export STITCH_API_KEY=$(op item get "Google Stitch API Key" \
    --field credential --reveal 2>/dev/null)
```

This ensures:
- Key is fetched once per login shell (no repeated macOS permission dialogs)
- Subshells (including Claude Code) inherit the exported value
- Graceful fallback when `op` is unavailable

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Tools not appearing | Ensure `STITCH_API_KEY` is exported before starting Claude Code |
| Auth error | Regenerate API key at stitch.withgoogle.com → Settings |
| `Cannot find module @google/stitch-sdk` | Run `cd plugins/frontend-toolkit/mcp && npm install  # monorepo dev only; installed plugins bundle deps into mcp/dist/` |
| Rate limit hit | 350 gen/month (Standard), 50/month (Experimental). Wait for reset |
| Empty HTML output | Screen may still be generating -- retry after a few seconds |
