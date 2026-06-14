#!/usr/bin/env node
/**
 * setup-repo-guard.ts — Standalone installer for the Claude repo-access guard.
 *
 * Deploys a shell wrapper + policy file that blocks non-Bedrock users from
 * running Claude in restricted repositories. No plugin dependency required.
 *
 * Usage:
 *   npx tsx hooks/bin/setup-repo-guard.ts          # development
 *   node hooks/dist/bin/setup-repo-guard.js         # compiled
 *
 * Safe to re-run: merges policy entries and replaces the shell wrapper in-place.
 *
 * @module devops-hooks/bin/setup-repo-guard
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ── Paths ──────────────────────────────────────────────────────────────────
const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const POLICY_FILE = path.join(CLAUDE_DIR, 'repo-access-policy.json');
const ZSHRC = path.join(HOME, '.zshrc');

const MARKER_BEGIN = '# >>> claude-repo-access-guard >>>';
const MARKER_END = '# <<< claude-repo-access-guard <<<';

// ── Embedded default policy ────────────────────────────────────────────────
interface RepoAccessPolicy {
  $comment?: string;
  bedrock_only: string[];
}

const DEFAULT_POLICY: RepoAccessPolicy = {
  $comment: 'Repos restricted to AWS Bedrock users only. See commands/setup-repo-access-guard.md',
  bedrock_only: [],
};

// ── Embedded shell wrapper ─────────────────────────────────────────────────
// Installed between marker comments in ~/.zshrc.
const WRAPPER_BLOCK = `${MARKER_BEGIN}
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
    printf '\\033[31m🚫 Access denied\\033[0m: This repository requires AWS Bedrock authentication.\\n\\n'
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

// ── Output helpers ─────────────────────────────────────────────────────────
function info(msg: string): void {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}

function warn(msg: string): void {
  console.log(`  \x1b[33m⚠\x1b[0m ${msg}`);
}

function header(msg: string): void {
  console.log(`\n\x1b[1m${msg}\x1b[0m`);
}

// ── Step 1: Create ~/.claude/ ──────────────────────────────────────────────
function ensureClaudeDir(): void {
  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    info('Created ~/.claude/');
  }
}

// ── Step 2: Write/merge policy file ────────────────────────────────────────
function setupPolicy(): void {
  if (!fs.existsSync(POLICY_FILE)) {
    fs.writeFileSync(POLICY_FILE, `${JSON.stringify(DEFAULT_POLICY, null, 2)}\n`);
    info(`Created ${POLICY_FILE}`);
    return;
  }

  // Merge: add any missing bedrock_only entries from the default policy
  let existing: RepoAccessPolicy;
  try {
    existing = JSON.parse(fs.readFileSync(POLICY_FILE, 'utf-8')) as RepoAccessPolicy;
  } catch {
    warn(`Could not parse ${POLICY_FILE} — skipping merge`);
    return;
  }

  const existingEntries = new Set(existing.bedrock_only ?? []);
  const added: string[] = [];

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
    fs.writeFileSync(POLICY_FILE, `${JSON.stringify(existing, null, 2)}\n`);
    info(`Merged new entries into policy: ${added.join(', ')}`);
  } else {
    info('Policy file already up to date');
  }
}

// ── Step 3: Install/update shell wrapper in ~/.zshrc ───────────────────────

/** Strip existing marker block from lines and return lines outside the block. */
function stripMarkerBlock(lines: string[]): string[] {
  const out: string[] = [];
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

  // Remove trailing blank lines before appending new block
  while (out.length > 0 && out[out.length - 1]?.trim() === '') {
    out.pop();
  }
  return out;
}

function setupZshrc(): void {
  if (!fs.existsSync(ZSHRC)) {
    fs.writeFileSync(ZSHRC, '');
  }

  const content = fs.readFileSync(ZSHRC, 'utf-8');

  if (content.includes(MARKER_BEGIN)) {
    const out = stripMarkerBlock(content.split('\n'));
    out.push('');
    out.push(WRAPPER_BLOCK);
    out.push(''); // trailing newline

    fs.writeFileSync(ZSHRC, out.join('\n'));
    info(`Updated shell wrapper in ${ZSHRC}`);
  } else {
    const suffix = content.endsWith('\n') ? '' : '\n';
    fs.writeFileSync(ZSHRC, `${content}${suffix}\n${WRAPPER_BLOCK}\n`);
    info(`Installed shell wrapper in ${ZSHRC}`);
  }
}

// ── Step 4: Summary ────────────────────────────────────────────────────────
function printSummary(): void {
  header('Done!');
  console.log('\n  To activate, run:');
  console.log('    \x1b[1msource ~/.zshrc\x1b[0m\n');
  console.log('  Or restart your terminal.\n');
}

// ── Main ───────────────────────────────────────────────────────────────────
function main(): void {
  header('Setting up repo-access guard...');
  ensureClaudeDir();
  setupPolicy();
  setupZshrc();
  printSummary();
}

main();
