# Authentication Flows

Patterns for handling login, OAuth, MFA, and authenticated sessions using the auth vault and browser profiles.

## Table of Contents

- [Authentication Methods](#authentication-methods)
- [Auth Vault](#auth-vault)
- [Auto-Connect from Running Chrome](#auto-connect-from-running-chrome)
- [Persistent Browser Profiles](#persistent-browser-profiles)
- [Form-Based Login](#form-based-login)
- [OAuth/SSO Flows](#oauthsso-flows)
- [MFA / 2FA Handling](#mfa--2fa-handling)
- [Session Token Extraction](#session-token-extraction)
- [Common Sites](#common-sites)
- [Security Best Practices](#security-best-practices)
- [Captcha Handling](#captcha-handling)

## Authentication Methods

| Method | Use Case | Complexity | User Involvement |
|--------|----------|------------|------------------|
| Auth vault (`auth save/login`) | Reusable named auth | Low | One-time login |
| `--auto-connect` | Import from running Chrome | Low | Already logged in |
| `--profile <path>` | Persistent browser profile | Low | First-time login |
| Form login | Username/password sites | Low | Credentials needed |
| OAuth/SSO popup | Google/GitHub/enterprise | Medium | User must complete |
| State restore | Reuse existing session | Low | Pre-export state |

### Decision Tree

```
Protected content needed
         |
         v
    Have auth vault entry?
         |
    +- Yes --> agent-browser auth login <name>
    |
    +- No --> Have running Chrome session?
                  |
             +- Yes --> agent-browser --auto-connect open <url>
             |
             +- No --> Check login type
                            |
                  +- Simple form --> Fill form with refs, then auth save
                  +- OAuth/SSO --> Use --headed, then auth save
```

## Auth Vault

Save and restore authentication state by name (v0.15.0):

```bash
# After logging in, save auth state
agent-browser auth save myapp

# In a new session, restore auth
agent-browser auth login myapp
agent-browser open https://app.example.com/dashboard
# Already authenticated!

# List saved auth entries
agent-browser state list
```

Encrypt vault entries with AES-256-GCM:

```bash
export AGENT_BROWSER_ENCRYPTION_KEY="your-64-char-hex-key"
agent-browser auth save myapp     # Encrypted on disk
agent-browser auth login myapp    # Decrypted on load
```

Generate a key: `openssl rand -hex 32`

## Auto-Connect from Running Chrome

Import authentication from an already-running Chrome instance (v0.16.0+):

```bash
# Connect to a running Chrome with remote debugging enabled
agent-browser --auto-connect open https://app.example.com

# Chrome must be started with remote debugging:
# google-chrome --remote-debugging-port=9222
```

This is useful when you are already logged into a site in your regular browser.

## Persistent Browser Profiles

Use `--profile <path>` for a persistent browser profile that retains cookies, localStorage, and login state across runs:

```bash
# First run: login is performed, profile saved to disk
agent-browser --profile ~/.agent-browser/profiles/work open https://app.example.com/login
# ... complete login ...
agent-browser close

# Next run: profile reloaded, still logged in
agent-browser --profile ~/.agent-browser/profiles/work open https://app.example.com/dashboard
```

## Form-Based Login

### Basic Login Flow

```bash
agent-browser open https://app.example.com/login
agent-browser snapshot -i

# Fill credentials (refs from snapshot)
agent-browser fill @e1 "$EMAIL"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3

agent-browser wait --url "**/dashboard"

# Save to auth vault for reuse
agent-browser auth save myapp
```

### Multi-Step Login (Email then Password)

```bash
agent-browser open https://app.example.com/login
agent-browser snapshot -i

# Step 1: Email
agent-browser fill @e1 "$EMAIL"
agent-browser click @e2  # Next button

# Step 2: Password
agent-browser wait --fn "document.querySelector('[type=password]') !== null"
agent-browser snapshot -i
agent-browser fill @e1 "$PASSWORD"
agent-browser click @e2  # Sign in button

agent-browser wait --url "**/dashboard"
agent-browser auth save myapp
```

### Handle Login Errors

```bash
ERROR=$(agent-browser eval "
const err = document.querySelector('.error-message, .alert-error, [role=\"alert\"]');
err ? err.innerText : '';
")

if [[ -n "$ERROR" ]]; then
    echo "Login failed: $ERROR"
fi
```

## OAuth/SSO Flows

For OAuth (Google, GitHub) and SSO, use headed mode for user interaction:

```bash
AGENT_BROWSER_HEADED=1 agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser click @e4  # "Sign in with Google"

echo "Please complete sign-in in the browser window..."
agent-browser wait --url "**/dashboard" --timeout 120000

# Save to auth vault
agent-browser auth save myapp-oauth
```

## MFA / 2FA Handling

### TOTP (Authenticator App)

```bash
# Requires: oathtool for TOTP generation
TOTP_SECRET="YOUR_BASE32_SECRET"

# After password login
agent-browser snapshot -i
MFA_CODE=$(oathtool --totp -b "$TOTP_SECRET")
agent-browser fill @e1 "$MFA_CODE"
agent-browser click @e2
agent-browser wait --url "**/dashboard"

# Save post-MFA state
agent-browser auth save myapp
```

### Manual Code Entry

```bash
agent-browser snapshot -i
echo "MFA code required. Enter the code:"
read MFA_CODE
agent-browser fill @e1 "$MFA_CODE"
agent-browser click @e2
agent-browser wait --url "**/dashboard"
```

## Session Token Extraction

```bash
# Extract auth tokens for API use
agent-browser eval "localStorage.getItem('authToken')"
agent-browser eval "sessionStorage.getItem('jwt')"
agent-browser eval "document.cookie"
```

## Common Sites

### GitHub Private Repos

```bash
agent-browser auth login github
agent-browser open https://github.com/org/private-repo
agent-browser wait --load networkidle
```

### Confluence/Jira (SSO)

```bash
AGENT_BROWSER_HEADED=1 agent-browser open https://company.atlassian.net
echo "Complete SSO authentication..."
agent-browser wait --url "**/wiki" --timeout 120000
agent-browser auth save atlassian
```

### Notion

```bash
AGENT_BROWSER_HEADED=1 agent-browser open https://notion.so
echo "Complete Notion login..."
agent-browser wait --url "**/workspace"
agent-browser auth save notion
```

## Security Best Practices

### 1. Never Hardcode Credentials

```bash
# Wrong
agent-browser fill @e1 "hardcoded@email.com"

# Correct -- use environment variables
agent-browser fill @e1 "$APP_USERNAME"
```

### 2. Encrypt Auth Vault

```bash
export AGENT_BROWSER_ENCRYPTION_KEY="$(openssl rand -hex 32)"
agent-browser auth save production-app
```

### 3. Clean Up When Done

```bash
trap 'agent-browser state clear myapp' EXIT
```

### 4. Set Expiry for Saved State

```bash
export AGENT_BROWSER_STATE_EXPIRE_DAYS=30
agent-browser state clean  # Remove expired entries
```

## Captcha Handling

agent-browser cannot solve captchas automatically. Options:

1. **Use accounts without captcha** (trusted devices/IP allowlists)
2. **Manual intervention** with headed mode
3. **External captcha-solving services** (API integration)

```bash
agent-browser snapshot -i
if agent-browser get text body | grep -q "captcha"; then
    echo "Captcha detected. Please solve manually."
    AGENT_BROWSER_HEADED=1 agent-browser open "$(agent-browser get url)"
    read
fi
```
