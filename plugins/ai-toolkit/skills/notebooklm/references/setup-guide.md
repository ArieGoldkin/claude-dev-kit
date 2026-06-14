# NotebookLM Setup Guide

## Table of Contents
- [Installation](#installation)
- [Authentication](#authentication)
- [Environment Variables](#environment-variables)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Installation

```bash
# Core CLI + Python API
pip install notebooklm-py

# With browser auth support (recommended for first-time setup)
pip install "notebooklm-py[browser]"
playwright install chromium
```

Requires Python 3.10+.

## Authentication

First-time login opens a browser for Google OAuth:

```bash
notebooklm login
```

Tokens are stored locally in `~/.notebooklm/` (or `$NOTEBOOKLM_HOME`).

### CI/CD Authentication

For headless environments, export auth credentials:

```bash
export NOTEBOOKLM_AUTH_JSON='{"cookies": "...", "csrf_token": "..."}'
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NOTEBOOKLM_HOME` | Custom config/data directory | `~/.notebooklm` |
| `NOTEBOOKLM_AUTH_JSON` | Inline auth for CI/CD | (none) |

## Verification

```bash
notebooklm --version           # Confirm installed version
notebooklm auth check --test   # Full auth validation with network test
notebooklm list                # List notebooks (confirms API access)
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `command not found: notebooklm` | `pip install notebooklm-py` or check PATH |
| Auth expired / CSRF error | Re-run `notebooklm login` |
| Rate limited | Wait 5-10 minutes, then retry |
| Playwright not found | `pip install "notebooklm-py[browser]" && playwright install chromium` |
| Multiple agents conflict | Use `-n <id>` or separate `NOTEBOOKLM_HOME` dirs |

## Language Configuration

```bash
notebooklm language list       # Show 80+ supported languages
notebooklm language set en     # Set default language
notebooklm language get        # Check current language
```

Language is a global account setting. Override per-command with `--language <code>`.
