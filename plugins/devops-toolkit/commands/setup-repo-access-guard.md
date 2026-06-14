---
description: Set up repo access guard to restrict specified repos to Bedrock users only. Run this once per developer machine.
---

# Setup Repo Access Guard

This command installs a two-layer enforcement system that prevents non-Bedrock users from running
Claude on restricted repositories.

**Why two layers?**

- **Layer 1 (shell wrapper)**: Intercepts the `claude` command before it starts — the real gate.
- **Layer 2 (SessionStart hook)**: Catches bypasses (non-zsh shells, direct invocation) by
  injecting a hard warning that makes Claude refuse to work.

## What to do

### Step 1 — Install the policy file

Copy the plugin's bundled policy to your home directory so the shell wrapper can find it:

```bash
mkdir -p ~/.claude
cp "${CLAUDE_PLUGIN_ROOT}/.claude/repo-access-policy.json" ~/.claude/repo-access-policy.json
```

If `~/.claude/repo-access-policy.json` already exists, check whether the required entries are
present:

```bash
cat ~/.claude/repo-access-policy.json
```

The file must contain a `bedrock_only` array with the restricted repo patterns. If entries are
missing, add them manually (merge, don't overwrite):

```json
{
  "$comment": "Repos restricted to AWS Bedrock users only. See commands/setup-repo-access-guard.md",
  "bedrock_only": [
    "your-org/restricted-repo-1",
    "your-org/restricted-repo-2"
  ]
}
```

> **Note**: Add the repo path patterns you want to restrict here
> (e.g. `"your-org/restricted-repo"`) and redeploy this policy file.

### Step 2 — Install the shell wrapper

Check if the wrapper is already in `~/.zshrc`:

```bash
grep -q '_claude_check_repo_access' ~/.zshrc && echo "Already installed" || echo "Not installed"
```

If **not installed**, append the wrapper to `~/.zshrc`. (The `\$1`/`\$2` below use the CC v2.1.163+ escape for a literal `$` before a digit — without it, slash-command argument substitution corrupts the function before it reaches the file.)

```bash
cat >> ~/.zshrc << 'ZSHRC_EOF'

# ─────────────────────────────────────────────────────────
# DevOps Plugin: Repo Access Guard
# Blocks Anthropic subscription users from restricted repos.
# See ~/.claude/repo-access-policy.json for the policy.
# ─────────────────────────────────────────────────────────
_claude_check_repo_access() {
  local remote_url="\$1" policy_file="\$2"
  python3 -c "
import json, sys
url, path = sys.argv[1], sys.argv[2]
try:
    policy = json.load(open(path))
    for p in policy.get('bedrock_only', []):
        if p in url: print(p); break
except: pass
" "$remote_url" "$policy_file" 2>/dev/null
}

claude() {
  local remote_url matched policy_file
  remote_url=$(git remote get-url origin 2>/dev/null) || remote_url=""
  policy_file="${HOME}/.claude/repo-access-policy.json"
  matched=""

  if [ -n "$remote_url" ] && [ -f "$policy_file" ]; then
    matched=$(_claude_check_repo_access "$remote_url" "$policy_file")
  fi

  if [ -n "$matched" ] && [ "${CLAUDE_CODE_USE_BEDROCK:-0}" != "1" ]; then
    printf '\033[31m🚫 Access denied\033[0m: This repository requires AWS Bedrock authentication.\n\n'
    printf '   Restricted repo: %s\n' "$matched"
    printf '   Remote URL:      %s\n\n' "$remote_url"
    printf '   To access this repo:\n'
    printf '     export CLAUDE_CODE_USE_BEDROCK=1\n'
    printf '   Then configure AWS credentials for the Bedrock endpoint.\n'
    return 1
  fi

  command claude "$@"
}
ZSHRC_EOF
```

If **already installed**, no action needed — skip this step.

### Step 3 — Reload your shell

```bash
source ~/.zshrc
```

Or restart your terminal.

### Step 4 — Verify

**Test in a restricted repo (should block):**

```bash
cd /path/to/restricted-repo
# Should print "🚫 Access denied" and exit 1 without launching Claude
claude --version
```

**Test in an unrestricted repo (should pass):**

```bash
cd /path/to/devops-plugin
# Should launch Claude normally
claude --version
```

**Test Bedrock bypass (should pass):**

```bash
cd /path/to/restricted-repo
export CLAUDE_CODE_USE_BEDROCK=1
# Should launch Claude normally (Bedrock users are allowed)
claude --version
unset CLAUDE_CODE_USE_BEDROCK
```

## Updating the restricted repo list

Edit `~/.claude/repo-access-policy.json` directly, or update the plugin's bundled
`.claude/repo-access-policy.json` and re-run `/setup-repo-access-guard` to push the update.

The SessionStart hook (`lifecycle/repo-access-guard`) reads the same policy file, so both
enforcement layers stay in sync automatically.
