#!/usr/bin/env node
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

var HOME = os.homedir();
var CLAUDE_DIR = path.join(HOME, ".claude");
var POLICY_FILE = path.join(CLAUDE_DIR, "repo-access-policy.json");
var ZSHRC = path.join(HOME, ".zshrc");
var MARKER_BEGIN = "# >>> claude-repo-access-guard >>>";
var MARKER_END = "# <<< claude-repo-access-guard <<<";
var DEFAULT_POLICY = {
  $comment: "Repos restricted to AWS Bedrock users only. See commands/setup-repo-access-guard.md",
  bedrock_only: []
};
var WRAPPER_BLOCK = `${MARKER_BEGIN}
# DevOps: Repo Access Guard
# Blocks Anthropic subscription users from restricted repos.
# See ~/.claude/repo-access-policy.json for the policy.
_claude_check_repo_access() {
  local remote_url="$1" policy_file="$2"
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
  policy_file="\${HOME}/.claude/repo-access-policy.json"
  matched=""

  if [ -n "$remote_url" ] && [ -f "$policy_file" ]; then
    matched=$(_claude_check_repo_access "$remote_url" "$policy_file")
  fi

  if [ -n "$matched" ] && [ "\${CLAUDE_CODE_USE_BEDROCK:-0}" != "1" ]; then
    printf '\\033[31m\u{1F6AB} Access denied\\033[0m: This repository requires AWS Bedrock authentication.\\n\\n'
    printf '   Restricted repo: %s\\n' "$matched"
    printf '   Remote URL:      %s\\n\\n' "$remote_url"
    printf '   To access this repo:\\n'
    printf '     export CLAUDE_CODE_USE_BEDROCK=1\\n'
    printf '   Then configure AWS credentials for the Bedrock endpoint.\\n'
    return 1
  fi

  command claude "$@"
}
${MARKER_END}`;
function info(msg) {
  console.log(`  \x1B[32m\u2713\x1B[0m ${msg}`);
}
function warn(msg) {
  console.log(`  \x1B[33m\u26A0\x1B[0m ${msg}`);
}
function header(msg) {
  console.log(`
\x1B[1m${msg}\x1B[0m`);
}
function ensureClaudeDir() {
  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    info("Created ~/.claude/");
  }
}
function setupPolicy() {
  if (!fs.existsSync(POLICY_FILE)) {
    fs.writeFileSync(POLICY_FILE, `${JSON.stringify(DEFAULT_POLICY, null, 2)}
`);
    info(`Created ${POLICY_FILE}`);
    return;
  }
  let existing;
  try {
    existing = JSON.parse(fs.readFileSync(POLICY_FILE, "utf-8"));
  } catch {
    warn(`Could not parse ${POLICY_FILE} \u2014 skipping merge`);
    return;
  }
  const existingEntries = new Set(existing.bedrock_only ?? []);
  const added = [];
  for (const entry of DEFAULT_POLICY.bedrock_only) {
    if (!existingEntries.has(entry)) {
      if (!existing.bedrock_only) {
        existing.bedrock_only = [];
      }
      existing.bedrock_only.push(entry);
      added.push(entry);
    }
  }
  if (added.length > 0) {
    fs.writeFileSync(POLICY_FILE, `${JSON.stringify(existing, null, 2)}
`);
    info(`Merged new entries into policy: ${added.join(", ")}`);
  } else {
    info("Policy file already up to date");
  }
}
function stripMarkerBlock(lines) {
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (line.trimEnd() === MARKER_BEGIN) {
      inside = true;
      continue;
    }
    if (line.trimEnd() === MARKER_END) {
      inside = false;
      continue;
    }
    if (!inside) {
      out.push(line);
    }
  }
  while (out.length > 0 && out[out.length - 1]?.trim() === "") {
    out.pop();
  }
  return out;
}
function setupZshrc() {
  if (!fs.existsSync(ZSHRC)) {
    fs.writeFileSync(ZSHRC, "");
  }
  const content = fs.readFileSync(ZSHRC, "utf-8");
  if (content.includes(MARKER_BEGIN)) {
    const out = stripMarkerBlock(content.split("\n"));
    out.push("");
    out.push(WRAPPER_BLOCK);
    out.push("");
    fs.writeFileSync(ZSHRC, out.join("\n"));
    info(`Updated shell wrapper in ${ZSHRC}`);
  } else {
    const suffix = content.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(ZSHRC, `${content}${suffix}
${WRAPPER_BLOCK}
`);
    info(`Installed shell wrapper in ${ZSHRC}`);
  }
}
function printSummary() {
  header("Done!");
  console.log("\n  To activate, run:");
  console.log("    \x1B[1msource ~/.zshrc\x1B[0m\n");
  console.log("  Or restart your terminal.\n");
}
function main() {
  header("Setting up repo-access guard...");
  ensureClaudeDir();
  setupPolicy();
  setupZshrc();
  printSummary();
}
main();
//# sourceMappingURL=setup-repo-guard.js.map
//# sourceMappingURL=setup-repo-guard.js.map