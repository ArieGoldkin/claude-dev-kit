# shadcn CLI Reference

## Table of Contents
- [General notes](#general-notes)
- [init](#init)
- [add](#add)
- [search](#search)
- [view](#view)
- [docs](#docs)
- [info](#info)
- [build](#build)
- [Templates](#templates)
- [Presets](#presets)
- [Switching presets](#switching-presets)

## General notes

- Always use the project's package runner: `npx shadcn@latest`, `pnpm dlx shadcn@latest`, or `bunx --bun shadcn@latest`
- Only use documented flags — do not invent or guess flags
- CLI auto-detects package manager from lockfile (no `--package-manager` flag exists)
- Configuration is read from `components.json`

## init

```bash
npx shadcn@latest init [components...] [options]
```

Initialize shadcn/ui in existing project or create new project (with `--name`).

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--template <t>` | `-t` | Template (next, vite, start, react-router, astro) | -- |
| `--preset [name]` | `-p` | Preset (named, code, or URL) | -- |
| `--yes` | `-y` | Skip confirmation | true |
| `--defaults` | `-d` | Use defaults (next + base-nova) | false |
| `--force` | `-f` | Force overwrite config | false |
| `--name <name>` | `-n` | Name for new project | -- |
| `--rtl` | | Enable RTL support | -- |
| `--reinstall` | | Re-install existing components | false |
| `--monorepo` | | Scaffold monorepo | -- |

`npx shadcn@latest create` is an alias.

## add

```bash
npx shadcn@latest add [components...] [options]
```

Accepts component names, registry-prefixed (`@magicui/shimmer-button`), URLs, or local paths.

| Flag | Short | Description |
|------|-------|-------------|
| `--dry-run` | | Preview changes without writing |
| `--diff [path]` | | Show diffs (implies dry-run) |
| `--view [path]` | | Show file contents (implies dry-run) |
| `--overwrite` | `-o` | Overwrite existing files |
| `--all` | `-a` | Add all available components |
| `--path <path>` | `-p` | Target path for component |

**When to use dry-run:**
- "What files will this add?" — `--dry-run`
- Before overwriting — `--diff` to preview
- Inspect source without installing — `--view`
- CSS changes — `--diff globals.css`

Prefer `add --dry-run/--diff/--view` over `view` command for project-context previews.

## search

```bash
npx shadcn@latest search <registries...> [options]
```

Fuzzy search across registries. Also aliased as `list`. Without `-q`, lists all items.

| Flag | Short | Description |
|------|-------|-------------|
| `--query <q>` | `-q` | Search query |
| `--limit <n>` | `-l` | Max items per registry (default: 100) |
| `--offset <n>` | `-o` | Items to skip |

## view

```bash
npx shadcn@latest view <items...>
```

Show item info including file contents. Use for browsing registry info without project context.

## docs

```bash
npx shadcn@latest docs <components...>
```

Returns resolved URLs for component docs, examples, and API references. Fetch the URLs to get content.

## info

```bash
npx shadcn@latest info
```

Shows framework, Tailwind version, aliases, base library, icon library, installed components, resolved paths. Run this first.

## build

```bash
npx shadcn@latest build [registry] [options]
```

Builds `registry.json` into individual JSON files. Default output: `./public/r`.

## Templates

| Value | Framework | Monorepo |
|-------|-----------|----------|
| next | Next.js | Yes |
| vite | Vite | Yes |
| start | TanStack Start | Yes |
| react-router | React Router | Yes |
| astro | Astro | Yes |
| laravel | Laravel | No |

## Presets

Three formats: named (`--preset base-nova`), code (`--preset a2r6bw`), URL.

Never decode preset codes manually — pass directly to CLI.

## Switching presets

Ask user first: reinstall, merge, or skip?

- **Reinstall**: `init --preset <code> --force --reinstall` — overwrites all component files
- **Merge**: `init --preset <code> --force --no-reinstall`, then smart merge per component
- **Skip**: `init --preset <code> --force --no-reinstall` — only updates config + CSS
