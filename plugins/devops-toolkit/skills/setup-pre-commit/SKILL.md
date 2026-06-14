---
name: setup-pre-commit
description: Set up Husky pre-commit hooks with lint-staged (Prettier or Biome), type checking, and tests in the current repo. Use when user wants to add pre-commit hooks, set up Husky, configure lint-staged, add commit-time formatting/typechecking/testing, or says "add pre-commit", "setup hooks for this repo", "wire up husky". Triggers on pre-commit, husky, lint-staged, prettier hook, biome hook, commit hook, setup hooks, format on commit.
---

# Setup Pre-Commit Hooks

## What This Sets Up

- **Husky** pre-commit hook
- **lint-staged** running a formatter on staged files
- **Formatter config** — Prettier OR Biome (choose by ecosystem)
- **typecheck** and **test** scripts in the pre-commit hook

## Steps

### 1. Detect package manager

Check for `package-lock.json` (npm), `pnpm-lock.yaml` (pnpm), `yarn.lock` (yarn), `bun.lockb` (bun). Use whichever is present. Default to npm if unclear.

### 2. Detect formatter preference

Inspect existing config OR ask the user:

- `biome.json` / `biome.jsonc` present → use Biome
- `.prettierrc*` / `prettier.config.*` present → use Prettier
- Neither → ask: **"Prettier (broader ecosystem) or Biome (faster, all-in-one)?"**

### 3. Install dependencies

For **Prettier**:

```
husky lint-staged prettier
```

For **Biome**:

```
husky lint-staged @biomejs/biome
```

Use the detected package manager (`npm install -D`, `pnpm add -D`, `yarn add -D`, `bun add -D`).

### 4. Initialize Husky

```bash
npx husky init
```

Creates `.husky/` and adds `prepare: "husky"` to `package.json`.

### 5. Create `.husky/pre-commit`

No shebang needed for Husky v9+:

```
npx lint-staged
npm run typecheck
npm run test
```

**Adapt**: replace `npm` with the detected package manager. If the repo lacks a `typecheck` or `test` script in `package.json`, omit those lines and tell the user (don't silently fail-shut).

### 6. Create `.lintstagedrc`

For **Prettier**:

```json
{
  "*": "prettier --ignore-unknown --write"
}
```

For **Biome**:

```json
{
  "*.{js,jsx,ts,tsx,json,jsonc,css}": "biome check --write --no-errors-on-unmatched"
}
```

### 7. Create formatter config (if missing)

For **Prettier** (`.prettierrc`):

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "printWidth": 80,
  "singleQuote": false,
  "trailingComma": "es5",
  "semi": true,
  "arrowParens": "always"
}
```

For **Biome** (`biome.json`):

```bash
npx biome init
```

Then customize as needed.

### 8. Verify

- [ ] `.husky/pre-commit` exists (Husky v9 auto-handles executable bit)
- [ ] `.lintstagedrc` exists
- [ ] `prepare` script in `package.json` is `"husky"`
- [ ] Formatter config exists (`.prettierrc` or `biome.json`)
- [ ] Run `npx lint-staged` to confirm it works on staged files

### 9. Smoke-test commit

Stage all changed/created files and commit with:

```
Add pre-commit hooks (husky + lint-staged + <formatter>)
```

The commit runs through the new pre-commit hooks — a good smoke test that everything wires up.

## Notes

- Husky v9+ doesn't need shebangs in hook files
- `prettier --ignore-unknown` skips files Prettier can't parse (images, lockfiles, etc.)
- Biome's `--no-errors-on-unmatched` is the equivalent escape hatch
- The pre-commit runs lint-staged first (fast, staged-only) then full typecheck and tests — fail-fast on format, slow-but-thorough on logic

## When NOT to use this skill

- **Python repos** — use the `pre-commit` framework (https://pre-commit.com) instead; different tool, same name-space
- **Monorepos with per-package hook configs** — needs `lint-staged` workspace setup, not covered here
- **Teams that enforce formatting at CI only** — some prefer this to avoid local-clock skew issues; respect the convention
- **`.husky/` already populated** — investigate the existing setup before overwriting

---

Adapted from [`github.com/mattpocock/skills/skills/misc/setup-pre-commit`](https://github.com/mattpocock/skills/tree/main/skills/misc/setup-pre-commit) (MIT, 2026-05-19 snapshot). Original by Matt Pocock. Extended with Biome alternative path and "when NOT to use" section for our environment.
