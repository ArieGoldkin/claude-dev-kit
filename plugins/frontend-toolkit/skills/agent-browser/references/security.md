# agent-browser Security Features

## Table of Contents

- [Content Boundaries](#content-boundaries)
- [Domain Allowlist](#domain-allowlist)
- [Action Policies](#action-policies)
- [Encrypted State](#encrypted-state)
- [Auto-Expiry](#auto-expiry)
- [Best Practices](#best-practices)

## Content Boundaries

`--content-boundaries` wraps page content with LLM safety delimiters, preventing prompt injection from malicious page content.

```bash
agent-browser --content-boundaries navigate https://untrusted-site.com
agent-browser snapshot -i
# Page content wrapped with safety delimiters
```

## Domain Allowlist

Restrict navigation to approved domains:

```bash
agent-browser --allowed-domains "example.com,api.example.com" navigate https://example.com
# Attempting to navigate to other domains will be blocked
```

## Action Policies

Restrict allowed actions via policy file:

```bash
agent-browser --action-policy policy.json navigate https://example.com
```

Policy file format:

```json
{
  "allowed_actions": ["navigate", "snapshot", "click", "fill", "screenshot"],
  "blocked_actions": ["eval", "cookies set", "storage local set"],
  "allowed_domains": ["example.com"]
}
```

## Encrypted State

State files (auth vault, session data) encrypted with AES-256-GCM:

```bash
export AGENT_BROWSER_ENCRYPTION_KEY="your-64-char-hex-key"
agent-browser auth save myapp   # Saved encrypted
agent-browser auth login myapp  # Decrypted on load
```

Generate a key: `openssl rand -hex 32`

## Auto-Expiry

`AGENT_BROWSER_STATE_EXPIRE_DAYS=30` -- auto-delete states older than N days.

```bash
export AGENT_BROWSER_STATE_EXPIRE_DAYS=30
agent-browser state clean  # Manual cleanup of expired states
```

## Best Practices

- Always use `--content-boundaries` when visiting untrusted sites
- Set `--allowed-domains` in automation scripts to prevent navigation hijacking
- Use `AGENT_BROWSER_ENCRYPTION_KEY` when saving authentication state
- Use action policies in CI/CD environments to restrict dangerous operations
- Do not log or expose the encryption key
- Combine domain allowlist with action policies for defense in depth
