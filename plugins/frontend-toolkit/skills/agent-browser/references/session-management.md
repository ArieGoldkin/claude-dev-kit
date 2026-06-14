# Session Management

Run multiple isolated browser sessions with state persistence, auto-save/restore, and encrypted storage.

## Table of Contents

- [Named Sessions](#named-sessions)
- [Session Names with Auto-Save/Restore](#session-names-with-auto-saverestore)
- [Session Isolation Properties](#session-isolation-properties)
- [State Commands](#state-commands)
- [Auth Vault](#auth-vault)
- [Encrypted State](#encrypted-state)
- [Idle Timeout](#idle-timeout)
- [State Auto-Cleanup](#state-auto-cleanup)
- [Common Patterns](#common-patterns)
  - [Authenticated Session Reuse](#authenticated-session-reuse)
  - [Concurrent Scraping](#concurrent-scraping)
  - [A/B Testing Sessions](#ab-testing-sessions)
- [Default Session](#default-session)
- [Session Cleanup](#session-cleanup)
- [Best Practices](#best-practices)

## Named Sessions

Use `--session` flag to isolate browser contexts:

```bash
# Session 1: Authentication flow
agent-browser --session auth open https://app.example.com/login

# Session 2: Public browsing (separate cookies, storage)
agent-browser --session public open https://example.com

# Commands are isolated by session
agent-browser --session auth fill @e1 "user@example.com"
agent-browser --session public get text body
```

## Session Names with Auto-Save/Restore

Use `--session-name <name>` (v0.10.0+) for automatic state persistence. The session state is saved on close and restored on next open:

```bash
# First run: performs login, state auto-saved as "myapp"
agent-browser --session-name myapp open https://app.example.com/login
# ... login flow ...
agent-browser close

# Next run: state auto-restored from "myapp"
agent-browser --session-name myapp open https://app.example.com/dashboard
# Already authenticated!
```

## Session Isolation Properties

Each session has independent:

| Resource | Isolated? |
|----------|-----------|
| Cookies | Yes |
| LocalStorage / SessionStorage | Yes |
| IndexedDB | Yes |
| Cache | Yes |
| Browsing history | Yes |
| Open tabs | Yes |

## State Commands

Manage saved states with the `state` subcommand (v0.10.0+):

```bash
# Save current session state
agent-browser state save myapp-auth

# Load a saved state
agent-browser state load myapp-auth

# List all saved states
agent-browser state list

# Show details of a saved state
agent-browser state show myapp-auth

# Rename a saved state
agent-browser state rename myapp-auth myapp-prod

# Delete a specific state
agent-browser state clear myapp-auth

# Delete expired states
agent-browser state clean
```

## Auth Vault

Save and restore authentication separately (v0.15.0):

```bash
# Save auth state (cookies, tokens) under a name
agent-browser auth save github

# Restore auth in a new session
agent-browser auth login github

# List saved auth entries
agent-browser state list
```

See [authentication.md](authentication.md) for full auth workflow patterns.

## Encrypted State

State files can be encrypted with AES-256-GCM:

```bash
export AGENT_BROWSER_ENCRYPTION_KEY="your-64-char-hex-key"

# All state save/load operations are now encrypted
agent-browser auth save myapp     # Saved encrypted
agent-browser auth login myapp    # Decrypted on load
agent-browser state save mystate  # Also encrypted
```

Generate a key: `openssl rand -hex 32`

## Idle Timeout

Auto-shutdown the daemon after inactivity:

```bash
# Daemon shuts down after 10 minutes of inactivity
agent-browser --idle-timeout 600000 open https://example.com
```

## State Auto-Cleanup

Set `AGENT_BROWSER_STATE_EXPIRE_DAYS` to auto-delete old states:

```bash
export AGENT_BROWSER_STATE_EXPIRE_DAYS=30
agent-browser state clean  # Deletes states older than 30 days
```

## Common Patterns

### Authenticated Session Reuse

```bash
#!/bin/bash
# Save login state once via auth vault, reuse many times

# Check if we have saved auth
if agent-browser auth login myapp 2>/dev/null; then
    agent-browser open https://app.example.com/dashboard
else
    # Perform login
    agent-browser open https://app.example.com/login
    agent-browser snapshot -i
    agent-browser fill @e1 "$USERNAME"
    agent-browser fill @e2 "$PASSWORD"
    agent-browser click @e3
    agent-browser wait navigation

    # Save for future use
    agent-browser auth save myapp
fi
```

### Concurrent Scraping

```bash
#!/bin/bash
# Scrape multiple sites concurrently

# Start all sessions
agent-browser --session site1 open https://site1.com &
agent-browser --session site2 open https://site2.com &
agent-browser --session site3 open https://site3.com &
wait

# Extract from each
agent-browser --session site1 get text body > site1.txt
agent-browser --session site2 get text body > site2.txt
agent-browser --session site3 get text body > site3.txt

# Cleanup
agent-browser --session site1 close
agent-browser --session site2 close
agent-browser --session site3 close
```

### A/B Testing Sessions

```bash
# Test different user experiences
agent-browser --session variant-a open "https://app.com?variant=a"
agent-browser --session variant-b open "https://app.com?variant=b"

# Compare
agent-browser --session variant-a screenshot /tmp/variant-a.png
agent-browser --session variant-b screenshot /tmp/variant-b.png
```

## Default Session

When `--session` is omitted, commands use the default session:

```bash
agent-browser open https://example.com
agent-browser snapshot -i
agent-browser close  # Closes default session
```

## Session Cleanup

```bash
# Close specific session
agent-browser --session auth close

# Force close (kills daemon for that session)
agent-browser --session auth close --force

# Delete all saved states
agent-browser state clean
```

## Best Practices

### 1. Name Sessions Semantically

```bash
# Good: clear purpose
agent-browser --session github-auth open https://github.com

# Avoid: generic names
agent-browser --session s1 open https://github.com
```

### 2. Use Auth Vault Instead of Manual State Files

```bash
# Preferred: auth vault
agent-browser auth save github

# Instead of: manual file management
# agent-browser state save /tmp/github-auth.json  (old pattern)
```

### 3. Encrypt Sensitive State

```bash
export AGENT_BROWSER_ENCRYPTION_KEY="$(openssl rand -hex 32)"
agent-browser auth save production-app
```

### 4. Set Idle Timeout in Automation

```bash
# Prevent orphaned daemons
agent-browser --idle-timeout 300000 open https://example.com
```
